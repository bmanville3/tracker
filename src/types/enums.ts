export const MUSCLE_GROUPS = [
  "chest",
  "upper_back",
  "lats",
  "traps",
  "front_delts",
  "side_delts",
  "rear_delts",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "lower_back",
  "spinal_erectors",
  "glutes",
  "adductors",
  "abductors",
  "quads",
  "hamstrings",
  "calves",
  "neck",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EXERCISE_AND_MUSCLE_TAGS = [
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
] as const;

export type ExerciseAndMuscleTag = (typeof EXERCISE_AND_MUSCLE_TAGS)[number];

export const PROGRAM_EDITOR_ROLES = ["owner", "viewer", "editor"] as const;

export type ProgramEditorRole = (typeof PROGRAM_EDITOR_ROLES)[number];

export const WEIGHT_UNITS = ["kg", "lb"] as const;

export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const DISTANCE_UNITS = ["m", "km", "mi", "ft", "yd"] as const;

export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const TIME_UNITS = ["sec", "min", "hr"] as const;

export type TimeUnit = (typeof TIME_UNITS)[number];

export const TRACKABLE_TAGS = ["program"] as const;

export type TrackableTag = (typeof TRACKABLE_TAGS)[number];

export const SET_TYPES = ["warmup", "top", "backoff", null] as const;

export type SetType = (typeof SET_TYPES)[number];

export const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export type RPE = (typeof RPES)[number];

export const RIRS = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0] as const;

export type RIR = (typeof RIRS)[number];

export const WORKOUT_TYPES = ["deload", "test", null] as const;

export type WorkoutType = (typeof WORKOUT_TYPES)[number];
