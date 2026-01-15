import { NEVER_CHANGES_RESET_TIME } from "../constants";
import { supabase } from "../supabase";
import { CACHE_FACTORY } from "../swrCache";
import { MuscleGroupRow } from "../types";
import { MuscleGroup } from "../types/enums";
import { showAlert } from "../utils";

const MUSCLE_CACHE = CACHE_FACTORY.getOrCreateSwrIdCache<MuscleGroupRow>(
  "muscleCache",
  NEVER_CHANGES_RESET_TIME,
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
