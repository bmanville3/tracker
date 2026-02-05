import {
  AssociatedProgramFields,
  ExerciseRow,
  LOG_PERFORMANCE_TYPES,
  LogPerformanceType,
  ProgramRow,
  TEMPLATE_PERFORMANCE_TYPES,
  TemplatePerformanceType,
  UUID,
  WorkoutExerciseLogRow,
  WorkoutExerciseSetLogRow,
  WorkoutExerciseSetTemplateRow,
  WorkoutExerciseTemplateRow,
  WorkoutLogRow,
  WorkoutTemplateRow,
} from "../types";
import {
  AllOrNothing,
  arraysEqual,
  doubleArraysEqual,
  OmitNever,
  showAlert,
} from "../utils";

export type WorkoutEditorMode = "template" | "log";

export type CompleteProgram = OmitNever<
  AssociatedProgramFields,
  "program_id"
> & {
  program_row: ProgramRow;
};

export type EditableProgramFields<M extends WorkoutEditorMode> =
  M extends "template" ? CompleteProgram : AllOrNothing<CompleteProgram>;

export type ModeTypes<M extends WorkoutEditorMode> = M extends "template"
  ? {
      WorkoutRow: Omit<
        WorkoutTemplateRow,
        "id" | keyof AssociatedProgramFields
      > &
        EditableProgramFields<M> & { id?: never };
      WorkoutExerciseRow: OmitNever<
        WorkoutExerciseTemplateRow,
        "id" | "workout_id" | "exercise_id" | "exercise_index"
      > & { exercise: ExerciseRow };
      WorkoutExerciseSetRow: OmitNever<
        WorkoutExerciseSetTemplateRow,
        "id" | "workout_exercise_id" | "set_index"
      >;
    }
  : {
      WorkoutRow: Omit<WorkoutLogRow, "id" | keyof AssociatedProgramFields> &
        EditableProgramFields<M> & { id?: never };
      WorkoutExerciseRow: OmitNever<
        WorkoutExerciseLogRow,
        "id" | "workout_id" | "exercise_id" | "exercise_index"
      > & { exercise: ExerciseRow };
      WorkoutExerciseSetRow: OmitNever<
        WorkoutExerciseSetLogRow,
        "id" | "workout_exercise_id" | "set_index"
      >;
    };

export type EditableWorkout<M extends WorkoutEditorMode> =
  ModeTypes<M>["WorkoutRow"];
export type EditableExercise<M extends WorkoutEditorMode> =
  ModeTypes<M>["WorkoutExerciseRow"];
export type EditableSet<M extends WorkoutEditorMode> =
  ModeTypes<M>["WorkoutExerciseSetRow"];

export type FullDetachedWorkoutForMode<M extends WorkoutEditorMode> = {
  workout: EditableWorkout<M>;
  exercises: EditableExercise<M>[];
  sets: EditableSet<M>[][];
};

export function isLogWorkout(
  w: EditableWorkout<WorkoutEditorMode>,
): w is EditableWorkout<"log"> {
  return "completed_on" in w;
}

export function isTemplateWorkout(
  w: EditableWorkout<WorkoutEditorMode>,
): w is EditableWorkout<"template"> {
  return !("completed_on" in w);
}

export function isLogSet(
  s: EditableSet<WorkoutEditorMode>,
): s is EditableSet<"log"> {
  return LOG_PERFORMANCE_TYPES.includes(
    s.performance_type as LogPerformanceType,
  );
}

export function isTemplateSet(
  s: EditableSet<WorkoutEditorMode>,
): s is EditableSet<"template"> {
  return TEMPLATE_PERFORMANCE_TYPES.includes(
    s.performance_type as TemplatePerformanceType,
  );
}

export function isFullDetachedLogWorkout(
  fw: FullDetachedWorkoutForMode<WorkoutEditorMode>,
): fw is FullDetachedWorkoutForMode<"log"> {
  return isLogWorkout(fw.workout);
}

export function isFullDetachedTemplateWorkout(
  fw: FullDetachedWorkoutForMode<WorkoutEditorMode>,
): fw is FullDetachedWorkoutForMode<"template"> {
  return isTemplateWorkout(fw.workout);
}

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

export function editableWorkoutEqual(
  a: EditableWorkout<WorkoutEditorMode>,
  b: EditableWorkout<WorkoutEditorMode>,
): boolean {
  if (isLogWorkout(a) && isLogWorkout(b)) {
    if (
      a.user_id !== b.user_id ||
      a.duration !== b.duration ||
      a.duration_unit !== b.duration_unit ||
      a.bodyweight !== b.bodyweight ||
      a.bodyweight_unit !== b.bodyweight_unit ||
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
    a.workout_type === b.workout_type;

  if (!sameScalars) return false;

  return editableProgramFieldsEqual(a, b);
}

export function editableExerciseEqual(
  a: EditableExercise<WorkoutEditorMode>,
  b: EditableExercise<WorkoutEditorMode>,
): boolean {
  // they are the same right now
  const sameMeta = a.superset_group === b.superset_group && a.notes === b.notes;

  if (!sameMeta) return false;

  return a.exercise.id === b.exercise.id;
}

// having to use this here
// im not sure why but typescript complains with a generic
export function editableSetEqual(
  a: EditableSet<WorkoutEditorMode>,
  b: EditableSet<WorkoutEditorMode>,
): boolean {
  if (
    a.weight_unit !== b.weight_unit ||
    a.distance_unit !== b.distance_unit ||
    a.set_type !== b.set_type ||
    a.duration !== b.duration ||
    a.time_unit !== b.time_unit ||
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
    return true;
  }

  if (isTemplateSet(a) && isTemplateSet(b)) {
    return true;
  }

  console.error(`Got different editable set types:\n\t${a}\n\t${b}`);
  return false;
}

export function fullDetachedWorkoutEqual(
  a: FullDetachedWorkoutForMode<WorkoutEditorMode> | null,
  b: FullDetachedWorkoutForMode<WorkoutEditorMode> | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;

  if (isFullDetachedLogWorkout(a) && isFullDetachedLogWorkout(b)) {
    // nothing to do here yet
  } else if (
    isFullDetachedTemplateWorkout(a) &&
    isFullDetachedTemplateWorkout(b)
  ) {
    // nothing to do here yet
  } else {
    console.error(`Got different detached full workout types:\n\t${a}\n\t${b}`);
    return false;
  }

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

export type FullAttachedWorkout<M extends WorkoutEditorMode> =
  FullDetachedWorkoutForMode<M> & {
    workoutId: UUID;
  };

export function isFullAttachedLogWorkout(
  fw: FullAttachedWorkout<WorkoutEditorMode>,
): fw is FullAttachedWorkout<"log"> {
  return isLogWorkout(fw.workout);
}

export function isFullAttachedLogWorkouts(
  fw: FullAttachedWorkout<WorkoutEditorMode>[],
): fw is FullAttachedWorkout<"log">[] {
  if (fw.length === 0) {
    return true;
  }
  return isLogWorkout(fw[0].workout);
}

export function isFullAttachedTemplateWorkout(
  fw: FullAttachedWorkout<WorkoutEditorMode>,
): fw is FullAttachedWorkout<"template"> {
  return isTemplateWorkout(fw.workout);
}

export function isFullAttachedTemplateWorkouts(
  fw: FullAttachedWorkout<WorkoutEditorMode>[],
): fw is FullAttachedWorkout<"template">[] {
  if (fw.length === 0) {
    return true;
  }
  return isTemplateWorkout(fw[0].workout);
}

function logOob(ctx: string, details: Record<string, unknown>): void {
  console.error(`[workout-bounds] ${ctx}`, details);
  showAlert(
    "A bounds error was caught when trying to edit the workout. You should try to save your progress and refresh the page.",
    `[workout-bounds] ${ctx}`,
  );
}

function checkExercisesSetsSameLength<M extends WorkoutEditorMode>(
  ctx: string,
  fullWorkout: FullDetachedWorkoutForMode<M>,
) {
  const exLen = fullWorkout.exercises.length;
  const setsLen = fullWorkout.sets.length;
  if (exLen !== setsLen) {
    logOob(`${ctx}: exercises/sets length mismatch`, {
      exercisesLength: exLen,
      setsLength: setsLen,
    });
  }
}

function checkExerciseIndex<M extends WorkoutEditorMode>(
  ctx: string,
  fullWorkout: FullDetachedWorkoutForMode<M>,
  exerciseIndex: number,
): boolean {
  checkExercisesSetsSameLength(ctx, fullWorkout);

  const exLen = fullWorkout.exercises.length;
  const setsLen = fullWorkout.sets.length;

  if (exerciseIndex < 0 || exerciseIndex >= exLen) {
    logOob(`${ctx}: exerciseIndex out of bounds for exercises`, {
      exerciseIndex,
      exercisesLength: exLen,
      setsLength: setsLen,
    });
    return false;
  }
  if (exerciseIndex >= setsLen) {
    logOob(`${ctx}: exerciseIndex out of bounds for sets`, {
      exerciseIndex,
      exercisesLength: exLen,
      setsLength: setsLen,
    });
    return false;
  }
  return true;
}

function checkSetIndex<M extends WorkoutEditorMode>(
  ctx: string,
  fullWorkout: FullDetachedWorkoutForMode<M>,
  exerciseIndex: number,
  setIndex: number,
): boolean {
  if (!checkExerciseIndex(ctx, fullWorkout, exerciseIndex)) {
    return false;
  }
  const setsForExercise = fullWorkout.sets[exerciseIndex];
  if (setIndex < 0 || setIndex >= setsForExercise.length) {
    logOob(`${ctx}: setIndex out of bounds`, {
      exerciseIndex,
      setIndex,
      setsForExerciseLength: setsForExercise.length,
    });
    return false;
  }
  return true;
}

// all of these function do NOT mutate fullWorkout

export function addSetToWorkout<M extends WorkoutEditorMode>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  exerciseIndex: number;
  newSet: EditableSet<M>;
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, exerciseIndex, newSet } = args;

  if (!checkExerciseIndex("addSetToWorkout", fullWorkout, exerciseIndex)) {
    return fullWorkout;
  }

  const nextSetsForExercise = [...fullWorkout.sets[exerciseIndex], newSet];
  const nextSets = fullWorkout.sets.map((s, i) =>
    i === exerciseIndex ? nextSetsForExercise : s,
  );

  return { ...fullWorkout, sets: nextSets };
}

export function removeSetFromWorkout<M extends WorkoutEditorMode>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  exerciseIndex: number;
  setIndex: number;
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, exerciseIndex, setIndex } = args;

  if (
    !checkSetIndex("removeSetFromWorkout", fullWorkout, exerciseIndex, setIndex)
  ) {
    return fullWorkout;
  }

  const nextSetsForExercise = fullWorkout.sets[exerciseIndex].filter(
    (_s, i) => i !== setIndex,
  );
  const nextSets = fullWorkout.sets.map((s, i) =>
    i === exerciseIndex ? nextSetsForExercise : s,
  );

  return { ...fullWorkout, sets: nextSets };
}

export function updateSetForWorkout<
  M extends WorkoutEditorMode,
  K extends keyof EditableSet<M>,
>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  exerciseIndex: number;
  setIndex: number;
  key: K;
  value: EditableSet<M>[K];
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, exerciseIndex, setIndex, key, value } = args;

  if (
    !checkSetIndex("updateSetForWorkout", fullWorkout, exerciseIndex, setIndex)
  ) {
    return fullWorkout;
  }

  const prevSetsForExercise = fullWorkout.sets[exerciseIndex];
  const prevSet = prevSetsForExercise[setIndex];

  const nextSet: EditableSet<M> = { ...prevSet, [key]: value };
  const nextSetsForExercise = prevSetsForExercise.map((s, i) =>
    i === setIndex ? nextSet : s,
  );

  const nextSets = fullWorkout.sets.map((s, i) =>
    i === exerciseIndex ? nextSetsForExercise : s,
  );

  return { ...fullWorkout, sets: nextSets };
}

export function swapSetsInExercises<M extends WorkoutEditorMode>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  exerciseIndex: number;
  setIndexFirst: number;
  setIndexSecond: number;
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, exerciseIndex, setIndexFirst, setIndexSecond } = args;

  if (
    !checkSetIndex(
      "swapSetsInExercises: setIndexFirst",
      fullWorkout,
      exerciseIndex,
      setIndexFirst,
    )
  ) {
    return fullWorkout;
  }
  if (
    !checkSetIndex(
      "swapSetsInExercises: setIndexSecond",
      fullWorkout,
      exerciseIndex,
      setIndexSecond,
    )
  ) {
    return fullWorkout;
  }
  if (setIndexFirst === setIndexSecond) {
    return fullWorkout;
  }

  const prev = fullWorkout.sets[exerciseIndex];
  const nextSetsForExercise = [...prev];
  const tmp = nextSetsForExercise[setIndexFirst];
  nextSetsForExercise[setIndexFirst] = nextSetsForExercise[setIndexSecond];
  nextSetsForExercise[setIndexSecond] = tmp;

  const nextSets = fullWorkout.sets.map((s, i) =>
    i === exerciseIndex ? nextSetsForExercise : s,
  );

  return { ...fullWorkout, sets: nextSets };
}

export function addExerciseToWorkout<M extends WorkoutEditorMode>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  newExercise: EditableExercise<M>;
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, newExercise } = args;

  checkExercisesSetsSameLength("addExerciseToWorkout", fullWorkout);

  return {
    ...fullWorkout,
    exercises: [...fullWorkout.exercises, newExercise],
    sets: [...fullWorkout.sets, []],
  };
}

export function removeExerciseFromWorkoutByIndex<
  M extends WorkoutEditorMode,
>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  exerciseIndex: number;
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, exerciseIndex } = args;

  if (
    !checkExerciseIndex(
      "removeExerciseFromWorkoutByIndex",
      fullWorkout,
      exerciseIndex,
    )
  ) {
    return fullWorkout;
  }

  return {
    ...fullWorkout,
    exercises: fullWorkout.exercises.filter((_ex, i) => i !== exerciseIndex),
    sets: fullWorkout.sets.filter((_s, i) => i !== exerciseIndex),
  };
}

export function removeExerciseFromWorkoutById<
  M extends WorkoutEditorMode,
>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  exerciseId: UUID;
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, exerciseId } = args;

  checkExercisesSetsSameLength("removeExerciseFromWorkoutById", fullWorkout);

  // keep indices in sync without a Set + second pass mutation
  const nextExercises: EditableExercise<M>[] = [];
  const nextSets: EditableSet<M>[][] = [];

  fullWorkout.exercises.forEach((ex, i) => {
    if (ex.exercise.id !== exerciseId) {
      nextExercises.push(ex);
      nextSets.push(fullWorkout.sets[i]);
    }
  });

  return { ...fullWorkout, exercises: nextExercises, sets: nextSets };
}

export function updateExerciseForWorkout<
  M extends WorkoutEditorMode,
  K extends keyof EditableExercise<M>,
>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  exerciseIndex: number;
  key: K;
  value: EditableExercise<M>[K];
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, exerciseIndex, key, value } = args;

  if (
    !checkExerciseIndex("updateExerciseForWorkout", fullWorkout, exerciseIndex)
  ) {
    return fullWorkout;
  }

  const nextExercises = fullWorkout.exercises.map((ex, i) =>
    i === exerciseIndex ? ({ ...ex, [key]: value } as EditableExercise<M>) : ex,
  );

  return { ...fullWorkout, exercises: nextExercises };
}

export function updateExercisesForWorkoutWhere<
  M extends WorkoutEditorMode,
  K extends keyof EditableExercise<M>,
>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  predicate: (editableExercise: EditableExercise<M>) => boolean;
  key: K;
  value: EditableExercise<M>[K];
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, predicate, key, value } = args;

  checkExercisesSetsSameLength("updateExercisesForWorkoutWhere", fullWorkout);

  const nextExercises = fullWorkout.exercises.map((ex) =>
    predicate(ex) ? ({ ...ex, [key]: value } as EditableExercise<M>) : ex,
  );

  return { ...fullWorkout, exercises: nextExercises };
}

export function swapExercisesInWorkout<M extends WorkoutEditorMode>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  exerciseIndexFirst: number;
  exerciseIndexSecond: number;
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, exerciseIndexFirst, exerciseIndexSecond } = args;

  if (
    !checkExerciseIndex(
      "swapExercisesInWorkout: exerciseIndexFirst",
      fullWorkout,
      exerciseIndexFirst,
    )
  ) {
    return fullWorkout;
  }
  if (
    !checkExerciseIndex(
      "swapExercisesInWorkout: exerciseIndexSecond",
      fullWorkout,
      exerciseIndexSecond,
    )
  ) {
    return fullWorkout;
  }
  if (exerciseIndexFirst === exerciseIndexSecond) {
    return fullWorkout;
  }

  const nextExercises = [...fullWorkout.exercises];
  const exTmp = nextExercises[exerciseIndexFirst];
  nextExercises[exerciseIndexFirst] = nextExercises[exerciseIndexSecond];
  nextExercises[exerciseIndexSecond] = exTmp;

  const nextSets = [...fullWorkout.sets];
  const setsTmp = nextSets[exerciseIndexFirst];
  nextSets[exerciseIndexFirst] = nextSets[exerciseIndexSecond];
  nextSets[exerciseIndexSecond] = setsTmp;

  return { ...fullWorkout, exercises: nextExercises, sets: nextSets };
}

export function updateWorkoutInWorkout<
  M extends WorkoutEditorMode,
  K extends keyof EditableWorkout<M>,
>(args: {
  fullWorkout: FullDetachedWorkoutForMode<M>;
  key: K;
  value: EditableWorkout<M>[K];
}): FullDetachedWorkoutForMode<M> {
  const { fullWorkout, key, value } = args;

  checkExercisesSetsSameLength("updateWorkoutInWorkout", fullWorkout);

  return {
    ...fullWorkout,
    workout: { ...fullWorkout.workout, [key]: value },
  };
}
