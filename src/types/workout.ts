import {
  DistanceUnit,
  RPE,
  SetType,
  TimeUnit,
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
  workout_type: WorkoutType;
};

export type WorkoutLogRow = AbstractWorkout &
  AllOrNothing<AssociatedProgramFields> & {
    user_id: UUID;
    completed_on: ISODate;

    duration: number | null;
    duration_unit: TimeUnit;

    bodyweight: number | null;
    bodyweight_unit: WeightUnit;
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
  time_unit: TimeUnit;

  set_type: SetType;
  rest_seconds_before: number | null;
};

export type PossiblePerformanceSetFields = {
  performance_type: string;
  percentage_of_max: null;
  max_percentage_exercise_id: null;
  reps: null;
  rpe: null;
  weight: null;
  distance_per_rep: null;
  duration: null;
};

export const LOG_PERFORMANCE_TYPES = ["weight", "movement"] as const;

export type LogPerformanceType = (typeof LOG_PERFORMANCE_TYPES)[number];

export type PossiblePerformanceSetLogFields = PossiblePerformanceSetFields & {
  performance_type: LogPerformanceType;
};

export const TEMPLATE_PERFORMANCE_TYPES = [
  "rpe",
  "percentage",
  "distance_only",
  "time_only",
  "distance_and_time",
] as const;

export type TemplatePerformanceType =
  (typeof TEMPLATE_PERFORMANCE_TYPES)[number];

// compile time assertion that template and log never overlap
type AssertNever<T extends never> = T;
type _NoOverlap = AssertNever<
  Extract<LogPerformanceType, TemplatePerformanceType>
>;

///////////
// full workout+exercise+set fields for template
///////////

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

export type WeightLogSet = Omit<
  PossiblePerformanceSetLogFields,
  "rpe" | "reps" | "weight" | "duration"
> & {
  performance_type: "weight";
  weight: number | null;
  reps: number | null;
  rpe: RPE | null;
  duration: number | null;
};

export type DistnaceLogSet = Omit<
  PossiblePerformanceSetLogFields,
  "duration" | "distance_per_rep" | "reps" | "weight"
> & {
  performance_type: "movement";
  duration: number | null;
  distance_per_rep: number | null;
  reps: number | null;
  weight: number | null;
};

export type WorkoutExerciseSetLogRow = AbstractWorkoutExerciseSet &
  (WeightLogSet | DistnaceLogSet);
