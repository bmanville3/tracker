import { MINUTE_MS } from "../constants";
import { supabase } from "../supabase";
import { CACHE_FACTORY } from "../swrCache";
import {
  AllOrNothing,
  AssociatedProgramFields,
  ISODate,
  ProgramRow,
  UUID,
  WorkoutExerciseLogRow,
  WorkoutExerciseSetLogRow,
  WorkoutLogRow,
} from "../types";
import { pageKey, requireGetUser, showAlert } from "../utils";
import { fetchExercises } from "./exerciseApi";
import {
  EditableExercise,
  EditableSet,
  EditableWorkout,
  FullDetachedWorkoutForMode,
} from "./workoutSharedApi";

export type FullAttachedWorkoutLog = FullDetachedWorkoutForMode<"log"> & {
  logId: UUID;
};
const TTL_MS = 15 * MINUTE_MS;
const WORKOUT_LOG_CACHE =
  CACHE_FACTORY.getOrCreateSwrKeyedCache<FullAttachedWorkoutLog>(
    "workoutLogCache",
    TTL_MS,
  );
const WORKOUT_LOG_QUERY_CACHE = CACHE_FACTORY.getOrCreateSwrKeyedCache<
  WorkoutLogRow[]
>("workoutQueryCache", TTL_MS);

/**
 * Updates or inserts the new full workout.
 *
 * WARNING: This function is NOT atomic. At any point if there is a failure,
 * we will be left in a half updated/inserted state. However, data is never
 * deleted until new data is fully inserted.
 *
 * TODO: Make this function atomic (all or nothing updates). This is going to require
 * offloading the logic to SQL.
 */
export async function upsertWorkoutLog(ctx: {
  payload: FullDetachedWorkoutForMode<"log">;
  workoutLogId?: UUID | null;
}): Promise<[boolean, UUID | null]> {
  const user = await requireGetUser();
  if (user === null) return [false, ctx.workoutLogId ?? null];
  const { payload, workoutLogId } = ctx;
  const { workout, exercises, sets } = payload;

  let payloadProgram: AllOrNothing<AssociatedProgramFields>;

  if (workout.program_row) {
    payloadProgram = {
      program_id: workout.program_row.id,
      day_in_week: workout.day_in_week,
      week_in_block: workout.week_in_block,
      block_in_program: workout.block_in_program,
    };
  } else {
    payloadProgram = {
      program_id: null,
      day_in_week: null,
      week_in_block: null,
      block_in_program: null,
    };
  }

  const runAll = async (): Promise<[boolean, UUID | null]> => {
    let command;
    let oldExercisesBeforeInsert: WorkoutExerciseLogRow[] | null = null;
    if (workoutLogId) {
      const { data: oldExercises, error: selectOldExercisesErr } =
        await supabase
          .from("workout_exercise_log")
          .select("*")
          .eq("workout_id", workoutLogId);
      if (selectOldExercisesErr) {
        showAlert(
          "Error fetching old exercises",
          selectOldExercisesErr.message,
        );
        return [false, workoutLogId];
      }
      oldExercisesBeforeInsert = oldExercises satisfies WorkoutExerciseLogRow[];

      const { program_row: _programRow, ...baseWorkout } = workout;
      const workoutRowPayload = {
        ...baseWorkout,
        ...payloadProgram,
        id: workoutLogId,
      } satisfies WorkoutLogRow;
      command = supabase.from("workout_log").upsert(workoutRowPayload);
    } else {
      const { program_row: _programRow, ...baseWorkout } = workout;
      const workoutRowPayload = {
        ...baseWorkout,
        ...payloadProgram,
      } satisfies Omit<WorkoutLogRow, "id">;
      command = supabase.from("workout_log").insert(workoutRowPayload);
    }
    const { data: workoutLogRow, error: workoutLogErr } = await command
      .select("*")
      .single();

    if (workoutLogErr) {
      showAlert("Error upserting workout log", workoutLogErr.message);
      return [false, workoutLogId ?? null];
    }

    const workoutLogNewRow = workoutLogRow as WorkoutLogRow;

    const exercisePayload: Omit<WorkoutExerciseLogRow, "id">[] = exercises.map(
      (ex, i) => {
        const {
          exercise,
          id: _oldId,
          workout_id: _oldWorkoutId,
          exercise_id: _oldExerciseId,
          exercise_index: _oldExerciseIndex,
          ...rest
        } = ex as WorkoutExerciseLogRow & { exercise: (typeof ex)["exercise"] };

        return {
          ...rest,
          exercise_id: exercise.id,
          exercise_index: i,
          workout_id: workoutLogNewRow.id,
        } satisfies Omit<WorkoutExerciseLogRow, "id">;
      },
    );

    const { data: insertedExercises, error: exerciseInsertionErr } =
      await supabase
        .from("workout_exercise_log")
        .insert(exercisePayload)
        .select("*");
    if (exerciseInsertionErr) {
      showAlert("Error inserting new exercises", exerciseInsertionErr.message);
      return [false, workoutLogNewRow.id];
    }
    const orderToExercise = Object.fromEntries(
      (insertedExercises satisfies WorkoutExerciseLogRow[]).map((ex) => [
        ex.exercise_index,
        ex.id,
      ]),
    );
    const setsPayloadFlattened: Omit<WorkoutExerciseSetLogRow, "id">[] =
      sets.flatMap((setsForExercise, exerciseIndex) =>
        setsForExercise.map((set, setIndex) => {
          const {
            id: _oldSetId,
            workout_exercise_id: _oldWorkoutExerciseId,
            ...rest
          } = set as WorkoutExerciseSetLogRow;

          return {
            ...rest,
            workout_exercise_id: orderToExercise[exerciseIndex],
            set_index: setIndex,
          } satisfies Omit<WorkoutExerciseSetLogRow, "id">;
        }),
      );

    const { error: setInsertionErr } = await supabase
      .from("workout_exercise_set_log")
      .insert(setsPayloadFlattened);
    if (setInsertionErr) {
      showAlert("Error inserting new sets", setInsertionErr.message);
      return [false, workoutLogNewRow.id];
    }

    if (
      workoutLogId &&
      oldExercisesBeforeInsert !== null &&
      oldExercisesBeforeInsert.length > 0
    ) {
      const oldExerciseIds = [...oldExercisesBeforeInsert.map((ex) => ex.id)];
      const { error: deleteOldSetsErr } = await supabase
        .from("workout_exercise_set_log")
        .delete()
        .in("workout_exercise_id", oldExerciseIds);
      if (deleteOldSetsErr) {
        showAlert("Error deleting old sets", deleteOldSetsErr.message);
        return [false, workoutLogNewRow.id];
      }
      const { error: deleteOldExercises } = await supabase
        .from("workout_exercise_log")
        .delete()
        .eq("workout_id", workoutLogId);
      if (deleteOldExercises) {
        showAlert("Error deleting old exercises", deleteOldExercises.message);
        return [false, workoutLogNewRow.id];
      }
    }
    return [true, workoutLogNewRow.id];
  };

  const [allScuccesful, newId] = await runAll();
  if (allScuccesful) {
    if (workoutLogId) {
      if (workoutLogId !== newId) {
        showAlert(`New id did not match old id ${workoutLogId} !== ${newId}`);
        WORKOUT_LOG_CACHE.clearAll();
      } else {
        WORKOUT_LOG_CACHE.set(workoutLogId, {
          ...payload,
          logId: workoutLogId,
        });
      }
    } else if (newId !== null) {
      WORKOUT_LOG_CACHE.set(newId, { ...payload, logId: newId });
    } else {
      showAlert("runAll() was successful but no id was returned");
      WORKOUT_LOG_CACHE.clearAll();
    }
  } else {
    // left in partial state -> too hard to recover so just refetch
    WORKOUT_LOG_CACHE.clearAll();
  }
  WORKOUT_LOG_QUERY_CACHE.clearAll();
  return [allScuccesful, newId];
}

export async function deleteWorkoutLog(workoutId: UUID): Promise<boolean> {
  // schema causes cascade and attached workout-exercises and workout-exercise-sets are deleted
  const { error } = await supabase
    .from("workout_log")
    .delete()
    .eq("id", workoutId);
  if (error) {
    showAlert("Error deleting workout log", error.message);
    return false;
  }
  WORKOUT_LOG_CACHE.delete(workoutId);
  WORKOUT_LOG_QUERY_CACHE.clearAll();
  return true;
}

export async function fullDetachedWorkoutLogFromWorkoutLogId(
  workoutId: UUID,
): Promise<FullAttachedWorkoutLog> {
  return WORKOUT_LOG_CACHE.fetch(workoutId, async () => {
    const { data, error } = await supabase
      .from("workout_log")
      .select("*")
      .eq("id", workoutId)
      .single();
    if (error) throw error;
    const row = data as WorkoutLogRow;
    return await fullDetachedWorkoutLogFromWorkoutLogRowCachless(row);
  });
}

export async function fullDetachedWorkoutLogFromWorkoutLogRowCachless(
  workoutLogRow: WorkoutLogRow,
): Promise<FullAttachedWorkoutLog> {
  // get the associated program if present
  let programRow: ProgramRow | null = null;
  if (workoutLogRow.program_id) {
    const { data: program, error: programErr } = await supabase
      .from("program")
      .select("*")
      .eq("id", workoutLogRow.program_id)
      .single();
    if (programErr) throw programErr;
    programRow = program satisfies ProgramRow;
  }

  // get the workout-exercise combination
  const { data: exerciseWorkouts, error: exWkErr } = await supabase
    .from("workout_exercise_log")
    .select("*")
    .eq("workout_id", workoutLogRow.id);
  if (exWkErr) throw exWkErr;
  const exWrkRows: WorkoutExerciseLogRow[] =
    exerciseWorkouts satisfies WorkoutExerciseLogRow[];
  const exWrkIds = [...exWrkRows.map((ex) => ex.id)];

  // get the actualy exercises with workout-exercise combos
  const exerciseIds = [...exWrkRows.map((ex) => ex.exercise_id)];
  const allExercises = await fetchExercises();
  exerciseIds.forEach((id) => {
    if (!allExercises.has(id)) {
      throw new Error(`Exercise id '${id}' not found`);
    }
  });

  // get the associated sets for each workout exercise combo
  let setRows: WorkoutExerciseSetLogRow[] = [];
  if (exWrkIds.length > 0) {
    const { data: sets, error: setErr } = await supabase
      .from("workout_exercise_set_log")
      .select("*")
      .in("workout_exercise_id", exWrkIds);
    if (setErr) throw setErr;
    setRows = sets as WorkoutExerciseSetLogRow[];
  }

  const exWrkToOrder = Object.fromEntries(
    exWrkRows.map((e) => [e.id, e.exercise_index]),
  );
  const groupedSets = new Map<UUID, [number, WorkoutExerciseSetLogRow[]]>();
  for (const s of setRows) {
    const key = s.workout_exercise_id;
    const existing = groupedSets.get(key);
    if (existing) {
      existing[1].push(s);
    } else {
      groupedSets.set(key, [exWrkToOrder[key], [s]]);
    }
  }

  const sortedExWrkRows = exWrkRows.sort(
    (a, b) => a.exercise_index - b.exercise_index,
  );

  const editableExercises: EditableExercise<"log">[] = sortedExWrkRows.map(
    (exWrk) => {
      return {
        ...exWrk,
        exercise: allExercises.get(exWrk.exercise_id)!,
      } satisfies EditableExercise<"log">;
    },
  );

  const editableSets: EditableSet<"log">[][] = sortedExWrkRows.map((exWrk) => {
    const entry = groupedSets.get(exWrk.id);
    const rows = entry ? entry[1] : [];
    return rows
      .sort((a, b) => a.set_index - b.set_index)
      .map((r) => r as EditableSet<"log">);
  });

  let editableWorkout: EditableWorkout<"log">;
  if (programRow !== null && workoutLogRow.block_in_program !== null) {
    editableWorkout = {
      ...workoutLogRow,
      program_row: programRow,
    } satisfies EditableWorkout<"log">;
  } else if (programRow === null && workoutLogRow.block_in_program === null) {
    editableWorkout = {
      ...workoutLogRow,
      program_row: null,
    } satisfies EditableWorkout<"log">;
  } else {
    throw new Error(
      `Mismatch. Both should be present or both null: programRow=${programRow}, workoutLogRow.block_in_program=${workoutLogRow.block_in_program}`,
    );
  }

  return {
    workout: editableWorkout,
    exercises: editableExercises,
    sets: editableSets,
    logId: workoutLogRow.id,
  };
}

export async function fetchLastNWorkoutLogs(
  n: number,
): Promise<FullAttachedWorkoutLog[]> {
  const key = pageKey("fetchLastNLogs", { n: n });
  const logs: WorkoutLogRow[] = await WORKOUT_LOG_QUERY_CACHE.fetch(
    key,
    async () => {
      const { data, error } = await supabase
        .from("workout_log")
        .select("*")
        .order("completed_on", { ascending: false })
        .limit(n);
      if (error) throw error;
      return data as WorkoutLogRow[];
    },
  );
  const fullWorkouts = await Promise.all(
    logs.map((log) =>
      WORKOUT_LOG_CACHE.fetch(log.id, () =>
        fullDetachedWorkoutLogFromWorkoutLogRowCachless(log),
      ),
    ),
  );
  return fullWorkouts
    .sort((a, b) => a.workout.name.localeCompare(b.workout.name))
    .sort((a, b) =>
      b.workout.completed_on.localeCompare(a.workout.completed_on),
    );
}

export async function fetchWorkoutLogsOnDate(
  date: ISODate,
): Promise<FullAttachedWorkoutLog[]> {
  const key = pageKey("fetchWorkoutLogOnDate", { date: date });
  const logs: WorkoutLogRow[] = await WORKOUT_LOG_QUERY_CACHE.fetch(
    key,
    async () => {
      const { data, error } = await supabase
        .from("workout_log")
        .select("*")
        .eq("completed_on", date);
      if (error) throw error;
      return data as WorkoutLogRow[];
    },
  );
  const fullWorkouts = await Promise.all(
    logs.map((log) =>
      WORKOUT_LOG_CACHE.fetch(log.id, () =>
        fullDetachedWorkoutLogFromWorkoutLogRowCachless(log),
      ),
    ),
  );
  return fullWorkouts;
}
