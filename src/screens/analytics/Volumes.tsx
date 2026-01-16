import { fetchExerciseMuscleVolumes } from "@/src/api/exerciseApi";
import { fetchMuscleGroups } from "@/src/api/muscleApi";
import { FullAttachedWorkout, WorkoutEditorMode } from "@/src/api/workoutSharedApi";
import {
  Button,
  ClosableModal,
  ModalPicker,
  Selection,
} from "@/src/components";
import { ALLOWED_VOLUMES } from "@/src/screens/exercise/VolumeRender";
import { colors, spacing, typography } from "@/src/theme";
import {
  ExerciseMuscleRow,
  MUSCLE_GROUPS,
  MuscleGroup,
  MuscleGroupRow,
  UUID
} from "@/src/types";
import { requireGetUser } from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart, barDataItem } from "react-native-gifted-charts";
import { Contribution, emptyContributionRecord, emptyMGRecord, extractVolumes } from "./helpers";

type VolumesProps<M extends WorkoutEditorMode> = {
  /** Workouts to model volume. */
  workoutsForMuscleVolume: FullAttachedWorkout<M>[];
  /** Increment this to refresh the data. */
  refreshToken: number;
  /** Number of days the workouts span. Should be >0. */
  workoutsDaysSpan: number;

  afterRefresh?: () => void;
}

export function Volumes<M extends WorkoutEditorMode>(props: VolumesProps<M>) {
  const { workoutsForMuscleVolume, refreshToken, workoutsDaysSpan, afterRefresh } = props;
  ///////////
  // Start volume related thing
  ///////////

  // volume helpers
  const [isFetchingVolumes, setIsFetchingVolumes] = useState<boolean>(false);

  // whats actually fetched by above query
  const [exerciseToMuscleVolume, setExerciseToMuscleVolume] = useState<
    Map<UUID, Map<MuscleGroup, ExerciseMuscleRow>>
  >(new Map());

  // extraction of workoutsForMuscleVolume
  const [exerciseContributionToVolume, setExerciseContributionToVolume] =
    useState<Record<MuscleGroup, Map<UUID, Contribution>>>(
      emptyContributionRecord(),
    );
  const [openExerciseContribution, setOpenExerciseContribution] = useState<
    [string, [UUID, Contribution][]] | null
  >(null);
  const [muscleVolumes, setMuscleVolumes] =
    useState<Record<MuscleGroup, number>>(emptyMGRecord());
  const [muscleGroupsToRow, setMuscleGroupsToRow] = useState<
    Map<MuscleGroup, MuscleGroupRow>
  >(new Map());

  // advanced settings for volume
  const [showAdvancedVolumeSettings, setShowAdvancedVolumeSettings] =
    useState<boolean>(false);
  const [showAsNDayAverage, setShowAsNDayAverage] = useState<number | null>(
    null,
  );
  const [filterWarmups, setFilterWarmups] = useState<boolean>(true);
  const [mustBeGeEqThresh, setMustBeGeEqThresh] = useState<number | null>(null);
  const [disableFractionalVolume, setDisableFractionalVolume] =
    useState<boolean>(false);

  ///////////
  // Volume related thing
  ///////////

  const resetAdvanced = () => {
    setShowAsNDayAverage(null);
    setFilterWarmups(true);
    setMustBeGeEqThresh(null);
    setDisableFractionalVolume(false);
    setShowAdvancedVolumeSettings(false);
  }

  const resetVolumes = () => {
    setMuscleVolumes(emptyMGRecord());
    setOpenExerciseContribution(null);
    setExerciseToMuscleVolume(new Map());
    setExerciseContributionToVolume(emptyContributionRecord());
    (async () => {
      setMuscleGroupsToRow(await fetchMuscleGroups());
      await fetchMuscleVolumeForGivenWorkout();
    })();
  }

  useEffect(() => {
    resetAdvanced();
    resetVolumes();
  }, [])

  useEffect(() => {
    resetVolumes();
  }, [workoutsForMuscleVolume, refreshToken]);

  const fetchMuscleVolumeForGivenWorkout = async () => {
    setIsFetchingVolumes(true);
    const user = await requireGetUser();
    if (!user) {
      setIsFetchingVolumes(false);
      return;
    }
    try {
      const uniqueExerciseIds = new Set<UUID>();
      for (const w of workoutsForMuscleVolume) {
        for (const ex of w.exercises) {
          uniqueExerciseIds.add(ex.exercise.id);
        }
      }
      const newMap = new Map<UUID, Map<MuscleGroup, ExerciseMuscleRow>>();
      for (const exId of uniqueExerciseIds) {
        const volumeForExercise = await fetchExerciseMuscleVolumes(
          exId,
          user.user_id,
        );
        newMap.set(exId, volumeForExercise);
      }
      setExerciseToMuscleVolume(newMap);
      loadVolumeFieldsFromState(newMap);
      if (afterRefresh) {
        afterRefresh();
      }
    } finally {
      setIsFetchingVolumes(false);
    }
  };

  const loadVolumeFieldsFromState = (exToMuscVolume: Map<string, Map<MuscleGroup, ExerciseMuscleRow>>) => {
    const { newContributionRecord, totalVolume } = extractVolumes({
      exToMuscVolume,
      workoutsForMuscleVolume,
      filterWarmups,
      mustBeGeEqThresh,
      disableFractionalVolume
    });
    setExerciseContributionToVolume(newContributionRecord);
    setMuscleVolumes(totalVolume);
  };

  useEffect(() => loadVolumeFieldsFromState(exerciseToMuscleVolume), [
    workoutsForMuscleVolume,
    exerciseToMuscleVolume,
    disableFractionalVolume,
    mustBeGeEqThresh,
    filterWarmups,
  ]);

  const barData = MUSCLE_GROUPS.map((mg) => {
    const display = muscleGroupsToRow.get(mg)?.display_name ?? mg;
    const idsToContributions = exerciseContributionToVolume[mg];
    const idsAndContributions = Array.from(idsToContributions.entries());
    idsAndContributions.sort(
      (a, b) =>
        b[1].numSets * b[1].volumeFactor - a[1].numSets * a[1].volumeFactor,
    );
    let volume = muscleVolumes[mg] ?? 0;
    if (showAsNDayAverage) {
      volume /= showAsNDayAverage;
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
            <Text style={typography.body}>N-Day Average:</Text>
            <ModalPicker
              title="Show as N-Day Average"
              help="Averages the volumes over N days. For example, to get your weekly average set N=7. N cannot be set greater than the number of days."
              options={[
                null,
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
                9,
                10,
                11,
                12,
                13,
                14,
                15,
                20,
                25,
                30,
                60,
                90,
                120,
                200,
                300,
                365,
              ]
                .filter((n) => n === null || n <= workoutsDaysSpan)
                .map((n) => {
                  return {
                    label: n === null ? "None" : n.toString(),
                    value: n,
                  };
                })}
              onChange={(value) => {
                if (value === null) {
                  setShowAsNDayAverage(value);
                } else if (value <= workoutsDaysSpan) {
                  setShowAsNDayAverage(value);
                }
              }}
              value={showAsNDayAverage}
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
                  mustBeGeEqThresh === null
                }
                onPress={() => {
                  setDisableFractionalVolume(false);
                  setFilterWarmups(true);
                  setShowAsNDayAverage(null);
                  setMustBeGeEqThresh(null);
                }}
              />
              <Selection
                title={"No Fracs"}
                isSelected={
                  disableFractionalVolume === true &&
                  filterWarmups === true &&
                  showAsNDayAverage === null &&
                  mustBeGeEqThresh === 0.5
                }
                onPress={() => {
                  setDisableFractionalVolume(true);
                  setFilterWarmups(true);
                  setShowAsNDayAverage(null);
                  setMustBeGeEqThresh(0.5);
                }}
              />
            </View>
            {workoutsDaysSpan >= 7 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Selection
                  title={"Weekly Avg"}
                  isSelected={
                    disableFractionalVolume === false &&
                    filterWarmups === true &&
                    showAsNDayAverage === 7 &&
                    mustBeGeEqThresh === null
                  }
                  onPress={() => {
                    setDisableFractionalVolume(false);
                    setFilterWarmups(true);
                    setShowAsNDayAverage(7);
                    setMustBeGeEqThresh(null);
                  }}
                />
                <Selection
                  title={"Weekly Avg No Fracs"}
                  isSelected={
                    disableFractionalVolume === true &&
                    filterWarmups === true &&
                    showAsNDayAverage === 7 &&
                    mustBeGeEqThresh === 0.5
                  }
                  onPress={() => {
                    setDisableFractionalVolume(true);
                    setFilterWarmups(true);
                    setShowAsNDayAverage(7);
                    setMustBeGeEqThresh(0.5);
                  }}
                />
              </View>
            )}
            {workoutsDaysSpan >= 30 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Selection
                  title={"Monthly Avg"}
                  isSelected={
                    disableFractionalVolume === false &&
                    filterWarmups === true &&
                    showAsNDayAverage === 30 &&
                    mustBeGeEqThresh === null
                  }
                  onPress={() => {
                    setDisableFractionalVolume(false);
                    setFilterWarmups(true);
                    setShowAsNDayAverage(30);
                    setMustBeGeEqThresh(null);
                  }}
                />
                <Selection
                  title={"Weekly Avg No Fracs"}
                  isSelected={
                    disableFractionalVolume === true &&
                    filterWarmups === true &&
                    showAsNDayAverage === 30 &&
                    mustBeGeEqThresh === 0.5
                  }
                  onPress={() => {
                    setDisableFractionalVolume(true);
                    setFilterWarmups(true);
                    setShowAsNDayAverage(30);
                    setMustBeGeEqThresh(0.5);
                  }}
                />
              </View>
            )}
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
          <ScrollView horizontal>
            <BarChart
              data={barData}
              disableScroll={true} // i like look better with my own scroll
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
          </ScrollView>
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
                {showAsNDayAverage && (
                  <View style={{ flexDirection: "row" }}>
                    <Text
                      style={{
                        ...styles.highlightedText,
                        alignSelf: "flex-start",
                      }}
                    >
                      Averaging Over {showAsNDayAverage}
                    </Text>
                    <Text style={{ ...typography.body, fontWeight: "700" }}>
                      &rarr;
                    </Text>
                    <Text
                      style={{ ...styles.highlightedText, fontWeight: "700" }}
                    >
                      {(conFac / showAsNDayAverage).toFixed(2)} Set
                      {conFac / showAsNDayAverage === 1 ? "" : "s"} /{" "}
                      {showAsNDayAverage} Day
                      {showAsNDayAverage === 1 ? "" : "s"}
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
