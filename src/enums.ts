export type MuscleGroup =
  | "chest"
  | "upper_back"
  | "lats"
  | "traps"
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "lower_back"
  | "spinal_erectors"
  | "glutes"
  | "adductors"
  | "abductors"
  | "quads"
  | "hamstrings"
  | "calves"
  | "neck";

export type MuscleTag =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower";

export type ProgramEditorRole =
  | "owner"
  | "viewer"
  | "editor";

export type ProgramUserRole =
  | "trainee"
  | "coach";

export type WeightUnit = "kg" | "lb";
export type DistanceUnit = "m" | "km" | "mi" | "ft" | "yd";

export type TrackableTag = 
  | "program";
