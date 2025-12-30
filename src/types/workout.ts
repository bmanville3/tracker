import {
  DistanceUnit,
  PerformanceType,
  RPE,
  SetType,
  WeightUnit,
  WorkoutType,
} from "./enums";
import { AllOrNothing, ISODate, UUID } from "./generic";

export type AssociatedProgramFields = {
  program_id: UUID;
  day_in_week: number;
  week_in_block: number;
  block_in_program: number;
};

///////////
// full workout fields
///////////

export type AbstractWorkout = {
  id: UUID;
  name: string;
  notes: string;
  bodyweight_kg: number | null;
  workout_type: WorkoutType;
};

export type WorkoutLogRow = AbstractWorkout &
  AllOrNothing<AssociatedProgramFields> & {
    user_id: UUID;
    completed_on: ISODate;
    duration_seconds: number | null;
  };

export type WorkoutTemplateRow = AbstractWorkout & AssociatedProgramFields & {};

///////////
// full workout+exercise fields
///////////

export type AbstractWorkoutExercise = {
  id: UUID;

  workout_id: UUID;
  exercise_id: UUID;

  superset_group: number | null;
  order: string | null;

  notes: string;
};

export type WorkoutExerciseLogRow = AbstractWorkoutExercise;

export type WorkoutExerciseTemplateRow = AbstractWorkoutExercise;

///////////
// full workout+exercise+set fields
///////////

export type AbstractWorkoutExerciseSet = {
  id: UUID;
  workout_exercise_id: UUID;
  set_number: number;

  weight_unit: WeightUnit;
  distance_unit: DistanceUnit;

  set_type: SetType;
  duration_seconds: number | null;
  performance_type: PerformanceType;
};

export type PossiblePerformanceSetFields = AbstractWorkoutExerciseSet & {
  percentage_of_max: null;
  max_percentage_exercise_id: null;
  reps: null;
  rpe: null;
  weight: null;
  distance_per_rep: null;
  duration_seconds: null;
};

///////////
// full workout+exercise+set fields for template
///////////

export type PercentageTemplateSet = Omit<
  PossiblePerformanceSetFields,
  "percentage_of_max" | "max_percentage_exercise_id" | "reps"
> & {
  performance_type: "percentage";
  percentage_of_max: number;
  max_percentage_exercise_id: UUID;
  reps: number;
};

export type RpeTemplateSet = Omit<
  PossiblePerformanceSetFields,
  "rpe" | "reps"
> & {
  performance_type: "rpe";
  rpe: RPE;
  reps: number;
};

export type WorkoutExerciseSetTemplate = PercentageTemplateSet | RpeTemplateSet;

///////////
// full workout+exercise+set fields for logs
///////////

export type WeightLogSet = Omit<
  PossiblePerformanceSetFields,
  "rpe" | "reps" | "weight" | "duration_seconds"
> & {
  performance_type: "weight";
  weight: number;
  reps: number;
  rpe: RPE;
  duration_seconds: number | null;
};

export type WorkoutExerciseSetLogRow = WeightLogSet & {
  is_complete: boolean;
  rest_seconds_before: number | null;
};
