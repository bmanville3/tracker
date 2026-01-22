import { Database, supabase } from "../supabase";
import { CACHE_FACTORY } from "../swrCache";
import {
  AssociatedProgramFields,
  ExerciseRow,
  ISODate,
  ProgramRow,
  UUID,
  WorkoutExerciseLogRow,
  WorkoutExerciseSetLogRow,
  WorkoutLogRow,
} from "../types";
import { AllOrNothing, anyErrorToString, OmitNever, requireGetUser, showAlert } from "../utils";
import { EXERCISE_CACHE_NAME, fetchExercises } from "./exerciseApi";
import {
  EditableExercise,
  EditableSet,
  EditableWorkout,
  FullAttachedWorkout,
  FullDetachedWorkoutForMode,
} from "./workoutSharedApi";

export const FULL_WORKOUT_LOG_CACHE_NAME = "fullWorkoutLogCache";
/**
 * A mapping of WorkoutLogRow.UUIDs to FullAttachedWorkout<'log'>
 */
const FULL_WORKOUT_LOG_CACHE =
  CACHE_FACTORY.getOrCreateSwrKeyedCache<FullAttachedWorkout<'log'>>(
    FULL_WORKOUT_LOG_CACHE_NAME,
    null,
  );

export const WORKOUT_LOG_HEADER_CACHE_NAME = 'workoutLogHeaderCache';
// a user would realistically do 5 workouts a week * 52 weeks a year = 120 workouts a year
// workout log rows are actually small so we will do this so we do not have to worry about
// overlapping queries on the database (fetching date ranges, fetching last N workouts, etc)
/**
 * A user database cache of the workout_log table.
 */
const WORKOUT_LOG_HEADER_CACHE = CACHE_FACTORY.getOrCreateSwrIdCache<WorkoutLogRow>(WORKOUT_LOG_HEADER_CACHE_NAME, null);


CACHE_FACTORY.subscribe(async (e) => {
  if (e.cacheName === EXERCISE_CACHE_NAME && e.type === 'write' && e.key !== undefined) {
    const newExercise = (await fetchExercises()).get(e.key);
    if (!newExercise) {
      console.error(`Got write commit but ${e.key} could not be found in new exercises`);
      return;
    }
    const workoutsToUpdate: Map<UUID, FullAttachedWorkout<'log'>> = new Map();
    FULL_WORKOUT_LOG_CACHE.getInnerMap().forEach(workout => {
      if (workout.exercises.some((ex) => ex.exercise.id === e.key)) {
        workoutsToUpdate.set(workout.workoutId, {...workout, exercises: workout.exercises.map((ex) => {
          if (ex.exercise.id === e.key) {
            return {...ex, exercise: newExercise}
          } else {
            return ex;
          }
        })})
      }
    });
    FULL_WORKOUT_LOG_CACHE.setAll(workoutsToUpdate);
  }
});


export function databaseRowToWorkoutLogRow(
  data: Database["public"]["Tables"]["workout_log"]["Row"],
): WorkoutLogRow {
  const { block_in_program, week_in_block, day_in_week, program_id, ...rest } =
    data;
  let row: WorkoutLogRow;
  if (
    block_in_program === null &&
    week_in_block === null &&
    day_in_week === null &&
    program_id === null
  ) {
    row = { ...rest, block_in_program, week_in_block, day_in_week, program_id };
  } else if (
    block_in_program !== null &&
    week_in_block !== null &&
    day_in_week !== null &&
    program_id !== null
  ) {
    row = { ...rest, block_in_program, week_in_block, day_in_week, program_id };
  } else {
    console.error(
      `Retrieved a log from workout log that had partially null data for a workout program. Cannot load program '${data.program_id}'`,
    );
    const {
      block_in_program,
      week_in_block,
      day_in_week,
      program_id,
      ...rest
    } = data;
    row = {
      ...rest,
      block_in_program: null,
      week_in_block: null,
      day_in_week: null,
      program_id: null,
    };
  }
  return row;
}

export function databaseRowsToWorkoutLogRows(
  data: Database["public"]["Tables"]["workout_log"]["Row"][],
): WorkoutLogRow[] {
  return [...data.map((d) => databaseRowToWorkoutLogRow(d))];
}

export async function fetchAllWorkoutLogHeaders(): Promise<Map<UUID, WorkoutLogRow>> {
  return WORKOUT_LOG_HEADER_CACHE.fetch(async () => {
    const { data, error } = await supabase.from('workout_log').select('*');
    if (error) throw error;
    return databaseRowsToWorkoutLogRows(data)
  });
}

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
  const { user_id, program_row, ...baseWorkout } = workout;
  if (user_id && user_id !== user.user_id) {
    throw new Error(`Tried to upsert with user_id=${user_id} but user.user_id=${user.user_id}`);
  }

  let payloadProgram: AllOrNothing<AssociatedProgramFields>;

  if (program_row) {
    payloadProgram = {
      program_id: program_row.id,
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

  let command;
  let oldExerciseWorkoutsBeforeInsert: WorkoutExerciseLogRow[] | null = null;
  if (workoutLogId) {
    const {
      data: oldExerciseWorkouts,
      error: selectOldExerciseWorkoutsErr,
    } = await supabase
      .from("workout_exercise_log")
      .select("*")
      .eq("workout_id", workoutLogId);
    if (selectOldExerciseWorkoutsErr) {
      // nothing udpate
      showAlert(
        "Error fetching old exercises",
        selectOldExerciseWorkoutsErr.message,
      );
      return [false, workoutLogId];
    }
    oldExerciseWorkoutsBeforeInsert =
      oldExerciseWorkouts satisfies WorkoutExerciseLogRow[];

    const workoutRowPayload = {
      ...baseWorkout,
      ...payloadProgram,
      id: workoutLogId,
      user_id: user.user_id,
    } satisfies WorkoutLogRow;
    command = supabase.from("workout_log").upsert(workoutRowPayload);
  } else {
    const workoutRowPayload = {
      ...baseWorkout,
      ...payloadProgram,
      user_id: user.user_id,
    } satisfies OmitNever<WorkoutLogRow, "id">;
    command = supabase.from("workout_log").insert(workoutRowPayload);
  }
  const { data: workoutLogRow, error: workoutLogErr } = await command
    .select("*")
    .single();

  if (workoutLogErr) {
    // nothing to update since the first update failed
    showAlert("Error upserting workout log", workoutLogErr.message);
    return [false, workoutLogId ?? null];
  }
  let runAfter: () => void = () => {};
  try {
    const exercisePayload: OmitNever<WorkoutExerciseLogRow, "id">[] =
    exercises.map((ex, i) => {
      const { exercise, notes, superset_group } = ex;

      return {
        exercise_id: exercise.id,
        exercise_index: i,
        workout_id: workoutLogRow.id,
        notes,
        superset_group,
      } satisfies OmitNever<WorkoutExerciseLogRow, "id">;
    });

    const { data: insertedExercises, error: exerciseInsertionErr } =
      await supabase
        .from("workout_exercise_log")
        .insert(exercisePayload)
        .select("*");
    if (exerciseInsertionErr) throw exerciseInsertionErr;
    const exerciseWorkoutIndexToId = Object.fromEntries(
      (insertedExercises satisfies WorkoutExerciseLogRow[]).map((ex) => [
        ex.exercise_index,
        ex.id,
      ]),
    );
    const setsPayloadFlattened: OmitNever<WorkoutExerciseSetLogRow, "id">[] =
      sets.flatMap((setsForExercise, exerciseWorkoutIndex) =>
        setsForExercise.map((set, setIndex) => {
          return {
            ...set,
            workout_exercise_id: exerciseWorkoutIndexToId[exerciseWorkoutIndex],
            set_index: setIndex,
          } satisfies OmitNever<WorkoutExerciseSetLogRow, "id">;
        }),
      );

    const { error: setInsertionErr } = await supabase
      .from("workout_exercise_set_log")
      .insert(setsPayloadFlattened);
    if (setInsertionErr) throw setInsertionErr;

    if (
      workoutLogId &&
      oldExerciseWorkoutsBeforeInsert !== null &&
      oldExerciseWorkoutsBeforeInsert.length > 0
    ) {
      // deleting all old workout-exercises will cascade delete all workout-exercise-sets
      const oldExerciseWorkoutIds = [
        ...oldExerciseWorkoutsBeforeInsert.map((exWk) => exWk.id),
      ];
      const { error: deleteOldExercises } = await supabase
        .from("workout_exercise_log")
        .delete()
        .in("id", oldExerciseWorkoutIds);
      if (deleteOldExercises) throw deleteOldExercises;
    }
    runAfter = () => {
      FULL_WORKOUT_LOG_CACHE.set(workoutLogRow.id, {...payload, workoutId: workoutLogRow.id});
    }
    return [true, workoutLogRow.id];
  } catch (e) {
    showAlert("Error updating workout", anyErrorToString(e, 'Unknown error'));
    // partial state too hard to recover from -> force refetch next fetch
    runAfter = () => {
      FULL_WORKOUT_LOG_CACHE.delete(workoutLogRow.id);
    }
    return [false, workoutLogRow.id];
  } finally {
    WORKOUT_LOG_HEADER_CACHE.upsert(databaseRowToWorkoutLogRow(workoutLogRow), runAfter);
  }
}

export async function deleteWorkoutLog(workoutId: UUID): Promise<void> {
  // schema causes cascade and attached workout-exercises and workout-exercise-sets are deleted
  const { error } = await supabase
    .from("workout_log")
    .delete()
    .eq("id", workoutId);
  if (error) throw error;
  FULL_WORKOUT_LOG_CACHE.delete(workoutId, () => {
    WORKOUT_LOG_HEADER_CACHE.delete(workoutId);
  });
}

function buildFullWorkoutFromAllBatch(
  workoutLogRow: WorkoutLogRow,
  allProgramRows: Map<UUID, ProgramRow>,
  allExerciseWorkouts: Map<UUID, Database["public"]["Tables"]["workout_exercise_log"]["Row"][]>,
  allSetRows: Map<UUID, Database["public"]["Tables"]["workout_exercise_set_log"]["Row"][]>,
  allExercises: Map<UUID, ExerciseRow>
): FullAttachedWorkout<'log'> {
  const filteredExerciseWorkouts = allExerciseWorkouts.get(workoutLogRow.id) ?? [];

  const sortedExWrkRows = filteredExerciseWorkouts.sort(
    (a, b) => a.exercise_index - b.exercise_index,
  );

  const editableExercises: EditableExercise<"log">[] = sortedExWrkRows.map(
    (exWrk) => {
      const { id, exercise_id, exercise_index, workout_id, ...rest } = exWrk;
      const editableExercise: EditableExercise<"log"> = {
        ...rest,
        exercise: allExercises.get(exWrk.exercise_id)!,
      };
      return editableExercise;
    },
  );

  const editableSets: EditableSet<"log">[][] = sortedExWrkRows.map((exWrk) => {
    // TODO: have to cast here because DB typing is not strict enough
    const rows: WorkoutExerciseSetLogRow[] = (allSetRows.get(exWrk.id) as (WorkoutExerciseSetLogRow[] | undefined)) ?? [];
    return rows
      .sort((a, b) => a.set_index - b.set_index)
      .map((r) => {
        const { id, set_index, workout_exercise_id, ...rest } = r;
        return { ...rest } satisfies EditableSet<"log">;
      });
  });

  let editableWorkout: EditableWorkout<"log">;
  const {
    program_id: _program_id,
    id: _id,
    block_in_program,
    week_in_block,
    day_in_week,
    ...restWrkLogRow
  } = workoutLogRow;
  const programRow = workoutLogRow.program_id !== null ? (allProgramRows.get(workoutLogRow.program_id) ?? null) : null;
  if (programRow !== null && block_in_program !== null) {
    editableWorkout = {
      ...restWrkLogRow,
      program_row: programRow,
      block_in_program,
      week_in_block,
      day_in_week,
    };
  } else if (programRow === null && block_in_program === null) {
    editableWorkout = {
      ...restWrkLogRow,
      program_row: programRow,
      block_in_program,
      week_in_block,
      day_in_week,
    };
  } else {
    throw new Error(
      `Mismatch. Both should be present or both null: programRow=${programRow}, workoutLogRow.block_in_program=${workoutLogRow.block_in_program}`,
    );
  }

  return {
    workout: editableWorkout,
    exercises: editableExercises,
    sets: editableSets,
    workoutId: workoutLogRow.id,
  };
}

export async function fullAttachedWorkoutLogFromWorkoutLogIds(
  workoutIds: UUID[],
): Promise<Map<UUID, FullAttachedWorkout<'log'>>> {
  const uniqueWorkoutIds = [...new Set(workoutIds)];
  let idsToFetch: UUID[] = [];
  const completed: Map<UUID, FullAttachedWorkout<'log'>> = new Map();
  uniqueWorkoutIds.forEach((id) => {
    const workoutMaybe = FULL_WORKOUT_LOG_CACHE.peek(id);
    if (workoutMaybe) {
      completed.set(id, workoutMaybe);
    } else {
      idsToFetch.push(id);
    }
  });
  if (idsToFetch.length === 0) return completed;
  const allWorkoutLogRows = await fetchAllWorkoutLogHeaders();
  idsToFetch = idsToFetch.filter((id) => {
    const present = allWorkoutLogRows.has(id);
    if (!present) {
      console.error(`${id} does not exist`);
    }
    return present;
  });
  if (idsToFetch.length === 0) return completed;
  const workoutLogRows: WorkoutLogRow[] = idsToFetch.map((id) => allWorkoutLogRows.get(id)!);

  const { data: allExerciseWorkouts, error: exWkErr } = await supabase
    .from("workout_exercise_log")
    .select("*")
    .in("workout_id", idsToFetch);
  if (exWkErr) throw exWkErr;

  const exerciseIds = [...allExerciseWorkouts.map((ex) => ex.exercise_id)];
  const allExercises = await fetchExercises();
  exerciseIds.forEach((id) => {
    if (!allExercises.has(id)) {
      throw new Error(`Exercise id '${id}' not found`);
    }
  });

  const pIds: UUID[] = [... new Set(workoutLogRows.map((w) => w.program_id).filter((pId) => pId !== null))];
  
  let allProgramRows: ProgramRow[] = [];
  if (pIds.length > 0) {
    const { data: allProgramRowsFromDb, error: prgError } = await supabase
      .from('program')
      .select('*')
      .in('id', pIds);
    if (prgError) throw prgError;
    allProgramRows = allProgramRowsFromDb satisfies ProgramRow[];
  }

  const { data: allSetExerciseWorkouts, error: setErr } = await supabase
    .from("workout_exercise_set_log")
    .select('*')
    .in('workout_exercise_id', allExerciseWorkouts.map((ex) => ex.id))
  if (setErr) throw setErr;

  const exByWorkout = new Map<UUID, Database["public"]["Tables"]["workout_exercise_log"]["Row"][]>();
  for (const ex of allExerciseWorkouts) {
    const arr = exByWorkout.get(ex.workout_id);
    if (arr) arr.push(ex);
    else exByWorkout.set(ex.workout_id, [ex]);
  }

  const setsByExWk = new Map<UUID, Database["public"]["Tables"]["workout_exercise_set_log"]["Row"][]>();
  for (const s of allSetExerciseWorkouts) {
    const arr = setsByExWk.get(s.workout_exercise_id);
    if (arr) arr.push(s);
    else setsByExWk.set(s.workout_exercise_id, [s]);
  }

  const programById = new Map<UUID, ProgramRow>();
  for (const p of allProgramRows) programById.set(p.id, p);

  const newlyCompleted = new Map();
  workoutLogRows.forEach((w) => {
    const fullWorkout = buildFullWorkoutFromAllBatch(w, programById, exByWorkout, setsByExWk, allExercises);
    completed.set(w.id, fullWorkout);
    newlyCompleted.set(w.id, fullWorkout);
  })
  FULL_WORKOUT_LOG_CACHE.setAll(newlyCompleted);

  return completed;
}

function sortWorkouts(workouts: FullAttachedWorkout<'log'>[]): FullAttachedWorkout<'log'>[] {
  return workouts
  .sort((a, b) => {
    const d = b.workout.completed_on.localeCompare(a.workout.completed_on);
    return d !== 0 ? d : a.workout.name.localeCompare(b.workout.name);
  });
}

/**
 * Fetches the full workout logs it can.
 * It is expected to always be able to fetch it.
 * In the case it does not, the return length WILL be less than the input length.
 */
async function _fetchLogs(workouts: WorkoutLogRow[]): Promise<FullAttachedWorkout<'log'>[]> {
  const ids = workouts.map((w) => w.id);
  const fullWorkouts = await fullAttachedWorkoutLogFromWorkoutLogIds(ids);
  const unfetched: UUID[] = [];
  ids.forEach((id) => {
    if (!fullWorkouts.has(id)) {
      unfetched.push(id);
    }
  });
  if (unfetched.length > 0) {
    console.error(`Failed to fetch ${unfetched.length} workouts`, JSON.stringify(unfetched));
  }
  return [...fullWorkouts.values()]
}

// Maybe-TODO: If this ever becomes a hotspot with lots of headers (e.g. many years of logs),
// consider building a date index once (e.g. Map<ISODate, UUID[]> + a sorted ISODate[] for binary search).
// For now, avoid allocating large intermediate arrays with `[...map.values()]` and use a single pass.

export async function fetchLastNWorkoutLogs(
  n: number,
): Promise<FullAttachedWorkout<"log">[]> {
  const headers = await fetchAllWorkoutLogHeaders();

  const all: WorkoutLogRow[] = [];
  for (const w of headers.values()) all.push(w);

  all.sort((a, b) => b.completed_on.localeCompare(a.completed_on));
  const lastNLogs = all.slice(0, n);

  return sortWorkouts(await _fetchLogs(lastNLogs));
}

export async function fetchWorkoutLogsOnDate(
  date: ISODate,
): Promise<FullAttachedWorkout<"log">[]> {
  const headers = await fetchAllWorkoutLogHeaders();

  const logsOnDate: WorkoutLogRow[] = [];
  for (const w of headers.values()) {
    if (w.completed_on === date) logsOnDate.push(w);
  }

  return sortWorkouts(await _fetchLogs(logsOnDate));
}

export async function fetchWorkoutLogsOnOrAfterDate(
  date: ISODate,
): Promise<FullAttachedWorkout<"log">[]> {
  const headers = await fetchAllWorkoutLogHeaders();

  const logsOnOrAfter: WorkoutLogRow[] = [];
  for (const w of headers.values()) {
    if (w.completed_on >= date) logsOnOrAfter.push(w);
  }

  return sortWorkouts(await _fetchLogs(logsOnOrAfter));
}

export async function fetchWorkoutLogsBeforeOrOnDate(
  date: ISODate,
): Promise<FullAttachedWorkout<"log">[]> {
  const headers = await fetchAllWorkoutLogHeaders();

  const logsBeforeOrOn: WorkoutLogRow[] = [];
  for (const w of headers.values()) {
    if (w.completed_on <= date) logsBeforeOrOn.push(w);
  }

  return sortWorkouts(await _fetchLogs(logsBeforeOrOn));
}

export async function fetchWorkoutLogsInRange(
  date1Inclusive: ISODate,
  date2Inclusive: ISODate,
): Promise<FullAttachedWorkout<"log">[]> {
  const headers = await fetchAllWorkoutLogHeaders();

  const logsInRange: WorkoutLogRow[] = [];
  for (const w of headers.values()) {
    if (w.completed_on >= date1Inclusive && w.completed_on <= date2Inclusive) {
      logsInRange.push(w);
    }
  }

  return sortWorkouts(await _fetchLogs(logsInRange));
}
