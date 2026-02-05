import { EXERCISE_CACHE_NAME, fetchExercises } from "@/src/api/exerciseApi";
import { upsertWorkoutLog } from "@/src/api/workoutLogApi";
import {
  addExerciseToWorkout,
  addSetToWorkout,
  EditableExercise,
  EditableSet,
  EditableWorkout,
  FullAttachedWorkout,
  fullDetachedWorkoutEqual,
  FullDetachedWorkoutForMode,
  isFullDetachedLogWorkout,
  isFullDetachedTemplateWorkout,
  isLogSet,
  isLogWorkout,
  isTemplateSet,
  isTemplateWorkout,
  removeExerciseFromWorkoutById,
  removeExerciseFromWorkoutByIndex,
  swapExercisesInWorkout,
  updateExerciseForWorkout,
  updateExercisesForWorkoutWhere,
  updateWorkoutInWorkout,
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
import { CACHE_FACTORY } from "@/src/swrCache";
import { colors, spacing, typography } from "@/src/theme";
import { DistanceUnit, ExerciseRow, UUID, WeightUnit } from "@/src/types";
import { anyErrorToString, changeWeightUnit, showAlert } from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ExerciseModal } from "../exercise/ExerciseModal";
import { VolumeRender } from "../exercise/VolumeRender";

export type SharedProps<M extends WorkoutEditorMode> = {
  setFullWorkout: React.Dispatch<
    React.SetStateAction<FullDetachedWorkoutForMode<M>>
  >;
  isLoading: boolean;
  allowEditing: boolean;
};

export type SetRenderProps<M extends WorkoutEditorMode> = SharedProps<M> & {
  set: EditableSet<M>;
  setIndex: number;
  exerciseIndex: number;
};

export type AdvancedSetRenderProps<M extends WorkoutEditorMode> =
  SetRenderProps<M> & {
    exercise: EditableExercise<M>;
    totalSetsInExercise: number;
    isVisible: boolean;
    onRequestClose: () => void;
    setAdvancedSet: React.Dispatch<
      React.SetStateAction<[number, number] | null>
    >;
  };

export type HeaderSubFieldsProps<M extends WorkoutEditorMode> =
  SharedProps<M> & {
    workout: EditableWorkout<M>;
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

function blankState<M extends WorkoutEditorMode>(
  strategy: WorkoutEditorModeStrategy<M>,
): FullDetachedWorkoutForMode<M> {
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
  onSuccessfulSave: (newWorkout: FullAttachedWorkout<M>) => void;
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

  const [fullWorkout, setFullWorkout] = useState<FullDetachedWorkoutForMode<M>>(
    structuredClone(loadWithExisting) ?? blankState(strategy),
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
  const [showVolumesForAdvancedExercise, setShowVolumesForAdvancedExercise] =
    useState<boolean>(false);
  const [editVolume, setEditVolumes] = useState<boolean>(false);
  const [advancedSet, setAdvancedSet] = useState<[number, number] | null>(null);

  const initialFullWorkoutRef = useRef<FullDetachedWorkoutForMode<M>>(
    loadWithExisting && updateWorkoutId
      ? structuredClone(loadWithExisting)
      : blankState(strategy),
  );

  useEffect(() => {
    return CACHE_FACTORY.subscribe(async (e) => {
      const keyChange = e.key;
      if (
        e.cacheName === EXERCISE_CACHE_NAME &&
        e.type === "write" &&
        keyChange !== undefined
      ) {
        const newExercise = (await fetchExercises()).get(keyChange);
        if (!newExercise) {
          console.error(
            `Got write commit but ${keyChange} could not be found in new exercises`,
          );
          return;
        }
        // make typescript not complain
        // EditableExercise<M>["exercise"] === ExerciseRow for all M
        const predicate = (editableExercise: EditableExercise<M>) =>
          editableExercise.exercise.id === keyChange;
        setFullWorkout((prev) => {
          return updateExercisesForWorkoutWhere({
            fullWorkout: prev,
            predicate: predicate,
            key: "exercise",
            value: newExercise,
          });
        });
        initialFullWorkoutRef.current = updateExercisesForWorkoutWhere({
          fullWorkout: initialFullWorkoutRef.current,
          predicate: predicate,
          key: "exercise",
          value: newExercise,
        });
      }
      if (
        e.cacheName === EXERCISE_CACHE_NAME &&
        e.type === "delete" &&
        keyChange !== undefined
      ) {
        setFullWorkout((prev) => {
          return removeExerciseFromWorkoutById({
            fullWorkout: prev,
            exerciseId: keyChange,
          });
        });
        initialFullWorkoutRef.current = removeExerciseFromWorkoutById({
          fullWorkout: initialFullWorkoutRef.current,
          exerciseId: keyChange,
        });
      }
    });
  }, [fullWorkout, initialFullWorkoutRef.current]);

  const clearAdvancedExercise = () => {
    setAdvancedExercise(null);
    setShowVolumesForAdvancedExercise(false);
    setEditVolumes(false);
  };

  const isDirty = useMemo(() => {
    if (
      updateWorkoutId === null &&
      fullDetachedWorkoutEqual(
        initialFullWorkoutRef.current,
        blankState(strategy),
      )
    ) {
      // allow saving blank new logs
      return true;
    }
    return !fullDetachedWorkoutEqual(
      initialFullWorkoutRef.current,
      fullWorkout,
    );
  }, [fullWorkout, initialFullWorkoutRef.current]);

  const renderAssociatedProgram = () => {
    const workout = fullWorkout.workout;
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

  const renderHeader = () => {
    const workout = fullWorkout.workout;
    return (
      <View style={{ marginBottom: 16 }}>
        {/* Name row */}
        <TextField
          value={workout.name}
          onChangeText={(text) => {
            setFullWorkout((prev) => {
              return updateWorkoutInWorkout({
                fullWorkout: prev,
                key: "name",
                value: text,
              });
            });
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
          openDatePicker,
          setOpenDatePicker,
          newSetWeightUnit,
          setNewSetWeightUnit,
          newSetDistanceUnit,
          setNewSetDistanceUnit,
          setFullWorkout,
        })}
      </View>
    );
  };

  const renderWorkoutFooter = () => {
    const workout = fullWorkout.workout;
    return (
      <View>
        <Text style={typography.label}>Notes</Text>
        <TextField
          multiline
          value={workout.notes ?? ""}
          onChangeText={(text) => {
            setFullWorkout((prev) => {
              return updateWorkoutInWorkout({
                fullWorkout: prev,
                key: "notes",
                value: text,
              });
            });
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
            title={allowEditing ? "Cancel " : "Exit"}
            onPress={requestClose}
            variant={allowEditing ? "secondary" : "primary"}
            style={{ flex: 1 }}
          />
          {allowEditing && (
            <Button
              title={`${updateWorkoutId !== null ? "Update" : "Create"} ${isTemplateWorkout(workout) ? "Template" : "Log"}`}
              onPress={handleSave}
              disabled={!isDirty || isLoading || !allowEditing}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </View>
    );
  };

  const renderAdvancedSet = () => {
    if (advancedSet === null) {
      return null;
    }
    const [exerciseIndex, setIndex] = advancedSet;
    const set = fullWorkout.sets[exerciseIndex][setIndex];
    const exercise = fullWorkout.exercises[exerciseIndex];
    const ctx: AdvancedSetRenderProps<M> = {
      set,
      setIndex,
      isLoading,
      allowEditing,
      exercise,
      exerciseIndex,
      totalSetsInExercise: fullWorkout.sets[exerciseIndex].length,
      isVisible: true,
      onRequestClose: () => setAdvancedSet(null),
      setFullWorkout,
      setAdvancedSet,
    };
    return strategy.renderAdvancedSetMenu(ctx);
  };

  const renderSet = (
    exerciseIndex: number,
    set: EditableSet<M>,
    setIndex: number,
  ) => {
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
              isLoading,
              allowEditing,
              setFullWorkout,
              exerciseIndex,
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

  const renderAdvancedExercise = () => {
    if (advancedExercise === null || fullWorkout.exercises.length === 0) {
      return null;
    }
    const exerciseIdx = advancedExercise;
    const workout = fullWorkout.workout;
    const setsForExercise = fullWorkout.sets[exerciseIdx];
    const exercise = fullWorkout.exercises[exerciseIdx];
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
        {allowEditing && fullWorkout.exercises.length > 1 && (
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
                onPress={() => {
                  setAdvancedExercise(exerciseIdx - 1);
                  setFullWorkout((prev) => {
                    return swapExercisesInWorkout({
                      fullWorkout: prev,
                      exerciseIndexFirst: exerciseIdx - 1,
                      exerciseIndexSecond: exerciseIdx,
                    });
                  });
                }}
                variant="secondary"
                style={{ padding: 4 }}
                textProps={{ style: { fontSize: 12 } }}
                disabled={isLoading || !allowEditing}
              />
            )}
            {exerciseIdx !== fullWorkout.exercises.length - 1 && (
              <Button
                title="&darr;"
                onPress={() => {
                  setAdvancedExercise(exerciseIdx + 1);
                  setFullWorkout((prev) => {
                    return swapExercisesInWorkout({
                      fullWorkout: prev,
                      exerciseIndexFirst: exerciseIdx + 1,
                      exerciseIndexSecond: exerciseIdx,
                    });
                  });
                }}
                variant="secondary"
                style={{ padding: 4 }}
                textProps={{ style: { fontSize: 12 } }}
                disabled={isLoading || !allowEditing}
              />
            )}
          </View>
        )}
        {allowEditing && (
          <Button
            title={"Change Exercise"}
            onPress={() => {
              setExercisePickerFunction(() => (newExercise: ExerciseRow) => {
                setFullWorkout((prev) => {
                  return updateExerciseForWorkout({
                    fullWorkout: prev,
                    exerciseIndex: exerciseIdx,
                    key: "exercise",
                    value: newExercise,
                  });
                });
                clearAdvancedExercise();
              });
              setOpenExercisePicker(true);
            }}
            variant="secondary"
            disabled={isLoading || !allowEditing}
          />
        )}
        <View>
          <Text style={typography.body}>Notes:</Text>
          <TextField
            multiline
            value={exercise.notes ?? ""}
            onChangeText={(text) =>
              setFullWorkout((prev) => {
                return updateExerciseForWorkout({
                  fullWorkout: prev,
                  exerciseIndex: exerciseIdx,
                  key: "notes",
                  value: text,
                });
              })
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
          <Button
            title="Show Volumes"
            onPress={() => setShowVolumesForAdvancedExercise((prev) => !prev)}
            variant="secondary"
          />
          {showVolumesForAdvancedExercise && (
            <Button
              title={`Toggle Editing. Editing Turned: ${editVolume ? "On" : "Off"}`}
              onPress={() => setEditVolumes((prev) => !prev)}
              variant={editVolume ? "primary" : "secondary"}
            />
          )}
        </View>
        {showVolumesForAdvancedExercise && (
          <VolumeRender
            exercise={exercise.exercise}
            onRequestClose={() => setShowVolumesForAdvancedExercise(false)}
            allowEditing={editVolume}
          />
        )}
        <Button title="Close" onPress={clearAdvancedExercise} />
        {allowEditing && (
          <Button
            title={`Delete Exercise`}
            onPress={() => {
              clearAdvancedExercise();
              setFullWorkout((prev) => {
                return removeExerciseFromWorkoutByIndex({
                  fullWorkout: prev,
                  exerciseIndex: exerciseIdx,
                });
              });
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
                      const newExercise: EditableExercise<M> = {
                        exercise: exerciseRow,
                        superset_group: null,
                        notes: "",
                      };
                      setFullWorkout((prev) => {
                        return addExerciseToWorkout({
                          fullWorkout: prev,
                          newExercise,
                        });
                      });
                    },
                  );
                }}
                disabled={isLoading || !allowEditing}
                style={{ paddingVertical: 6, paddingHorizontal: 8 }}
              />
            </View>
          )}
        </View>

        {fullWorkout.exercises.length === 0 ? (
          <Text style={typography.hint}>
            No exercises added yet. Tap &quot;Add Exercise&quot; to build this
            workout.
          </Text>
        ) : (
          fullWorkout.exercises.map((ex, exerciseIdx) => {
            const setsForExercise = fullWorkout.sets[exerciseIdx];
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
                      setFullWorkout((prev) => {
                        if (ex.superset_group !== null) {
                          return updateExerciseForWorkout({
                            fullWorkout: prev,
                            exerciseIndex: exerciseIdx,
                            key: "superset_group",
                            value: null,
                          });
                        }
                        for (let i = exerciseIdx - 1; i >= 0; i--) {
                          const exerciseBefore = fullWorkout.exercises[i];
                          if (exerciseBefore.superset_group === null) continue;
                          return updateExerciseForWorkout({
                            fullWorkout: prev,
                            exerciseIndex: exerciseIdx,
                            key: "superset_group",
                            value: exerciseBefore.superset_group,
                          });
                        }
                        for (
                          let i = exerciseIdx + 1;
                          i < fullWorkout.exercises.length;
                          i++
                        ) {
                          const exerciseAfter = fullWorkout.exercises[i];
                          if (exerciseAfter.superset_group === null) continue;
                          return updateExerciseForWorkout({
                            fullWorkout: prev,
                            exerciseIndex: exerciseIdx,
                            key: "superset_group",
                            value: exerciseAfter.superset_group,
                          });
                        }
                        return updateExerciseForWorkout({
                          fullWorkout: prev,
                          exerciseIndex: exerciseIdx,
                          key: "superset_group",
                          value: 1,
                        });
                      });
                    }}
                    disabled={isLoading || !allowEditing}
                  />
                  {ex.superset_group !== null && (
                    <NumberField
                      numberValue={ex.superset_group}
                      onChangeNumber={(value) => {
                        if (value !== null && value >= 1) {
                          setFullWorkout((prev) => {
                            return updateExerciseForWorkout({
                              fullWorkout: prev,
                              exerciseIndex: exerciseIdx,
                              key: "superset_group",
                              value,
                            });
                          });
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
                      onPress={() => {
                        setFullWorkout((prev) => {
                          const setsForExerciseInWorkout =
                            fullWorkout.sets[exerciseIdx];
                          if (setsForExerciseInWorkout.length > 0) {
                            const lastSetSeen = setsForExerciseInWorkout.at(-1);
                            if (lastSetSeen) {
                              return addSetToWorkout({
                                fullWorkout: prev,
                                exerciseIndex: exerciseIdx,
                                newSet: { ...lastSetSeen },
                              });
                            }
                          }
                          return addSetToWorkout({
                            fullWorkout: prev,
                            exerciseIndex: exerciseIdx,
                            newSet: strategy.createEmptySet({
                              weightUnit: newSetWeightUnit,
                              distanceUnit: newSetDistanceUnit,
                            }),
                          });
                        });
                      }}
                      style={{ marginLeft: "auto", padding: 4 }}
                      textProps={{
                        style: {
                          ...typography.hint,
                          color: colors.textOnPrimary,
                          fontWeight: "700",
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
      fullWorkout.workout.name.length === 0
        ? { ...fullWorkout.workout, name: "Untitled Workout" }
        : fullWorkout.workout;

    const payload: FullDetachedWorkoutForMode<M> = {
      ...fullWorkout,
      workout: finalWorkout,
    };

    setFullWorkout(payload);

    try {
      let success = false;

      if (isFullDetachedTemplateWorkout(payload)) {
        success = await upsertTemplateWorkout(payload, updateWorkoutId);
      } else if (isFullDetachedLogWorkout(payload)) {
        const [wasSuccess, newId] = await upsertWorkoutLog({
          payload,
          workoutLogId: updateWorkoutId,
        });

        success = wasSuccess;

        if (success) {
          if (newId === null) {
            throw new Error("Had successful upsert but new id was null");
          }
          onSuccessfulSave({
            ...payload,
            workoutId: newId,
          } satisfies FullAttachedWorkout<M>);
        }
      } else {
        throw new Error(
          `Unknown full workout mode: ${JSON.stringify(payload)}`,
        );
      }

      if (success) {
        showAlert("Successfully saved workout!");
        initialFullWorkoutRef.current = structuredClone(payload);

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
        allowDeleteExercises={true}
        allowEditExercises={true}
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
