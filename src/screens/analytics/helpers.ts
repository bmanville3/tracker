import {
  FullAttachedWorkout,
  WorkoutEditorMode,
} from "@/src/api/workoutSharedApi";
import {
  ExerciseMuscleRow,
  ExerciseRow,
  MUSCLE_GROUPS,
  MuscleGroup,
  RPE,
  UUID,
} from "@/src/types";

export function emptyMGRecord(): Record<MuscleGroup, number> {
  return MUSCLE_GROUPS.reduce<Record<MuscleGroup, number>>(
    (acc, mg) => {
      acc[mg] = 0;
      return acc;
    },
    {} as Record<MuscleGroup, number>,
  );
}

export type Contribution = {
  exerciseRow: ExerciseRow;
  numSets: number;
  volumeFactor: number;
};

export function emptyContributionRecord(): Record<
  MuscleGroup,
  Map<UUID, Contribution>
> {
  return Object.fromEntries(
    MUSCLE_GROUPS.map((mg) => [mg, new Map()]),
  ) as Record<MuscleGroup, Map<UUID, Contribution>>;
}

export function extractVolumes<M extends WorkoutEditorMode>(props: {
  workoutsForMuscleVolume: FullAttachedWorkout<M>[];
  exToMuscVolume: Map<string, Map<MuscleGroup, ExerciseMuscleRow>>;
  filterWarmups: boolean;
  mustBeGeEqThresh: number | null;
  disableFractionalVolume: boolean;
  rpeMustMeetCriteria: RPE | null | "no-track";
}) {
  const {
    workoutsForMuscleVolume,
    exToMuscVolume,
    filterWarmups,
    mustBeGeEqThresh,
    disableFractionalVolume,
    rpeMustMeetCriteria,
  } = props;
  const totalVolume = emptyMGRecord();
  const newContributionRecord = emptyContributionRecord();
  const exercisesToSetCount: Map<UUID, [ExerciseRow, number]> = new Map();
  for (const w of workoutsForMuscleVolume) {
    for (const [i, ex] of w.exercises.entries()) {
      let numSetsDone =
        w.sets[i]?.filter((s) => {
          if (filterWarmups && s.set_type === "warmup") {
            return false;
          }
          if (rpeMustMeetCriteria === "no-track") {
            if (s.rpe === null) {
              return false;
            }
          } else if (rpeMustMeetCriteria !== null) {
            if (s.rpe === null || s.rpe < rpeMustMeetCriteria) {
              return false;
            }
          }
          return true;
        }).length ?? 0;
      exercisesToSetCount.set(ex.exercise.id, [
        ex.exercise,
        (exercisesToSetCount.get(ex.exercise.id)?.[1] ?? 0) + numSetsDone,
      ]);
    }
  }
  for (const [exId, [exercise, count]] of exercisesToSetCount.entries()) {
    const volumeForExercise = exToMuscVolume.get(exId) ?? new Map();
    if (volumeForExercise.size === 0) {
      continue;
    }
    for (const mg of MUSCLE_GROUPS) {
      let vf = volumeForExercise.get(mg)?.volume_factor ?? 0;
      if (mustBeGeEqThresh !== null && vf < mustBeGeEqThresh) {
        continue;
      }
      if (disableFractionalVolume) {
        vf = vf > 0 ? 1 : 0;
      }
      const contribution = vf * count;
      totalVolume[mg] += contribution;
      if (contribution > 0) {
        newContributionRecord[mg].set(exId, {
          exerciseRow: exercise,
          volumeFactor: vf,
          numSets: count,
        });
      }
    }
  }
  return { newContributionRecord, totalVolume };
}
