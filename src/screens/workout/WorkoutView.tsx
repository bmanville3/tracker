import { upsertWorkoutLog } from "@/src/api/workoutLogApi";
import {
  AnyEditableSet,
  EditableExercise,
  editableExerciseEqual,
  EditableSet,
  editableSetEqual,
  EditableWorkout,
  editableWorkoutEqual,
  FullDetachedWorkoutForMode,
  isFullLogWorkout,
  isFullTemplateWorkout,
  isLogSet,
  isLogWorkout,
  isTemplateSet,
  isTemplateWorkout,
  WorkoutEditorMode,
  workoutHasProgram,
} from "@/src/api/workoutSharedApi";
import { upsertTemplateWorkout } from "@/src/api/workoutTemplateApi";
import {
  Button,
  ClosableModal,
  NumberField,
  Screen,
  Selection,
  TextField,
} from "@/src/components/";
import { rpeChartE1RM } from "@/src/screens/RPEChart";
import { colors, spacing, typography } from "@/src/theme";
import { DistanceUnit, ExerciseRow, UUID, WeightUnit } from "@/src/types";
import {
  anyErrorToString,
  arraysEqual,
  changeWeightUnit,
  doubleArraysEqual,
  requireGetUser,
  showAlert,
} from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ExerciseModal } from "../exercise/ExerciseModal";
import { VolumeRender } from "../exercise/VolumeRender";

export type SetRenderProps<M extends WorkoutEditorMode> = {
  set: EditableSet<M>;
  setIndex: number;
  handleUpdateSetCurried: <K extends keyof EditableSet<M>>(
    key: K,
    value: EditableSet<M>[K],
  ) => void;
  isLoading: boolean;
  allowEditing: boolean;
};

export type AdvancedSetRenderProps<M extends WorkoutEditorMode> =
  SetRenderProps<M> & {
    exercise: EditableExercise<M>;
    exerciseIndex: number;
    totalSetsInExercise: number;
    handleSwapSetsInExercise: (
      exerciseIdx: number,
      setIdx1: number,
      setIdx2: number,
    ) => void;
    handleRemoveSetInExercise: (exerciseIdx: number, setIdx: number) => void;
    isVisible: boolean;
    onRequestClose: () => void;
  };

export type HeaderSubFieldsProps<M extends WorkoutEditorMode> = {
  workout: EditableWorkout<M>;
  allowEditing: boolean;
  isLoading: boolean;
  handleUpdateWorkout: <K extends keyof EditableWorkout<M>>(
    key: K,
    value: EditableWorkout<M>[K],
  ) => void;
  openDatePicker: boolean;
  setOpenDatePicker: (o: boolean) => void;
  newSetWeightUnit: WeightUnit;
  setNewSetWeightUnit: (w: WeightUnit) => void;
  newSetDistanceUnit: DistanceUnit;
  setNewSetDistanceUnit: (d: DistanceUnit) => void;
};

export interface WorkoutEditorModeStrategy<M extends WorkoutEditorMode> {
  mode: M;

  createEmptyWorkout(): EditableWorkout<M>;

  createEmptySet(ctx: {
    weightUnit: WeightUnit;
    distanceUnit: DistanceUnit;
  }): EditableSet<M>;

  renderSetBody(ctx: SetRenderProps<M>): React.JSX.Element | null;

  renderAdvancedSetMenu(
    ctx: AdvancedSetRenderProps<M>,
  ): React.JSX.Element | null;

  renderWorkoutHeaderSubFields(
    ctx: HeaderSubFieldsProps<M>,
  ): React.JSX.Element | null;
}

function computeInitialState<M extends WorkoutEditorMode>(
  strategy: WorkoutEditorModeStrategy<M>,
  loadWithExisting: FullDetachedWorkoutForMode<M> | null | undefined,
): FullDetachedWorkoutForMode<M> {
  if (loadWithExisting) {
    return loadWithExisting;
  }

  return {
    workout: strategy.createEmptyWorkout(),
    exercises: [],
    sets: [],
  };
}

export type WorkoutViewProps<M extends WorkoutEditorMode> = {
  isActive: boolean;
  requestClose: () => void;
  /** This function serves to update `loadWithExisting` and `updateWorkoutId` when the user saves a workout.
   * This function should be ignore ONLY if requestCloseOnSuccessfulSave=True.
   * Otherwise it might have odd side effects if `loadWithExisting` and `updateWorkoutId` are not properly changed.
   */
  onSuccessfulSave: (
    newWorkout: FullDetachedWorkoutForMode<M>,
    newId: UUID,
  ) => void;
  strategy: WorkoutEditorModeStrategy<M>;
  loadWithExisting?: FullDetachedWorkoutForMode<M> | null;
  updateWorkoutId?: UUID | null;
  allowEditing?: boolean;
  requestCloseOnSuccessfulSave?: boolean;
};

export function WorkoutView<M extends WorkoutEditorMode>(
  props: WorkoutViewProps<M>,
) {
  const {
    isActive,
    requestClose,
    onSuccessfulSave,
    strategy,
    loadWithExisting = null,
    updateWorkoutId = null,
    allowEditing = false,
    requestCloseOnSuccessfulSave = true,
  } = props;

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [workout, setWorkout] = useState<EditableWorkout<M>>(
    loadWithExisting?.workout ?? strategy.createEmptyWorkout(),
  );
  const [exercises, setExercises] = useState<EditableExercise<M>[]>(
    loadWithExisting?.exercises ?? [],
  );
  const [sets, setSets] = useState<EditableSet<M>[][]>(
    loadWithExisting?.sets ?? [],
  );

  const [newSetWeightUnit, setNewSetWeightUnit] = useState<WeightUnit>("kg");
  const [newSetDistanceUnit, setNewSetDistanceUnit] =
    useState<DistanceUnit>("m");

  const [openExercisePicker, setOpenExercisePicker] = useState<boolean>(false);
  const [exercisePickerFunction, setExercisePickerFunction] = useState<
    ((ex: ExerciseRow) => void) | null
  >(null);

  const [openDatePicker, setOpenDatePicker] = useState<boolean>(false);

  const [advancedExercise, setAdvancedExercise] = useState<number | null>(null);
  const [showVolumesForAdvancedExercise, setShowVolumesForAdvancedExercise] = useState<boolean>(false);
  const [editVolume, setEditVolumes] = useState<boolean>(false);
  const [advancedSet, setAdvancedSet] = useState<[number, number] | null>(null);

  const initialWorkoutRef = useRef<EditableWorkout<M> | null>(null);
  const initialExercisesRef = useRef<EditableExercise<M>[] | null>(null);
  const initialSetsRef = useRef<EditableSet<M>[][] | null>(null);

  const clearAdvancedExercise = () => {
    setAdvancedExercise(null);
    setShowVolumesForAdvancedExercise(false);
    setEditVolumes(false);
  }

  const resetAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const profile = await requireGetUser();
      if (!profile) return;

      setNewSetWeightUnit(profile.default_weight_unit);
      setNewSetDistanceUnit(profile.default_distance_unit);
      setOpenExercisePicker(false);
      setExercisePickerFunction(null);
      setOpenDatePicker(false);
      setAdvancedSet(null);
      clearAdvancedExercise();

      const initial = computeInitialState(strategy, loadWithExisting);

      initialWorkoutRef.current = initial.workout;
      initialExercisesRef.current = initial.exercises;
      initialSetsRef.current = initial.sets;

      setWorkout(initial.workout);
      setExercises(initial.exercises);
      setSets(initial.sets);
    } finally {
      setIsLoading(false);
    }
  }, [strategy, loadWithExisting]);

  useEffect(() => {
    if (!isActive) return;
    void resetAll();
  }, [isActive, strategy, loadWithExisting]);

  const isSavable = useMemo(() => {
    const initialWorkout = initialWorkoutRef.current;
    const initialExercises = initialExercisesRef.current;
    const initialSets = initialSetsRef.current;

    if (!initialWorkout || !initialExercises || !initialSets) {
      return false;
    }

    const wEqual = editableWorkoutEqual(initialWorkout, workout);
    const eEqual = arraysEqual(
      initialExercises,
      exercises,
      editableExerciseEqual,
    );
    const sEqual = doubleArraysEqual(initialSets, sets, editableSetEqual);

    return !(wEqual && eEqual && sEqual);
  }, [workout, exercises, sets]);

  const renderAssociatedProgram = () => {
    if (!workoutHasProgram(workout)) {
      return null;
    }

    const { program_row, block_in_program, week_in_block, day_in_week } =
      workout;

    return (
      <View style={{ marginTop: 4, marginBottom: 12, flexDirection: "row" }}>
        <Text style={typography.hint}>
          {strategy.mode === "template" ? "For" : "From"} Program:{" "}
          <Text style={{ fontWeight: "600" }}>{program_row.name}</Text>
        </Text>
        <Text style={typography.hint}>
          Block {block_in_program}, Week {week_in_block}, Day {day_in_week}
        </Text>
      </View>
    );
  };

  const handleUpdateWorkout = <K extends keyof EditableWorkout<M>>(
    key: K,
    value: EditableWorkout<M>[K],
  ) => {
    setWorkout((prev) => {
      return { ...prev, [key]: value };
    });
  };

  const renderHeader = () => {
    return (
      <View style={{ marginBottom: 16 }}>
        {/* Name row */}
        <TextField
          value={workout.name}
          onChangeText={(text) => {
            const newWorkout: EditableWorkout<M> = { ...workout };
            newWorkout.name = text;
            setWorkout(newWorkout);
          }}
          placeholder="Untitled workout"
          placeholderTextColor={colors.placeholderTextColor}
          style={{
            ...typography.title,
            paddingVertical: spacing.padding_sm,
            color: colors.navy,
            marginBottom: spacing.md,
            flex: 1,
            backgroundColor: allowEditing ? colors.surface : colors.surfaceAlt,
          }}
          editable={!isLoading && allowEditing}
        />
        {!allowEditing && (
          <Text
            style={{
              ...typography.subsection,
              marginBottom: spacing.md,
              color: colors.navy,
            }}
          >
            (View Only)
          </Text>
        )}
        {strategy.renderWorkoutHeaderSubFields({
          workout,
          allowEditing,
          isLoading,
          handleUpdateWorkout,
          openDatePicker,
          setOpenDatePicker,
          newSetWeightUnit,
          setNewSetWeightUnit,
          newSetDistanceUnit,
          setNewSetDistanceUnit,
        })}
      </View>
    );
  };

  const renderWorkoutFooter = () => {
    return (
      <View>
        <Text style={typography.label}>Notes</Text>
        <TextField
          multiline
          value={workout.notes ?? ""}
          onChangeText={(text) => {
            const newWorkout = { ...workout };
            newWorkout.notes = text;
            setWorkout(newWorkout);
          }}
          placeholder="Any notes about this workout (RPE goals, cues, etc.)"
          placeholderTextColor={colors.placeholderTextColor}
          style={{
            ...typography.body,
            marginTop: 4,
            minHeight: 80,
            textAlignVertical: "top",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 6,
            backgroundColor: allowEditing ? colors.surface : colors.surfaceAlt,
          }}
          editable={!isLoading && allowEditing}
        />
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 8,
            gap: 8,
            marginTop: spacing.md,
          }}
        >
          <Button
            title={allowEditing ? "Cancel ": "Exit"}
            onPress={requestClose}
            variant={allowEditing ? "secondary" : "primary"}
            style={{ flex: 1}}
          />
          {allowEditing && (
            <Button
              title={`${updateWorkoutId !== null ? "Update" : "Create"} ${isTemplateWorkout(workout) ? "Template" : "Log"}`}
              onPress={handleSave}
              disabled={!isSavable || isLoading || !allowEditing}
              style={{ flex: 1}}
            />
          )}
        </View>
      </View>
    );
  };

  const handleRemoveSetInExercise = (
    exerciseIndex: number,
    setIndex: number,
  ) => {
    if (exerciseIndex < 0 || exerciseIndex >= sets.length) {
      return;
    }
    if (setIndex < 0 || setIndex >= sets[exerciseIndex].length) {
      return;
    }
    setSets((prev) => {
      const newSets = [...prev];
      newSets[exerciseIndex] = newSets[exerciseIndex].filter(
        (_, i) => i !== setIndex,
      );
      return newSets;
    });
    if (advancedSet !== null && advancedSet[1] === setIndex) {
      setAdvancedSet(null);
    }
  };

  const handleSwapSetsInExercise = (
    exerciseIndex: number,
    s1: number,
    s2: number,
  ) => {
    if (exerciseIndex < 0 || exerciseIndex >= sets.length) {
      return;
    }
    const exerciseSets = sets[exerciseIndex];
    if (
      s1 < 0 ||
      s2 < 0 ||
      s1 >= exerciseSets.length ||
      s2 >= exerciseSets.length
    ) {
      return;
    }
    setSets((prev) => {
      const newSets = [...prev];
      [sets[exerciseIndex][s1], sets[exerciseIndex][s2]] = [
        sets[exerciseIndex][s2],
        sets[exerciseIndex][s1],
      ];
      return newSets;
    });
    if (advancedSet !== null) {
      if (advancedSet[1] === s1) {
        setAdvancedSet([advancedSet[0], s2]);
      } else if (advancedSet[1] === s2) {
        setAdvancedSet([advancedSet[0], s1]);
      }
    }
  };

  const handleRemoveExercise = (index: number) => {
    if (index < 0 || index >= sets.length || index >= exercises.length) {
      return;
    }
    setExercises((prev) => prev.filter((_, i) => i !== index));
    setSets((prev) => prev.filter((_, i) => i !== index));
    if (advancedExercise === index) {
      clearAdvancedExercise();
    }
    if (advancedSet !== null && advancedSet[0] === index) {
      setAdvancedSet(null);
    }
  };

  const handleUpdateExercise = <
    K extends keyof EditableExercise<WorkoutEditorMode>,
  >(
    exerciseIndex: number,
    key: K,
    value: EditableExercise<WorkoutEditorMode>[K],
  ) => {
    if (exerciseIndex < 0 || exerciseIndex >= sets.length) {
      return;
    }
    setExercises((prev) => {
      const next = [...prev];
      next[exerciseIndex] = { ...next[exerciseIndex], [key]: value };
      return next;
    });
  };

  // have to use WorkoutEditorMode and NOT M
  const handleUpdateSet = <K extends keyof EditableSet<M>>(
    exerciseIndex: number,
    setIndex: number,
    key: K,
    value: EditableSet<M>[K],
  ) => {
    if (exerciseIndex < 0 || exerciseIndex >= sets.length) {
      return;
    }
    if (setIndex < 0 || setIndex >= sets[exerciseIndex].length) {
      return;
    }
    setSets((prev) => {
      const next = [...prev];
      const exerciseSets = [...next[exerciseIndex]];
      const current = exerciseSets[setIndex];
      exerciseSets[setIndex] = { ...current, [key]: value };
      next[exerciseIndex] = exerciseSets;
      return next;
    });
  };

  const renderAdvancedSet = () => {
    if (advancedSet === null) {
      return null;
    }
    function handleUpdateSetCurried<K extends keyof EditableSet<M>>(
      key: K,
      value: EditableSet<M>[K],
    ) {
      handleUpdateSet(exerciseIndex, setIndex, key, value);
    }
    const [exerciseIndex, setIndex] = advancedSet;
    const set = sets[exerciseIndex][setIndex];
    const exercise = exercises[exerciseIndex];
    const ctx: AdvancedSetRenderProps<M> = {
      set,
      setIndex,
      handleUpdateSetCurried,
      isLoading,
      allowEditing,
      exercise,
      exerciseIndex,
      totalSetsInExercise: sets[exerciseIndex].length,
      handleSwapSetsInExercise,
      handleRemoveSetInExercise,
      isVisible: true,
      onRequestClose: () => setAdvancedSet(null),
    };
    return strategy.renderAdvancedSetMenu(ctx);
  };

  const renderSet = (
    exerciseIndex: number,
    set: AnyEditableSet,
    setIndex: number,
  ) => {
    function handleUpdateSetCurried<K extends keyof EditableSet<M>>(
      key: K,
      value: EditableSet<M>[K],
    ) {
      handleUpdateSet(exerciseIndex, setIndex, key, value);
    }

    return (
      <View
        key={`${exerciseIndex - setIndex}`}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 6,
          backgroundColor: colors.surfaceAlt,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View>
          {isTemplateSet(set) ? (
            <Text>Template sets are not supported yet</Text>
          ) : isLogSet(set) ? (
            strategy.renderSetBody({
              set,
              setIndex,
              handleUpdateSetCurried,
              isLoading,
              allowEditing,
            })
          ) : (
            <Text>Unknown set type. Cannot render</Text>
          )}
        </View>
        {/* Top row: Set label, classification chips, complete toggle */}
        <Pressable
          onPress={() => setAdvancedSet([exerciseIndex, setIndex])}
          style={{ marginLeft: "auto" }}
        >
          <Feather name="more-horizontal" size={18} color="black" />
        </Pressable>
      </View>
    );
  };

  const handleAddSet = (exerciseIndex: number) => {
    if (exerciseIndex < 0 || exerciseIndex >= sets.length) {
      return;
    }
    setSets((prev) => {
      const next = [...prev];
      if (next[exerciseIndex].length > 0) {
        next[exerciseIndex] = [
          ...next[exerciseIndex],
          { ...next[exerciseIndex][next[exerciseIndex].length - 1] },
        ];
      } else {
        next[exerciseIndex] = [
          ...next[exerciseIndex],
          {
            ...strategy.createEmptySet({
              weightUnit: newSetWeightUnit,
              distanceUnit: newSetDistanceUnit,
            }),
            performance_type: isTemplateWorkout(workout)
              ? "percentage"
              : "weight",
          },
        ];
      }
      return next;
    });
  };

  const handleSwapExercisePositions = (i1: number, i2: number) => {
    if (i1 < 0 || i2 < 0 || i1 >= exercises.length || i2 >= exercises.length) {
      return;
    }

    setExercises((prev) => {
      const next = [...prev];
      [next[i1], next[i2]] = [next[i2], next[i1]];
      return next;
    });

    setSets((prev) => {
      const next = [...prev];
      [next[i1], next[i2]] = [next[i2], next[i1]];
      return next;
    });
    if (advancedExercise === i1) {
      setAdvancedExercise(i2);
    } else if (advancedExercise === i2) {
      setAdvancedExercise(i1);
    }
    if (advancedSet !== null && advancedSet[0] === i1) {
      setAdvancedSet([i2, advancedSet[1]]);
    } else if (advancedSet !== null && advancedSet[0] === i2) {
      setAdvancedSet([i1, advancedSet[1]]);
    }
  };

  const renderAdvancedExercise = () => {
    if (advancedExercise === null) {
      return null;
    }
    const exerciseIdx = advancedExercise;
    const setsForExercise = sets[exerciseIdx];
    const exercise = exercises[exerciseIdx];
    let bestSetByE1RM: [EditableSet<"log">, number] | null = null;
    if (isLogWorkout(workout) && setsForExercise.length > 0) {
      const logSets = setsForExercise.filter(
        (s): s is EditableSet<"log"> =>
          isLogSet(s) &&
          s.performance_type === "weight" &&
          s.weight !== null &&
          s.reps !== null,
      );
      const withE1RM = logSets
        .map((set) => {
          const weightInTargetUnit = changeWeightUnit(
            set.weight!,
            set.weight_unit,
            "kg",
          );

          const e1rm = rpeChartE1RM(weightInTargetUnit, set.reps!, set.rpe);

          return [set, e1rm] as const;
        })
        .filter(([_s, e1rm]) => e1rm !== null);

      const bestSetByE1RMMaybeNull =
        withE1RM.length === 0
          ? null
          : withE1RM.reduce((best, current) => {
              return current[1]! > best[1]! ? current : best;
            });
      if (
        bestSetByE1RMMaybeNull === null ||
        bestSetByE1RMMaybeNull[1] === null
      ) {
        bestSetByE1RM = null;
      } else {
        bestSetByE1RM = [
          bestSetByE1RMMaybeNull[0],
          changeWeightUnit(
            bestSetByE1RMMaybeNull[1],
            "kg",
            bestSetByE1RMMaybeNull[0].weight_unit,
          ),
        ];
      }
    }

    return (
      <ClosableModal
        visible={advancedExercise !== null}
        onRequestClose={clearAdvancedExercise}
        scrollViewProps={{ contentContainerStyle: { gap: spacing.md } }}
      >
        <Text
          style={{
            ...typography.section,
            borderBottomWidth: 2,
            borderBottomColor: colors.border,
            marginBottom: spacing.sm,
            paddingBottom: spacing.padding_sm,
          }}
        >
          Advanced Logging for {exercise.exercise.name} - Exercise{" "}
          {exerciseIdx + 1}
        </Text>
        <Text
          style={{
            ...typography.subsection,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: spacing.sm,
            paddingBottom: spacing.padding_sm,
          }}
        >
          Options
        </Text>
        {allowEditing && exercises.length > 1 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Text style={{ ...typography.body, marginRight: spacing.md }}>
              Move Exercise:
            </Text>
            {exerciseIdx !== 0 && (
              <Button
                title="&uarr;"
                onPress={() =>
                  handleSwapExercisePositions(exerciseIdx - 1, exerciseIdx)
                }
                variant="secondary"
                style={{ padding: 4 }}
                textProps={{ style: { fontSize: 12 } }}
                disabled={isLoading || !allowEditing}
              />
            )}
            {exerciseIdx !== exercises.length - 1 && (
              <Button
                title="&darr;"
                onPress={() =>
                  handleSwapExercisePositions(exerciseIdx, exerciseIdx + 1)
                }
                variant="secondary"
                style={{ padding: 4 }}
                textProps={{ style: { fontSize: 12 } }}
                disabled={isLoading || !allowEditing}
              />
            )}
            {setsForExercise.length === 0 && (
              <Button
                title="&times;"
                onPress={() => handleRemoveExercise(exerciseIdx)}
                variant="revert"
                style={{ padding: 4 }}
                textProps={{ style: { fontSize: 12 } }}
                disabled={
                  setsForExercise.length > 0 || isLoading || !allowEditing
                }
              />
            )}
          </View>
        )}
        {allowEditing && <Button
          title={"Change Exercise"}
          onPress={() => {
            setExercisePickerFunction(() => (newExercise: ExerciseRow) => {
              handleUpdateExercise(exerciseIdx, 'exercise', newExercise);
              clearAdvancedExercise();
            })
            setOpenExercisePicker(true);
          }}
          variant="secondary"
          disabled={isLoading || !allowEditing}
        />}
        <View>
          <Text style={typography.body}>Notes:</Text>
          <TextField
            multiline
            value={exercise.notes ?? ""}
            onChangeText={(text) =>
              handleUpdateExercise(exerciseIdx, "notes", text)
            }
            placeholder="Any notes about this exercise (RPE goals, cues, etc.)"
            placeholderTextColor={colors.placeholderTextColor}
            style={{
              ...typography.body,
              marginTop: 4,
              minHeight: 80,
              textAlignVertical: "top",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: allowEditing
                ? colors.surface
                : colors.surfaceAlt,
            }}
            editable={!isLoading && allowEditing}
          />
        </View>
        <Text
          style={{
            ...typography.subsection,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: spacing.sm,
            paddingBottom: spacing.padding_sm,
          }}
        >
          Metrics
        </Text>
        {isLogWorkout(workout) &&
          (bestSetByE1RM !== null ? (
            <View>
              <View
                style={{
                  borderRadius: 10,
                  padding: spacing.padding_sm,
                  backgroundColor: colors.fadedPrimary,
                  marginBottom: spacing.xs,
                }}
              >
                <Text style={typography.body}>
                  Best Set:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {bestSetByE1RM[0].weight?.toFixed(1)}{" "}
                    {bestSetByE1RM[0].weight_unit}
                    {bestSetByE1RM[0].weight === 1 ? "" : "s"} &times;{" "}
                    {bestSetByE1RM[0].reps}
                    {bestSetByE1RM[0].rpe !== null
                      ? ` @ RPE ${bestSetByE1RM[0].rpe}`
                      : ""}
                  </Text>
                </Text>
                <Text style={typography.body}>
                  Estimated One Rep Max (e1RM):{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {bestSetByE1RM[1].toFixed(1)} {bestSetByE1RM[0].weight_unit}
                    {bestSetByE1RM[1] === 1 ? "" : "s"}
                  </Text>
                </Text>
                <Text style={{ ...typography.hint, marginTop: spacing.sm }}>
                  Only sets with 1-12 reps were considered. Sets with no RPE
                  were defaulted to RPE 10 (max effort).
                </Text>
              </View>
            </View>
          ) : (
            <Text style={typography.body}>
              Enter sets with weights and reps (1-12) to track your best set
              (sets must have the 'Weight' performance type).
            </Text>
          ))}
        <View>
          <Button title="Show Volumes" onPress={() => setShowVolumesForAdvancedExercise((prev) => !prev)} variant="secondary"/>
          {showVolumesForAdvancedExercise && <Button title={`Toggle Editing. Editing Turned: ${editVolume ? 'On' : 'Off'}`} onPress={() => setEditVolumes((prev) => !prev)} variant={editVolume ? "primary" : "secondary"}/>}
        </View>
        {showVolumesForAdvancedExercise && <VolumeRender
          exercise={exercise.exercise}
          onRequestClose={() => setShowVolumesForAdvancedExercise(false)}
          allowEditing={editVolume}
        />}
        <Button title="Close" onPress={clearAdvancedExercise} />
        {allowEditing && (
          <Button
            title={`Delete Exercise`}
            onPress={() => {
              handleRemoveExercise(exerciseIdx);
            }}
            variant="revert"
            disabled={!allowEditing || isLoading}
          />
        )}
      </ClosableModal>
    );
  };

  const renderExercisesSection = () => {
    return (
      <View style={{ marginBottom: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text style={{ ...typography.title, color: colors.teal }}>
            Exercises
          </Text>
          {allowEditing && (
            <View style={{ marginLeft: "auto", alignItems: "center" }}>
              <Button
                title="Add Exercise"
                onPress={() => {
                  setOpenExercisePicker(true);
                  setExercisePickerFunction(
                    () => (exerciseRow: ExerciseRow) => {
                      const newExercise: EditableExercise<WorkoutEditorMode> = {
                        exercise: exerciseRow,
                        superset_group: null,
                        notes: "",
                      };
                      setExercises([...exercises, newExercise]);
                      setSets([...sets, []]);
                    },
                  );
                }}
                disabled={isLoading || !allowEditing}
                style={{ paddingVertical: 6, paddingHorizontal: 8 }}
              />
            </View>
          )}
        </View>

        {exercises.length === 0 ? (
          <Text style={typography.hint}>
            No exercises added yet. Tap &quot;Add Exercise&quot; to build this
            workout.
          </Text>
        ) : (
          exercises.map((ex, exerciseIdx) => {
            const setsForExercise = sets[exerciseIdx];
            return (
              <View
                key={`${ex.exercise.id}-${exerciseIdx}`}
                style={{
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  marginBottom: spacing.md,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: spacing.xs,
                    flexWrap: "wrap",
                  }}
                >
                  <Text
                    style={{
                      ...typography.subsection,
                      marginRight: 10,
                      color: colors.orange,
                    }}
                  >
                    {exerciseIdx + 1}. {ex.exercise.name}
                  </Text>
                  <Text
                    style={{ ...typography.body, color: colors.textPrimary }}
                  >
                    - {setsForExercise.length} set
                    {setsForExercise.length === 1 ? "" : "s"}
                  </Text>
                  <Pressable
                    onPress={() => setAdvancedExercise(exerciseIdx)}
                    style={{ marginLeft: "auto" }}
                  >
                    <Feather name="more-horizontal" size={24} color="black" />
                  </Pressable>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: spacing.md,
                  }}
                >
                  <Selection
                    title={"Superset"}
                    isSelected={ex.superset_group !== null}
                    onPress={() => {
                      if (ex.superset_group !== null) {
                        handleUpdateExercise(
                          exerciseIdx,
                          "superset_group",
                          null,
                        );
                        return;
                      }
                      for (let i = exerciseIdx - 1; i >= 0; i--) {
                        const exerciseBefore = exercises[i];
                        if (exerciseBefore.superset_group === null) continue;
                        handleUpdateExercise(
                          exerciseIdx,
                          "superset_group",
                          exerciseBefore.superset_group,
                        );
                        return;
                      }
                      for (let i = exerciseIdx + 1; i < exercises.length; i++) {
                        const exerciseAfter = exercises[i];
                        if (exerciseAfter.superset_group === null) continue;
                        handleUpdateExercise(
                          exerciseIdx,
                          "superset_group",
                          exerciseAfter.superset_group,
                        );
                        return;
                      }
                      handleUpdateExercise(exerciseIdx, "superset_group", 1);
                    }}
                    disabled={isLoading || !allowEditing}
                  />
                  {ex.superset_group !== null && (
                    <NumberField
                      numberValue={ex.superset_group}
                      onChangeNumber={(value) => {
                        if (value !== null && value >= 1) {
                          handleUpdateExercise(
                            exerciseIdx,
                            "superset_group",
                            value,
                          );
                        }
                      }}
                      numberType={"int"}
                      style={{
                        ...typography.hint,
                        width: 30,
                        borderBottomWidth: 1,
                        borderColor: colors.border,
                        marginLeft: 6,
                        padding: 4,
                      }}
                      editable={!isLoading && allowEditing}
                    />
                  )}
                  {allowEditing && (
                    <Button
                      title={"Add Set"}
                      onPress={() => handleAddSet(exerciseIdx)}
                      style={{ marginLeft: "auto", padding: 4 }}
                      textProps={{
                        style: {
                          ...typography.hint,
                          color: colors.textOnPrimary,
                          fontWeight: '700'
                        },
                      }}
                      disabled={!allowEditing}
                    />
                  )}
                </View>
                {setsForExercise.length === 0 ? (
                  <Text style={typography.hint}>
                    No exercises added yet. Tap &quot;Add Set&quot; to build
                    this exercise.
                  </Text>
                ) : (
                  setsForExercise.map((item, setIndex) =>
                    renderSet(exerciseIdx, item, setIndex),
                  )
                )}
              </View>
            );
          })
        )}
      </View>
    );
  };

  const handleSave = async () => {
    setIsLoading(true);

    const finalWorkout =
      workout.name.length === 0
        ? { ...workout, name: "Untitled Workout" }
        : workout;

    if (finalWorkout !== workout) setWorkout(finalWorkout);

    try {
      const payload: FullDetachedWorkoutForMode<M> = {
        workout: finalWorkout,
        exercises,
        sets,
      };

      let success = false;
      let savedWorkout = finalWorkout;
      let savedExercises = exercises;
      let savedSets = sets;

      if (isFullTemplateWorkout(payload)) {
        success = await upsertTemplateWorkout(payload, updateWorkoutId);
      } else if (isFullLogWorkout(payload)) {
        const user = await requireGetUser();
        if (!user) return;

        const workoutWithUser = { ...payload.workout, user_id: user.user_id };
        const [wasSuccess, newId] = await upsertWorkoutLog({
          payload: {
            workout: workoutWithUser,
            exercises: payload.exercises,
            sets: payload.sets,
          },
          workoutLogId: updateWorkoutId,
        });

        success = wasSuccess;

        if (success) {
          if (newId === null)
            throw new Error("Had successful upsert but new id was null");
          savedWorkout = workoutWithUser;
          onSuccessfulSave(
            {
              workout: workoutWithUser,
              exercises: savedExercises,
              sets: savedSets,
            },
            newId,
          );
        }
      } else {
        throw new Error(
          `Unknown full workout mode: ${JSON.stringify(payload)}`,
        );
      }

      if (success) {
        showAlert("Successfully saved workout!");
        initialWorkoutRef.current = savedWorkout;
        initialExercisesRef.current = savedExercises;
        initialSetsRef.current = savedSets;

        if (requestCloseOnSuccessfulSave) requestClose();
      }
    } catch (e: unknown) {
      showAlert(
        "Error saving",
        anyErrorToString(e, "Could not convert error to string. Check logs"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isActive) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={{ marginTop: 8 }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Screen center={false}>
      {renderHeader()}
      {renderAssociatedProgram()}
      {renderExercisesSection()}
      {renderWorkoutFooter()}
      {renderAdvancedSet()}
      {!openExercisePicker && renderAdvancedExercise()}
      <ExerciseModal
        allowSelectExercises={true}
        allowCreateExercises={true}
        visible={openExercisePicker}
        onRequestClose={(exercise: ExerciseRow | null) => {
          setOpenExercisePicker(false);
          if (exercise === null) {
            return;
          }
          if (exercisePickerFunction === null) {
            console.error(
              "Requested close on exercise modal but no picker function selected",
            );
            return;
          }
          exercisePickerFunction(exercise);
        }}
      />
    </Screen>
  );
}
