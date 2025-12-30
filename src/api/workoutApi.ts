import { MINUTE_MS } from "@/src/constants";
import { supabase } from "@/src/supabase";
import { CACHE_FACTORY } from "@/src/swrCache";
import type {
  ExerciseRow,
  ISODate,
  UUID,
  WorkoutExerciseRow,
  WorkoutExerciseSetRow,
  WorkoutRow,
} from "@/src/types";
import { getUser, pageKey, showAlert } from "../utils";
import { fetchExercises } from "./exerciseApi";

const TTL_MS = 10 * MINUTE_MS;

export type Workout = Omit<
  WorkoutRow,
  keyof {
    id: any;
    program_id: any;
    user_id: any;
    day_in_week: any;
    week_in_block: any;
    block_in_program: any;
    scheduled_for: any;
    completed_on: any;
    status: any;
  }
>;

export function workoutEqual(a: Workout | null, b: Workout | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return (
    a.name === b.name &&
    a.duration_seconds === b.duration_seconds &&
    a.bodyweight_kg === b.bodyweight_kg &&
    a.workout_type === b.workout_type &&
    a.notes === b.notes
  );
}

export type Exercise = Omit<
  WorkoutExerciseRow,
  keyof {
    id: any;
    workout_id: any;
    exercise_id: any;
    order: any;
  }
> & {
  exercise: ExerciseRow;
};

export function exerciseEqual(a: Exercise | null, b: Exercise | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return (
    a.superset_group === b.superset_group &&
    a.notes === b.notes &&
    a.exercise.id === b.exercise.id
  );
}

export function exercisesEqual(
  a: Exercise[] | null,
  b: Exercise[] | null,
): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!exerciseEqual(a[i], b[i])) return false;
  }
  return true;
}

export type Set = Omit<
  WorkoutExerciseSetRow,
  keyof {
    id: any;
    workout_exercise_id: any;
    max_percentage_exercise_id: any;
  }
> & { max_percentage_exercise: ExerciseRow | null };

export function setEqual(a: Set | null, b: Set | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return (
    a.set_number === b.set_number &&
    a.reps === b.reps &&
    a.weight === b.weight &&
    a.rpe === b.rpe &&
    a.percentage_of_max === b.percentage_of_max &&
    a.distance_per_rep === b.distance_per_rep &&
    a.weight_unit === b.weight_unit &&
    a.distance_unit === b.distance_unit &&
    a.performance_type === b.performance_type &&
    a.set_type === b.set_type &&
    a.is_complete === b.is_complete &&
    a.duration_seconds === b.duration_seconds &&
    a.rest_seconds_before === b.rest_seconds_before &&
    a.max_percentage_exercise === b.max_percentage_exercise
  );
}

export function setsEqual(a: Set[] | null, b: Set[] | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!setEqual(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

export function setsMatrixEqual(a: Set[][] | null, b: Set[][] | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!setsEqual(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

export type FullDetachedWorkout = {
  workout: Workout;
  exercises: Exercise[];
  sets: Set[][];
};

export const EMPTY_WORKOUT: Workout = {
  name: "",
  duration_seconds: null,
  bodyweight_kg: null,
  workout_type: null,
  notes: "",
};

export const EMPTY_SET: Set = {
  set_number: 1,

  reps: null,
  weight: null,
  rpe: null,
  percentage_of_max: null,
  max_percentage_exercise: null,
  distance_per_rep: null,

  weight_unit: "kg",
  distance_unit: "m",

  performance_type: null,

  set_type: "regular",

  is_complete: false,
  duration_seconds: null,
  rest_seconds_before: null,
};

export type FullWorkout = {
  id: UUID;
  workout: WorkoutRow;
  exercises: WorkoutExerciseRow[];
  setsByExerciseId: Record<UUID, WorkoutExerciseSetRow[]>;
};

// Canonical: one FullWorkout per workout id
const workoutByIdCache = CACHE_FACTORY.getOrCreateSwrIdCache<FullWorkout>(
  "workoutByIdCache",
  TTL_MS,
);

// Query cache: keys -> list of workout IDs (and optionally full objects)
const workoutQueryCache = CACHE_FACTORY.getOrCreateSwrKeyedCache<{
  ids: UUID[];
  full?: FullWorkout[];
}>("workoutQueryCache", TTL_MS);

// Helpers
function clearWorkoutQueryCaches(): void {
  workoutQueryCache.clearAll();
}

function peekFullWorkoutFromCache(id: UUID): FullWorkout | null {
  const map = workoutByIdCache.peek();
  if (!map) return null;
  return map.get(id) ?? null;
}

export async function fullToDetached(
  fullWorkout: FullWorkout,
): Promise<FullDetachedWorkout> {
  const { workout, exercises, setsByExerciseId } = fullWorkout;

  // ---------------------------------------------------------------------------
  // 1) Collect all exercise IDs we need to look up
  // ---------------------------------------------------------------------------
  const exerciseIds = new Set<UUID>();

  // main exercises for the workout
  for (const we of exercises) {
    exerciseIds.add(we.exercise_id);
  }

  // max_percentage_exercise_id from sets
  for (const ex of exercises) {
    const sets = setsByExerciseId[ex.id] ?? [];
    for (const s of sets) {
      if (s.max_percentage_exercise_id) {
        exerciseIds.add(s.max_percentage_exercise_id);
      }
    }
  }

  const exerciseById: Record<UUID, ExerciseRow> = Object.fromEntries([
    ...(await fetchExercises()).entries(),
  ]);

  const detachedWorkout: Workout = {
    name: workout.name,
    duration_seconds: workout.duration_seconds,
    bodyweight_kg: workout.bodyweight_kg,
    workout_type: workout.workout_type,
    notes: workout.notes,
  };

  const sortedExercises = [...exercises].sort((a, b) => a.order - b.order);

  const detachedExercises: Exercise[] = sortedExercises.map((we) => {
    const exRow = exerciseById[we.exercise_id];
    if (!exRow) {
      throw new Error(
        `Missing ExerciseRow for exercise_id ${we.exercise_id} in fullToDetached`,
      );
    }

    const detached: Exercise = {
      superset_group: we.superset_group,
      notes: we.notes,
      exercise: exRow,
    };

    return detached;
  });

  const detachedSets: Set[][] = [];

  for (const we of sortedExercises) {
    const setsForExercise = setsByExerciseId[we.id] ?? [];

    // Sort by set_number to keep natural order
    const sortedSets = [...setsForExercise].sort(
      (a, b) => a.set_number - b.set_number,
    );

    const converted: Set[] = sortedSets.map((s) => {
      const maxEx =
        s.max_percentage_exercise_id != null
          ? (exerciseById[s.max_percentage_exercise_id] ?? null)
          : null;

      const detachedSet: Set = {
        set_number: s.set_number,

        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
        percentage_of_max: s.percentage_of_max,
        max_percentage_exercise: maxEx,
        distance_per_rep: s.distance_per_rep,

        weight_unit: s.weight_unit,
        distance_unit: s.distance_unit,

        performance_type: s.performance_type,
        set_type: s.set_type,

        is_complete: s.is_complete,
        duration_seconds: s.duration_seconds,
        rest_seconds_before: s.rest_seconds_before,
      };

      return detachedSet;
    });

    detachedSets.push(converted);
  }

  return {
    workout: detachedWorkout,
    exercises: detachedExercises,
    sets: detachedSets,
  };
}

export async function insertFullDetachedWorkout(
  detached: FullDetachedWorkout,
  status: "template" | "completed" | "skipped",
  completedOn?: ISODate | null,
): Promise<UUID> {
  const user = await getUser();
  if (!user) {
    throw new Error("User is null");
  }

  // 1) Insert workout row (minimal fields; adjust defaults as needed)
  const { data: workoutRow, error: workoutErr } = await supabase
    .from("workout")
    .insert({
      user_id: user.user_id,
      program_id: null,

      name: detached.workout.name,
      day_in_week: null,
      week_in_block: null,
      block_in_program: null,

      scheduled_for: null,
      completed_on: completedOn ?? null,

      duration_seconds: detached.workout.duration_seconds,
      bodyweight_kg: detached.workout.bodyweight_kg,

      status,
      workout_type: detached.workout.workout_type,

      notes: detached.workout.notes ?? "",
    })
    .select("*")
    .single();

  if (workoutErr) {
    throw workoutErr;
  }

  const workoutId = (workoutRow as WorkoutRow).id;

  // 2) Insert workout_exercise rows in order
  const workoutExerciseIds: UUID[] = [];

  for (let i = 0; i < detached.exercises.length; i++) {
    const ex = detached.exercises[i];

    const { data: exRow, error: exErr } = await supabase
      .from("workout_exercise")
      .insert({
        workout_id: workoutId,
        exercise_id: ex.exercise.id,
        order: i,

        superset_group: ex.superset_group ?? null,
        notes: ex.notes ?? "",
      })
      .select("*")
      .single();

    if (exErr) {
      throw exErr;
    }

    workoutExerciseIds[i] = (exRow as WorkoutExerciseRow).id;
  }

  // 3) Insert sets for each workout_exercise
  for (let i = 0; i < detached.sets.length; i++) {
    const setsForExercise = detached.sets[i];
    const workoutExerciseId = workoutExerciseIds[i];
    if (!workoutExerciseId || !setsForExercise) continue;

    for (const s of setsForExercise) {
      const { error: setErr } = await supabase
        .from("workout_exercise_set")
        .insert({
          workout_exercise_id: workoutExerciseId,
          set_number: s.set_number,

          reps: s.reps,
          weight: s.weight,
          rpe: s.rpe,
          percentage_of_max: s.percentage_of_max,
          max_percentage_exercise_id: s.max_percentage_exercise
            ? s.max_percentage_exercise.id
            : null,
          distance_per_rep: s.distance_per_rep,

          weight_unit: s.weight_unit,
          distance_unit: s.distance_unit,

          performance_type: s.performance_type,
          set_type: s.set_type,

          is_complete: s.is_complete,
          duration_seconds: s.duration_seconds,
          rest_seconds_before: s.rest_seconds_before,
        });

      if (setErr) {
        throw setErr;
      }
    }
  }

  // 4) Invalidate and warm caches
  workoutByIdCache.delete(workoutId);
  clearWorkoutQueryCaches();
  await fetchWorkoutFull(workoutId);

  return workoutId;
}

export async function updateFullDetachedWorkout(
  workoutId: UUID,
  detached: FullDetachedWorkout,
  status: "template" | "completed" | "skipped",
  completedOn?: ISODate | null,
  programId?: UUID | null,
  userId?: UUID | null,
): Promise<void> {
  // 1) Update base workout fields (do NOT stomp program_id, status, etc.)
  const payload: Omit<WorkoutRow, "id"> = {
    name: detached.workout.name,
    duration_seconds: detached.workout.duration_seconds,
    bodyweight_kg: detached.workout.bodyweight_kg,
    workout_type: detached.workout.workout_type,
    notes: detached.workout.notes ?? "",
    completed_on: completedOn ?? null,
    program_id: programId ?? null,
    user_id: userId ?? null,
    day_in_week: null,
    week_in_block: null,
    block_in_program: null,
    scheduled_for: null,
    status,
  };
  const { error: workoutErr } = await supabase
    .from("workout")
    .update(payload)
    .eq("id", workoutId);

  if (workoutErr) {
    throw workoutErr;
  }

  // 2) Delete existing exercises + sets for this workout
  const { data: existingExRows, error: exListErr } = await supabase
    .from("workout_exercise")
    .select("id")
    .eq("workout_id", workoutId);

  if (exListErr) {
    throw exListErr;
  }

  const existingExIds = (existingExRows ?? []).map((r: any) => r.id as UUID);

  if (existingExIds.length > 0) {
    const { error: delSetsErr } = await supabase
      .from("workout_exercise_set")
      .delete()
      .in("workout_exercise_id", existingExIds);

    if (delSetsErr) {
      throw delSetsErr;
    }
  }

  if (existingExIds.length > 0) {
    const { error: delExErr } = await supabase
      .from("workout_exercise")
      .delete()
      .eq("workout_id", workoutId);

    if (delExErr) {
      throw delExErr;
    }
  }

  // 3) Re-insert exercises with new structure
  const workoutExerciseIds: UUID[] = [];

  for (let i = 0; i < detached.exercises.length; i++) {
    const ex = detached.exercises[i];

    const { data: exRow, error: exErr } = await supabase
      .from("workout_exercise")
      .insert({
        workout_id: workoutId,
        exercise_id: ex.exercise.id,
        order: i,

        superset_group: ex.superset_group ?? null,
        notes: ex.notes ?? "",
      })
      .select("*")
      .single();

    if (exErr) {
      throw exErr;
    }

    workoutExerciseIds[i] = (exRow as WorkoutExerciseRow).id;
  }

  // 4) Re-insert sets
  for (let i = 0; i < detached.sets.length; i++) {
    const setsForExercise = detached.sets[i];
    const workoutExerciseId = workoutExerciseIds[i];
    if (!workoutExerciseId || !setsForExercise) continue;

    for (const s of setsForExercise) {
      const { error: setErr } = await supabase
        .from("workout_exercise_set")
        .insert({
          workout_exercise_id: workoutExerciseId,
          set_number: s.set_number,

          reps: s.reps,
          weight: s.weight,
          rpe: s.rpe,
          percentage_of_max: s.percentage_of_max,
          max_percentage_exercise_id: s.max_percentage_exercise
            ? s.max_percentage_exercise.id
            : null,
          distance_per_rep: s.distance_per_rep,

          weight_unit: s.weight_unit,
          distance_unit: s.distance_unit,

          performance_type: s.performance_type,
          set_type: s.set_type,

          is_complete: s.is_complete,
          duration_seconds: s.duration_seconds,
          rest_seconds_before: s.rest_seconds_before,
        });

      if (setErr) {
        throw setErr;
      }
    }
  }

  // 5) Invalidate + warm caches
  workoutByIdCache.delete(workoutId);
  clearWorkoutQueryCaches();
  await fetchWorkoutFull(workoutId);
}

/**
 * Internal helper: given a list of WorkoutRow, fetch their exercises and sets,
 * merge with existing cache objects, upsert into workoutByIdCache, and return
 * FullWorkout[] plus ids.
 */
async function buildFullWorkoutsFromRows(
  workouts: WorkoutRow[],
): Promise<{ ids: UUID[]; full: FullWorkout[] }> {
  if (workouts.length === 0) {
    return { ids: [], full: [] };
  }

  const workoutIds = workouts.map((w) => w.id);

  // Fetch exercises for these workouts
  const { data: exData, error: exErr } = await supabase
    .from("workout_exercise")
    .select("*")
    .in("workout_id", workoutIds);

  if (exErr) {
    showAlert("Error getting workout exercises", exErr.message);
    throw exErr;
  }

  const workoutExercises = (exData ?? []) as WorkoutExerciseRow[];

  const workoutExerciseByWorkoutId: Record<UUID, WorkoutExerciseRow[]> = {};
  for (const ex of workoutExercises) {
    const k = ex.workout_id;
    (workoutExerciseByWorkoutId[k] ??= []).push(ex);
  }

  const workoutExerciseIds = [...new Set(workoutExercises.map((e) => e.id))];

  let setsByWorkoutExerciseId: Record<UUID, WorkoutExerciseSetRow[]> = {};
  if (workoutExerciseIds.length > 0) {
    const { data: setData, error: setErr } = await supabase
      .from("workout_exercise_set")
      .select("*")
      .in("workout_exercise_id", workoutExerciseIds);

    if (setErr) {
      showAlert("Error getting workout sets", setErr.message);
      throw setErr;
    }

    setsByWorkoutExerciseId = {};
    for (const s of (setData ?? []) as WorkoutExerciseSetRow[]) {
      const k = s.workout_exercise_id;
      (setsByWorkoutExerciseId[k] ??= []).push(s);
    }
  }

  const byId = workoutByIdCache.peek();
  const full: FullWorkout[] = [];

  for (const w of workouts) {
    const existing = byId?.get(w.id) ?? null;

    // reuse object if it exists, otherwise create
    const fullWorkout: FullWorkout =
      existing ??
      ({
        id: w.id,
        workout: w,
        exercises: [],
        setsByExerciseId: {},
      } as FullWorkout);

    // refresh contents from DB result
    fullWorkout.workout = w;

    fullWorkout.exercises.length = 0;
    for (const [k] of Object.entries(fullWorkout.setsByExerciseId)) {
      delete fullWorkout.setsByExerciseId[k as UUID];
    }

    const exs = workoutExerciseByWorkoutId[w.id] ?? [];
    for (const we of exs) {
      fullWorkout.exercises.push(we);
      fullWorkout.setsByExerciseId[we.id] =
        setsByWorkoutExerciseId[we.id] ?? [];
    }

    // upsert into canonical cache
    workoutByIdCache.upsert(fullWorkout);
    full.push(fullWorkout);
  }

  const ids = full.map((f) => f.id);
  return { ids, full };
}

/**
 * Generic helper for query-based fetches.
 * Takes a Supabase "workout" query builder, a cache key, and returns FullWorkout[].
 */
async function fetchWorkoutsWithQuery(
  buildQuery: (q: any) => any,
  cacheKey: string,
): Promise<FullWorkout[]> {
  return workoutQueryCache
    .fetch(cacheKey, async () => {
      const base = supabase.from("workout").select("*");
      const { data, error } = await buildQuery(base);

      if (error) {
        showAlert("Error getting workouts", error.message);
        throw error;
      }

      const workouts = (data ?? []) as WorkoutRow[];
      const { ids, full } = await buildFullWorkoutsFromRows(workouts);

      return { ids, full };
    })
    .then((cached) => {
      // If full was cached, just return it
      if (cached.full) {
        return cached.full as FullWorkout[];
      }

      // Otherwise, rebuild from canonical map
      const map = workoutByIdCache.peek();
      const full: FullWorkout[] = [];
      if (map && cached.ids) {
        for (const id of cached.ids) {
          const f = map.get(id);
          if (f) full.push(f);
        }
      }
      return full;
    });
}

// ============================================================================
// Bulk fetchers
// ============================================================================

/**
 * Fetch the last 30 completed workouts for the current user,
 * including all exercises and sets. Results are cached.
 */
export async function fetchCompletedLast30Workouts(): Promise<FullWorkout[]> {
  const user = await getUser();
  if (!user) throw new Error("User is null");

  const key = pageKey("completedLast30", { userId: user.user_id });

  return fetchWorkoutsWithQuery(
    (q) =>
      q
        .eq("user_id", user.user_id)
        .eq("status", "completed")
        .not("completed_on", "is", null)
        .order("completed_on", { ascending: false })
        .limit(30),
    key,
  );
}

/**
 * Fetch all completed workouts for a given date for the current user.
 * (You can have multiple in a day; returns all.) Cached by date.
 */
export async function fetchCompletedWorkoutOnDate(
  date: ISODate,
): Promise<FullWorkout[]> {
  const user = await getUser();
  if (!user) throw new Error("User is null");

  const key = pageKey("completedOnDate", { userId: user.user_id, date });

  return fetchWorkoutsWithQuery(
    (q) =>
      q
        .eq("user_id", user.user_id)
        .eq("status", "completed")
        .eq("completed_on", date)
        .order("completed_on", { ascending: false }),
    key,
  );
}

/**
 * Fetch all workouts (any status) for a program, including all exercises and sets.
 */
export async function fetchAllWorkoutsForProgram(
  programId: UUID,
): Promise<FullWorkout[]> {
  const key = pageKey("workoutsForProgram", { programId });

  return fetchWorkoutsWithQuery(
    (q) =>
      q
        .eq("program_id", programId)
        .order("block_in_program", { ascending: true })
        .order("week_in_block", { ascending: true })
        .order("day_in_week", { ascending: true })
        .order("completed_on", { ascending: true }),
    key,
  );
}

export async function fetchWorkoutFull(
  workoutId: UUID,
): Promise<FullWorkout | null> {
  // 1. Try cache first
  const cached = peekFullWorkoutFromCache(workoutId);
  if (cached) return cached;

  // 2. Fetch base workout row
  const { data, error } =
    (await supabase
      .from("workout")
      .select("*")
      .eq("id", workoutId)
      .maybeSingle?.()) ??
    (await supabase.from("workout").select("*").eq("id", workoutId).single());

  // If using supabase-js v2, you can use .maybeSingle().
  // If not, just keep the .single() version above and handle "no rows" via error code.

  if (error) {
    // If it's a "no rows" error, just return null so callers can handle gracefully
    const code = (error as any).code;
    if (code === "PGRST116" || code === "PGRST103") {
      // PGRST116: Results contain 0 rows (or similar 'no rows' cases)
      return null;
    }

    showAlert("Error getting workout", error.message);
    throw error;
  }

  if (!data) {
    // No row found
    return null;
  }

  const workout = data as WorkoutRow;

  // 3. Build full object (will also populate workoutByIdCache)
  const { full } = await buildFullWorkoutsFromRows([workout]);
  return full[0] ?? null;
}

// ============================================================================
// CRUD: Workout
// ============================================================================

export async function addWorkout(
  payload: Omit<WorkoutRow, "id">,
): Promise<UUID> {
  const user = await getUser();
  if (!user) throw new Error("User is null");

  const { data, error } = await supabase
    .from("workout")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  const row = data as any as WorkoutRow;
  const id = row.id;

  const full: FullWorkout = {
    id,
    workout: row,
    exercises: [],
    setsByExerciseId: {},
  };

  workoutByIdCache.upsert(full);
  clearWorkoutQueryCaches();

  return id;
}

export async function updateWorkout(params: {
  workoutId: UUID;
  // All optional; only provided fields will be updated
  name?: string;
  status?: WorkoutRow["status"];
  notes?: string | null;
  programId?: UUID | null;
  templateSourceWorkoutId?: UUID | null;
  dayInWeek?: number | null;
  weekInBlock?: number | null;
  blockInProgram?: number | null;
  scheduledFor?: ISODate | null;
  startedAt?: ISODate | null;
  completedOn?: ISODate | null;
  durationSeconds?: number | null;
  bodyweightKg?: number | null;
  isDeload?: boolean;
  isTestDay?: boolean;
}): Promise<void> {
  const update: any = {};

  if ("name" in params) update.name = params.name;
  if ("status" in params) update.status = params.status;
  if ("notes" in params) update.notes = params.notes ?? "";
  if ("programId" in params) update.program_id = params.programId ?? null;
  if ("templateSourceWorkoutId" in params)
    update.template_source_workout_id = params.templateSourceWorkoutId ?? null;
  if ("dayInWeek" in params) update.day_in_week = params.dayInWeek ?? null;
  if ("weekInBlock" in params)
    update.week_in_block = params.weekInBlock ?? null;
  if ("blockInProgram" in params)
    update.block_in_program = params.blockInProgram ?? null;
  if ("scheduledFor" in params)
    update.scheduled_for = params.scheduledFor ?? null;
  if ("startedAt" in params) update.started_at = params.startedAt ?? null;
  if ("completedOn" in params) update.completed_on = params.completedOn ?? null;
  if ("durationSeconds" in params)
    update.duration_seconds = params.durationSeconds ?? null;
  if ("bodyweightKg" in params)
    update.bodyweight_kg = params.bodyweightKg ?? null;
  if ("isDeload" in params) update.is_deload = params.isDeload ?? false;
  if ("isTestDay" in params) update.is_test_day = params.isTestDay ?? false;

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("workout")
    .update(update)
    .eq("id", params.workoutId);

  if (error) throw error;

  const byId = workoutByIdCache.peek();
  const full = byId?.get(params.workoutId);
  if (full) {
    full.workout = { ...full.workout, ...update } as WorkoutRow;
    workoutByIdCache.upsert(full);
  }

  clearWorkoutQueryCaches();
}

export async function deleteWorkout(params: {
  workoutId: UUID;
}): Promise<void> {
  const { error } = await supabase
    .from("workout")
    .delete()
    .eq("id", params.workoutId);

  if (error) throw error;

  workoutByIdCache.delete(params.workoutId);
  clearWorkoutQueryCaches();
}

// ============================================================================
// CRUD: WorkoutExercise
// ============================================================================

export async function addWorkoutExercise(params: {
  workoutId: UUID;
  exerciseId: UUID;
  notes?: string | null;
  supersetGroup?: string | null;
  trainingMax?: number | null;
  trainingMaxUnit?: "kg" | "lb" | null;
}): Promise<WorkoutExerciseRow> {
  // find next order
  const { data: last, error: lastErr } = await supabase
    .from("workout_exercise")
    .select("order")
    .eq("workout_id", params.workoutId)
    .order("order", { ascending: false })
    .limit(1);

  if (lastErr) throw lastErr;

  const nextOrder = (last?.[0]?.order ?? -1) + 1;

  const { data, error } = await supabase
    .from("workout_exercise")
    .insert({
      workout_id: params.workoutId,
      exercise_id: params.exerciseId,
      order: nextOrder,
      superset_group: params.supersetGroup ?? null,
      notes: params.notes ?? "",
      training_max: params.trainingMax ?? null,
      training_max_unit: params.trainingMaxUnit ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  const row = data as any as WorkoutExerciseRow;

  const byId = workoutByIdCache.peek();
  const full = byId?.get(params.workoutId);
  if (full) {
    full.exercises.push(row);
    full.setsByExerciseId[row.id] = [];
    workoutByIdCache.upsert(full);
  }

  clearWorkoutQueryCaches();
  return row;
}

export async function updateWorkoutExercise(params: {
  workoutExerciseId: UUID;
  notes?: string | null;
  supersetGroup?: string | null;
  trainingMax?: number | null;
}): Promise<void> {
  const { data: row, error: getErr } = await supabase
    .from("workout_exercise")
    .select("workout_id")
    .eq("id", params.workoutExerciseId)
    .single();

  if (getErr) throw getErr;

  const update: any = {};
  if ("notes" in params) update.notes = params.notes ?? "";
  if ("supersetGroup" in params)
    update.superset_group = params.supersetGroup ?? null;
  if ("trainingMax" in params) update.training_max = params.trainingMax ?? null;
  if ("trainingMaxUnit" in params)
    update.training_max_unit = params.trainingMaxUnit ?? null;

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("workout_exercise")
    .update(update)
    .eq("id", params.workoutExerciseId);

  if (error) throw error;

  const workoutId = (row as any).workout_id as UUID;
  const byId = workoutByIdCache.peek();
  const full = byId?.get(workoutId);
  if (!full) {
    clearWorkoutQueryCaches();
    return;
  }

  const ex = full.exercises.find((e) => e.id === params.workoutExerciseId);
  if (ex) {
    Object.assign(ex, update);
    workoutByIdCache.upsert(full);
  }

  clearWorkoutQueryCaches();
}

export async function deleteWorkoutExercise(params: {
  workoutExerciseId: UUID;
}): Promise<void> {
  const { data: row, error: getErr } = await supabase
    .from("workout_exercise")
    .select("workout_id")
    .eq("id", params.workoutExerciseId)
    .single();

  if (getErr) throw getErr;

  const { error } = await supabase
    .from("workout_exercise")
    .delete()
    .eq("id", params.workoutExerciseId);

  if (error) throw error;

  const workoutId = (row as any).workout_id as UUID;
  const byId = workoutByIdCache.peek();
  const full = byId?.get(workoutId);
  if (!full) {
    clearWorkoutQueryCaches();
    return;
  }

  full.exercises = full.exercises.filter(
    (e) => e.id !== params.workoutExerciseId,
  );
  delete full.setsByExerciseId[params.workoutExerciseId];

  workoutByIdCache.upsert(full);
  clearWorkoutQueryCaches();
}

// ============================================================================
// CRUD: WorkoutExerciseSet
// ============================================================================

export async function addWorkoutExerciseSet(params: {
  workoutExerciseId: UUID;
  isWarmup?: boolean;
  isTopSet?: boolean;
  isBackoff?: boolean;
}): Promise<WorkoutExerciseSetRow> {
  const { data: parent, error: parentErr } = await supabase
    .from("workout_exercise")
    .select("workout_id")
    .eq("id", params.workoutExerciseId)
    .single();

  if (parentErr) throw parentErr;

  const { data: last, error: lastErr } = await supabase
    .from("workout_exercise_set")
    .select("set_number")
    .eq("workout_exercise_id", params.workoutExerciseId)
    .order("set_number", { ascending: false })
    .limit(1);

  if (lastErr) throw lastErr;

  const next = (last?.[0]?.set_number ?? 0) + 1;

  const { data, error } = await supabase
    .from("workout_exercise_set")
    .insert({
      workout_exercise_id: params.workoutExerciseId,
      set_number: next,
      reps: null,
      weight: null,
      rpe: null,
      percentage_of_max: null,
      weight_unit: null,
      display_as_rpe: true,
      is_warmup: params.isWarmup ?? false,
      is_top_set: params.isTopSet ?? false,
      is_backoff: params.isBackoff ?? false,
      is_complete: false,
      duration_seconds: null,
      rest_seconds_before: null,
    })
    .select("*")
    .single();

  if (error) throw error;

  const workoutId = (parent as any).workout_id as UUID;
  const newSet = data as any as WorkoutExerciseSetRow;

  const byId = workoutByIdCache.peek();
  const full = byId?.get(workoutId);
  if (full) {
    (full.setsByExerciseId[params.workoutExerciseId] ??= []).push(newSet);
    workoutByIdCache.upsert(full);
  }

  clearWorkoutQueryCaches();
  return newSet;
}

export async function updateWorkoutExerciseSet(params: {
  setId: UUID;
  reps?: number | null;
  weight?: number | null;
  rpe?: number | null;
  percentageOfMax?: number | null;
  weightUnit?: "kg" | "lb" | null;
  displayAsRpe?: boolean;
  isWarmup?: boolean;
  isTopSet?: boolean;
  isBackoff?: boolean;
  isComplete?: boolean;
  durationSeconds?: number | null;
  restSecondsBefore?: number | null;
}): Promise<void> {
  const { data: parent, error: parentErr } = await supabase
    .from("workout_exercise_set")
    .select("workout_exercise_id, ex:workout_exercise_id ( workout_id )")
    .eq("id", params.setId)
    .single();

  if (parentErr) throw parentErr;

  const workoutId = (parent as any).ex.workout_id as UUID;
  const exId = (parent as any).workout_exercise_id as UUID;

  const update: any = {};
  if ("reps" in params) update.reps = params.reps;
  if ("weight" in params) update.weight = params.weight;
  if ("rpe" in params) update.rpe = params.rpe;
  if ("percentageOfMax" in params)
    update.percentage_of_max = params.percentageOfMax;
  if ("weightUnit" in params) update.weight_unit = params.weightUnit ?? null;
  if ("displayAsRpe" in params)
    update.display_as_rpe = params.displayAsRpe ?? false;
  if ("isWarmup" in params) update.is_warmup = params.isWarmup ?? false;
  if ("isTopSet" in params) update.is_top_set = params.isTopSet ?? false;
  if ("isBackoff" in params) update.is_backoff = params.isBackoff ?? false;
  if ("isComplete" in params) update.is_complete = params.isComplete ?? false;
  if ("durationSeconds" in params)
    update.duration_seconds = params.durationSeconds ?? null;
  if ("restSecondsBefore" in params)
    update.rest_seconds_before = params.restSecondsBefore ?? null;

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("workout_exercise_set")
    .update(update)
    .eq("id", params.setId);

  if (error) throw error;

  const byId = workoutByIdCache.peek();
  const full = byId?.get(workoutId);
  if (!full) {
    clearWorkoutQueryCaches();
    return;
  }

  const sets = full.setsByExerciseId[exId];
  if (!sets) {
    clearWorkoutQueryCaches();
    return;
  }

  const s = sets.find((x) => x.id === params.setId);
  if (s) {
    Object.assign(s, update);
    workoutByIdCache.upsert(full);
  }

  clearWorkoutQueryCaches();
}

export async function deleteWorkoutExerciseSet(params: {
  setId: UUID;
}): Promise<void> {
  const { data: parent, error: parentErr } = await supabase
    .from("workout_exercise_set")
    .select("workout_exercise_id, ex:workout_exercise_id ( workout_id )")
    .eq("id", params.setId)
    .single();

  if (parentErr) throw parentErr;

  const workoutId = (parent as any).ex.workout_id as UUID;
  const exId = (parent as any).workout_exercise_id as UUID;

  const { error } = await supabase
    .from("workout_exercise_set")
    .delete()
    .eq("id", params.setId);

  if (error) throw error;

  const byId = workoutByIdCache.peek();
  const full = byId?.get(workoutId);
  if (!full) {
    clearWorkoutQueryCaches();
    return;
  }

  const sets = full.setsByExerciseId[exId];
  if (!sets) {
    clearWorkoutQueryCaches();
    return;
  }

  full.setsByExerciseId[exId] = sets.filter((s) => s.id !== params.setId);
  workoutByIdCache.upsert(full);
  clearWorkoutQueryCaches();
}
