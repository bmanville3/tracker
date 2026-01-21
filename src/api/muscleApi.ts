import { supabase } from "../supabase";
import { CACHE_FACTORY } from "../swrCache";
import { MuscleGroupRow } from "../types";
import { MuscleGroup } from "../types/enums";
import { showAlert } from "../utils";

export const MUSCLE_CACHE_NAME = "muscleCache";
const MUSCLE_CACHE = CACHE_FACTORY.getOrCreateSwrIdCache<MuscleGroupRow>(
  MUSCLE_CACHE_NAME,
  null,
);

async function fetchAllMuscleGroupsFromDb(): Promise<MuscleGroupRow[]> {
  const { data, error } = await supabase.from("muscle_groups").select("*");
  if (error) {
    showAlert("Error fetching muscle groups from database", error.message);
    throw error;
  }
  return data;
}

export async function fetchMuscleGroups(): Promise<
  Map<MuscleGroup, MuscleGroupRow>
> {
  // we know this will have keys of MuscleGroups since they are the id
  return (await MUSCLE_CACHE.fetch(fetchAllMuscleGroupsFromDb)) as Map<
    MuscleGroup,
    MuscleGroupRow
  >;
}
