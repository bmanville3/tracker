import {
  EMPTY_SET,
  EMPTY_WORKOUT,
  Exercise,
  exercisesEqual,
  FullDetachedWorkout,
  Set,
  setsMatrixEqual,
  Workout,
  workoutEqual,
} from "@/src/api/workoutApi";
import {
  Button,
  NumberField,
  Screen,
  Selection,
  TextField,
} from "@/src/components/";
import { colors, typography } from "@/src/theme";
import {
  DISTANCE_UNITS,
  DistanceUnit,
  ExerciseRow,
  PERFORMANCE_TYPES,
  ProgramRow,
  SET_TYPES,
  WEIGHT_UNITS,
  WeightUnit,
} from "@/src/types";
import {
  capitalizeFirstLetter,
  changeWeightUnit,
  requireGetUser,
  showAlert,
} from "@/src/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ExerciseModal } from "../ExerciseModal";

export type WorkoutViewProps = {
  isActive: boolean;
  requestClose: () => void;
  onSave: (workout: FullDetachedWorkout) => Promise<boolean>;
  createAsTemplate: boolean;
  loadWithExisting?: FullDetachedWorkout | null;
  associatedProgram?: {
    program: ProgramRow;
    day_in_week: number | null;
    week_in_block: number | null;
    block_in_program: number | null;
  };
  saveButtonTitle?: string | null;
  allowEditing?: boolean;
};

export function WorkoutView(props: WorkoutViewProps) {
  const {
    isActive,
    requestClose,
    onSave,
    createAsTemplate,
    loadWithExisting = null,
    associatedProgram = null,
    allowEditing = false,
    saveButtonTitle = null,
  } = props;

  const hasAssociatedProgram = associatedProgram !== null;

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [workout, setWorkout] = useState<Workout>(EMPTY_WORKOUT);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("m");

  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [sets, setSets] = useState<Set[][]>([]);

  const [openExercisePicker, setOpenExercisePicker] = useState<boolean>(false);

  const [openExercisePickerForSet, setOpenExercisePickerForSet] =
    useState<boolean>(false);
  const [updateExerciseForSet, setUpdateExerciseForSet] = useState<
    ((exercise: ExerciseRow) => void) | null
  >(null);

  const initialWorkoutRef = useRef<Workout | null>(null);
  const initialExercisesRef = useRef<Exercise[] | null>(null);
  const initialSetsRef = useRef<Set[][] | null>(null);

  const resetAll = async () => {
    setIsLoading(true);
    const profile = await requireGetUser();
    if (!profile) return;
    setWeightUnit(profile.default_weight_unit);
    setDistanceUnit(profile.default_distance_unit);
    setOpenExercisePicker(false);
    setOpenExercisePickerForSet(false);
    setUpdateExerciseForSet(null);
    let initialWorkout = EMPTY_WORKOUT;
    let initialExercises: Exercise[] = [];
    let initialSets: Set[][] = [];

    if (loadWithExisting) {
      initialWorkout = loadWithExisting.workout;
      initialExercises = loadWithExisting.exercises;
      initialSets = loadWithExisting.sets;
    }

    setWorkout(initialWorkout);
    setExercises(initialExercises);
    setSets(initialSets);

    initialWorkoutRef.current = initialWorkout;
    initialExercisesRef.current = initialExercises;
    initialSetsRef.current = initialSets;
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isActive) return;
    resetAll();
  }, [isActive, loadWithExisting]);

  const isSavable = useMemo(() => {
    const wEqual = workoutEqual(initialWorkoutRef.current, workout);
    const eEqual = exercisesEqual(initialExercisesRef.current, exercises);
    const sEqual = setsMatrixEqual(initialSetsRef.current, sets);

    return !(wEqual && eEqual && sEqual);
  }, [workout, exercises, sets]);

  const renderAssociatedProgram = () => {
    if (!hasAssociatedProgram) {
      return null;
    }

    const { program, block_in_program, week_in_block, day_in_week } =
      associatedProgram!;

    return (
      <View style={{ marginTop: 4, marginBottom: 12 }}>
        <Text style={typography.hint}>
          For Program: <Text style={{ fontWeight: "600" }}>{program.name}</Text>
        </Text>
        <Text style={typography.hint}>
          {block_in_program ? `Block ${block_in_program} ` : ""}
          {week_in_block ? `Week ${week_in_block} ` : ""}
          {day_in_week ? `Day ${day_in_week}` : ""}
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

        {/* Meta row: duration + bodyweight + units */}
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

  const handleUpdateExercise = <K extends keyof Exercise>(
    exerciseIndex: number,
    key: K,
    value: Exercise[K],
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

  const handleUpdateSet = <K extends keyof Set>(
    exerciseIndex: number,
    setIndex: number,
    key: K,
    value: Set[K],
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

  const renderSet = (exerciseIndex: number, set: Set, setIndex: number) => {
    function handleUpdateSetCurried<K extends keyof Set>(
      key: K,
      value: Set[K],
    ) {
      handleUpdateSet(exerciseIndex, setIndex, key, value);
    }

    const renderSetHeader = () => {
      return (
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          {SET_TYPES.map((t) => {
            return (
              <Selection
                key={t}
                title={t !== null ? capitalizeFirstLetter(t) : "Normal"}
                isSelected={set.set_type === t}
                onPress={() => handleUpdateSetCurried("set_type", t)}
              />
            );
          })}
          {createAsTemplate && (
            <View style={{ flexDirection: "row" }}>
              <Text style={{ ...typography.body, marginLeft: 10 }}>|</Text>
              {PERFORMANCE_TYPES.map((t) => {
                if (t === null) {
                  return null;
                }
                return (
                  <Selection
                    key={t}
                    title={t === "rpe" ? "RPE" : capitalizeFirstLetter(t)}
                    isSelected={set.performance_type === t}
                    onPress={() =>
                      handleUpdateSetCurried("performance_type", t)
                    }
                    style={{ marginLeft: 12, padding: 3 }}
                  />
                );
              })}
            </View>
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
      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ width: 60, marginRight: 6 }}>
            <NumberField
              numberValue={set.reps}
              placeholder="Reps"
              onChangeNumber={(value) => handleUpdateSetCurried("reps", value)}
              numberType="int"
              editable={isLoading || allowEditing}
              style={{ padding: 4 }}
            />
          </View>
          <Text style={{ ...typography.body, marginRight: 4 }}>Reps @ RPE</Text>
          <View style={{ width: 60, marginLeft: 6, marginRight: 6 }}>
            <NumberField
              numberValue={set.rpe}
              placeholder="RPE"
              onChangeNumber={(value) => handleUpdateSetCurried("rpe", value)}
              numberType="float"
              editable={isLoading || allowEditing}
              style={{ padding: 4 }}
            />
          </View>
        </View>
      );
    };

    const renderTemplateWeightDisplay = () => {
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
                setOpenExercisePickerForSet(true);
                setUpdateExerciseForSet(() => (exerciseRow: ExerciseRow) => {
                  handleUpdateSetCurried(
                    "max_percentage_exercise",
                    exerciseRow,
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
                {set.max_percentage_exercise
                  ? set.max_percentage_exercise.name
                  : exercises[exerciseIndex].exercise.name}
              </Text>
            </Pressable>
          </View>

          <Text style={{ ...typography.body, marginRight: 6, marginLeft: 6 }}>
            &times;
          </Text>
          <View style={{ width: 60, marginRight: 6 }}>
            <NumberField
              numberValue={set.reps}
              placeholder="Reps"
              onChangeNumber={(value) => handleUpdateSetCurried("reps", value)}
              numberType="int"
              editable={isLoading || allowEditing}
              style={{ padding: 4 }}
            />
          </View>
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
          <View style={{ width: 60, marginRight: 6 }}>
            <NumberField
              numberValue={set.reps}
              placeholder="Reps"
              onChangeNumber={(value) => handleUpdateSetCurried("reps", value)}
              numberType="int"
              editable={isLoading || allowEditing}
            />
          </View>
          <Text style={{ ...typography.body, marginRight: 4 }}>Reps @ RPE</Text>
          <View style={{ width: 60, marginLeft: 6 }}>
            <NumberField
              numberValue={set.rpe}
              placeholder="RPE"
              onChangeNumber={(value) => handleUpdateSetCurried("rpe", value)}
              numberType="float"
              editable={isLoading || allowEditing}
            />
          </View>
        </View>
      );
    };

    return (
      <View
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
          {createAsTemplate
            ? set.performance_type === "rpe"
              ? renderTemplateRPEDisplay()
              : set.performance_type === "weight"
                ? renderTemplateWeightDisplay()
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
            ...EMPTY_SET,
            weight_unit: weightUnit,
            distance_unit: distanceUnit,
            performance_type: createAsTemplate ? "weight" : null,
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
                onPress={() => setOpenExercisePicker(true)}
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
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ ...typography.hint, marginRight: 10 }}>
                    Exercise {exerciseIdx + 1}
                    {")"}
                  </Text>
                  <Text style={typography.body}>{ex.exercise.name}</Text>
                  <Text
                    style={[typography.hint, { marginLeft: 8, marginRight: 8 }]}
                  >
                    {setsForExercise.length} set
                    {setsForExercise.length === 1 ? "" : "s"}
                  </Text>
                  <View
                    style={{ marginLeft: "auto", flexDirection: "row", gap: 0 }}
                  >
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
                          setsForExercise.length > 0 ||
                          isLoading ||
                          !allowEditing
                        }
                      />
                    )}
                  </View>
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
                      for (const otherEx of exercises) {
                        if (otherEx.exercise.id === ex.exercise.id) continue;
                        if (otherEx.superset_group !== null) {
                          handleUpdateExercise(
                            exerciseIdx,
                            "superset_group",
                            otherEx.superset_group,
                          );
                          return;
                        }
                      }
                      handleUpdateExercise(
                        exerciseIdx,
                        "superset_group",
                        "Superset 1",
                      );
                    }}
                  />
                  {ex.superset_group !== null && (
                    <View style={{ width: 150 }}>
                      <TextField
                        value={ex.superset_group}
                        onChangeText={(text) => {
                          if (text === "") {
                            handleUpdateExercise(
                              exerciseIdx,
                              "superset_group",
                              null,
                            );
                          } else {
                            handleUpdateExercise(
                              exerciseIdx,
                              "superset_group",
                              text,
                            );
                          }
                        }}
                        placeholder="Superset Group"
                        placeholderTextColor={colors.placeholderTextColor}
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
    try {
      const payload: FullDetachedWorkout = { workout, exercises, sets };
      const success = await onSave(payload);

      if (success) {
        initialWorkoutRef.current = workout;
        initialExercisesRef.current = exercises;
        initialSetsRef.current = sets;
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
          const newExercise: Exercise = {
            exercise,
            superset_group: null,
            notes: "",
          };
          setExercises([...exercises, newExercise]);
          setSets([...sets, []]);
        }}
      />
    );

  if (!isActive) {
    return null;
  }

  {
    /* Picker for setting the max for a given set */
  }
  if (openExercisePickerForSet)
    return (
      <ExerciseModal
        allowSelectExercises={true}
        allowCreateExercises={true}
        visible={openExercisePickerForSet}
        onRequestClose={(exercise: ExerciseRow | null) => {
          setOpenExercisePickerForSet(false);
          if (exercise === null) {
            return;
          }
          if (updateExerciseForSet === null) return;
          updateExerciseForSet(exercise);
          setUpdateExerciseForSet(null);
        }}
      />
    );

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
            title={`${saveButtonTitle ? saveButtonTitle : "Workout"} ${createAsTemplate ? "Template" : "Log"}`}
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
