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
  exercise_index: number;

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
  set_index: number;

  weight_unit: WeightUnit;
  distance_unit: DistanceUnit;

  set_type: SetType;
  duration_seconds: number | null;
  performance_type: PerformanceType;
  rest_seconds_before: number | null;
};

export type PossiblePerformanceSetFields = {
  performance_type: PerformanceType;
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

export type TemplatePerformanceType = Extract<
  PerformanceType,
  "percentage" | "rpe"
>;

export type PossiblePerformanceSetTemplateFields =
  PossiblePerformanceSetFields & {
    performance_type: TemplatePerformanceType;
  };

export type PercentageTemplateSet = Omit<
  PossiblePerformanceSetTemplateFields,
  "percentage_of_max" | "max_percentage_exercise_id" | "reps"
> & {
  performance_type: "percentage";
  percentage_of_max: number | null; // defaults to workout_exercise->exercise_id if null
  max_percentage_exercise_id: UUID | null;
  reps: number | null;
};

export type RpeTemplateSet = Omit<
  PossiblePerformanceSetTemplateFields,
  "rpe" | "reps"
> & {
  performance_type: "rpe";
  rpe: RPE | null;
  reps: number | null;
};

export type WorkoutExerciseSetTemplateRow = AbstractWorkoutExerciseSet &
  (PercentageTemplateSet | RpeTemplateSet);

///////////
// full workout+exercise+set fields for logs
///////////

export type LogPerformanceType = Extract<PerformanceType, "weight">;

export type PossiblePerformanceSetLogFields = PossiblePerformanceSetFields & {
  performance_type: LogPerformanceType;
};

export type WeightLogSet = Omit<
  PossiblePerformanceSetLogFields,
  "rpe" | "reps" | "weight" | "duration_seconds"
> & {
  performance_type: "weight";
  weight: number | null;
  reps: number | null;
  rpe: RPE | null;
  duration_seconds: number | null;
};

export type WorkoutExerciseSetLogRow = AbstractWorkoutExerciseSet &
  WeightLogSet & {
    is_complete: boolean;
  };
