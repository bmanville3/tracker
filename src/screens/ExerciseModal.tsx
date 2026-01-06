import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import {
  addExercise,
  addExerciseMuscleVolume,
  deleteExercise,
  fetchAllExerciseMuscleVolumes,
  fetchExerciseMuscleVolumes,
  searchExercises,
  updateExercise,
  updateExerciseMuscleVolume,
} from "@/src/api/exerciseApi";
import { fetchMuscleGroups } from "@/src/api/muscleApi";
import { Button, ClosableModal, ModalPicker, Selection, TextField } from "@/src/components";
import { colors, spacing, typography } from "@/src/theme";
import {
  EXERCISE_AND_MUSCLE_TAGS,
  ExerciseAndMuscleTag,
  ExerciseMuscleRow,
  ExerciseRow,
  MUSCLE_GROUPS,
  MuscleGroup,
  MuscleGroupRow,
} from "@/src/types";
import {
  anyErrorToString,
  capitalizeFirstLetter,
  requireGetUser,
  setsEqual,
  showAlert,
} from "@/src/utils";

type ExerciseModalProps = {
  visible: boolean;

  /** Called when a user tries to close the modal. */
  onRequestClose: (exercise: ExerciseRow | null) => void;

  allowDeleteExercises?: boolean;
  allowEditExercises?: boolean;
  allowCreateExercises?: boolean;
  allowSelectExercises?: boolean;
  /** If true, automatically close the modal after selecting an exercise */
  autoCloseOnSelect?: boolean;
};

type VolumeEntry = {
  row: ExerciseMuscleRow | null;
  value: number;
};
type VolumeByMuscle = Record<MuscleGroup, VolumeEntry>;

function volumeEntryEqual(a: VolumeEntry, b: VolumeEntry): boolean {
  if (a === b) return true;

  if (a.row === null && b.row !== null) return false;
  if (a.row !== null && b.row === null) return false;
  if (a.row !== null && b.row !== null && a.row.id !== b.row.id) return false;

  if (a.value !== b.value) return false;

  return true;
}

function volumeByMuscleEqual(
  v1: VolumeByMuscle | null,
  v2: VolumeByMuscle | null,
): boolean {
  if (v1 === v2) return true;
  if (v1 === null || v2 === null) return false;

  for (const mg of MUSCLE_GROUPS) {
    if (!volumeEntryEqual(v1[mg], v2[mg])) {
      return false;
    }
  }

  return true;
}

export function ExerciseModal(props: ExerciseModalProps) {
  const {
    visible,
    onRequestClose,
    autoCloseOnSelect = false,
    allowDeleteExercises = false,
    allowEditExercises = false,
    allowCreateExercises = false,
    allowSelectExercises = false,
  } = props;

  const [selection, setSelection] = useState<ExerciseRow | null>(null);

  const [mode, setMode] = useState<"Search" | "Create" | "Edit">("Search");

  const [muscleGroups, setMuscleGroups] = useState<Map<MuscleGroup, MuscleGroupRow>>(new Map());
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOnlyUserCreated, setSearchOnlyUserCreated] = useState<boolean>(false);

  const [selectedTags, setSelectedTags] = useState<Set<ExerciseAndMuscleTag>>(
    new Set(),
  );

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editting, setEditting] = useState(false);

  const initialEditValuesRef = useRef({
    tags: new Set<ExerciseAndMuscleTag>(),
    name: "",
    description: "",
  });

  const [loadingVolumes, setLoadingVolumes] = useState(false);
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const [selectedExerciseForVolume, setSelectedExerciseForVolume] =
    useState<ExerciseRow | null>(null);
  const [
    selectedExerciseForVolumeMuscleToVolume,
    setSelectedExerciseForVolumeMuscleToVolume,
  ] = useState<VolumeByMuscle | null>(null);

  const initialVolumeValuesRef = useRef<VolumeByMuscle | null>(null);

  const [exerciseToDelete, setExerciseToDelete] = useState<ExerciseRow | null>(
    null,
  );

  const performSearch = async (q: string, tags: Set<ExerciseAndMuscleTag>, byUser: boolean) => {
    const trimmed = q.trim();
    if (!trimmed && tags.size === 0 && byUser === false) {
      await loadDefaultSearch();
      return;
    }

    setLoadingExercises(true);
    setExerciseError(null);
    try {
      const xs = await searchExercises(trimmed, tags);
      xs.sort((a, b) => a.name.localeCompare(b.name));
      if (byUser) {
        setExercises(xs.filter(ex => ex.created_by_user !== null));
      } else {
        setExercises(xs);
      }
    } catch (e: any) {
      setExerciseError(anyErrorToString(e, "Failed to search exercises"));
    } finally {
      setLoadingExercises(false);
    }
  };

  const loadDefaultSearch = async () => {
    setLoadingExercises(true);
    setExerciseError(null);
    try {
      let xs: ExerciseRow[] = [];
      [...(await searchExercises("Squat")).values()]
        .slice(0, 3)
        .forEach((er) => xs.push(er));
      [...(await searchExercises("Bench")).values()]
        .slice(0, 3)
        .forEach((er) => xs.push(er));
      [...(await searchExercises("Deadlift")).values()]
        .slice(0, 3)
        .forEach((er) => xs.push(er));
      xs = [...new Map(xs.map((er) => [er.id, er])).values()];
      xs.sort((a, b) => a.name.localeCompare(b.name));
      if (searchOnlyUserCreated) {
        xs = xs.filter(x => x.created_by_user !== null)
      }
      setExercises(xs.slice(0, Math.min(xs.length, 10)));
    } catch (e: any) {
      setExerciseError(anyErrorToString(e, "Failed to search exercises"));
    } finally {
      setLoadingExercises(false);
    }
  };

  const loadMuscleGroups = async () => {
    return setMuscleGroups(await fetchMuscleGroups());
  };

  const resetAll = () => {
    setExercises([]);
    setSelectedExerciseForVolume(null);
    setSearchQuery("");
    setNewName("");
    setNewDescription("");
    setSelectedExerciseForVolumeMuscleToVolume(null);
    setVolumeError(null);
    setSelection(null);
    setSearchOnlyUserCreated(false);
    setMode("Search");
    initialVolumeValuesRef.current = null;
    initialEditValuesRef.current = {
      tags: new Set<ExerciseAndMuscleTag>(),
      name: "",
      description: "",
    };
    setExerciseToDelete(null);
    setSelectedTags(new Set());
    loadDefaultSearch();
    loadMuscleGroups();
    // kick this off in the background
    // user will most likely be requesting this shortly anyways
    void fetchAllExerciseMuscleVolumes();
  };

  useEffect(() => {
    if (!visible) return;

    resetAll();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    void performSearch(searchQuery, selectedTags, searchOnlyUserCreated);
  }, [searchQuery, selectedTags, visible, searchOnlyUserCreated]);

  const handleSelectExercise = (ex: ExerciseRow | null) => {
    if (!allowSelectExercises) return;
    setSelection(ex);
    if (autoCloseOnSelect) {
      onRequestClose(selection);
    }
  };

  const handleDeleteExercise = async (ex: ExerciseRow) => {
    if (!allowDeleteExercises) {
      showAlert(
        "Deleting exercises is not allowed right now",
        "Try going to the exercise creation screen for full access",
      );
      return;
    }
    if (ex.created_by_user === null) {
      showAlert("Cannot delete exercise. Owned by system");
      return;
    }

    try {
      await deleteExercise(ex.id);
      setExercises((prev) => prev.filter((x) => x.id !== ex.id));

      if (selectedExerciseForVolume?.id === ex.id) {
        setMode("Search");
        setSelectedExerciseForVolume(null);
        setSelectedExerciseForVolumeMuscleToVolume(null);
      }
      resetAll();
      showAlert(`${ex.name} has been deleted`);
    } catch (e: any) {
      const msg = anyErrorToString(e, "Error deleting exercise");
      if (msg.includes("delete on table")) {
        if (msg.includes("workout_exercise_log")) {
          setExerciseError("Cannot delete exercise as a workout log references it");
        } else if (msg.includes("workout_exercise_template")) {
          setExerciseError("Cannot delete exercise as a workout template references it");
        } else {
          setExerciseError("Cannot delete exercise as something references it that restricts deletion");
        }
      } else {
        setExerciseError(msg);
      }
    }
  };

  const handleCreateExercise = async () => {
    if (!allowCreateExercises) {
      showAlert(
        "Creating exercises is not allowed right now",
        "Try going to the exercise creation screen for full access",
      );
      return;
    }
    const name = newName.trim();
    if (!name) {
      showAlert("Please enter a name for the exercise.");
      return;
    }
    const other = await searchExercises(name);
    if (other.some((o) => o.name === name)) {
      showAlert(`Exercise '${name}' already exists`);
      return;
    }

    setEditting(true);
    try {
      const user = await requireGetUser();
      await addExercise({
        name,
        description: newDescription.trim(),
        created_by_user: user?.user_id ?? null,
        tags: [...selectedTags],
      });
      showAlert(`'${name}' added sucessfully!`);
      resetAll();
    } catch (e: any) {
      showAlert("Error creating exercise", e?.message ?? String(e));
    } finally {
      setEditting(false);
    }
    void performSearch(searchQuery, selectedTags, searchOnlyUserCreated);
  };

  const handleEditExercise = async () => {
    if (!allowEditExercises) {
      showAlert(
        "Editing exercises is not allowed right now",
        "Try going to the exercise creation screen for full access",
      );
      return;
    }
    const name = newName.trim();
    if (!name) {
      showAlert("Please enter a name for the exercise.");
      return;
    }

    const other = await searchExercises(name);
    if (other.some((o) => o.name === name)) {
      showAlert(`Exercise '${name}' already exists`);
      return;
    }

    if (selection === null) {
      showAlert("No exercise selected to edit");
      resetAll();
      return;
    } else if (selection.created_by_user === null) {
      showAlert("Tried to edit system level exercise. Not possible");
      resetAll();
      return;
    }

    setEditting(true);
    try {
      const user = await requireGetUser();
      await updateExercise({
        id: selection.id,
        patch: {
          name,
          description: newDescription.trim(),
          tags: [...selectedTags],
        },
      });
      resetAll();
      showAlert("Edit successful!");
    } catch (e: any) {
      showAlert("Error creating exercise", e?.message ?? String(e));
    } finally {
      setEditting(false);
    }
    void performSearch(searchQuery, selectedTags, searchOnlyUserCreated);
  };

  const loadVolumesForExercise = async (exercise: ExerciseRow) => {
    setLoadingVolumes(true);
    setVolumeError(null);
    try {
      const user = await requireGetUser();
      if (!user) return;

      const map = await fetchExerciseMuscleVolumes(exercise.id, user.user_id);

      const records: VolumeByMuscle = MUSCLE_GROUPS.reduce((acc, mg) => {
        acc[mg] = {
          row: null,
          value: 0,
        };
        return acc;
      }, {} as VolumeByMuscle);

      for (const row of map.values()) {
        const mg = row.muscle_id;
        records[mg] = {
          row,
          value: row.volume_factor,
        };
      }

      setSelectedExerciseForVolumeMuscleToVolume(records);
      initialVolumeValuesRef.current = records;
    } catch (e: any) {
      setSelectedExerciseForVolumeMuscleToVolume(null);
      setVolumeError(e?.message ?? "Failed to load muscle volumes");
    } finally {
      setLoadingVolumes(false);
    }
  };

  const handleSelectForVolumes = (ex: ExerciseRow | null) => {
    setSelectedExerciseForVolumeMuscleToVolume(null);
    setSelectedExerciseForVolume(ex);
    setVolumeError(null);
    if (ex !== null) {
      void loadVolumesForExercise(ex);
    }
  };

  const updateVolumeField = (
    muscleId: MuscleGroup,
    value: number,
  ) => {
    if (!allowEditExercises) return;
    setSelectedExerciseForVolumeMuscleToVolume((prev) => {
      const current =
        prev ??
        MUSCLE_GROUPS.reduce((acc, mg) => {
          acc[mg] = { row: null, value: 0 };
          return acc;
        }, {} as VolumeByMuscle);

      return {
        ...current,
        [muscleId]: {
          ...current[muscleId],
          value,
        },
      };
    });
  };

  const handleSaveVolumes = async () => {
    if (!allowEditExercises) return;
    if (!selectedExerciseForVolume) return;
    if (!selectedExerciseForVolumeMuscleToVolume) return;
    setLoadingVolumes(true);
    setVolumeError(null);
    try {
      const user = await requireGetUser();
      if (!user) {
        throw new Error("User is null");
      }

      if (
        Object.values(selectedExerciseForVolumeMuscleToVolume).some(
          (volumeRow) => {
            if (volumeRow.value < 0 || volumeRow.value > 1) {
              showAlert(
                `Volume must be between 0 and 1. Got ${volumeRow.value}`,
              );
              return true;
            }
            return false;
          },
        )
      ) {
        return;
      }

      for (const [muscleId, volumeRow] of Object.entries(
        selectedExerciseForVolumeMuscleToVolume,
      )) {
        if (volumeRow.value < 0 || volumeRow.value > 1) {
          showAlert(`Volume must be between 0 and 1. Got ${volumeRow.value}`);
          return;
        }
        if (volumeRow.row !== null) {
          await updateExerciseMuscleVolume({
            id: volumeRow.row.id,
            patch: { volume_factor: volumeRow.value },
          });
        } else {
          await addExerciseMuscleVolume({
            muscle_id: muscleId as MuscleGroup,
            exercise_id: selectedExerciseForVolume.id,
            volume_factor: volumeRow.value,
            user_id: user.user_id,
          });
        }
      }

      showAlert("Saved muscle volumes.");
      void loadVolumesForExercise(selectedExerciseForVolume);
    } catch (e: any) {
      setVolumeError(e?.message ?? "Failed to save volumes");
    } finally {
      setLoadingVolumes(false);
    }
  };

  const renderDeleteExerciseButton = (item: ExerciseRow) => {
    if (item.created_by_user === null || !allowDeleteExercises) {
      return null;
    }
    if (exerciseToDelete !== null && exerciseToDelete.id !== item.id) {
      return null;
    }
    if (exerciseToDelete === null) {
      return (
        <View>
          <Pressable
            onPress={() => setExerciseToDelete(item)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 12, color: "crimson" }}>Delete</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={() => setExerciseToDelete(null)}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.textPrimary }}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleDeleteExercise(item)}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontSize: 12, color: "crimson" }}>Confirm</Text>
        </Pressable>
      </View>
    );
  };

  const renderExerciseItem = (item: ExerciseRow) => {
    const isSelected = selectedExerciseForVolume?.id === item.id;
    const isNotTheSelection = selection === null || selection.id !== item.id;
    return (
      <View
        key={item.id}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 8,
          borderBottomWidth: 0.5,
          borderColor: colors.border,
          borderRadius: 6,
          backgroundColor:
            selection?.id === item.id ? colors.fadedPrimary : undefined,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: -1,
          }}
        >
          <Text style={{ ...typography.body, flexShrink: 1 }}>{item.name}</Text>
          {item.created_by_user !== null && allowEditExercises && (
            <Pressable
              onPress={() => {
                setSelection(item);
                setNewName(item.name);
                setNewDescription(item.description);
                const tags = new Set(item.tags);
                setSelectedTags(tags);
                initialEditValuesRef.current.tags = tags;
                initialEditValuesRef.current.description = item.description;
                initialEditValuesRef.current.name = item.name;
                setMode("Edit");
              }}
              style={{
                marginLeft: "auto",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
              }}
            >
              <Text style={{ fontSize: 12 }}>Edit</Text>
            </Pressable>
          )}
          {allowSelectExercises && (
            <Pressable
              onPress={() => {
                if (selection !== null && selection.id === item.id) {
                  handleSelectExercise(null);
                } else {
                  handleSelectExercise(item);
                }
              }}
              style={{
                marginLeft:
                  item.created_by_user === null || !allowEditExercises
                    ? "auto"
                    : 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: isNotTheSelection
                  ? undefined
                  : colors.fadedPrimaryOffset,
              }}
            >
              <Text style={{ fontSize: 12 }}>Select</Text>
            </Pressable>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 2,
            marginTop: spacing.xs,
          }}
        >
          {item.tags.map((tag) => (
            <View
              key={`${item.id}-${tag}`}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceAlt,
                marginTop: 0,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: colors.textSecondary,
                }}
              >
                {capitalizeFirstLetter(tag)}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={{
            flexDirection: "row",
            marginTop: spacing.sm,
            gap: spacing.xs,
          }}
        >
          <Selection
            title={"Volumes"}
            isSelected={isSelected}
            onPress={() => {
              if (selectedExerciseForVolume?.id == item.id) {
                handleSelectForVolumes(null);
              } else {
                handleSelectForVolumes(item);
              }
            }}
            style={{
              borderColor: isSelected
                ? colors.selection
                : isNotTheSelection
                  ? colors.border
                  : colors.borderFadedPrimary,
            }}
          />

          {renderDeleteExerciseButton(item)}
        </View>
        {/* Volume editor */}
        {selectedExerciseForVolume !== null &&
          selectedExerciseForVolume.id === item.id &&
          renderVolumeEditor()}
      </View>
    );
  };

  const renderVolumeEditor = () => {
    if (!selectedExerciseForVolume) {
      return (
        <Text style={{ ...typography.body, opacity: 0.6 }}>
          Select an exercise to configure muscle volumes.
        </Text>
      );
    }

    return (
      <View
        style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#e5e7eb",
        }}
      >
        <Text style={{ ...typography.subsection, marginBottom: 8 }}>
          Muscle Volumes for {selectedExerciseForVolume.name}
        </Text>
        {!allowEditExercises && (
          <Text style={{ ...typography.hint, marginBottom: 8 }}>
            Editing is turned off
          </Text>
        )}

        {loadingVolumes ? (
          <View style={{ marginTop: 8 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            {volumeError ? (
              <Text style={{ color: "crimson", marginTop: 6 }}>
                {volumeError}
              </Text>
            ) : null}

            <View style={{ marginTop: 8 }}>
              {selectedExerciseForVolumeMuscleToVolume &&
                MUSCLE_GROUPS.map((name) => {
                  const entry = selectedExerciseForVolumeMuscleToVolume[name];
                  if (!allowEditExercises && entry.value === 0) {
                    return null;
                  }
                  const muscleGroup: MuscleGroupRow | undefined = muscleGroups.get(name);
                  return (
                    <View key={name}>
                      {/* Add a line between each item*/}
                      <View
                        style={{
                          height: 1,
                          backgroundColor: colors.border,
                          marginVertical: 4,
                        }}
                      />

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                          }}
                        >
                          {muscleGroup?.display_name ?? name}
                        </Text>

                        {/* Add/subtract button at end */}
                        <ModalPicker
                          title={`Choose exercise volume for ${muscleGroup?.display_name ?? name}`}
                          options={[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(n => {return {label: n !== null ? n.toFixed(1): '0.0', value: n}})}
                          value={entry.value}
                          onChange={(value) => updateVolumeField(name, value)}
                          pressableProps={{ style: {alignSelf: 'flex-end'}, disabled: !allowEditExercises }}
                        />
                      </View>
                    </View>
                  );
                })}
            </View>

            {allowEditExercises && (
              <Button
                title="Save volumes"
                onPress={handleSaveVolumes}
                disabled={
                  loadingVolumes ||
                  !allowEditExercises ||
                  volumeByMuscleEqual(
                    initialVolumeValuesRef.current,
                    selectedExerciseForVolumeMuscleToVolume,
                  )
                }
              />
            )}
            <Button
              title="Exit volumes"
              onPress={() => handleSelectForVolumes(null)}
              variant="secondary"
            />
          </>
        )}
      </View>
    );
  };

  const renderSelectTags = () => {
    return (
      <View
        style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}
      >
        {EXERCISE_AND_MUSCLE_TAGS.map((tag, idx) => {
          let onPress;
          let borderColor;
          let backgroundColor;
          if (!selectedTags.has(tag)) {
            onPress = () => setSelectedTags(new Set([...selectedTags, tag]));
            borderColor = colors.border;
            backgroundColor = colors.surfaceAlt;
          } else {
            onPress = () =>
              setSelectedTags(
                new Set([...selectedTags].filter((t) => t !== tag)),
              );
            borderColor = colors.borderFadedPrimary;
            backgroundColor = colors.fadedPrimary;
          }
          return (
            <View
              key={tag}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                marginRight: 4,
              }}
            >
              <Pressable onPress={onPress}>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                  }}
                >
                  {capitalizeFirstLetter(tag)}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  const renderSearchMode = () => {
    return (
      <View>
        {/* Search */}
        <Text style={[typography.label, { marginTop: 8 }]}>Search</Text>
        <TextField
          placeholder="Search exercises..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Text style={[typography.hint, { marginTop: 8, marginBottom: 8 }]}>
          Filter by tags (must match all):
        </Text>
        {renderSelectTags()}
        <Selection
          title="Created By You"
          onPress={() => setSearchOnlyUserCreated(!searchOnlyUserCreated)}
          isSelected={searchOnlyUserCreated}
          style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
        />
        <View
          style={{
            height: 2,
            backgroundColor: colors.border,
            marginTop: 8,
          }}
        />

        {/* Exercise list */}
        <View style={{ marginTop: 8, flex: 1 }}>
          {exerciseError ? (
            <Text style={{ color: "crimson" }}>{exerciseError}</Text>
          ) : null}
          {loadingExercises ? (
            <View style={{ marginTop: 8 }}>
              <ActivityIndicator />
            </View>
          ) : exercises.length > 0 ? (
            exercises.map((ex) => renderExerciseItem(ex))
          ) : (
            <Text style={{ marginTop: 8, opacity: 0.6 }}>
              {searchQuery === "" && selectedTags.size === 0
                ? "Search an exercise or select a tag to begin"
                : "No exercises found. Try a different search or create a new exercise below"}
            </Text>
          )}
        </View>
        {!autoCloseOnSelect && allowSelectExercises && (
          <Button
            title={"Save Selection"}
            disabled={selection === null}
            onPress={() => onRequestClose(selection)}
          />
        )}
        {allowCreateExercises && (
          <Button
            title={"Create New Exercise"}
            onPress={() => {
              setMode("Create");
              if (searchQuery) {
                setNewName(searchQuery);
              }
            }}
            variant={allowSelectExercises ? "secondary" : "primary"}
          />
        )}
      </View>
    );
  };

  const renderCreateMode = () => {
    if (!allowCreateExercises) {
      resetAll();
      return;
    }
    return (
      <View style={{ marginTop: 12 }}>
        <Text style={typography.label}>Name</Text>
        <TextField
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Barbell Bench Press"
        />
        <Text style={typography.label}>Description</Text>
        <TextField
          value={newDescription}
          onChangeText={setNewDescription}
          multiline
          style={{ minHeight: 60, textAlignVertical: "top" }}
          placeholder="Optional description"
        />
        <Text style={typography.label}>Add tags</Text>
        {renderSelectTags()}
        <Button
          title={editting ? "Creating..." : "Create exercise"}
          onPress={handleCreateExercise}
          disabled={editting || newName.trim().length === 0}
          style={{ marginTop: 16 }}
        />
        <Button
          title={editting ? "Creating..." : "Back"}
          onPress={resetAll}
          disabled={editting}
          variant="secondary"
        />
      </View>
    );
  };

  const renderEditMode = () => {
    if (!allowEditExercises) {
      resetAll();
      return;
    }
    return (
      <View style={{ marginTop: 12 }}>
        <Text style={typography.label}>Name</Text>
        <TextField
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Barbell Bench Press"
        />
        <Text style={typography.label}>Description</Text>
        <TextField
          value={newDescription}
          onChangeText={setNewDescription}
          multiline
          style={{ minHeight: 60, textAlignVertical: "top" }}
          placeholder="Optional description"
        />
        <Text style={typography.label}>Add tags</Text>
        {renderSelectTags()}
        <Button
          title={editting ? "Editing..." : "Edit exercise"}
          onPress={handleEditExercise}
          disabled={
            editting ||
            (setsEqual(initialEditValuesRef.current.tags, selectedTags) &&
              initialEditValuesRef.current.description === newDescription &&
              initialEditValuesRef.current.name === newName.trim()) ||
            newName.trim().length === 0
          }
        />
        <Button
          title={editting ? "Editing..." : "Back"}
          onPress={resetAll}
          disabled={editting}
          variant="secondary"
        />
      </View>
    );
  };

  return (
    <ClosableModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onRequestClose(null)}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={typography.section}>{mode} Exercise</Text>
        {/* "x" button here */}
        <Pressable
          onPress={() => onRequestClose(null)}
          style={{ marginLeft: "auto", padding: 4 }}
        >
          <Text style={{ fontSize: 18 }}>&#x2715;</Text>
        </Pressable>
      </View>

      {/* Search */}
      {mode === "Search" && renderSearchMode()}

      {/* New exercise form */}
      {mode === "Create" && renderCreateMode()}

      {/* Edit existing exercise */}
      {mode === "Edit" && renderEditMode()}
    </ClosableModal>
  );
}
