import { fetchExerciseMuscleVolumes } from "@/src/api/exerciseApi";
import { fetchMuscleGroups } from "@/src/api/muscleApi";
import { fetchWorkoutLogsOnOrAfterDate, FullAttachedWorkoutLog } from "@/src/api/workoutLogApi";
import { Button, ClosableModal, ModalPicker, Screen } from "@/src/components";
import { RpeTableModal } from "@/src/components/RPEChart";
import { colors, spacing, typography } from "@/src/theme";
import { ExerciseRow, ISODate, MUSCLE_GROUPS, MuscleGroup, MuscleGroupRow, UUID } from "@/src/types";
import { requireGetUser, toISODate } from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View, StyleSheet } from "react-native";
import { BarChart, barDataItem } from "react-native-gifted-charts";

function daysAgo(days: number): ISODate {
  if (days < 0) {
    return toISODate(new Date(0));
  }
  const today = new Date();
  today.setDate(today.getDate() - days);
  return toISODate(today);
}

function emptyMGRecord(): Record<MuscleGroup, number> {
  return MUSCLE_GROUPS.reduce<Record<MuscleGroup, number>>((acc, mg) => {
    acc[mg] = 0;
    return acc;
  }, {} as Record<MuscleGroup, number>)
}

type Contribution = {
  exerciseRow: ExerciseRow;
  numSets: number;
  volumeFactor: number;
}

function emptyContributionRecord(): Record<MuscleGroup, Map<UUID, Contribution>> {
  return Object.fromEntries(MUSCLE_GROUPS.map(mg => [mg, new Map()])) as Record<MuscleGroup, Map<UUID, Contribution>>;
}


export default function Analytics() {
  const [displayRpeChart, setDisplayRpeChart] = useState<boolean>(false);

  const [isFetchingVolumes, setIsFetchingVolumes] = useState<boolean>(false);
  const [muscleVolumeDays, setMuscleVolumeDays] = useState<number>(7);
  const [volumesLastFetched, setVolumesLastFetched] = useState<Date | null>(null);
  const [workoutsForMuscleVolume, setWorkoutsForMuscleVolume] = useState<FullAttachedWorkoutLog[]>([]);
  const [exerciseContributionToVolume, setExerciseContributionToVolume] = useState<Record<MuscleGroup, Map<UUID, Contribution>>>(emptyContributionRecord());
  const [openExerciseContribution, setOpenExerciseContribution] = useState<[string, Map<UUID, Contribution>] | null>(null);
  const [muscleVolumes, setMuscleVolumes] = useState<Record<MuscleGroup, number>>(emptyMGRecord());
  const [muscleGroupsToRow, setMuscleGroupsToRow] = useState<Map<MuscleGroup, MuscleGroupRow>>(new Map());

  const resetAll = () => {
    const days = 7;
    setDisplayRpeChart(false);
    setMuscleVolumeDays(days);
    setMuscleVolumes(emptyMGRecord());
    setWorkoutsForMuscleVolume([]);
    setVolumesLastFetched(null);
    setOpenExerciseContribution(null);
    setExerciseContributionToVolume(emptyContributionRecord());
    (async () => {
      setMuscleGroupsToRow(await fetchMuscleGroups());
      fetchMuscleVolumes(daysAgo(days));
    })();
  }

  useEffect(() => {
    resetAll();
  }, []);

  const fetchMuscleVolumes = async (onOrAfterDate: ISODate) => {
    setIsFetchingVolumes(true);
    const user = await requireGetUser();
    if (!user) {
      setIsFetchingVolumes(false);
      return;
    };
    try {
      const totalVolume = emptyMGRecord();
      const newContributionRecord = emptyContributionRecord();
      const workouts = await fetchWorkoutLogsOnOrAfterDate(onOrAfterDate);
      setWorkoutsForMuscleVolume(workouts);
      const exercisesToSetCount: Map<UUID, [ExerciseRow, number]> = new Map();
      for (const w of workouts) {
        for (const [i, ex] of w.exercises.entries()) {
          const numSetsDone = w.sets[i]?.length ?? 0;
          exercisesToSetCount.set(ex.exercise.id, [ex.exercise, (exercisesToSetCount.get(ex.exercise.id)?.[1] ?? 0) + numSetsDone])
        }
      }
      for (const [exId, [exercise, count]] of exercisesToSetCount.entries()) {
        const volumeForExercise = await fetchExerciseMuscleVolumes(exId, user.user_id);
        for (const mg of MUSCLE_GROUPS) {
          const vf = (volumeForExercise.get(mg)?.volume_factor ?? 0);
          const contribution = vf * count;
          totalVolume[mg] += contribution;
          if (contribution > 0) {
            newContributionRecord[mg].set(exId, {exerciseRow: exercise, volumeFactor: vf, numSets: count});
          }
        }
      }
      setExerciseContributionToVolume(newContributionRecord);
      setMuscleVolumes(totalVolume);
      setVolumesLastFetched(new Date());
    } finally {
      setIsFetchingVolumes(false);
    }
  }

  const barData = MUSCLE_GROUPS.map((mg) => {
    const display = muscleGroupsToRow.get(mg)?.display_name ?? mg;
    return {
      value: Math.round((muscleVolumes[mg] ?? 0) * 10) / 10,
      label: display,
      onPress: () => {
        setOpenExerciseContribution([display, exerciseContributionToVolume[mg]])
      }
    } satisfies barDataItem;
  });
  barData.sort((a, b) => b.value - a.value)

  return (
    <Screen center={false}>
      <Button
        title={"RPE Calculator"}
        style={{ alignSelf: "flex-end" }}
        onPress={() => setDisplayRpeChart(true)}
      />
      <RpeTableModal
        visible={displayRpeChart}
        onRequestClose={() => setDisplayRpeChart(false)}
      />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Text style={typography.subsection}>Muscle Volumes</Text>
        <ModalPicker
          options={([0, 1, 3, 7, 14, 30, 60, 90, 365, 'All Time'] as const).map(v => {
            return {value: v === 'All Time' ? -1 : v, label: v === 0 ? 'Today' : v === 'All Time' ? v : `Since ${v} Day${v === 1 ? '' : 's'} Ago`}
          })}
          value={muscleVolumeDays}
          onChange={(value) => {
            if (value === muscleVolumeDays) {
              return;
            }
            setMuscleVolumeDays(value);
            fetchMuscleVolumes(daysAgo(value));
        }}/>
        <Feather name="refresh-ccw" onPress={() => fetchMuscleVolumes(daysAgo(muscleVolumeDays))} isEnabled={!isFetchingVolumes} size={18} style={{ marginLeft: spacing.sm }}/>
        <Text style={typography.hint}>Last Fetched: {volumesLastFetched?.toLocaleTimeString() ?? 'n/a'}</Text>
      </View>
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

              yAxisThickness={1}
              xAxisThickness={1}
              xAxisColor={colors.border}
              yAxisColor={colors.border}

              yAxisTextStyle={typography.hint}
              yAxisLabelWidth={34}
              initialSpacing={10}

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
        <Text style={{...typography.title, borderBottomColor: colors.border, borderBottomWidth: 1, marginBottom: spacing.sm}}>Volume Contributions for {openExerciseContribution?.[0] ?? 'Unknown Musle'}</Text>
        {openExerciseContribution !== null && openExerciseContribution[1].size > 0 ? 
          Array.from(openExerciseContribution[1].entries())
            .toSorted((a, b) => b[1].numSets * b[1].volumeFactor - a[1].numSets * a[1].volumeFactor)
            .map(([id, contribution]) => {
              if (contribution.volumeFactor === 0 || contribution.numSets === 0) {
                return <Text>No Exercise Found</Text>;
              }
              const conFac = contribution.numSets * contribution.volumeFactor;
              return <View 
                key={id}
                style={{
                  marginBottom: spacing.xs,
                  flexDirection: 'row',
                  gap: spacing.xs,
                  alignItems: 'center',
                }}
              >
                <Text style={{...typography.body, fontWeight: '700'}}>{contribution.exerciseRow.name}:</Text>
                <Text style={styles.highlightedText}>
                  {contribution.numSets} Set{contribution.numSets === 1 ? '' : 's'} @ {contribution.volumeFactor} Volume per Set
                </Text>
                <Text style={{...typography.body, fontWeight: '700'}}>&rarr;</Text>
                <Text style={{...styles.highlightedText, fontWeight: '700'}}>{conFac.toFixed(1)} Set{conFac === 1 ? '' : 's'} Contributed</Text>
              </View>
            })
          : <Text>No Exercise Found</Text>}
      </ClosableModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  highlightedText: {...typography.body, backgroundColor: colors.fadedPrimary, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.padding_sm},
})
