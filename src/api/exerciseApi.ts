import { NEVER_CHANGES_RESET_TIME } from "../constants";
import { supabase } from "../supabase";
import { CACHE_FACTORY } from "../swrCache";
import { ExerciseMuscleRow, ExerciseRow, UUID } from "../types";
import { ExerciseAndMuscleTag, MuscleGroup } from "../types/enums";
import { isSubsetOf, OmitNever, pageKey } from "../utils";

const EXERCISE_CACHE = CACHE_FACTORY.getOrCreateSwrIdCache<ExerciseRow>(
  "exerciseCache",
  NEVER_CHANGES_RESET_TIME,
);
const EXERCISE_MUSCLE_CACHE = CACHE_FACTORY.getOrCreateSwrKeyedCache<
  Map<MuscleGroup, ExerciseMuscleRow>
>("exerciseMuscleCache", NEVER_CHANGES_RESET_TIME);

export async function fetchExercises(): Promise<Map<UUID, ExerciseRow>> {
  return EXERCISE_CACHE.fetch(async () => {
    console.log("Fetching the exercise table from the database...");
    const { data, error } = await supabase.from("exercise").select("*");
    if (error) throw error;
    return data satisfies ExerciseRow[];
  });
}

export async function addExercise(
  args: OmitNever<ExerciseRow, "id">,
): Promise<void> {
  const { data, error } = await supabase
    .from("exercise")
    .insert(args)
    .select("*")
    .single();

  if (error) throw error;

  EXERCISE_CACHE.upsert(data satisfies ExerciseRow);
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

  if (error) throw error;

  EXERCISE_CACHE.upsert(data satisfies ExerciseRow);
}

export async function deleteExercise(id: UUID): Promise<void> {
  const { error } = await supabase.from("exercise").delete().eq("id", id);
  if (error) throw error;

  EXERCISE_CACHE.delete(id);

  const inner = EXERCISE_MUSCLE_CACHE.getInnerMap();

  const updates = Array.from(inner.entries())
    .map(([pageKeyQuery, cachedRows]) => {
      const keysToDelete: MuscleGroup[] = [];
      for (const [muscle_id, row] of cachedRows.entries()) {
        if (row.exercise_id === id) keysToDelete.push(muscle_id);
      }
      if (keysToDelete.length === 0) return null;

      const updatedCachedRows = new Map(cachedRows);
      for (const muscle_id of keysToDelete) updatedCachedRows.delete(muscle_id);

      return [pageKeyQuery, updatedCachedRows] as const;
    })
    .filter(
      (x): x is readonly [string, Map<MuscleGroup, ExerciseMuscleRow>] =>
        x !== null,
    );

  for (const [pageKeyQuery, updatedCachedRows] of updates) {
    EXERCISE_MUSCLE_CACHE.set(pageKeyQuery, updatedCachedRows);
  }
}

function getPageKeyExerciseMuscle(exercise_id: UUID, user_id: UUID): string {
  return pageKey("exMc", { exercise_id, user_id });
}

export async function fetchExerciseMuscleVolumes(
  exerciseId: UUID,
  userId: UUID,
): Promise<Map<MuscleGroup, ExerciseMuscleRow>> {
  const key = getPageKeyExerciseMuscle(exerciseId, userId);
  return EXERCISE_MUSCLE_CACHE.fetch(key, async () => {
    const { data, error } = await supabase
      .from("exercise_muscle")
      .select("*")
      .eq("exercise_id", exerciseId);
    if (error) throw error;
    const exerciseMuscleData = data satisfies ExerciseMuscleRow[];

    const userEntries = exerciseMuscleData.filter(
      (row) => row.user_id === userId,
    );
    const musclesAlreadyEstablished = new Set(
      userEntries.map((row) => row.muscle_id),
    );
    const systemEntries = exerciseMuscleData.filter(
      (row) =>
        row.user_id === null && !musclesAlreadyEstablished.has(row.muscle_id),
    );
    const allEntries = [...userEntries, ...systemEntries];
    return new Map(allEntries.map((row) => [row.muscle_id, row]));
  });
}

export async function addExerciseMuscleVolume(args: {
  muscle_id: MuscleGroup;
  exercise_id: UUID;
  volume_factor: number;
  user_id: UUID;
}): Promise<void> {
  if (args.volume_factor < 0 || args.volume_factor > 1) {
    throw new Error(
      `Volume should be between 0 and 1. Got ${args.volume_factor}`,
    );
  }

  const { data, error } = await supabase
    .from("exercise_muscle")
    .insert(args)
    .select("*")
    .single();

  if (error) throw error;

  const key = getPageKeyExerciseMuscle(args.exercise_id, args.user_id);

  const existing = EXERCISE_MUSCLE_CACHE.peek(key);
  const newMap = new Map(existing ?? []);
  newMap.set(data.muscle_id, data);
  EXERCISE_MUSCLE_CACHE.set(key, newMap);
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

  if (error) throw error;

  const inner = EXERCISE_MUSCLE_CACHE.getInnerMap();

  const updates = Array.from(inner.entries())
    .filter(([_k, cachedRows]) =>
      Array.from(cachedRows.values()).some((row) => row.id === data.id),
    )
    .map(([pageKeyQuery, cachedRows]) => {
      const updatedCachedRows = new Map(cachedRows);
      for (const [muscle_id, row] of updatedCachedRows.entries()) {
        if (row.id === data.id) updatedCachedRows.set(muscle_id, data);
      }
      return [pageKeyQuery, updatedCachedRows] as const;
    });

  for (const [pageKeyQuery, updatedCachedRows] of updates) {
    EXERCISE_MUSCLE_CACHE.set(pageKeyQuery, updatedCachedRows);
  }
}

export async function deleteExerciseMuscleVolume(id: UUID): Promise<void> {
  const { data, error } = await supabase
    .from("exercise_muscle")
    .delete()
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data === null) return;

  // refetch the system row if it exists
  const { data: systemRow, error: sysErr } = await supabase
    .from("exercise_muscle")
    .select("*")
    .eq("exercise_id", data.exercise_id)
    .eq("muscle_id", data.muscle_id)
    .is("user_id", null)
    .maybeSingle();
  if (sysErr) throw sysErr;

  const inner = EXERCISE_MUSCLE_CACHE.getInnerMap();

  const updates = Array.from(inner.entries())
    .map(([pageKeyQuery, cachedRows]) => {
      let keyToEdit: MuscleGroup | null = null;
      for (const [muscle_id, row] of cachedRows.entries()) {
        if (row.id === data.id) {
          keyToEdit = muscle_id;
          break;
        }
      }
      if (keyToEdit === null) return null;

      const updatedCachedRows = new Map(cachedRows);
      if (systemRow !== null) {
        updatedCachedRows.set(keyToEdit, systemRow);
      } else {
        updatedCachedRows.delete(keyToEdit);
      }
      return [pageKeyQuery, updatedCachedRows] as const;
    })
    .filter(
      (x): x is readonly [string, Map<MuscleGroup, ExerciseMuscleRow>] =>
        x !== null,
    );

  for (const [pageKeyQuery, updatedCachedRows] of updates) {
    EXERCISE_MUSCLE_CACHE.set(pageKeyQuery, updatedCachedRows);
  }
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
