// interfaces.ts
// Simple DB-aligned interfaces (1:1 with tables)

import { DistanceUnit, ProgramEditorRole, ProgramUserRole, TrackableTag, WeightUnit } from "./enums";

export type UUID = string;
export type ISODate = string; // "YYYY-MM-DD"
export type ISOTimestamp = string; // ISO 8601 timestamptz string

/** Effort metrics */
export type RPE = number; // 1..10
export type RIR = number; // 0..10

export interface ProgramRow {
  id: UUID;

  name: string;
  owned_by: UUID;
  description: string;
  num_weeks: number;
}

export interface ProgramMembershipRow {
  program_id: UUID;
  user_id: UUID;
  editor_role: ProgramEditorRole;
  user_role: ProgramUserRole;
}

export interface UserProfileRow {
  user_id: UUID;
  display_name: string;

  default_weight_unit: WeightUnit;
  default_distance_unit: DistanceUnit;
}

export interface TrackedUserItemRow {
  user_id: UUID;
  item_id: UUID;
  item_tag: TrackableTag;
}

// /* ===================== USERS ===================== */

// export interface UserProfileRow {
//   user_id: UUID; // FK auth.users
//   display_name: string | null;

//   unit_system: UnitSystem;
//   default_weight_unit: WeightUnit;
//   default_distance_unit: DistanceUnit;

//   created_at: ISOTimestamp;
// }

// /**
//  * Program → coaches join table
//  */
// export interface ProgramCoachRow {
//   program_id: UUID; // FK program.id
//   coach_user_id: UUID; // FK auth.users.id
//   can_edit: boolean;

//   created_at: ISOTimestamp;
// }

// /* ===================== WORKOUTS ===================== */
// /**
//  * A workout is the single source of truth:
//  * - planned
//  * - scheduled
//  * - completed
//  * - edited
//  */
// export interface WorkoutRow {
//   id: UUID;

//   program_id: UUID; // FK program.id

//   name: string;
//   notes: string | null;

//   scheduled_date: ISODate | null;
//   is_complete: boolean;

//   created_at: ISOTimestamp;
// }

// /* ===================== GLOBAL EXERCISES ===================== */

// export interface ExerciseRow {
//   id: UUID;
//   name: string;
//   description: string | null;

//   created_at: ISOTimestamp | null;
// }

// export interface ModifierRow {
//   id: UUID;
//   name: string;
//   description: string | null;
// }

// /**
//  * User-specific exercise → muscle mapping.
//  * muscle_id references MUSCLES[x].id (static list).
//  */
// export interface ExerciseMuscleRow {
//   user_id: UUID; // FK auth.users
//   exercise_id: UUID; // FK exercise.id

//   muscle_id: MuscleEntry["id"];
//   contribution: number; // 0..1
// }

// /* ===================== WORKOUT CONTENT ===================== */

// export interface WorkoutExerciseRow {
//   id: UUID;

//   workout_id: UUID; // FK workout.id
//   exercise_id: UUID; // FK exercise.id

//   order: number;
//   notes: string | null;
// }

// export interface WorkoutExerciseModifierRow {
//   workout_exercise_id: UUID; // FK workout_exercise.id
//   modifier_id: UUID; // FK modifier.id
// }

// export interface WorkoutSetRow {
//   id: UUID;
//   workout_exercise_id: UUID; // FK workout_exercise.id

//   set_index: number;

//   // Strength
//   reps: number | null;
//   weight_value: number | null;
//   weight_unit: WeightUnit | null;

//   // Effort
//   rpe: RPE | null;
//   rir: RIR | null;

//   // Timing / cardio
//   rest_sec: number | null;
//   duration_sec: number | null;
//   distance_value: number | null;
//   distance_unit: DistanceUnit | null;
//   calories: number | null;

//   notes: string | null;

//   created_at: ISOTimestamp;
//   is_complete: boolean;
// }

// /* ===================== BODY METRICS ===================== */

// export interface BodyMetricsRow {
//   id: UUID;
//   user_id: UUID; // FK auth.users

//   measured_at: ISOTimestamp;

//   bodyweight_value: number | null;
//   bodyweight_unit: WeightUnit | null;

//   sleep_hours: number | null;
//   soreness: number | null; // 1..10
//   fatigue: number | null; // 1..10
//   stress: number | null; // 1..10

//   notes: string | null;
// }

// /* ===================== PR CACHE (OPTIONAL) ===================== */

// export type PRMetric =
//   | "one_rep_max_estimate"
//   | "max_weight"
//   | "max_reps"
//   | "best_time"
//   | "best_distance"
//   | "max_volume";

// export interface PersonalRecordRow {
//   id: UUID;

//   user_id: UUID; // trainee
//   exercise_id: UUID;

//   metric: PRMetric;
//   value: number;
//   value_unit: string | null;

//   achieved_at: ISOTimestamp;

//   workout_id: UUID | null; // FK workout.id
//   set_id: UUID | null; // FK workout_set.id

//   notes: string | null;
// }
