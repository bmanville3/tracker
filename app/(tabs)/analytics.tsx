import { fetchExerciseMuscleVolumes } from "@/src/api/exerciseApi";
import { fetchMuscleGroups } from "@/src/api/muscleApi";
import { fetchWorkoutLogsOnOrAfterDate, FullAttachedWorkoutLog } from "@/src/api/workoutLogApi";
import { Button, ClosableModal, ModalPicker, Screen, Selection } from "@/src/components";
import { ALLOWED_VOLUMES } from "@/src/screens/exercise/VolumeRender";
import { colors, spacing, typography } from "@/src/theme";
import { ExerciseMuscleRow, ExerciseRow, ISODate, MUSCLE_GROUPS, MuscleGroup, MuscleGroupRow, UUID } from "@/src/types";
import { requireGetUser, toISODate } from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { BarChart, barDataItem } from "react-native-gifted-charts";

function getDaySpanIncludingToday(days: number): ISODate {
  if (days < 0) {
    return toISODate(new Date(0));
  }
  if (days === 0) {
    return toISODate(new Date());
  }
  const today = new Date();
  today.setDate(today.getDate() - (days - 1));
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
  ///////////
  // Start volume related thing
  ///////////

  // volume meta data/helper
  const [isFetchingVolumes, setIsFetchingVolumes] = useState<boolean>(false);
  const [muscleVolumeDays, setMuscleVolumeDays] = useState<number>(7);
  const [volumesLastFetched, setVolumesLastFetched] = useState<Date | null>(null);

  // whats actually fetched by above query
  const [workoutsForMuscleVolume, setWorkoutsForMuscleVolume] = useState<FullAttachedWorkoutLog[]>([]);
  const [exerciseToMuscleVolume, setExerciseToMuscleVolume] = useState<Map<UUID, Map<MuscleGroup, ExerciseMuscleRow>>>(new Map());

  // extraction of workoutsForMuscleVolume
  const [exerciseContributionToVolume, setExerciseContributionToVolume] = useState<Record<MuscleGroup, Map<UUID, Contribution>>>(emptyContributionRecord());
  const [openExerciseContribution, setOpenExerciseContribution] = useState<[string, [UUID, Contribution][]] | null>(null);
  const [muscleVolumes, setMuscleVolumes] = useState<Record<MuscleGroup, number>>(emptyMGRecord());
  const [muscleGroupsToRow, setMuscleGroupsToRow] = useState<Map<MuscleGroup, MuscleGroupRow>>(new Map());

  // advanced settings for volume
  const [showAdvancedVolumeSettings, setShowAdvancedVolumeSettings] = useState<boolean>(false);
  const [showAsNDayAverage, setShowAsNDayAverage] = useState<number | null>(null);
  const [filterWarmups, setFilterWarmups] = useState<boolean>(true);
  const [mustBeGeEqThresh, setMustBeGeEqThresh] = useState<number | null>(null);
  const [disableFractionalVolume, setDisableFractionalVolume] = useState<boolean>(false);

  ///////////
  // Eolume related thing
  ///////////

  const resetAll = () => {
    const days = 7;
    setMuscleVolumeDays(days);
    setMuscleVolumes(emptyMGRecord());
    setWorkoutsForMuscleVolume([]);
    setVolumesLastFetched(null);
    setOpenExerciseContribution(null);
    setShowAsNDayAverage(null);
    setFilterWarmups(true);
    setMustBeGeEqThresh(null);
    setDisableFractionalVolume(false);
    setShowAdvancedVolumeSettings(false);
    setExerciseToMuscleVolume(new Map());
    setExerciseContributionToVolume(emptyContributionRecord());
    (async () => {
      setMuscleGroupsToRow(await fetchMuscleGroups());
      fetchMuscleVolumes(getDaySpanIncludingToday(days));
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
      const workouts = await fetchWorkoutLogsOnOrAfterDate(onOrAfterDate);
      setWorkoutsForMuscleVolume(workouts);
      const uniqueExerciseIds = new Set<UUID>();
      for (const w of workouts) {
        for (const ex of w.exercises) {
          uniqueExerciseIds.add(ex.exercise.id);
        }
      }
      const newMap = new Map<UUID, Map<MuscleGroup, ExerciseMuscleRow>>();
      for (const exId of uniqueExerciseIds) {
        const volumeForExercise = await fetchExerciseMuscleVolumes(exId, user.user_id);
        newMap.set(exId, volumeForExercise);
      }
      setExerciseToMuscleVolume(newMap);
      loadVolumeFieldsFromState();
    } finally {
      setIsFetchingVolumes(false);
    }
  }

  const loadVolumeFieldsFromState = () => {
    const totalVolume = emptyMGRecord();
    const newContributionRecord = emptyContributionRecord();
    const exercisesToSetCount: Map<UUID, [ExerciseRow, number]> = new Map();
    for (const w of workoutsForMuscleVolume) {
      for (const [i, ex] of w.exercises.entries()) {
        let numSetsDone;
        if (filterWarmups) {
          numSetsDone = w.sets[i]?.filter(s => s.set_type !== 'warmup').length ?? 0;
        } else {
          numSetsDone = w.sets[i]?.length ?? 0;
        }
        exercisesToSetCount.set(ex.exercise.id, [ex.exercise, (exercisesToSetCount.get(ex.exercise.id)?.[1] ?? 0) + numSetsDone])
      }
    }
    for (const [exId, [exercise, count]] of exercisesToSetCount.entries()) {
      const volumeForExercise = exerciseToMuscleVolume.get(exId) ?? new Map();
      for (const mg of MUSCLE_GROUPS) {
        let vf = (volumeForExercise.get(mg)?.volume_factor ?? 0);
        if (mustBeGeEqThresh !== null && vf < mustBeGeEqThresh) {
          continue;
        }
        if (disableFractionalVolume) {
          vf = vf > 0 ? 1 : 0;
        }
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
  }

  useEffect(loadVolumeFieldsFromState, [workoutsForMuscleVolume, exerciseToMuscleVolume, disableFractionalVolume, mustBeGeEqThresh, filterWarmups])

  const barData = MUSCLE_GROUPS.map((mg) => {
    const display = muscleGroupsToRow.get(mg)?.display_name ?? mg;
    const idsToContributions = exerciseContributionToVolume[mg];
    const idsAndContributions = Array.from(idsToContributions.entries());
    idsAndContributions.sort((a, b) => b[1].numSets * b[1].volumeFactor - a[1].numSets * a[1].volumeFactor);
    let volume = muscleVolumes[mg] ?? 0;
    if (showAsNDayAverage) {
      volume /= showAsNDayAverage;
    }
    return {
      value: Math.round(volume * 10) / 10,
      label: display,
      onPress: () => {
        setOpenExerciseContribution([display, idsAndContributions])
      } 
    } satisfies barDataItem;
  });
  barData.sort((a, b) => b.value - a.value)
  const maxBarValue = Math.max(20, ...barData.map(b => b.value)) * 1.1;

  return (
    <Screen center={false}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}
      >
        <Text style={typography.subsection}>Muscle Set Volume</Text>
        <ModalPicker
          title="Pick Date Span"
          help="Pick the date span to track set volumes per muscle group."
          options={([1, 3, 7, 14, 30, 60, 90, 365] as const).map(v => {
            return {
              value: v,
              label: v === 1 ? 'Today' : `Last ${v} Days`,
              description: v === 1 ? `Get workouts from today: ${getDaySpanIncludingToday(1)}.` : `Gets workout over the last ${v} days including today. Spans from ${getDaySpanIncludingToday(v)} to ${getDaySpanIncludingToday(1)}.`
            }
          })}
          value={muscleVolumeDays}
          onChange={(value) => {
            if (value === muscleVolumeDays) {
              return;
            }
            setMuscleVolumeDays(value);
            fetchMuscleVolumes(getDaySpanIncludingToday(value));
          }}
          pressableProps={{ style: { paddingHorizontal: spacing.padding_sm, paddingVertical: spacing.padding_sm }}}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
        <Text style={typography.body}>Advanced Filters and Settings</Text>
        <Feather name={showAdvancedVolumeSettings ? "arrow-up-circle" : "arrow-down-circle"} size={18} onPress={() => setShowAdvancedVolumeSettings((prev) => !prev)}/>
      </View>
      
      {showAdvancedVolumeSettings && <View style={{ rowGap: spacing.xs, marginBottom: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: spacing.padding_lg, borderRadius: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={typography.body}>N-Day Average:</Text>
          <ModalPicker
            title="Show as N-Day Average"
            help="Averages the volumes over N days. For example, to get your weekly average set N=7. N cannot be set greater than the number of days."
            options={[null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30, 60, 90, 120, 200, 300, 365].filter(n => n === null || n <= muscleVolumeDays).map(n => {return {label: n === null ? 'None' : n.toString(), value: n}})}
            onChange={(value) => {
              if (value === null) {
                setShowAsNDayAverage(value);
              } else if (value <= muscleVolumeDays) {
                setShowAsNDayAverage(value);
              }
            }}
            value={showAsNDayAverage}
            pressableProps={{ style: { alignSelf: 'flex-start', padding: spacing.padding_sm } }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Selection
            title={"Filter Warmups"}
            isSelected={filterWarmups}
            onPress={() => setFilterWarmups((prev) => !prev)}
            style={{ alignSelf: 'flex-start' }}
          />
          <Selection
            title={"Disable Fractional Volue"}
            isSelected={disableFractionalVolume}
            onPress={() => setDisableFractionalVolume((prev) => !prev)}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={typography.body}>Set Volume Threshold:</Text>
          <ModalPicker
            title="Set Volume Threshold"
            help="An exercise must past this threshold in order to contribute to total muscle set volume."
            options={[...ALLOWED_VOLUMES, null].map(v => {return {label: v === null ? 'None' : v.toString(), value: v}})}
            value={mustBeGeEqThresh}
            onChange={(value) => setMustBeGeEqThresh(value)}
            pressableProps={{ style: { alignSelf: 'flex-start', padding: spacing.padding_sm } }}
          />
        </View>
        <View style={{ rowGap: spacing.xs }}>
          <Text style={typography.label}>Defaults to Try:</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Selection
              title={"Default"}
              isSelected={disableFractionalVolume === false
                && filterWarmups === true
                && showAsNDayAverage === null
                && mustBeGeEqThresh === null}
              onPress={() => {
                setDisableFractionalVolume(false);
                setFilterWarmups(true);
                setShowAsNDayAverage(null);
                setMustBeGeEqThresh(null);
              }}
            />
            <Selection
              title={"No Fracs"}
              isSelected={disableFractionalVolume === true
                && filterWarmups === true
                && showAsNDayAverage === null
                && mustBeGeEqThresh === 0.5}
              onPress={() => {
                setDisableFractionalVolume(true);
                setFilterWarmups(true);
                setShowAsNDayAverage(null);
                setMustBeGeEqThresh(0.5);
              }}
            />
          </View>
          {muscleVolumeDays >= 7 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Selection
              title={"Weekly Avg"}
              isSelected={disableFractionalVolume === false
                && filterWarmups === true
                && showAsNDayAverage === 7
                && mustBeGeEqThresh === null}
              onPress={() => {
                setDisableFractionalVolume(false);
                setFilterWarmups(true);
                setShowAsNDayAverage(7);
                setMustBeGeEqThresh(null);
              }}
            />
            <Selection
              title={"Weekly Avg No Fracs"}
              isSelected={disableFractionalVolume === true
                && filterWarmups === true
                && showAsNDayAverage === 7
                && mustBeGeEqThresh === 0.5}
              onPress={() => {
                setDisableFractionalVolume(true);
                setFilterWarmups(true);
                setShowAsNDayAverage(7);
                setMustBeGeEqThresh(0.5);
              }}
            />
          </View>}
          {muscleVolumeDays >= 30 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Selection
              title={"Monthly Avg"}
              isSelected={disableFractionalVolume === false
                && filterWarmups === true
                && showAsNDayAverage === 30
                && mustBeGeEqThresh === null}
              onPress={() => {
                setDisableFractionalVolume(false);
                setFilterWarmups(true);
                setShowAsNDayAverage(30);
                setMustBeGeEqThresh(null);
              }}
            />
            <Selection
              title={"Weekly Avg No Fracs"}
              isSelected={disableFractionalVolume === true
                && filterWarmups === true
                && showAsNDayAverage === 30
                && mustBeGeEqThresh === 0.5}
              onPress={() => {
                setDisableFractionalVolume(true);
                setFilterWarmups(true);
                setShowAsNDayAverage(30);
                setMustBeGeEqThresh(0.5);
              }}
            />
          </View>}
        </View>
      </View>}
      
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}
      >
        <Feather name="refresh-ccw" onPress={() => fetchMuscleVolumes(getDaySpanIncludingToday(muscleVolumeDays))} isEnabled={!isFetchingVolumes} size={18} style={{ marginLeft: spacing.sm }}/>
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
        <Text style={{ ...typography.title, borderBottomColor: colors.border, borderBottomWidth: 1, marginBottom: spacing.sm}}>Volume Contributions for {openExerciseContribution?.[0] ?? 'Unknown Musle'}</Text>
        {openExerciseContribution !== null && openExerciseContribution[1].length > 0 ? 
          openExerciseContribution[1]
            .map(([id, contribution]) => {
              if (contribution.volumeFactor === 0 || contribution.numSets === 0) {
                return null;
              }
              const conFac = contribution.numSets * contribution.volumeFactor;
              return <View 
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
                <Text style={{...typography.body, fontWeight: '700'}}>{contribution.exerciseRow.name}:</Text>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={{...styles.highlightedText, alignSelf: 'flex-start'}}>
                    {contribution.numSets} Set{contribution.numSets === 1 ? '' : 's'} @ {contribution.volumeFactor} Volume per Set
                  </Text>
                  <Text style={{...typography.body, fontWeight: '700'}}>&rarr;</Text>
                  <Text style={{...styles.highlightedText, fontWeight: '700'}}>{conFac.toFixed(1)} Set{conFac === 1 ? '' : 's'}</Text>
                </View>
                {showAsNDayAverage && <View style={{ flexDirection: 'row' }}>
                  <Text style={{...styles.highlightedText, alignSelf: 'flex-start'}}>
                    Averaging Over {showAsNDayAverage}
                  </Text>
                  <Text style={{...typography.body, fontWeight: '700'}}>&rarr;</Text>
                  <Text style={{...styles.highlightedText, fontWeight: '700'}}>{(conFac / showAsNDayAverage).toFixed(2)} Set{conFac / showAsNDayAverage === 1 ? '' : 's'} / {showAsNDayAverage} Day{showAsNDayAverage === 1 ? '' : 's'}</Text>
                </View>}
              </View>
            })
          : <Text>No Exercise Found</Text>}
          <Button title="Close" onPress={() => setOpenExerciseContribution(null)}/>
      </ClosableModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  highlightedText: {...typography.body, backgroundColor: colors.fadedPrimary, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.padding_sm},
})
