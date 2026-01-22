import { EditableExercise, EditableSet, FullAttachedWorkout, isFullAttachedLogWorkouts, WorkoutEditorMode } from "@/src/api/workoutSharedApi";
import { Button, ClosableModal, ModalPicker, Selection } from "@/src/components";
import { colors, spacing, typography } from "@/src/theme";
import { EXERCISE_AND_MUSCLE_TAGS, ExerciseAndMuscleTag, ExerciseRow, ISODate, UUID } from "@/src/types";
import { capitalizeFirstLetter, isSubsetOfArray, maxNullable } from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { ExerciseModal } from "../exercise/ExerciseModal";
import { RPE_TABLE_MODE_TO_E1RM_FUNCTION, RPE_TABLE_MODES, RpeTableMode } from "../RPEChart";

function e1rmForSetLog(args: {
  ss: EditableSet<'log'>;
  mode: RpeTableMode;
}): number | null {
  const { ss, mode } = args;
  if (ss.weight == null || ss.reps == null) return null;
  const fn = RPE_TABLE_MODE_TO_E1RM_FUNCTION[mode];
  return fn(ss.weight, ss.reps, ss.rpe);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function combineE1RM(values: Map<UUID, number>): [UUID, number] | null {
  const nums = [...values.entries()].filter((entry): entry is [UUID, number] => entry[1] !== null);
  if (nums.length === 0) return null;
  const maxIndex = nums.reduce((iMax, item, i, arr) => {
    return item[1] > arr[iMax][1] ? i : iMax;
  }, 0)
  return nums[maxIndex];
}

export type ExerciseTrackerProps = (
  { trackOverWorkouts: FullAttachedWorkout<"log">[] }
  | { trackOverWorkouts: FullAttachedWorkout<"template">[] }
);

type VolumeSettings = {
  showAdvanced: boolean;
  useRollingAverage: boolean;
  rollingAverage: number;
  filterWarmups: boolean;
};

type GroupSettings = {
  exercises: Map<UUID, ExerciseRow>;
  tagsToLookAt: ExerciseAndMuscleTag[];
  trackAsSingularUnit: boolean;
  includeRawGraph: boolean;
  includeRpeGraph: boolean;
  includeVolumeGraph: boolean;
  e1RMFormula: RpeTableMode;
  volume: VolumeSettings;
  displayGroup: boolean;
};

type DataToGraph = {
  bestE1RM: number | null;
  numberOfSets: number;
  rpesLogged: number[];
}

const DEFAULT_GROUP: GroupSettings = {
  exercises: new Map(),
  tagsToLookAt: [],
  trackAsSingularUnit: false,
  includeRawGraph: false,
  includeRpeGraph: false,
  includeVolumeGraph: false,
  e1RMFormula: 'Tuchscherer\'s Chart',
  volume: {
    showAdvanced: false,
    useRollingAverage: false,
    rollingAverage: 0.75,
    filterWarmups: true,
  },
  displayGroup: false,
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

export function ExerciseTracker(props: ExerciseTrackerProps) {
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
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<number | null>(null);
  const [confirmDeleteAllGroups, setConfirmDeleteAllGroups] = useState<boolean>(false);

  const [groups, setGroups] = useState<GroupSettings[]>([]);

  const isLogWorkouts = isFullAttachedLogWorkouts(trackOverWorkouts);

  const allExerciseInWorkout: Map<UUID, ExerciseRow> = new Map();
  trackOverWorkouts.forEach(w => w.exercises.forEach(e => allExerciseInWorkout.set(e.exercise.id, e.exercise)));
  const allExerciseIdsInWorkouts = [...new Set(allExerciseInWorkout.keys())];

  const reduceWorkoutsForGroup = (i: number) => {
    const group = groups[i];
    return trackOverWorkouts
      .filter(w => w.exercises.some(ex => group.exercises.has(ex.exercise.id)))
      .map(w => {
        const fitleredWithIndex = w.exercises.map((ex, i) => [ex, i] satisfies [EditableExercise<WorkoutEditorMode>, number]).filter(([ex, _i]) => group.exercises.has(ex.exercise.id));
        const newExercises = fitleredWithIndex.map(([ex, _i]) => ex);
        const newSets = fitleredWithIndex.map(([_ex, i]) => w.sets[i])
        return {workout: w.workout, exercises: newExercises, sets: newSets, workoutId: w.workoutId} satisfies FullAttachedWorkout<WorkoutEditorMode>;
      })
  }

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
    const idsToRemove = new Set(exercises.map(e => e.id));

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
    const volume = group.volume;
    const dropdown = <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={typography.body}>Advanced Filters and Settings for Group {groupIndex + 1}</Text>
      <Feather
        name={
          volume.showAdvanced ? "arrow-up-circle" : "arrow-down-circle"
        }
        size={18}
        onPress={() => updateGroupVolume(groupIndex, {showAdvanced: !volume.showAdvanced})}
      />
    </View>
    if (!volume.showAdvanced) {
      return dropdown;
    }
    return <View>
      {dropdown}
      <View style={{...styles.containerStyle, alignSelf: 'flex-start'}}>
        <View style={styles.containerStyle}>
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
          <Selection
            title={"Use Rolling Average"} 
            isSelected={volume.useRollingAverage}
            onPress={() => updateGroupVolume(groupIndex, {useRollingAverage: !volume.useRollingAverage})}
          />
          {volume.useRollingAverage && (<>
            <Feather name="minus-circle" size={22} onPress={() => {
              updateGroupVolume(groupIndex, {rollingAverage: Math.max(0.05, volume.rollingAverage - 0.05)})
            }}/>
            <Text style={typography.body}>{volume.rollingAverage.toFixed(2)}</Text>
            <Feather name="plus-circle" size={22} onPress={() => {
              updateGroupVolume(groupIndex, {rollingAverage: Math.max(0.05, volume.rollingAverage + 0.05)})
            }}/>
          </>)}
        </View>
      </View>
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
        {renderGroupExercises(group, groupIndex)}
      </View>}
    </View>
  }

  const renderAllGroupsGraphData = () => {
    if (!isLogWorkouts) {
      return null;
    }
    
    // each index corresponds to a group
    // each date corresponds to a map of exercises in that group and data
    const fullDataLayout: Map<ISODate, Map<UUID, DataToGraph>>[] = [];
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const reduced = reduceWorkoutsForGroup(groupIndex) as FullAttachedWorkout<"log">[];
      if (reduced.length === 0) {
        fullDataLayout.push(new Map());
        continue;
      }
      const group = groups[groupIndex];
      fullDataLayout.push(extractDataToGraph(group, reduced))
    }
    return <ScrollView horizontal>
      <LineChart
      
      />
    </ScrollView>
  }

  const renderWorkoutsMetadata = () => {
    const allExerciseInWorkoutFiltered = [...allExerciseInWorkout.values()].filter(e => isSubsetOfArray(filterAllExercisesByTags, e.tags));
    return <View>
      <View style={{ ...styles.containerStyle, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm}}>
        <Text style={{...typography.body}}>Tracking over {trackOverWorkouts.length} workout</Text>
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
                    title={`Add to Group ${gI + 1}`}
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
