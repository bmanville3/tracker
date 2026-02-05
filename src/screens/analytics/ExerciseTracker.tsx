import { EditableExercise, EditableSet, FullAttachedWorkout, isFullAttachedLogWorkouts, WorkoutEditorMode } from "@/src/api/workoutSharedApi";
import { Button, ClosableModal, ModalPicker, Selection } from "@/src/components";
import { colors, spacing, typography } from "@/src/theme";
import { EXERCISE_AND_MUSCLE_TAGS, ExerciseAndMuscleTag, ExerciseRow, ISODate, UUID } from "@/src/types";
import { addDays, capitalizeFirstLetter, daysBetweenDates, fromISODate, generateDateRange, isSubsetOfArray, maxNullable, rgbColorGenerator, toISODate } from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { LineChart, LineChartPropsType, lineDataItem } from "react-native-gifted-charts";
import { ExerciseModal } from "../exercise/ExerciseModal";
import { RPE_TABLE_MODE_TO_E1RM_FUNCTION, RPE_TABLE_MODES, RpeTableMode } from "../RPEChart";

const METRICS = ["sets", "e1rm", "rpe"] as const;
type Metric = (typeof METRICS)[number];

function metricLabel(m: Metric): string {
  switch (m) {
    case "sets": return "Volume";
    case "e1rm": return "e1RM";
    case "rpe": return "Avg RPE";
    default: throw new Error(`Unknown metric: ${m}`);
  }
}

function Legend({ groups }: { groups: GroupSettings[] }) {
  return (
    <View style={{ padding: 8, gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {groups.map((g, i) => {
          const c = rgbColorGenerator(i, groups.length);
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />
              <Text>{`Group ${i + 1} - ${metricLabel(g.trackingMetric)}`}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function e1rmForSetLog(args: {
  ss: EditableSet<'log'>;
  mode: RpeTableMode;
}): number | null {
  const { ss, mode } = args;
  if (ss.weight == null || ss.reps == null) return null;
  const fn = RPE_TABLE_MODE_TO_E1RM_FUNCTION[mode];
  return fn(ss.weight, ss.reps, ss.rpe);
}

export type ExerciseTrackerProps<M extends WorkoutEditorMode> = {
  trackOverWorkouts: FullAttachedWorkout<M>[];
};

type VolumeSettings = {
  averagingStrategy: 'sliding' | 'rolling' | null;
  windowSize: number;
  alpha: number;
  filterWarmups: boolean;
};

type GroupSettings = {
  trackingMetric: Metric;
  exercises: Map<UUID, ExerciseRow>;
  tagsToLookAt: ExerciseAndMuscleTag[];
  trackAsSingularUnit: boolean;
  includeRawGraph: boolean;
  includeRpeGraph: boolean;
  includeVolumeGraph: boolean;
  e1RMFormula: RpeTableMode;
  volume: VolumeSettings;
  displayGroup: boolean;
  showAdvancedSettings: boolean;
  showQickAdd: boolean;
  showExercisesInGroup: boolean;
};

type DataToGraph = {
  bestE1RM: number | null;
  numberOfSets: number;
  rpesLogged: number[];
}

const DEFAULT_GROUP: GroupSettings = {
  trackingMetric: 'e1rm',
  exercises: new Map(),
  tagsToLookAt: [],
  trackAsSingularUnit: false,
  includeRawGraph: false,
  includeRpeGraph: false,
  includeVolumeGraph: false,
  e1RMFormula: 'Tuchscherer\'s Chart',
  volume: {
    averagingStrategy: 'sliding',
    windowSize: 7,
    alpha: 0.80,
    filterWarmups: true,
  },
  displayGroup: false,
  showAdvancedSettings: false,
  showQickAdd: false,
  showExercisesInGroup: false,
};

// this function is here to make sure the backing arrays are not shared
// since we never do things in place it should be fine
// but this is to hopefully prevent subtle bugs later
function cloneGroup(g: GroupSettings): GroupSettings {
  return {
    ...g,
    exercises: new Map(g.exercises),
    tagsToLookAt: [...g.tagsToLookAt],
    volume: { ...g.volume },
  };
}

/**
 * Given a group and workouts, extracts data to graph.
 * @param settings Group settings to abide by.
 * @param workouts Workouts to extract data from.
 * @returns A map of data to graph.
 *    ISODate - Date workout was completed on. Only for workouts with at least one DataToGraph. If >1 workout on a day, combines information.:
 *        UUID - An exercise ID from settings.exercises. Only for exercises with data on the date (present on date and numberOfSets > 0).:
 *            DataToGraph - Graphing data. Only present for applicable exercises.
 */
function extractDataToGraph(settings: GroupSettings, workouts: FullAttachedWorkout<'log'>[]): Map<ISODate, Map<UUID, DataToGraph>> {
  const finalMapping: Map<ISODate, Map<UUID, DataToGraph>> = new Map();
  workouts.forEach((workout) => {
    const dataForExercisesInThisWorkout = new Map<UUID, DataToGraph>();
  
    workout.exercises.forEach((exercise, i) => {
      const exId = exercise.exercise.id;
      // not tracking exercise
      if (!settings.exercises.has(exId)) return;
      // get the data for the exercise. Should be undefined if not seen or present if seen WITH sets
      let data = dataForExercisesInThisWorkout.get(exId);

      let setsForThisExercise = workout.sets[i] ?? [];
      if (settings.volume.filterWarmups) {
        setsForThisExercise = setsForThisExercise.filter(s => s.set_type !== "warmup");
      }
      if (setsForThisExercise.length === 0) {
        // if there are no sets we cannot update anything
        return;
      }
      // there were sets. if not seen yet, make a new entry
      if (data === undefined) {
        data = {bestE1RM: null, numberOfSets: 0, rpesLogged: []};
      }
      data.numberOfSets += setsForThisExercise.length;

      let best: number | null = null;
      for (const ss of setsForThisExercise) {
        if (ss.rpe !== null) {
          data.rpesLogged.push(ss.rpe);
        }
        const e = e1rmForSetLog({ ss, mode: settings.e1RMFormula });
        if (e != null) {
          best = best === null ? e : Math.max(best, e);
        }
      }
      // tracking best over entire workout
      if (best != null) {
        const prev = data.bestE1RM;
        data.bestE1RM = prev === null ? best : Math.max(prev, best);
      }
      dataForExercisesInThisWorkout.set(exId, data);
    });
    if (dataForExercisesInThisWorkout.size > 0) {
      if (finalMapping.has(workout.workout.completed_on)) {
        const dataOnDateAlready = finalMapping.get(workout.workout.completed_on)!;
        dataForExercisesInThisWorkout.forEach((newDataToGraph, exId) => {
          if (dataOnDateAlready.has(exId)) {
            const oldDataToGraph = dataOnDateAlready.get(exId)!;
            const combined: DataToGraph = {
              bestE1RM: maxNullable(oldDataToGraph.bestE1RM, newDataToGraph.bestE1RM),
              numberOfSets: oldDataToGraph.numberOfSets + newDataToGraph.numberOfSets,
              rpesLogged: [...oldDataToGraph.rpesLogged, ...newDataToGraph.rpesLogged]
            }
            dataOnDateAlready.set(exId, combined);
          } else {
            dataOnDateAlready.set(exId, newDataToGraph);
          }
        })
      } else {
        finalMapping.set(workout.workout.completed_on, dataForExercisesInThisWorkout);
      }
    }
  });
  return finalMapping;
}

function averageInPlace(
  data: { value: number }[],
  averagingStrategy: {strat: 'sliding', windowSize: number} | {strat: 'rolling', alpha: number} | null
): void {
  if (data.length <= 1) {
    return;
  }

  if (averagingStrategy === null) {
    return;
  } else if (averagingStrategy.strat === 'sliding') {
    let ws = Math.round(averagingStrategy.windowSize);
    if (ws <= 0) {
      console.error(`Got a window size of ${ws} which is not allowed. Default to ws=7`);
      ws = 7;
    }
    const raw = data.map(p => p.value);
    let back = 0;
    let sum = 0;
    for (let front = 0; front < raw.length; front++) {
      sum += raw[front];

      while (front - back + 1 > ws) {
        // push the back forward to keep the true size = ws
        sum -= raw[back];
        back++;
      }

      const windowSize = front - back + 1;
      data[front].value = sum / windowSize;
    }
  } else if (averagingStrategy.strat === 'rolling') {
    let alpha = averagingStrategy.alpha;
    if (alpha < 0 || alpha > 1) {
      console.error(`Got alpha=${alpha} but has constraints 0<=alpha<=1. Setting alpha=0.80`);
      alpha = 0.80;
    }
    let rollingAverage = data[0].value;
    data.forEach((v) => {
      rollingAverage = rollingAverage * alpha + v.value * (1 - alpha);
      v.value = rollingAverage;
    })
  } else {
    throw new Error(`Unsupported averaging strategy: ${averagingStrategy}`)
  }
}

function addInterpolationInPlace(
  base: { date: ISODate, value: number | null }[]
): void {
  const knownIdx: number[] = [];
  for (let i = 0; i < base.length; i++) {
    if (base[i].value != null) knownIdx.push(i);
  }
  if (knownIdx.length <= 1) return;
  for (let k = 0; k < knownIdx.length - 1; k++) {
    const i0 = knownIdx[k];
    const i1 = knownIdx[k + 1];
    if (i0 + 1 === i1) {
      // dates are consective - move on
      continue;
    }

    const v0 = base[i0].value!;
    const v1 = base[i1].value!;

    const numDaysBetweenDates = daysBetweenDates(base[i0].date, base[i1].date);
    if (numDaysBetweenDates <= 0) {
      console.error(`Days should be increasing. Got date1=${base[i0].date}, date2=${base[i1].date}`);
      continue;
    }

    for (let i = i0 + 1; i < i1; i++) {
      const frac = daysBetweenDates(base[i0].date, base[i].date) / numDaysBetweenDates;
      base[i].value = v0 + (v1 - v0) * frac;
    }
  }
}

function buildVolumeSeries(
  allDates: Map<ISODate, Map<UUID, DataToGraph>>,
  dateRangeFromMinToMax: ISODate[],
  averagingStrategy: {strat: 'sliding', windowSize: number} | {strat: 'rolling', alpha: number} | null,
): lineDataItem[] {

  const baseExtraction = dateRangeFromMinToMax.map((date) => {
    const exMap = allDates.get(date);
    if (!exMap) return { label: date, value: 0.0 };

    let raw = 0;
    for (const d of exMap.values()) raw += d.numberOfSets;
    return { label: date, value: raw };
  });
  averageInPlace(baseExtraction, averagingStrategy);
  return baseExtraction;
}

function buildE1RMSeries(
  allDates: Map<ISODate, Map<UUID, DataToGraph>>,
  dateRangeFromMinToMax: ISODate[],
): lineDataItem[] {
  // between points inside of allDates, we linearly interpolate missing dates
  // outside of allDates, we set the value to null (no interpolation)
  const base: { date: ISODate, value: number | null, dataPointColor?: string }[] = dateRangeFromMinToMax
    .map((date) => {
      const exMap = allDates.get(date);
      if (!exMap) return { date, value: null };

      let best: number | null = null;
      for (const d of exMap.values()) {
        const v = d.bestE1RM;
        if (v != null) best = best == null ? v : Math.max(best, v);
      }
      return { date, value: best };
    });
  const notKnown: number[] = [];
  for (let i = 0; i < base.length; i++) {
    if (base[i].value == null) notKnown.push(i);
  }
  addInterpolationInPlace(base);
  notKnown.forEach((i) => base[i] = {...base[i], dataPointColor: 'transparent'})
  return base.map((v) => {return {label: v.date, value: v.value === null ? undefined : v.value, dataPointColor: v.dataPointColor }});
}

function buildAverageRPESeries(
  allDates: Map<ISODate, Map<UUID, DataToGraph>>,
  dateRangeFromMinToMax: ISODate[],
): lineDataItem[] {
  const base: { date: ISODate, value: number | null, dataPointColor?: string }[] = dateRangeFromMinToMax.map((date) => {
    const exMap = allDates.get(date);
    if (!exMap) return { date, value: null };

    let sum = 0;
    let n = 0;
    for (const d of exMap.values()) {
      for (const r of d.rpesLogged) { sum += r; n += 1; }
    }
    const raw = n === 0 ? null : sum / n;
    return { date, value: raw };
  });
  const notKnown: number[] = [];
  for (let i = 0; i < base.length; i++) {
    if (base[i].value == null) notKnown.push(i);
  }
  addInterpolationInPlace(base);
  notKnown.forEach((i) => base[i] = {...base[i], dataPointColor: 'transparent'})
  return base.map((v) => {return {label: v.date, value: v.value === null ? undefined : v.value, dataPointColor: v.dataPointColor}});
}

function buildSeriesForGroupMetric(args: {
    group: GroupSettings,
    allDates: Map<ISODate, Map<UUID, DataToGraph>>,
    dateRangeFromMinToMax: ISODate[],
  }
): lineDataItem[] {
  const { group, allDates, dateRangeFromMinToMax } = args;

  switch (group.trackingMetric) {
    case 'sets': return buildVolumeSeries(allDates, dateRangeFromMinToMax, group.volume.averagingStrategy === null ? null : {strat: group.volume.averagingStrategy, windowSize: group.volume.windowSize, alpha: group.volume.alpha});
    case 'e1rm': return buildE1RMSeries(allDates, dateRangeFromMinToMax);
    case 'rpe': return buildAverageRPESeries(allDates, dateRangeFromMinToMax);
    default: throw new Error(`Unknown metricL ${group.trackingMetric}`);
  }
}

function minMaxNormalize(x: number, min: number, max: number): number {
  if (max === min) return 0.5; // flat line; put it in the middle
  return (x - min) / (max - min);
}

function computeMinMax(points: {value?: number | null | undefined}[]): { min: number; max: number } | null {
  if (points.length === 0) return null;
  const values: number[] = points.map(p => p.value).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return null;
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return { min, max };
}

function reduceWorkoutsForGroup<M extends WorkoutEditorMode>(trackOverWorkouts: FullAttachedWorkout<M>[], group: GroupSettings): FullAttachedWorkout<M>[] {
  return trackOverWorkouts
    .filter(w => w.exercises.some(ex => group.exercises.has(ex.exercise.id)))
    .map(w => {
      const fitleredWithIndex = w.exercises.map((ex, i) => [ex, i] satisfies [EditableExercise<M>, number]).filter(([ex, _i]) => group.exercises.has(ex.exercise.id));
      const newExercises = fitleredWithIndex.map(([ex, _i]) => ex);
      const newSets = fitleredWithIndex.map(([_ex, i]) => w.sets[i])
      return {workout: w.workout, exercises: newExercises, sets: newSets, workoutId: w.workoutId} satisfies FullAttachedWorkout<M>;
    })
}

export function ExerciseTracker<M extends WorkoutEditorMode>(props: ExerciseTrackerProps<M>) {
  const {
    trackOverWorkouts
  } = props;

  // exercise picker
  const [exerciseModalVisible, setExerciseModalVisible] = useState<boolean>(false);
  const [exerciseModalFn, setExerciseModalFn] = useState<((exercise: ExerciseRow) => void) | null>(null);
  const [exerciseModalIdLimiter, setExerciseModalIdLimiter] = useState<Set<UUID>>(new Set());

  // all groups
  const [seeAllExercises, setSeeAllExercises] = useState<boolean>(false);
  const [filterAllExercisesByTags, setFilterAllExercisesByTags] = useState<ExerciseAndMuscleTag[]>([]);
  const [showGroupsToAddTo, setShowGroupsToAddTo] = useState<boolean>(false);
  const [applyNormalization, setApplyNormalization] = useState<boolean>(false);
  const [oneGraph, setOneGraph] = useState<boolean>(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<number | null>(null);
  const [confirmDeleteAllGroups, setConfirmDeleteAllGroups] = useState<boolean>(false);

  const [groups, setGroups] = useState<GroupSettings[]>([]);

  const isLogWorkouts = isFullAttachedLogWorkouts(trackOverWorkouts);

  const allExerciseInWorkout: Map<UUID, ExerciseRow> = new Map();
  trackOverWorkouts.forEach(w => w.exercises.forEach(e => allExerciseInWorkout.set(e.exercise.id, e.exercise)));
  const allExerciseIdsInWorkouts = [...new Set(allExerciseInWorkout.keys())];

  function updateGroup(i: number, patch: Partial<GroupSettings>) {
    setGroups((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function updateGroupVolume(i: number, patch: Partial<VolumeSettings>) {
    setGroups((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], volume: { ...next[i].volume, ...patch } };
      return next;
    });
  }

  function copyGroup(i: number) {
    updateGroup(i, {displayGroup: false});
    setGroups((prev) => {
      const cloned = cloneGroup(prev[i]);
      const {volume, displayGroup, ...rest} = cloned
      return [...prev, {...rest, displayGroup: true, volume: {...volume, showAdvanced: true }}]
    });
  }

  function addGroup() {
    setGroups((prev) => [...prev, cloneGroup(DEFAULT_GROUP)]);
  }

  function deleteGroup(i: number) {
    if (i < 0 || i >= groups.length) {
      console.error("Attempted to delete group outside range");
      return;
    }
    setGroups((prev) => prev.filter((_group, index) => i !== index))
  }

  function addAllExercisesWithTagsToGroup(groupIndex: number, tags: ExerciseAndMuscleTag[]) {
    const exercisesToAdd: Map<UUID, ExerciseRow> = new Map();
    trackOverWorkouts.forEach(w => {
      w.exercises.forEach(e => {
        if (exercisesToAdd.has(e.exercise.id)) {
          return;
        }
        if (isSubsetOfArray(tags, e.exercise.tags)) {
          exercisesToAdd.set(e.exercise.id, e.exercise);
        }
      })
    });
    addExercisesToGroup(groupIndex, [...exercisesToAdd.values()]);
  }

  function removeAllExercisesWithTagsToGroup(groupIndex: number, tags: ExerciseAndMuscleTag[]) {
    const exercisesToRemove: Map<UUID, ExerciseRow> = new Map();
    trackOverWorkouts.forEach(w => {
      w.exercises.forEach(e => {
        if (exercisesToRemove.has(e.exercise.id)) {
          return;
        }
        if (isSubsetOfArray(tags, e.exercise.tags)) {
          exercisesToRemove.set(e.exercise.id, e.exercise);
        }
      })
    });
    removeExercisesFromGroup(groupIndex, [...exercisesToRemove.values()]);
  }

  function addExercisesToGroup(i: number, exercises: ExerciseRow[]) {
    setGroups(prev => {
      if (i < 0 || i >= prev.length) return prev;

      const next = [...prev];
      const g = next[i];

      const newExercises = new Map(g.exercises);
      for (const ex of exercises) {
        newExercises.set(ex.id, ex);
      }

      next[i] = {
        ...g,
        exercises: newExercises,
      };
      return next;
    });
  }

  function removeExercisesFromGroup(i: number, exercises: ExerciseRow[]) {
    setGroups(prev => {
      if (i < 0 || i >= prev.length) return prev;

      const next = [...prev];
      const g = next[i];

      const newMap = new Map(g.exercises);

      for (const ex of exercises) {
        newMap.delete(ex.id);
      }

      next[i] = { ...g, exercises: newMap };
      return next;
    });
  }
  
  const renderGroupExercises = (group: GroupSettings, groupIndex: number) => {
    return <View>
      <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
        <Button
          title={'Add Exercise'}
          onPress={() => {
            setExerciseModalFn(() => (ex: ExerciseRow) => {
              addExercisesToGroup(groupIndex, [ex]);
            })
            setExerciseModalIdLimiter(new Set(allExerciseIdsInWorkouts.filter(exId => !group.exercises.has(exId))));
            setExerciseModalVisible(true);
          }}
          {...styles.smallButton}
        />
        <Text style={typography.hint}>({allExerciseIdsInWorkouts.filter(id => !group.exercises.has(id)).length} exercises left to add)</Text>
      </View>
      {group.exercises.size > 0 ? [...group.exercises.values()].map((ex) => {
        return <View key={ex.id} style={styles.exercisePill}>
          <Text>{ex.name}</Text>
          <Feather name={'x'} onPress={() => removeExercisesFromGroup(groupIndex, [ex])}/>
        </View>
      }) : <Text style={{...typography.label, marginLeft: spacing.sm}}>No exercises in Group {groupIndex + 1} yet</Text>}
    </View>
  }

  const renderGroupDropdown = (group: GroupSettings, groupIndex: number) => {
    if (!group.displayGroup) return null;
    const volume = group.volume;
    const dropdownSettings = <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={typography.body}>Filters and Settings</Text>
      <Feather
        name={
          group.showAdvancedSettings ? "arrow-up-circle" : "arrow-down-circle"
        }
        size={18}
        onPress={() => updateGroup(groupIndex, {showAdvancedSettings: !group.showAdvancedSettings})}
      />
    </View>
    const settings = <View style={{...styles.containerStyle, alignSelf: 'flex-start'}}>
      <View style={{...styles.containerStyle, flexDirection: 'row', alignItems: 'center', gap:spacing.sm}}>
        <Selection
          title={"Filter Warmups"}
          isSelected={volume.filterWarmups}
          onPress={() => updateGroupVolume(groupIndex, {filterWarmups: !volume.filterWarmups})}
          style={{ alignSelf: "flex-start" }}
        />
        <Text style={typography.hint}>{trackOverWorkouts.map(w =>
          w.sets.map(
            s => s.map(
              ss => (ss.set_type === 'warmup' ? 1 : 0) as number
            ).reduce((a, b) => a + b, 0)
          ).reduce((a, b) => a + b, 0)
        ).reduce((a, b) => a + b, 0)} Sets of Warmups Exist</Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          ...styles.containerStyle,
          gap: spacing.sm,
        }}
      >
        <Text style={typography.body}>Set e1RM Formula:</Text>
        <ModalPicker
          title="Set e1RM Formula"
          options={RPE_TABLE_MODES.map(m => {return {label: m, value: m}})}
          value={group.e1RMFormula}
          onChange={(value) => updateGroup(groupIndex, {e1RMFormula: value})}
          pressableProps={{
            style: styles.smallButton.style,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          ...styles.containerStyle,
          gap: spacing.sm,
        }}
      >
        <ModalPicker
          options={[null, 'rolling', 'sliding'].map((v) => {return {label: v === null ? 'No Averaging' : v === 'rolling' ? "Rolling Average" : "Sliding Window", value: v}})}
          value={volume.averagingStrategy}
          onChange={(value) => {
            if (value === null || value === 'rolling' || value === 'sliding') {
              updateGroupVolume(groupIndex, {averagingStrategy: value});
            } else {
              throw new Error(`Unknown update to average strategy: ${value}`);
            }
          }}
          pressableProps={{
            style: styles.smallButton.style,
          }}
        />
        {volume.averagingStrategy === 'rolling' && (<>
          <Feather name="minus-circle" size={22} onPress={() => {
            updateGroupVolume(groupIndex, {alpha: Math.max(0, volume.alpha - 0.05)})
          }}/>
          <Text style={typography.body}>{volume.alpha.toFixed(2)}</Text>
          <Feather name="plus-circle" size={22} onPress={() => {
            updateGroupVolume(groupIndex, {alpha: Math.min(1, volume.alpha + 0.05)})
          }}/>
        </>)}
        {volume.averagingStrategy === 'sliding' && (<>
          <Feather name="minus-circle" size={22} onPress={() => {
            updateGroupVolume(groupIndex, {windowSize: Math.max(1, volume.alpha - 1)})
          }}/>
          <Text style={typography.body}>{volume.alpha.toFixed(2)}</Text>
          <Feather name="plus-circle" size={22} onPress={() => {
            updateGroupVolume(groupIndex, {alpha: Math.min(100, volume.alpha + 1)})
          }}/>
        </>)}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          ...styles.containerStyle,
          gap: spacing.sm,
        }}
      >
        <Text style={typography.body}>Tacking:</Text>
        {METRICS.map((m) => <Selection key={m} title={metricLabel(m)} isSelected={group.trackingMetric === m} onPress={() => updateGroup(groupIndex, {trackingMetric: m})}/>)}
      </View>
    </View>
    const dropdownExercises = <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={typography.body}>Exercises in Group</Text>
      <Feather
        name={
          group.showExercisesInGroup ? "arrow-up-circle" : "arrow-down-circle"
        }
        size={18}
        onPress={() => updateGroup(groupIndex, {showExercisesInGroup: !group.showExercisesInGroup})}
      />
    </View>
    const dropdownQuickAdd = <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={typography.body}>Quick Add Exercises</Text>
      <Feather
        name={
          group.showQickAdd ? "arrow-up-circle" : "arrow-down-circle"
        }
        size={18}
        onPress={() => updateGroup(groupIndex, {showQickAdd: !group.showQickAdd})}
      />
    </View>
    const quickAdd = <View style={styles.containerStyle}>
      <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
        <Button
          title="Add All"
          {...styles.smallButton}
          onPress={() => addAllExercisesWithTagsToGroup(groupIndex, group.tagsToLookAt)}
        />
        <Button
          title="Remove All"
          {...styles.smallButton}
          onPress={() => removeAllExercisesWithTagsToGroup(groupIndex, group.tagsToLookAt)}
        />
        <Text style={typography.hint}>(Must include all tags):</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {EXERCISE_AND_MUSCLE_TAGS.map(t => {
          return <Selection
            key={t}
            title={capitalizeFirstLetter(t)}
            isSelected={group.tagsToLookAt.includes(t)}
            onPress={() => {
              if (group.tagsToLookAt.includes(t)) {
                updateGroup(groupIndex, {tagsToLookAt: group.tagsToLookAt.filter(ot => ot !== t)});
              } else {
                updateGroup(groupIndex, {tagsToLookAt: [...group.tagsToLookAt, t]});
              }
            }}
            {...styles.smallButton}
          />
        })}
      </View>
      <Text style={typography.hint}>{new Set(trackOverWorkouts.flatMap(w => w.exercises.filter(e => isSubsetOfArray(group.tagsToLookAt, e.exercise.tags)).map(e => e.exercise.id))).size} exercises have all selected tags
      </Text>
    </View>
    return <View>
      {dropdownSettings}
      {group.showAdvancedSettings && settings}
      {dropdownQuickAdd}
      {group.showQickAdd && quickAdd}
      {dropdownExercises}
      {group.showExercisesInGroup && renderGroupExercises(group, groupIndex)}
    </View>
  }

  const renderFullGroupMetadata = (group: GroupSettings, groupIndex: number) => {
    return <View style={{ marginBottom: spacing.sm }}>
      <View style={{ ...styles.containerStyle, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <Text style={typography.subsection}>Group {groupIndex + 1}</Text>
        <Feather
          name={
            group.displayGroup ? "arrow-up-circle" : "arrow-down-circle"
          }
          size={22}
          onPress={() => updateGroup(groupIndex, {displayGroup: !group.displayGroup})}
        />
        <Feather style={{...typography.body, marginLeft: 'auto'}} name="copy" size={22} onPress={() => copyGroup(groupIndex)}/>
        <Feather style={{...typography.body, marginLeft: spacing.xs}} name="trash" size={22} onPress={() => setConfirmDeleteGroup(groupIndex)}/>
      </View>
      {group.displayGroup && <View style={{marginTop: spacing.md, ...styles.containerStyle, backgroundColor: colors.bg}}>
        {renderGroupDropdown(group, groupIndex)}
      </View>}
    </View>
  }

  const renderAllGroupsGraphData = () => {
    if (!isLogWorkouts) return null;
    if (groups.length === 0) {
      return <Text style={typography.hint}>Add groups to track exercise(s)</Text>
    }
    if (!groups.some(g => g.exercises.size > 0)) {
      return <Text style={typography.hint}>Add exercises to groups for tracking</Text>
    }

    const allDatesDataArray: Map<ISODate, Map<UUID, DataToGraph>>[] = [];
    let minDate: ISODate | null = null;
    let maxDate: ISODate | null = null;

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      const reduced = reduceWorkoutsForGroup(trackOverWorkouts, group);
      const allDatesData = extractDataToGraph(group, reduced);
      allDatesDataArray.push(allDatesData);
      const datesForData: ISODate[] = [...allDatesData.keys()];
      console.log(datesForData)
      datesForData.forEach((d) => {
        if (maxDate === null || d > maxDate) {
          maxDate = d;
        }
        if (minDate === null || d < minDate) {
          minDate = d;
        }
      })
    }

    if (minDate === null || maxDate === null) {
      console.error(`Got minDate=${minDate} and maxDate=${maxDate}. Neither should be null`);
      return <Text style={typography.label}>Could not generate graphs at this time</Text>
    }

    const dateRangeFromMinToMax = generateDateRange(minDate, maxDate);
    console.log(dateRangeFromMinToMax)

    let dataSet: {
        data: lineDataItem[];
        color: string;
        dataPointsColor: string;
    }[] = [];

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      const groupColor = rgbColorGenerator(groupIndex, groups.length);
      const allDatesData = allDatesDataArray[groupIndex];
      let graphData = buildSeriesForGroupMetric({group, allDates: allDatesData, dateRangeFromMinToMax});
      if (applyNormalization) {
        const minMax = computeMinMax(graphData);
        graphData = graphData.map((p) => {
          if (p.value === null || p.value === undefined) {
            return p;
          }
          return {...p, value: minMaxNormalize(p.value, minMax?.min ?? 0, minMax?.max ?? 0)}
        })
      }
      dataSet.push({data: graphData, color: groupColor, dataPointsColor: groupColor});
    }

    const lineChartProps: LineChartPropsType = {
      xAxisLabelTextStyle: {
        ...typography.hint,
        color: colors.textPrimary,
        fontWeight: "600",
        backgroundColor: colors.primarySoft,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 1,
      },
      spacing: 80,
      initialSpacing: 40,
      showDataPointsForMissingValues: false,
      extrapolateMissingValues: false,
      interpolateMissingValues: false,
    }

    const legend = <View style={{ flexWrap: 'wrap' }}>
      <Legend groups={groups} />
    </View>

    if (oneGraph) {
      const atLeastOneNotE1RM = groups.some(g => g.trackingMetric !== 'e1rm');
      const min = applyNormalization || atLeastOneNotE1RM ? 0 : computeMinMax(dataSet.map(d => computeMinMax(d.data)?.min ?? 0).map(n => {return {value: n}}))?.min ?? 0;
      return <View style={{ gap: spacing.sm }}>
        {legend}
        <LineChart
          dataSet={dataSet}
          yAxisOffset={Math.round(min * 0.9)}
          {...lineChartProps}
        />
      </View>
    } else {
      return <View style={{ gap: spacing.sm }}>
        {legend}
        {dataSet.map((data, i) => {
          if (data.data.length === 0) {
            return <Text>Nothing to graph for Group {i + 1}</Text>
          }
          const min = applyNormalization || groups[i].trackingMetric === 'e1rm' ? computeMinMax(data.data)?.min ?? 0 : 0;
          return <LineChart
            key={`${data.data}-${i}`}
            yAxisOffset={Math.round(min * 0.9)}
            data={data.data}
            color={data.color}
            dataPointsColor={data.color}
            {...lineChartProps}
          />
          })
        }
      </View>
    }
  };

  const renderWorkoutsMetadata = () => {
    const allExerciseInWorkoutFiltered = [...allExerciseInWorkout.values()].filter(e => isSubsetOfArray(filterAllExercisesByTags, e.tags));
    return <View>
      <View style={{ ...styles.containerStyle, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm}}>
        <Text style={{...typography.body}}>Tracking over {trackOverWorkouts.length} workout{trackOverWorkouts.length === 1 ? '' : 's'}</Text>
        <Selection title={"Normalize"} isSelected={applyNormalization} onPress={() => setApplyNormalization((prev) => !prev)}/>
          <Selection title={"One Graph"} isSelected={oneGraph} onPress={() => setOneGraph((prev) => !prev)}/>
        <Text style={{...typography.body, marginLeft: 'auto'}}>See All Exercises</Text>
        <Feather
          name={
            seeAllExercises ? "arrow-up-circle" : "arrow-down-circle"
          }
          size={18}
          onPress={() => setSeeAllExercises((prev) => !prev)}
        />
      </View>
      {seeAllExercises && <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm, gap: spacing.xs}}>
        <Text style={typography.hint}>Filter by tags (Must include all tags):</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {EXERCISE_AND_MUSCLE_TAGS.map(t => {
            return <Selection
              key={t}
              title={capitalizeFirstLetter(t)}
              isSelected={filterAllExercisesByTags.includes(t)}
              onPress={() => {
                if (filterAllExercisesByTags.includes(t)) {
                  setFilterAllExercisesByTags((prev) => prev.filter(tag => tag !== t));
                } else {
                  setFilterAllExercisesByTags((prev) => [...prev, t]);
                }
              }}
              {...styles.smallButton}
            />
          })}
        </View>
        {groups.length > 0 && <Selection
          title={"Show Groups to Add Exercises To"}
          isSelected={showGroupsToAddTo}
          onPress={() => setShowGroupsToAddTo((prev) => !prev)}
          style={{ alignSelf: 'flex-start' }}
          textProps={{ style: {...typography.body, padding: spacing.padding_sm} }}
        />}
      </View>}
      {seeAllExercises && (
        allExerciseInWorkoutFiltered.length > 0 ? allExerciseInWorkoutFiltered.map((ex) => {
          return <View key={ex.id} style={{...styles.exercisePill, flexDirection: 'column', padding: spacing.padding_sm, alignItems: undefined}}>
            <Text style={typography.body}>{ex.name}</Text>
            {showGroupsToAddTo && groups.length > 0 && <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
              {groups.map((g, gI) => {
                if (g.exercises.has(ex.id)) {
                  return null;
                } else {
                  return <Button
                    key={`${ex.id}-${gI}`}
                    title={`+Group ${gI + 1}`}
                    onPress={() => addExercisesToGroup(gI, [ex])}
                    {...styles.smallButton}
                  />
                }
              })}
            </View>}
          </View>
        }) : <Text>No Exercises in Tracked Workouts with Selected Tags</Text>
      )}
    </View>
  }

  return <View>
    {renderWorkoutsMetadata()}
    <Button
      title={"New Group"}
      onPress={addGroup}
      variant="secondary"
      style={{ marginBottom: spacing.md, marginTop: spacing.md }}
    />
    {groups.map(renderFullGroupMetadata)}
    {groups.length > 0 && <Button
      title="Remove All Groups"
      onPress={() => setConfirmDeleteAllGroups(true)}
      style={{ marginTop: spacing.md, marginBottom: spacing.md, padding: spacing.padding_sm, alignSelf: 'flex-end' }}
      variant="revert"
    />}
    {renderAllGroupsGraphData()}
    <ExerciseModal
      visible={exerciseModalVisible}
      onRequestClose={(ex) => {
        if (exerciseModalFn !== null && ex !== null) {
          exerciseModalFn(ex);
        }
        setExerciseModalVisible(false);
        setExerciseModalFn(null);
        setExerciseModalIdLimiter(new Set());
      }}
      allowSelectExercises={true}
      allowCreateExercises={false}
      allowDeleteExercises={false}
      allowEditExercises={false}
      limitToExercisesIds={exerciseModalIdLimiter}
    />
    <ClosableModal visible={confirmDeleteGroup !== null} onRequestClose={() => setConfirmDeleteGroup(null)}>
      <Text style={{...typography.title, borderBottomColor: colors.border, borderBottomWidth: 2, marginBottom: spacing.sm}}>Delete Group {confirmDeleteGroup !== null ? confirmDeleteGroup + 1 : 'n/a'}?</Text>
      <Button
        title={`Delete Group ${confirmDeleteGroup !== null ? confirmDeleteGroup + 1 : 'n/a'}`}
        onPress={() => {
          if (confirmDeleteGroup === null) {
            return;
          }
          deleteGroup(confirmDeleteGroup);
          setConfirmDeleteGroup(null);
        }}
        variant="revert"
      />
      <Button
        title="Cancel"
        onPress={() => setConfirmDeleteGroup(null)}
      />
    </ClosableModal>
    <ClosableModal visible={confirmDeleteAllGroups} onRequestClose={() => setConfirmDeleteAllGroups(false)}>
      <Text style={{...typography.title, borderBottomColor: colors.border, borderBottomWidth: 2, marginBottom: spacing.sm}}>Delete All Groups?</Text>
      <Button
        title={'Delete All Groups'}
        onPress={() => {
          setGroups([]);
          setConfirmDeleteAllGroups(false);
        }}
        variant="revert"
      />
      <Button
        title="Cancel"
        onPress={() => setConfirmDeleteAllGroups(false)}
      />
    </ClosableModal>
  </View>;
}

const styles = {
  smallButton: {
    style: {
      alignSelf: 'flex-start',
      padding: spacing.padding_sm,
      marginLeft: 0,
    },
    textProps: {
      style: {
        fontSize: typography.body.fontSize,
      },
    },
  },
  exercisePill: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.fadedPrimary, borderColor: colors.border, borderWidth: 1, alignSelf: 'flex-start', borderRadius: 10, padding: spacing.padding_xs, margin: spacing.xxs},
  containerStyle: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: spacing.padding_md, borderRadius: 10, rowGap: spacing.xs },
} as const;
