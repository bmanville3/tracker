import { UUID } from "../types";
import { FullDetachedWorkoutForMode } from "./workoutSharedApi";

export async function upsertTemplateWorkout(
  payload: FullDetachedWorkoutForMode<"template">,
  workoutTemplateId?: UUID | null,
): Promise<boolean> {
  return true;
}
