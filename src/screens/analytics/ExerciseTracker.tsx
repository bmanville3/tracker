import { EditableExercise, EditableSet, FullAttachedWorkout, isFullAttachedLogWorkouts, WorkoutEditorMode } from "@/src/api/workoutSharedApi";
import { Button, ModalPicker, Selection } from "@/src/components";
import { colors, spacing, typography } from "@/src/theme";
import { ExerciseRow, ISODate, UUID } from "@/src/types";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { LineChart, lineDataItem } from "react-native-gifted-charts";
import { ExerciseModal } from "../exercise/ExerciseModal";
import { ALLOWED_VOLUMES } from "../exercise/VolumeRender";
import { RPE_TABLE_MODE_TO_E1RM_FUNCTION, RpeTableMode } from "../RPEChart";

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

// pick a y-value when tracking as one unit
function combineE1RM(values: Array<number | null>): number | null {
  // "one unit" definition: best available e1RM that day across tracked exercises
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

export type ExerciseTrackerProps = (
  { trackOverWorkouts: FullAttachedWorkout<"log">[] }
  | { trackOverWorkouts: FullAttachedWorkout<"template">[] }
);

export function ExerciseTracker(props: ExerciseTrackerProps) {
  const {
    trackOverWorkouts
  } = props;

  // exercise picker
  const [exerciseModalVisible, setExerciseModalVisible] = useState<boolean>(false);
  const [exerciseModalFn, setExerciseModalFn] = useState<((exercise: ExerciseRow) => void) | null>(null);

  // stuff to track
  const [exercisesToTrack, setExercisesToTrack] = useState<Set<ExerciseRow>>(new Set());
  const [trackExercisesAsOneUnit, setTrackerExercisesAsOneUnit] = useState<ExerciseRow | null>(null);
  const [graphAgainst, setGraphAgaist] = useState<Set<ExerciseRow>>(new Set());
  const [graphAgainstAverageRPE, setGraphAgainstAverageRPE] = useState<boolean>(false);
  const [graphAgainstVolume, setGraphAgainstVolume] = useState<boolean>(false);

  /// e1rm formula to use
  const [e1RMFormula, setE1RMFormula] = useState<RpeTableMode>('Tuchscherer\'s Chart');

  // advanced volume tracking settings
  const [showAdvancedVolumeSettings, setShowAdvancedVolumeSettings] =
    useState<boolean>(false);
  const [rollingAverageVolume, setRollingAverageVolume] = useState<number | null>(null);
  const [filterWarmupsVolume, setFilterWarmupsVolume] = useState<boolean>(true);
  const [mustBeGeEqThreshVolume, setMustBeGeEqThreshVolume] = useState<number | null>(null);
  const [disableFractionalVolume, setDisableFractionalVolume] =
    useState<boolean>(false);

  const exerciseIdsToTrack = new Set(Array.from(exercisesToTrack).map(e => e.id));
  const exercisesIdsForAgainst = new Set(Array.from(graphAgainst).map(e => e.id));
  const exerciseById = new Map([...Array.from(exercisesToTrack), ...Array.from(graphAgainst)].map(e => [e.id, e]));

  // this contains ONLY the workouts, exercises, and sets corresponding to the exercisesToTrack
  const reducedWorkoutsForTracking = trackOverWorkouts
    .filter(w => w.exercises.some(ex => exerciseIdsToTrack.has(ex.exercise.id)))
    .map(w => {
      const fitleredWithIndex = w.exercises.map((ex, i) => [ex, i] satisfies [EditableExercise<WorkoutEditorMode>, number]).filter(([ex, _i]) => exerciseIdsToTrack.has(ex.exercise.id));
      const newExercises = fitleredWithIndex.map(([ex, _i]) => ex);
      const newSets = fitleredWithIndex.map(([_ex, i]) => w.sets[i])
      return {workout: w.workout, exercises: newExercises, sets: newSets, workoutId: w.workoutId} satisfies FullAttachedWorkout<WorkoutEditorMode>;
    });

  const reducedWorkoutsForAgainst = trackOverWorkouts
    .filter(w => w.exercises.some(ex => exercisesIdsForAgainst.has(ex.exercise.id)))
    .map(w => {
      const fitleredWithIndex = w.exercises.map((ex, i) => [ex, i] satisfies [EditableExercise<WorkoutEditorMode>, number]).filter(([ex, _i]) => exercisesIdsForAgainst.has(ex.exercise.id));
      const newExercises = fitleredWithIndex.map(([ex, _i]) => ex);
      const newSets = fitleredWithIndex.map(([_ex, i]) => w.sets[i])
      return {workout: w.workout, exercises: newExercises, sets: newSets, workoutId: w.workoutId} satisfies FullAttachedWorkout<WorkoutEditorMode>;
    });
  
  const exerciseListCreator = (title: string, exercises: Set<ExerciseRow>, setExercises: (ex: Set<ExerciseRow>) => void) => {
    return <View>
      <Button
        title={title}
        onPress={() => {
          setExerciseModalFn(() => (ex: ExerciseRow) => {
            setExercises(new Set([...Array.from(exercises), ex]));
          })
          setExerciseModalVisible(true);
        }}
        style={{ alignSelf: 'flex-start', padding: spacing.padding_sm }}
        textProps={{ style: {fontSize: typography.body.fontSize} }}
      />
      {Array.from(exercises).map((ex) => {
        return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.fadedPrimary, borderColor: colors.border, borderWidth: 1, alignSelf: 'flex-start', borderRadius: 10, padding: spacing.padding_xs, margin: spacing.xxs }}>
          <Text>{ex.name}</Text>
          <Feather name={'x'} onPress={() => {
            setExercises(new Set(Array.from(exercises).filter(e => e.id !== ex.id)))
          }}/>
        </View>
      })}
    </View>
  }

  const generateAdvancedDropdowns = () => {
    const dropdown = <View
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
    if (!showAdvancedVolumeSettings) {
      return dropdown;
    }
    return <View>
      {dropdown}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <Selection
          title={"Filter Warmups"}
          isSelected={filterWarmupsVolume}
          onPress={() => setFilterWarmupsVolume((prev) => !prev)}
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
          value={mustBeGeEqThreshVolume}
          onChange={(value) => setMustBeGeEqThreshVolume(value)}
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
          title={"Use Rolling Average"} 
          isSelected={rollingAverageVolume !== null}
          onPress={() => {
            if (rollingAverageVolume === null) {
              setRollingAverageVolume(0.75);
            } else {
              setRollingAverageVolume(null);
            }
          }}
        />
        {rollingAverageVolume !== null && (<>
          <Feather name="minus-circle" size={22} onPress={() => {
            setRollingAverageVolume(Math.max(0.05, rollingAverageVolume - 0.05))
          }}/>
          <Text style={typography.body}>{rollingAverageVolume.toFixed(2)}</Text>
          <Feather name="plus-circle" size={22} onPress={() => {
            setRollingAverageVolume(Math.min(1.0, rollingAverageVolume + 0.05))
          }}/>
        </>)}
      </View>
    </View>
  }

  const extractE1RM = () => {
    if (reducedWorkoutsForTracking.length === 0 || !isFullAttachedLogWorkouts(reducedWorkoutsForTracking)) {
      return;
    }
    const dateAndExerciseToE1RM: Array<[ISODate, Map<UUID, number | null>]> =
      reducedWorkoutsForTracking.map((w) => {
        const date = w.workout.completed_on satisfies ISODate;

        const e1rmByExerciseId = new Map<UUID, number | null>();
        for (const ex of exercisesToTrack) {
          e1rmByExerciseId.set(ex.id, null);
        }

        w.exercises.forEach((ex, i) => {
          const exId = ex.exercise.id;
          if (!exerciseIdsToTrack.has(exId)) return;

          const setsForThisExercise = w.sets[i] ?? [];
          let best: number | null = null;

          for (const ss of setsForThisExercise) {
            const e = e1rmForSetLog({ ss, mode: e1RMFormula });
            if (e != null) {
              best = best === null ? e : Math.max(best, e);
            }
          }

          if (best != null) {
            const prev = e1rmByExerciseId.get(exId);
            e1rmByExerciseId.set(exId, prev === undefined || prev === null ? best : Math.max(prev, best));
          }
        });

        return [date, e1rmByExerciseId] satisfies [ISODate, Map<UUID, number | null>];
      })
      .sort(([a], [b]) => a.localeCompare(b));

    const labelStep = Math.max(1, Math.floor(dateAndExerciseToE1RM.length / 6));

    const xLabels: lineDataItem[] = dateAndExerciseToE1RM.map(([date], idx) => ({
      value: 0,
      label: idx % labelStep === 0 ? date : "",
    }));

    type LineSpec = {
      key: string;           // legend label
      data: lineDataItem[];  // y points
    };

    let lineSpecs: LineSpec[];

    if (trackExercisesAsOneUnit) {
      const data: lineDataItem[] = dateAndExerciseToE1RM.map(([date, map], idx) => {
        const combined = combineE1RM(
          [...exercisesToTrack].map((ex) => map.get(ex.id) ?? null),
        );

        return {
          value: combined === null ? 0 : round1(combined),
          label: idx % labelStep === 0 ? date : "",
        };
      });

      lineSpecs = [
        {
          key: trackExercisesAsOneUnit.name,
          data,
        },
      ];
    } else {
      lineSpecs = [...exercisesToTrack].map((ex) => {
        const data: lineDataItem[] = dateAndExerciseToE1RM.map(([date, map], idx) => {
          const v = map.get(ex.id) ?? null;
          return {
            value: v === null ? 0 : round1(v),
            label: idx % labelStep === 0 ? date : "",
          };
        });

        return { key: ex.name, data };
      });
    }

    const allValues = lineSpecs.flatMap((ls) =>
      ls.data.map((p) => p.value).filter((v) => v !== undefined && v > 0),
    );
    const maxValue = Math.max(10, ...allValues) * 1.1;

    // If your gifted-charts version supports `dataSet`:
    const dataSet = lineSpecs.map((ls, idx) => ({
      data: ls.data,
      // You can omit color to use defaults OR provide your own palette.
      // color: SOME_PALETTE[idx % SOME_PALETTE.length],
      // thickness: 2,
    }));


    return (
      <View style={{ gap: spacing.sm }}>
        {/* Legend */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {lineSpecs.map((ls, idx) => (
            <View key={ls.key} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              {/* swatch */}
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  // backgroundColor: SOME_PALETTE[idx % SOME_PALETTE.length],
                  backgroundColor: colors.primary, // replace with palette if you want
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
              <Text style={typography.hint}>{ls.key}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal>
          <LineChart
            // base x labels: in dataset mode, some versions use `data` only for labels
            // If your version doesn’t need this, remove it.
            data={xLabels}
            dataSet={dataSet}
            height={220}
            spacing={40}
            initialSpacing={20}
            endSpacing={10}
            maxValue={maxValue}
            hideYAxisText
            yAxisThickness={0}
            rulesColor={colors.border}
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
            // Consider these if you like:
            // curved
            // showDataPointOnPress
            // showStripOnPress
          />
        </ScrollView>
      </View>)
  }

  return <View>
    {exerciseListCreator("Add Exercise to Track", exercisesToTrack, setExercisesToTrack)}
    {exerciseListCreator("Add Exercise to Graph Against", graphAgainst, setGraphAgaist)}
    {generateAdvancedDropdowns()}
    {extractE1RM()}
    <ExerciseModal
      visible={exerciseModalVisible}
      onRequestClose={(ex) => {
        if (exerciseModalFn !== null && ex !== null) {
          exerciseModalFn(ex);
        }
        setExerciseModalVisible(false);
        setExerciseModalFn(null);
      }}
      allowSelectExercises={true}
      allowCreateExercises={false}
      allowDeleteExercises={false}
      allowEditExercises={false}
    />
  </View>;
}
