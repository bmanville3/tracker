import { MINUTE_MS } from "../constants";
import { supabase } from "../supabase";
import { CACHE_FACTORY } from "../swrCache";
import { ExerciseMuscleRow, ExerciseRow, UUID } from "../types";
import { ExerciseAndMuscleTag, MuscleGroup } from "../types/enums";
import { isSubsetOf, showAlert } from "../utils";

// this data is rarely changed
// no reason to refetch it all the time

const TTL_MS = 30 * MINUTE_MS;

const EXERCISE_CACHE = CACHE_FACTORY.getOrCreateSwrIdCache<ExerciseRow>(
  "exerciseCache",
  TTL_MS,
);
const EXERCISE_MUSCLE_CACHE =
  CACHE_FACTORY.getOrCreateSwrIdCache<ExerciseMuscleRow>(
    "exerciseMuscleCache",
    TTL_MS,
  );

export async function fetchExercises(): Promise<Map<UUID, ExerciseRow>> {
  return EXERCISE_CACHE.fetch(async () => {
    console.log("Fetching the exercise table from the database...");
    const { data, error } = await supabase.from("exercise").select("*");
    if (error) {
      showAlert("Error fetching exercises from database", error.message);
      throw error;
    }
    return data as ExerciseRow[];
  });
}

export async function addExercise(
  args: Omit<ExerciseRow, "id">,
): Promise<void> {
  const { data, error } = await supabase
    .from("exercise")
    .insert(args)
    .select("*")
    .single();

  if (error) {
    showAlert("Error adding exercise to database", error.message);
    throw error;
  }

  EXERCISE_CACHE.upsert(data as ExerciseRow);
}

export async function updateExercise(args: {
  id: UUID;
  patch: Partial<Pick<ExerciseRow, "name" | "description" | "tags">>;
}): Promise<void> {
  const { id, patch } = args;

  const { data, error } = await supabase
    .from("exercise")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    showAlert("Error updating exercise in database", error.message);
    throw error;
  }

  EXERCISE_CACHE.upsert(data as ExerciseRow);
}

export async function deleteExercise(id: UUID): Promise<void> {
  const { error } = await supabase.from("exercise").delete().eq("id", id);
  if (error) {
    showAlert("Error deleting exercise from database", error.message);
    throw error;
  }

  EXERCISE_CACHE.delete(id);
}

export async function fetchAllExerciseMuscleVolumes(): Promise<
  Map<UUID, ExerciseMuscleRow>
> {
  return EXERCISE_MUSCLE_CACHE.fetch(async () => {
    console.log("Fetching the exercise muscle table from the database...");
    const { data, error } = await supabase.from("exercise_muscle").select("*");
    if (error) {
      showAlert(
        "Error fetching exercise muscle volume from database",
        error.message,
      );
      throw error;
    }
    return data as ExerciseMuscleRow[];
  });
}

export async function fetchExerciseMuscleVolumes(
  exerciseId: UUID,
  userId: UUID | null,
): Promise<Map<MuscleGroup, ExerciseMuscleRow>> {
  const allRows = await fetchAllExerciseMuscleVolumes();
  const forThisExercise = [...allRows.values()].filter(
    (ex) => ex.exercise_id === exerciseId,
  );
  if (userId === null) {
    return new Map(forThisExercise.map((row) => [row.muscle_id, row]));
  }
  const userEntries = forThisExercise.filter((row) => row.user_id === userId);
  const musclesAlreadyEstablished = new Set(
    userEntries.map((row) => row.muscle_id),
  );
  const systemEntries = forThisExercise.filter(
    (row) =>
      row.user_id === null && !musclesAlreadyEstablished.has(row.muscle_id),
  );
  const allEntries = [...userEntries, ...systemEntries];
  return new Map(allEntries.map((row) => [row.muscle_id, row]));
}

export async function addExerciseMuscleVolume(args: {
  muscle_id: UUID;
  exercise_id: UUID;
  volume_factor: number;
  user_id: UUID;
}): Promise<void> {
  if (args.volume_factor < 0 || args.volume_factor > 1) {
    showAlert(
      `Volume factor should be between 0 and 1. Got ${args.volume_factor}`,
    );
    throw new Error(
      `Volume should be between 0 and 1. Got ${args.volume_factor}`,
    );
  }
  const { data, error } = await supabase
    .from("exercise_muscle")
    .insert(args)
    .select("*")
    .single();

  if (error) {
    showAlert("Error adding exercise muscle volume to database", error.message);
    throw error;
  }

  EXERCISE_MUSCLE_CACHE.upsert(data as ExerciseMuscleRow);
}

export async function updateExerciseMuscleVolume(args: {
  id: UUID;
  patch: Partial<Pick<ExerciseMuscleRow, "volume_factor">>;
}): Promise<void> {
  const { id, patch } = args;

  const { data, error } = await supabase
    .from("exercise_muscle")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    showAlert(
      "Error updating exercise muscle volume in database",
      error.message,
    );
    throw error;
  }

  EXERCISE_MUSCLE_CACHE.upsert(data as ExerciseMuscleRow);
}

export async function deleteExerciseMuscleVolume(id: UUID): Promise<void> {
  const { error } = await supabase
    .from("exercise_muscle")
    .delete()
    .eq("id", id);

  if (error) {
    showAlert(
      "Error deleting exercise muscle volume from database",
      error.message,
    );
    throw error;
  }

  EXERCISE_MUSCLE_CACHE.delete(id);
}

export async function searchExercises(
  query: string,
  tags?: Set<ExerciseAndMuscleTag>,
): Promise<ExerciseRow[]> {
  const q = query.trim();
  if (!q && !tags) return [];
  if (!tags) {
    tags = new Set();
  }

  const allExercisesMap = await fetchExercises();
  let allExercises = Array.from(
    [...allExercisesMap.values()].filter((ex) =>
      isSubsetOf(tags, new Set(ex.tags)),
    ),
  );

  const regex = /[^a-zA-Z0-9\s]/g;
  const strippedQuery = q.toLowerCase().replace(regex, "");

  const idsOf = (xs: ExerciseRow[]) => new Set(xs.map((x) => x.id));

  const startsWithRaw = allExercises.filter((ex) =>
    ex.name.toLowerCase().startsWith(q.toLowerCase()),
  );
  const seen1 = idsOf(startsWithRaw);
  allExercises = allExercises.filter((ex) => !seen1.has(ex.id));

  const startsWithStripped = allExercises.filter((ex) => {
    const strippedName = ex.name.toLowerCase().replace(regex, "");
    return strippedName.startsWith(strippedQuery);
  });
  const seen2 = new Set([...seen1, ...idsOf(startsWithStripped)]);
  allExercises = allExercises.filter((ex) => !seen2.has(ex.id));

  const parts = strippedQuery
    .split(" ")
    .map((p) => p.replace(/[\s+]/g, ""))
    .filter((p) => p !== "");
  const includesPartsOfStripped = allExercises.filter((ex) => {
    const strippedName = ex.name
      .toLowerCase()
      .replace(regex, "")
      .replace(/[\s+]/g, "");
    for (const p of parts) {
      if (!strippedName.includes(p)) {
        return false;
      }
    }
    return true;
  });

  return [...startsWithRaw, ...startsWithStripped, ...includesPartsOfStripped];
}
