import {
  AllOrNothing,
  AssociatedProgramFields,
  ExerciseRow,
  ProgramRow,
  WorkoutExerciseLogRow,
  WorkoutExerciseSetLogRow,
  WorkoutExerciseSetTemplateRow,
  WorkoutExerciseTemplateRow,
  WorkoutLogRow,
  WorkoutTemplateRow,
} from "../types";
import { arraysEqual, doubleArraysEqual, OmitNever } from "../utils";

export type WorkoutEditorMode = "template" | "log";

export type ModeTypes<M extends WorkoutEditorMode> = M extends "template"
  ? {
      WorkoutRow: WorkoutTemplateRow;
      ExerciseRow: WorkoutExerciseTemplateRow;
      SetRow: WorkoutExerciseSetTemplateRow;
    }
  : {
      WorkoutRow: WorkoutLogRow;
      ExerciseRow: WorkoutExerciseLogRow;
      SetRow: WorkoutExerciseSetLogRow;
    };

export type CompleteProgram = OmitNever<AssociatedProgramFields, "program_id"> & {
  program_row: ProgramRow;
};

export type EditableProgramFields<M extends WorkoutEditorMode> =
  M extends "template" ? CompleteProgram : AllOrNothing<CompleteProgram>;

export type EditableWorkout<M extends WorkoutEditorMode> =
  Omit<ModeTypes<M>["WorkoutRow"], 'id' | keyof AssociatedProgramFields>
  & EditableProgramFields<M>
  & {'id'?: never};

export type EditableExercise<M extends WorkoutEditorMode> = OmitNever<
  ModeTypes<M>["ExerciseRow"],
  "id" | "workout_id" | "exercise_id" | "exercise_index"
> & {
  exercise: ExerciseRow;
};

export type EditableSet<M extends WorkoutEditorMode> = OmitNever<
  ModeTypes<M>["SetRow"],
  "id" | "workout_exercise_id" | "set_index"
>;

export type FullDetachedWorkoutForMode<M extends WorkoutEditorMode> = {
  workout: EditableWorkout<M>;
  exercises: EditableExercise<M>[];
  sets: EditableSet<M>[][];
};

export type WorkoutTableName<M extends WorkoutEditorMode> = M extends "log"
  ? "workout_log"
  : "workout_template";

export type WorkoutExerciseTableName<M extends WorkoutEditorMode> =
  M extends "log" ? "workout_exercise_log" : "workout_exercise_template";

export type WorkoutSetTableName<M extends WorkoutEditorMode> = M extends "log"
  ? "workout_exercise_set_log"
  : "workout_exercise_set_template";

export type EditablePerformanceType<M extends WorkoutEditorMode> = ModeTypes<M>['SetRow']["performance_type"];


export function isFullLogWorkout(
  fw: FullDetachedWorkoutForMode<WorkoutEditorMode>,
): fw is FullDetachedWorkoutForMode<"log"> {
  return isLogWorkout(fw.workout);
}

export function isFullTemplateWorkout(
  fw: FullDetachedWorkoutForMode<WorkoutEditorMode>,
): fw is FullDetachedWorkoutForMode<"template"> {
  return isTemplateWorkout(fw.workout);
}

// equality of types

export function editableProgramFieldsEqual(
  a: EditableProgramFields<WorkoutEditorMode>,
  b: EditableProgramFields<WorkoutEditorMode>,
): boolean {
  if (a === b) return true;

  if (a.program_row === null && b.program_row === null) return true;
  if (a.program_row === null || b.program_row === null) return false;

  return (
    a.program_row.id === b.program_row.id &&
    a.block_in_program === b.block_in_program &&
    a.week_in_block === b.week_in_block &&
    a.day_in_week === b.day_in_week
  );
}

export function isLogWorkout(
  w: EditableWorkout<WorkoutEditorMode>,
): w is EditableWorkout<"log"> {
  return "user_id" in w;
}

export function isTemplateWorkout(
  w: EditableWorkout<WorkoutEditorMode>,
): w is EditableWorkout<"template"> {
  return !("user_id" in w);
}

export function editableWorkoutEqual<M extends WorkoutEditorMode>(
  a: EditableWorkout<M>,
  b: EditableWorkout<M>,
): boolean {
  if (isLogWorkout(a) && isLogWorkout(b)) {
    if (
      a.user_id !== b.user_id ||
      a.duration_seconds !== b.duration_seconds ||
      a.completed_on !== b.completed_on
    ) {
      return false;
    }
  } else if (isTemplateWorkout(a) && isTemplateWorkout(b)) {
    // nothig special about template workouts yet
  } else {
    console.error(`Got different editable workout types:\n\t${a}\n\t${b}`);
    return false;
  }

  const sameScalars =
    a.name === b.name &&
    a.notes === b.notes &&
    a.bodyweight_kg === b.bodyweight_kg &&
    a.workout_type === b.workout_type;

  if (!sameScalars) return false;

  return editableProgramFieldsEqual(
    a satisfies EditableProgramFields<WorkoutEditorMode>,
    b satisfies EditableProgramFields<WorkoutEditorMode>,
  );
}

export function editableExerciseEqual<M extends WorkoutEditorMode>(
  a: EditableExercise<M>,
  b: EditableExercise<M>,
): boolean {
  // they are the same right now
  const sameMeta = a.superset_group === b.superset_group && a.notes === b.notes;

  if (!sameMeta) return false;

  return a.exercise.id === b.exercise.id;
}

export type AnyEditableSet = EditableSet<WorkoutEditorMode>;

export function isLogSet(
  s: EditableSet<WorkoutEditorMode>,
): s is EditableSet<"log"> {
  return "is_complete" in s;
}

export function isTemplateSet(
  s: EditableSet<WorkoutEditorMode>,
): s is EditableSet<"template"> {
  return !("is_complete" in s);
}

// having to use this here
// im not sure why but typescript complains with a generic
export function editableSetEqual(
  a: AnyEditableSet,
  b: AnyEditableSet,
): boolean {
  if (
    a.weight_unit !== b.weight_unit ||
    a.distance_unit !== b.distance_unit ||
    a.set_type !== b.set_type ||
    a.duration_seconds !== b.duration_seconds ||
    a.performance_type !== b.performance_type ||
    a.percentage_of_max !== b.percentage_of_max ||
    a.max_percentage_exercise_id !== b.max_percentage_exercise_id ||
    a.reps !== b.reps ||
    a.rpe !== b.rpe ||
    a.weight !== b.weight ||
    a.rest_seconds_before !== b.rest_seconds_before
  ) {
    return false;
  }

  if (isLogSet(a) && isLogSet(b)) {
    if (a.is_complete !== b.is_complete) return false;
    return true;
  }

  if (isTemplateSet(a) && isTemplateSet(b)) {
    return true;
  }

  console.error(`Got different editable set types:\n\t${a}\n\t${b}`);
  return false;
}

export function fullDetachedWorkoutEqual<M extends WorkoutEditorMode>(
  a: FullDetachedWorkoutForMode<M> | null,
  b: FullDetachedWorkoutForMode<M> | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;

  if (!editableWorkoutEqual(a.workout, b.workout)) return false;
  if (
    !arraysEqual(a.exercises, b.exercises, (x, y) =>
      editableExerciseEqual(x, y),
    )
  )
    return false;
  if (!doubleArraysEqual(a.sets, b.sets, (a, b) => editableSetEqual(a, b)))
    return false;

  return true;
}

export function workoutHasProgram(
  w: EditableWorkout<WorkoutEditorMode>,
): w is
  | EditableWorkout<"template">
  | (EditableWorkout<"log"> & CompleteProgram) {
  return w.program_row !== null;
}
