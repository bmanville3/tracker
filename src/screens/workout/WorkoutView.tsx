import { getExerciseWithState } from "@/src/api/exerciseApi";
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
  isLogWorkout,
  isTemplateSet,
  isTemplateWorkout,
  WorkoutEditorMode,
  workoutHasProgram,
} from "@/src/api/workoutSharedApi";
import { upsertTemplateWorkout } from "@/src/api/workoutTemplateApi";
import {
  Button,
  ModalPicker,
  NumberField,
  Screen,
  Selection,
  TextField,
} from "@/src/components/";
import { CalendarModal } from "@/src/components/CalendarModal";
import { colors, typography } from "@/src/theme";
import {
  DISTANCE_UNITS,
  DistanceUnit,
  ExerciseRow,
  PERFORMANCE_TYPES,
  RPE,
  RPES,
  SET_TYPES,
  UUID,
  WEIGHT_UNITS,
  WeightUnit,
} from "@/src/types";
import {
  arraysEqual,
  capitalizeFirstLetter,
  changeWeightUnit,
  doubleArraysEqual,
  requireGetUser,
  showAlert,
} from "@/src/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ExerciseModal } from "../ExerciseModal";

export interface WorkoutEditorModeStrategy<M extends WorkoutEditorMode> {
  mode: M;

  createEmptyWorkout(): EditableWorkout<M>;

  createEmptySet(ctx: {
    weightUnit: WeightUnit;
    distanceUnit: DistanceUnit;
  }): EditableSet<M>;
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

  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("m");

  const [openExercisePicker, setOpenExercisePicker] = useState<boolean>(false);
  const [exercisePickerFunction, setExercisePickerFunction] = useState<
    ((ex: ExerciseRow) => void) | null
  >(null);

  const [openDatePicker, setOpenDatePicker] = useState<boolean>(false);

  const initialWorkoutRef = useRef<EditableWorkout<M> | null>(null);
  const initialExercisesRef = useRef<EditableExercise<M>[] | null>(null);
  const initialSetsRef = useRef<EditableSet<M>[][] | null>(null);

  const resetAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const profile = await requireGetUser();
      if (!profile) return;

      setWeightUnit(profile.default_weight_unit);
      setDistanceUnit(profile.default_distance_unit);
      setOpenExercisePicker(false);
      setExercisePickerFunction(null);
      setOpenDatePicker(false);

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

  const renderHeader = () => {
    return (
      <View style={{ marginBottom: 16 }}>
        {/* Name row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <TextField
            value={workout.name}
            onChangeText={(text) => setWorkout({ ...workout, name: text })}
            placeholder="Untitled workout"
            placeholderTextColor={colors.placeholderTextColor}
            style={{
              ...typography.title,
              flex: 1,
              paddingVertical: 1,
            }}
            editable={isLoading || allowEditing}
          />
        </View>
        {!allowEditing && (
          <Text style={{ ...typography.hint, marginBottom: 10 }}>
            Editing disabled
          </Text>
        )}
        {isLogWorkout(workout) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              rowGap: 8,
            }}
          >
            <Text>Completed On:</Text>
            <Pressable
              onPress={() => setOpenDatePicker((prev) => !prev)}
              style={{
                ...typography.hint,
                borderRadius: 999,
                borderColor: colors.border,
                borderWidth: 1,
                backgroundColor: colors.surface,
                marginLeft: 4,
              }}
              disabled={!allowEditing}
            >
              <Text style={{ ...typography.hint, padding: 4 }}>
                {workout.completed_on}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Meta row: duration + bodyweight + units */}
        {isLogWorkout(workout) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              rowGap: 8,
            }}
          >
            {/* Duration */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginRight: 16,
              }}
            >
              <Text style={[typography.label, { marginRight: 4 }]}>
                Duration (min)
              </Text>
              <NumberField
                numberValue={
                  workout.duration_seconds !== null
                    ? Math.round(workout.duration_seconds / 60)
                    : null
                }
                onChangeNumber={(value) =>
                  setWorkout({
                    ...workout,
                    duration_seconds: value === null ? null : value * 60,
                  })
                }
                numberType={"int"}
                placeholder="min"
                placeholderTextColor={colors.placeholderTextColor}
                style={{
                  ...typography.body,
                  padding: 0,
                  width: 65,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                  textAlign: "center",
                }}
                editable={isLoading || allowEditing}
              />
            </View>

            {/* Bodyweight */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginRight: 16,
              }}
            >
              <Text style={[typography.label, { marginRight: 4 }]}>
                Bodyweight ({weightUnit})
              </Text>
              <NumberField
                numberValue={
                  workout.bodyweight_kg !== null
                    ? changeWeightUnit(workout.bodyweight_kg, "kg", weightUnit)
                    : null
                }
                onChangeNumber={(value) =>
                  setWorkout({
                    ...workout,
                    bodyweight_kg:
                      value !== null
                        ? changeWeightUnit(value, weightUnit, "kg")
                        : null,
                  })
                }
                placeholder={weightUnit}
                placeholderTextColor={colors.placeholderTextColor}
                style={{
                  ...typography.body,
                  padding: 0,
                  width: 65,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                  textAlign: "center",
                }}
                numberType={"float"}
                editable={isLoading || allowEditing}
              />
            </View>
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 4,
          }}
        >
          {WEIGHT_UNITS.map((u) => {
            const selected = u === weightUnit;
            return (
              <Selection
                key={u}
                title={u}
                isSelected={selected}
                onPress={() => setWeightUnit(u)}
              />
            );
          })}
          <Text style={[typography.label, { marginRight: 8, marginLeft: 8 }]}>
            |
          </Text>
          {DISTANCE_UNITS.map((u) => {
            const selected = u === distanceUnit;
            return (
              <Selection
                key={u}
                title={u}
                isSelected={selected}
                onPress={() => setDistanceUnit(u)}
              />
            );
          })}
        </View>
      </View>
    );
  };

  const renderWorkoutFooter = () => {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={typography.label}>Notes</Text>
        <TextField
          multiline
          value={workout.notes ?? ""}
          onChangeText={(text) => setWorkout({ ...workout, notes: text })}
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
          }}
          editable={isLoading || allowEditing}
        />
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
  };

  const handleRemoveExercise = (index: number) => {
    if (index < 0 || index >= sets.length || index >= exercises.length) {
      return;
    }
    setExercises((prev) => prev.filter((_, i) => i !== index));
    setSets((prev) => prev.filter((_, i) => i !== index));
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
  const handleUpdateSet = <K extends keyof EditableSet<WorkoutEditorMode>>(
    exerciseIndex: number,
    setIndex: number,
    key: K,
    value: EditableSet<WorkoutEditorMode>[K],
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

  const renderSet = (
    exerciseIndex: number,
    set: AnyEditableSet,
    setIndex: number,
  ) => {
    function handleUpdateSetCurried<
      K extends keyof EditableSet<WorkoutEditorMode>,
    >(key: K, value: EditableSet<WorkoutEditorMode>[K]) {
      handleUpdateSet(exerciseIndex, setIndex, key, value);
    }

    const rpeFieldRender = () => {
      return (
        <NumberField
          numberValue={set.rpe}
          placeholder="6-10"
          onChangeNumber={(value) => {
            if (value === null) {
              handleUpdateSetCurried("rpe", value);
              return;
            }
            const roundedToPoint5 = Math.round(value * 2) / 2;
            if (set.rpe === null) {
              // if no number yet force into rpe range
              // idea is to show what is allowed
              if (roundedToPoint5 < 2) {
                // assume trying to type 10
                handleUpdateSetCurried("rpe", 10);
                return;
              }
              const vAsRpe = Math.max(
                Math.min(...RPES),
                Math.min(roundedToPoint5, Math.max(...RPES)),
              ) as RPE;
              handleUpdateSetCurried("rpe", vAsRpe);
            } else if (RPES.includes(roundedToPoint5 as any)) {
              // if there is a number let user override
              handleUpdateSetCurried("rpe", roundedToPoint5 as RPE);
            }
          }}
          numberType="float"
          editable={isLoading || allowEditing}
          style={{ padding: 4 }}
        />
      );
    };

    const repsFieldRender = () => {
      return (
        <NumberField
          numberValue={set.reps}
          placeholder="Reps"
          onChangeNumber={(value) => {
            if (value !== null && value < 0) {
              return;
            }
            handleUpdateSetCurried("reps", value);
          }}
          numberType="float"
          editable={isLoading || allowEditing}
          style={{ padding: 4 }}
        />
      );
    };

    const renderSetHeader = () => {
      return (
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <Text style={typography.hint}>Set Type: </Text>
          <ModalPicker
            title="Pick Set Type"
            options={SET_TYPES.map((t) => {
              return {
                label: t !== null ? capitalizeFirstLetter(t) : "None",
                value: t,
              };
            })}
            value={set.set_type}
            onChange={(v) => handleUpdateSetCurried("set_type", v)}
            textProps={{ style: typography.hint }}
          />
          {isTemplateSet(set) && (
            <ModalPicker
              title="Pick Performance Metrics for Set"
              options={PERFORMANCE_TYPES.filter(
                (t) => t === "rpe" || t === "percentage",
              ).map((t) => {
                return {
                  label: t === "rpe" ? "RPE" : capitalizeFirstLetter(t),
                  value: t,
                };
              })}
              value={set.performance_type}
              onChange={(v) => handleUpdateSetCurried("performance_type", v)}
              textProps={{ style: typography.hint }}
            />
          )}
          <View style={{ marginLeft: "auto", flexDirection: "row", gap: 0 }}>
            {setIndex !== 0 && (
              <Button
                title="&uarr;"
                onPress={() =>
                  handleSwapSetsInExercise(
                    exerciseIndex,
                    setIndex,
                    setIndex - 1,
                  )
                }
                variant="secondary"
                style={{ padding: 5 }}
                textProps={{ style: { fontSize: 12 } }}
                disabled={isLoading || !allowEditing}
              />
            )}
            {setIndex !== sets[exerciseIndex].length - 1 && (
              <Button
                title="&darr;"
                onPress={() =>
                  handleSwapSetsInExercise(
                    exerciseIndex,
                    setIndex,
                    setIndex + 1,
                  )
                }
                variant="secondary"
                style={{ padding: 5 }}
                textProps={{ style: { fontSize: 12 } }}
                disabled={isLoading || !allowEditing}
              />
            )}
            <Button
              title="&times;"
              onPress={() => handleRemoveSetInExercise(exerciseIndex, setIndex)}
              variant="revert"
              style={{ padding: 5 }}
              textProps={{ style: { fontSize: 12 } }}
              disabled={isLoading || !allowEditing}
            />
          </View>
        </View>
      );
    };

    const renderTemplateRPEDisplay = () => {
      if (!isTemplateSet(set) || set.performance_type !== "rpe") {
        showAlert("Failed to render set. Please check the logs");
        console.error(`Failed to render as template rpe set: ${set}`);
        return null;
      }
      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ width: 60, marginRight: 6 }}>{repsFieldRender()}</View>
          <Text style={{ ...typography.body, marginRight: 4 }}>Reps @ RPE</Text>
          <View style={{ width: 60, marginLeft: 6, marginRight: 6 }}>
            {rpeFieldRender()}
          </View>
        </View>
      );
    };

    const renderTemplatePercentageDisplay = () => {
      if (!isTemplateSet(set) || set.performance_type !== "percentage") {
        showAlert("Failed to render set. Please check the logs");
        console.error(`Failed to render as template percentage set: ${set}`);
        return null;
      }
      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ width: 60, marginRight: 6 }}>
            <NumberField
              numberValue={set.percentage_of_max}
              placeholder="%"
              onChangeNumber={(value) =>
                handleUpdateSetCurried("percentage_of_max", value)
              }
              numberType="float"
              editable={isLoading || allowEditing}
              style={{ padding: 4 }}
            />
          </View>
          <Text style={{ ...typography.body, marginRight: 6 }}>
            % of 1RM of
          </Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Pressable
              onPress={() => {
                setOpenExercisePicker(true);
                setExercisePickerFunction(() => (exerciseRow: ExerciseRow) => {
                  handleUpdateSetCurried(
                    "max_percentage_exercise_id",
                    exerciseRow.id,
                  );
                });
              }}
              style={{
                ...typography.hint,
                borderRadius: 999,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 4,
              }}
              disabled={!allowEditing}
            >
              <Text style={{ ...typography.hint, padding: 4 }}>
                {set.max_percentage_exercise_id
                  ? (getExerciseWithState(set.max_percentage_exercise_id)
                      ?.name ?? "Not Found")
                  : exercises[exerciseIndex].exercise.name}
              </Text>
            </Pressable>
          </View>

          <Text style={{ ...typography.body, marginRight: 6, marginLeft: 6 }}>
            &times;
          </Text>
          <View style={{ width: 60, marginRight: 6 }}>{repsFieldRender()}</View>
          <Text style={{ ...typography.body, marginRight: 6 }}>Reps</Text>
        </View>
      );
    };

    const renderLogDisplay = () => {
      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 4,
          }}
        >
          <View style={{ width: 70, marginRight: 6 }}>
            <NumberField
              numberValue={set.weight}
              placeholder="Weight"
              onChangeNumber={(value) =>
                handleUpdateSetCurried("weight", value)
              }
              numberType={"float"}
              editable={isLoading || allowEditing}
              style={{ padding: 4 }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              marginRight: 6,
            }}
          >
            {WEIGHT_UNITS.map((u) => {
              return (
                <Selection
                  key={`${u}-${exerciseIndex}-${setIndex}`}
                  title={u}
                  isSelected={u === set.weight_unit}
                  onPress={() => handleUpdateSetCurried("weight_unit", u)}
                />
              );
            })}
          </View>
          <Text style={{ ...typography.body, marginRight: 4 }}>&times;</Text>
          <View style={{ width: 60, marginRight: 6 }}>{repsFieldRender()}</View>
          <Text style={{ ...typography.body, marginRight: 4 }}>Reps @ RPE</Text>
          <View style={{ width: 60, marginLeft: 6 }}>{rpeFieldRender()}</View>
        </View>
      );
    };

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
        }}
      >
        {/* Top row: Set label, classification chips, complete toggle */}
        {renderSetHeader()}

        {/* Middle row*/}
        <View>
          {isTemplateSet(set)
            ? set.performance_type === "rpe"
              ? renderTemplateRPEDisplay()
              : set.performance_type === "percentage"
                ? renderTemplatePercentageDisplay()
                : (() => {
                    throw new Error(
                      `Unknown performance type: ${set.performance_type}`,
                    );
                  })()
            : renderLogDisplay()}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 5,
            }}
          >
            <Text style={{ ...typography.hint, marginRight: 6 }}>
              Rest Before (s)
            </Text>
            <View style={{ width: 50 }}>
              <NumberField
                numberValue={set.rest_seconds_before}
                placeholder="sec"
                onChangeNumber={(value) =>
                  handleUpdateSetCurried("rest_seconds_before", value)
                }
                numberType="int"
                style={{ fontSize: 13, padding: 4 }}
                editable={isLoading || allowEditing}
              />
            </View>

            <Text style={{ ...typography.hint, marginRight: 6, marginLeft: 6 }}>
              Dur (s)
            </Text>
            <View style={{ width: 50 }}>
              <NumberField
                numberValue={set.duration_seconds}
                placeholder="sec"
                onChangeNumber={(value) =>
                  handleUpdateSetCurried("duration_seconds", value)
                }
                numberType="int"
                style={{ fontSize: 13, padding: 4 }}
                editable={isLoading || allowEditing}
              />
            </View>
          </View>
        </View>
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
              weightUnit: weightUnit,
              distanceUnit: distanceUnit,
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
          <Text style={typography.section}>Exercises</Text>
          {allowEditing && (
            <View style={{ marginLeft: "auto", alignItems: "center" }}>
              <Button
                title="+"
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
            No exercises added yet. Tap &quot;+&quot; to build this workout.
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
                  marginBottom: 16,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <Text style={{ ...typography.subsection, marginRight: 10 }}>
                    {exerciseIdx + 1}
                    {")"}
                  </Text>
                  <Text style={typography.subsection}>{ex.exercise.name}</Text>
                  <Text
                    style={[typography.body, { marginLeft: 8, marginRight: 8 }]}
                  >
                    - {setsForExercise.length} set
                    {setsForExercise.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 4,
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
                  />
                  {ex.superset_group !== null && (
                    <View style={{ width: 40 }}>
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
                          flex: 1,
                          borderBottomWidth: 1,
                          borderColor: colors.border,
                          marginLeft: 6,
                          padding: 4,
                        }}
                        editable={isLoading || allowEditing}
                      />
                    </View>
                  )}
                  <Button
                    title={"Add Set"}
                    onPress={() => handleAddSet(exerciseIdx)}
                    style={{ marginLeft: "auto", padding: 4 }}
                    textProps={{
                      style: {
                        ...typography.hint,
                        color: colors.textOnPrimary,
                      },
                    }}
                  />
                  {exerciseIdx !== 0 && (
                    <Button
                      title="&uarr;"
                      onPress={() =>
                        handleSwapExercisePositions(
                          exerciseIdx - 1,
                          exerciseIdx,
                        )
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
                        handleSwapExercisePositions(
                          exerciseIdx,
                          exerciseIdx + 1,
                        )
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
    if (workout.name.length === 0) {
      showAlert("Please add a workout name");
      return;
    }
    try {
      const payload: FullDetachedWorkoutForMode<M> = {
        workout,
        exercises,
        sets,
      };
      let success: boolean = false;
      if (isFullTemplateWorkout(payload)) {
        success = await upsertTemplateWorkout(payload, updateWorkoutId);
      } else if (isFullLogWorkout(payload)) {
        const user = await requireGetUser();
        if (!user) return;
        const workout = { ...payload.workout, user_id: user.user_id };
        const [wasSuccess, newId] = await upsertWorkoutLog({
          payload: {
            workout,
            exercises: payload.exercises,
            sets: payload.sets,
          },
          workoutLogId: updateWorkoutId,
        });
        if (wasSuccess) {
          if (newId === null) {
            throw new Error("Had successful upsert but new id was null");
          }
          onSuccessfulSave({ workout, exercises, sets }, newId);
        }
        success = wasSuccess;
      } else {
        throw new Error(`Unknown full workout mode: ${payload}`);
      }

      if (success) {
        showAlert("Successfully saved workout!");
        initialWorkoutRef.current = workout;
        initialExercisesRef.current = exercises;
        initialSetsRef.current = sets;
        if (requestCloseOnSuccessfulSave) {
          requestClose();
        }
      }
    } catch (e: any) {
      console.log(e);
      const message =
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
            ? String(e.message)
            : String(e);
      showAlert("Error saving", message);
    } finally {
      setIsLoading(false);
    }
  };

  {
    /* Picker for adding new exercses */
  }
  if (openExercisePicker)
    return (
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
    );

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

      {isLogWorkout(workout) && (
        <CalendarModal
          visible={openDatePicker}
          onRequestClose={() => setOpenDatePicker(false)}
          selectedDate={workout.completed_on}
          onSelectDate={(date) =>
            setWorkout((prev) => {
              return { ...prev, completed_on: date };
            })
          }
        />
      )}

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 8,
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            title={`${updateWorkoutId !== null ? "Update" : "Create"} ${isTemplateWorkout(workout) ? "Template" : "Log"}`}
            onPress={handleSave}
            disabled={!isSavable || isLoading || !allowEditing}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Exit" onPress={requestClose} variant="secondary" />
        </View>
      </View>
    </Screen>
  );
}
