import {
  EXERCISE_MUSCLE_CACHE_NAME,
  fetchExerciseMuscleVolumes,
} from "@/src/api/exerciseApi";
import { fetchMuscleGroups } from "@/src/api/muscleApi";
import {
  FullAttachedWorkout,
  isFullAttachedLogWorkouts,
  isFullAttachedTemplateWorkouts,
  WorkoutEditorMode,
} from "@/src/api/workoutSharedApi";
import {
  Button,
  ClosableModal,
  ModalPicker,
  Selection,
} from "@/src/components";
import { ALLOWED_VOLUMES } from "@/src/screens/exercise/VolumeRender";
import { CACHE_FACTORY } from "@/src/swrCache";
import { colors, spacing, typography } from "@/src/theme";
import {
  ExerciseMuscleRow,
  MUSCLE_GROUPS,
  MuscleGroup,
  MuscleGroupRow,
  RPE,
  RPES,
  UUID,
} from "@/src/types";
import { daysBetweenDates, isRealNumber, requireGetUser } from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BarChart, barDataItem } from "react-native-gifted-charts";
import {
  Contribution,
  emptyContributionRecord,
  emptyMGRecord,
  extractVolumes,
} from "./helpers";

type VolumesProps<M extends WorkoutEditorMode> = {
  /** Workouts to model volume. */
  workoutsForMuscleVolume: FullAttachedWorkout<M>[];
  daysSpan?: number | null;
};

function daysToLabel(number: 1 | 7 | 30 | 365) {
  return number === 1
    ? "Daily"
    : number === 7
      ? "Weekly"
      : number === 30
        ? "Monthly"
        : "Yearly";
}

export function Volumes(props: VolumesProps<WorkoutEditorMode>) {
  const { workoutsForMuscleVolume, daysSpan } = props;
  // If is fetching volumes of the workouts.
  const [isFetchingVolumes, setIsFetchingVolumes] = useState<boolean>(false);
  // whats actually fetched by above query
  const [exerciseToMuscleVolume, setExerciseToMuscleVolume] = useState<
    Map<UUID, Map<MuscleGroup, ExerciseMuscleRow>>
  >(new Map());
  // per exercise extraction of workoutsForMuscleVolume
  const [exerciseContributionToVolume, setExerciseContributionToVolume] =
    useState<Record<MuscleGroup, Map<UUID, Contribution>>>(
      emptyContributionRecord(),
    );
  // when true, opens up a pop up showing exercise contributions
  const [openExerciseContribution, setOpenExerciseContribution] = useState<
    [string, [UUID, Contribution][]] | null
  >(null);
  // the flat out muscle volumes from all the workouts
  const [muscleVolumes, setMuscleVolumes] =
    useState<Record<MuscleGroup, number>>(emptyMGRecord());
  // id to row in database
  const [muscleGroupsToRow, setMuscleGroupsToRow] = useState<
    Map<MuscleGroup, MuscleGroupRow>
  >(new Map());

  // advanced settings for volume
  const [showAdvancedVolumeSettings, setShowAdvancedVolumeSettings] =
    useState<boolean>(false);
  const [showAsNDayAverage, setShowAsNDayAverage] = useState<
    1 | 7 | 30 | 365 | null
  >(null);
  const [filterWarmups, setFilterWarmups] = useState<boolean>(true);
  const [mustBeGeEqThresh, setMustBeGeEqThresh] = useState<number | null>(null);
  const [rpeMustMeetCriteria, setRPEMustMeetCriteria] = useState<
    RPE | null | "no-track"
  >(6);
  const [disableFractionalVolume, setDisableFractionalVolume] =
    useState<boolean>(false);

  const numDaysSpanned = useMemo(() => {
    if (daysSpan !== undefined && daysSpan !== null) {
      return daysSpan;
    }
    if (
      workoutsForMuscleVolume.length === 0 ||
      workoutsForMuscleVolume.length === 1
    ) {
      return workoutsForMuscleVolume.length;
    }
    if (isFullAttachedLogWorkouts(workoutsForMuscleVolume)) {
      let firstDay = workoutsForMuscleVolume[0].workout.completed_on;
      let lastDay = workoutsForMuscleVolume[0].workout.completed_on;
      for (const workout of workoutsForMuscleVolume) {
        if (workout.workout.completed_on < firstDay) {
          firstDay = workout.workout.completed_on;
        }
        if (workout.workout.completed_on > lastDay) {
          lastDay = workout.workout.completed_on;
        }
      }
      // only one day, the below returns 0 so +1. only two days, the below returns 1 so +1. ....
      return daysBetweenDates(firstDay, lastDay) + 1;
    } else if (isFullAttachedTemplateWorkouts(workoutsForMuscleVolume)) {
      const blockToWeeks: Map<number, Set<number>> = new Map();
      workoutsForMuscleVolume.forEach((w) => {
        const block = w.workout.block_in_program;
        const week = w.workout.week_in_block;
        blockToWeeks.set(
          block,
          (blockToWeeks.get(block) ?? new Set()).add(week),
        );
      });
      let numWeeks = 0;
      blockToWeeks.values().forEach((s) => {
        let lastWeek = -1;
        for (const wk of s) {
          if (wk > lastWeek) lastWeek = wk;
        }
        // last week is 0 indexed
        numWeeks += lastWeek + 1;
      });
      return numWeeks * 7;
    } else {
      throw new Error(
        `Cannot process workouts due to type: ${JSON.stringify(workoutsForMuscleVolume)}`,
      );
    }
  }, [workoutsForMuscleVolume, daysSpan]);

  const uniqueExerciseIds = useMemo(() => {
    const ids = new Set<UUID>();
    for (const w of workoutsForMuscleVolume) {
      for (const ex of w.exercises) {
        ids.add(ex.exercise.id);
      }
    }
    return ids;
  }, [workoutsForMuscleVolume]);

  useEffect(() => {
    void (async () => setMuscleGroupsToRow(await fetchMuscleGroups()))();
  }, []);

  const fetchMuscleVolumeForGivenWorkout = useCallback(async () => {
    setIsFetchingVolumes(true);
    try {
      const user = await requireGetUser();
      if (!user) return;

      const entries = await Promise.all(
        [...uniqueExerciseIds].map(async (exId) => {
          const volume = await fetchExerciseMuscleVolumes(exId, user.user_id);
          return [exId, volume] as const;
        }),
      );
      const newMap = new Map(entries);

      const { newContributionRecord, totalVolume } = extractVolumes({
        exToMuscVolume: newMap,
        workoutsForMuscleVolume,
        filterWarmups,
        mustBeGeEqThresh,
        disableFractionalVolume,
        rpeMustMeetCriteria,
      });
      setExerciseContributionToVolume(newContributionRecord);
      setMuscleVolumes(totalVolume);
      setExerciseToMuscleVolume(newMap);
    } finally {
      setIsFetchingVolumes(false);
    }
  }, [
    uniqueExerciseIds,
    workoutsForMuscleVolume,
    filterWarmups,
    mustBeGeEqThresh,
    disableFractionalVolume,
    rpeMustMeetCriteria,
  ]);

  useEffect(() => {
    void fetchMuscleVolumeForGivenWorkout();
    return CACHE_FACTORY.subscribe((e) => {
      if (e.cacheName === EXERCISE_MUSCLE_CACHE_NAME) {
        void fetchMuscleVolumeForGivenWorkout();
      }
    });
  }, [fetchMuscleVolumeForGivenWorkout]);

  const barData = MUSCLE_GROUPS.map((mg) => {
    const display = muscleGroupsToRow.get(mg)?.display_name ?? mg;
    const idsToContributions = exerciseContributionToVolume[mg];
    const idsAndContributions = Array.from(idsToContributions.entries());
    idsAndContributions.sort(
      (a, b) =>
        b[1].numSets * b[1].volumeFactor - a[1].numSets * a[1].volumeFactor,
    );
    let volume = muscleVolumes[mg] ?? 0;
    if (showAsNDayAverage && numDaysSpanned > 0) {
      volume = (volume / numDaysSpanned) * showAsNDayAverage;
    }
    return {
      value: Math.round(volume * 10) / 10,
      label: display,
      onPress: () => {
        setOpenExerciseContribution([display, idsAndContributions]);
      },
    } satisfies barDataItem;
  });
  barData.sort((a, b) => b.value - a.value);
  const maxBarValue = Math.max(20, ...barData.map((b) => b.value)) * 1.1;

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          marginBottom: spacing.sm,
        }}
      >
        <Text style={typography.body}>Advanced Filters and Settings</Text>
        <Feather
          name={
            showAdvancedVolumeSettings ? "arrow-up-circle" : "arrow-down-circle"
          }
          size={18}
          onPress={() => setShowAdvancedVolumeSettings((prev) => !prev)}
        />
      </View>

      {showAdvancedVolumeSettings && (
        <View
          style={{
            rowGap: spacing.xs,
            marginBottom: spacing.sm,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            padding: spacing.padding_lg,
            borderRadius: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Text style={typography.body}>Show as Trend:</Text>
            <ModalPicker
              title="Show as Trend"
              help="Scales your recent average volume to show trends over different time periods (e.g., weekly trend from the last 30 days, daily trend from the last 7 days). Formula used is: (total volume ÷ days in range) × trend period."
              options={(
                [null, "Daily", "Weekly", "Monthly", "Yearly"] as const
              ).map((n) => {
                return {
                  label: n === null ? "None" : n,
                  value: n,
                };
              })}
              onChange={(value) => {
                if (value === null) {
                  setShowAsNDayAverage(value);
                } else if (value === "Daily") {
                  setShowAsNDayAverage(1);
                } else if (value === "Weekly") {
                  setShowAsNDayAverage(7);
                } else if (value === "Monthly") {
                  setShowAsNDayAverage(30);
                } else if (value === "Yearly") {
                  setShowAsNDayAverage(365);
                }
              }}
              value={
                showAsNDayAverage === null
                  ? null
                  : daysToLabel(showAsNDayAverage)
              }
              pressableProps={{
                style: { alignSelf: "flex-start", padding: spacing.padding_sm },
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Selection
              title={"Filter Warmups"}
              isSelected={filterWarmups}
              onPress={() => setFilterWarmups((prev) => !prev)}
              style={{ alignSelf: "flex-start" }}
            />
            <Selection
              title={"Disable Fractional Volue"}
              isSelected={disableFractionalVolume}
              onPress={() => setDisableFractionalVolume((prev) => !prev)}
              style={{ alignSelf: "flex-start" }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Text style={typography.body}>Set Volume Threshold:</Text>
            <ModalPicker
              title="Set Volume Threshold"
              help="An exercise must past this threshold in order to contribute to total muscle set volume."
              options={[...ALLOWED_VOLUMES, null].map((v) => {
                return { label: v === null ? "None" : v.toString(), value: v };
              })}
              value={mustBeGeEqThresh}
              onChange={(value) => setMustBeGeEqThresh(value)}
              pressableProps={{
                style: { alignSelf: "flex-start", padding: spacing.padding_sm },
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Text style={typography.body}>RPE Filter:</Text>
            <ModalPicker
              title="Set RPE Filter"
              help="A set must achieve at least this RPE to be tracked. If RPE is missing and there is an applied filter, the set is ignored."
              options={[...RPES, null, "no-track"].map((v) => {
                return {
                  label:
                    v === null
                      ? "No Filter"
                      : v === "no-track"
                        ? "Remove sets without an RPE"
                        : `\u2265${v}`,
                  value: v,
                };
              })}
              value={rpeMustMeetCriteria}
              onChange={(value) => {
                if (value === null) {
                  setRPEMustMeetCriteria(null);
                } else if (value === "no-track") {
                  setRPEMustMeetCriteria("no-track");
                } else if (isRealNumber(value) && RPES.includes(value)) {
                  setRPEMustMeetCriteria(value);
                } else {
                  throw new Error(`Got value=${value}`);
                }
              }}
              pressableProps={{
                style: { alignSelf: "flex-start", padding: spacing.padding_sm },
              }}
            />
          </View>
          <View style={{ rowGap: spacing.xs }}>
            <Text style={typography.label}>Defaults to Try:</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Selection
                title={"Default"}
                isSelected={
                  disableFractionalVolume === false &&
                  filterWarmups === true &&
                  showAsNDayAverage === null &&
                  mustBeGeEqThresh === null &&
                  rpeMustMeetCriteria === 6
                }
                onPress={() => {
                  setDisableFractionalVolume(false);
                  setFilterWarmups(true);
                  setShowAsNDayAverage(null);
                  setMustBeGeEqThresh(null);
                  setRPEMustMeetCriteria(6);
                }}
              />
              <Selection
                title={"No Fracs"}
                isSelected={
                  disableFractionalVolume === true &&
                  filterWarmups === true &&
                  showAsNDayAverage === null &&
                  mustBeGeEqThresh === 0.5 &&
                  rpeMustMeetCriteria === 6
                }
                onPress={() => {
                  setDisableFractionalVolume(true);
                  setFilterWarmups(true);
                  setShowAsNDayAverage(null);
                  setMustBeGeEqThresh(0.5);
                  setRPEMustMeetCriteria(6);
                }}
              />
            </View>
          </View>
        </View>
      )}
      <View>
        {isFetchingVolumes ? (
          <View>
            <ActivityIndicator />
            <Text style={typography.hint}>Loading muscle volumes…</Text>
          </View>
        ) : (
          <BarChart
            data={barData}
            barWidth={34}
            spacing={40}
            height={220}
            frontColor={colors.primary}
            maxValue={maxBarValue}
            hideYAxisText={true}
            yAxisThickness={0}
            initialSpacing={20}
            endSpacing={10}
            xAxisLabelTextStyle={{
              ...typography.hint,
              color: colors.textPrimary,
              fontWeight: "600",
              backgroundColor: colors.primarySoft,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              marginRight: 1,
            }}
            rulesColor={colors.border}
            topLabelTextStyle={typography.hint}
            showValuesAsTopLabel
          />
        )}
      </View>

      <ClosableModal
        visible={openExerciseContribution !== null}
        onRequestClose={() => setOpenExerciseContribution(null)}
        center
      >
        <Text
          style={{
            ...typography.title,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            marginBottom: spacing.sm,
          }}
        >
          Volume Contributions for{" "}
          {openExerciseContribution?.[0] ?? "Unknown Musle"}
        </Text>
        {openExerciseContribution !== null &&
        openExerciseContribution[1].length > 0 ? (
          openExerciseContribution[1].map(([id, contribution]) => {
            if (contribution.volumeFactor === 0 || contribution.numSets === 0) {
              return null;
            }
            const conFac = contribution.numSets * contribution.volumeFactor;
            return (
              <View
                key={id}
                style={{
                  marginBottom: spacing.xs,
                  gap: spacing.xs,
                  borderWidth: 2,
                  borderColor: colors.border,
                  borderRadius: 20,
                  paddingHorizontal: spacing.padding_xl,
                  paddingVertical: spacing.padding_lg,
                }}
              >
                <Text style={{ ...typography.body, fontWeight: "700" }}>
                  {contribution.exerciseRow.name}:
                </Text>
                <View style={{ flexDirection: "row" }}>
                  <Text
                    style={{
                      ...styles.highlightedText,
                      alignSelf: "flex-start",
                    }}
                  >
                    {contribution.numSets} Set
                    {contribution.numSets === 1 ? "" : "s"} @{" "}
                    {contribution.volumeFactor} Volume per Set
                  </Text>
                  <Text style={{ ...typography.body, fontWeight: "700" }}>
                    &rarr;
                  </Text>
                  <Text
                    style={{ ...styles.highlightedText, fontWeight: "700" }}
                  >
                    {conFac.toFixed(1)} Set{conFac === 1 ? "" : "s"}
                  </Text>
                </View>
                {showAsNDayAverage && numDaysSpanned > 0 && (
                  <View style={{ flexDirection: "row" }}>
                    <Text
                      style={{
                        ...styles.highlightedText,
                        alignSelf: "flex-start",
                      }}
                    >
                      {showAsNDayAverage} Day Average
                    </Text>
                    <Text style={{ ...typography.body, fontWeight: "700" }}>
                      &rarr;
                    </Text>
                    <Text
                      style={{ ...styles.highlightedText, fontWeight: "700" }}
                    >
                      {((conFac / numDaysSpanned) * showAsNDayAverage).toFixed(
                        2,
                      )}{" "}
                      Set
                      {(conFac / numDaysSpanned) * showAsNDayAverage === 1
                        ? ""
                        : "s"}{" "}
                      / {daysToLabel(showAsNDayAverage)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text>No Exercise Found</Text>
        )}
        <Button
          title="Close"
          onPress={() => setOpenExerciseContribution(null)}
        />
      </ClosableModal>
    </View>
  );
}

const styles = StyleSheet.create({
  highlightedText: {
    ...typography.body,
    backgroundColor: colors.fadedPrimary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.padding_sm,
  },
});
