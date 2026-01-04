import { EditableSet, EditableWorkout } from "@/src/api/workoutSharedApi";
import { DistanceUnit, WeightUnit } from "@/src/types";
import { todayISO } from "@/src/utils";
import { WorkoutEditorModeStrategy } from "./WorkoutView";

export const logWorkoutStrategy: WorkoutEditorModeStrategy<"log"> = {
  mode: "log",

  createEmptyWorkout(): EditableWorkout<"log"> {
    return {
      name: "",
      notes: "",
      bodyweight_kg: null,

      user_id: "",
      completed_on: todayISO(),
      duration_seconds: null,

      program_row: null,
      block_in_program: null,
      week_in_block: null,
      day_in_week: null,
      workout_type: null,
    } satisfies EditableWorkout<"log">;
  },

  createEmptySet(ctx: {
    weightUnit: WeightUnit;
    distanceUnit: DistanceUnit;
  }): EditableSet<"log"> {
    const { weightUnit, distanceUnit } = ctx;

    return {
      weight_unit: weightUnit,
      distance_unit: distanceUnit,
      set_type: null,
      duration_seconds: null,
      performance_type: "weight",

      percentage_of_max: null,
      max_percentage_exercise_id: null,

      reps: null,
      rpe: null,
      weight: null,
      rest_seconds_before: null,

      is_complete: false,
      distance_per_rep: null,
    } satisfies EditableSet<"log">;
  },
};
