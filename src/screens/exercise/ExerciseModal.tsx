import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import {
  addExercise,
  deleteExercise,
  searchExercises,
  updateExercise,
} from "@/src/api/exerciseApi";
import { Button, ClosableModal, Selection, TextField } from "@/src/components";
import { colors, spacing, typography } from "@/src/theme";
import {
  EXERCISE_AND_MUSCLE_TAGS,
  ExerciseAndMuscleTag,
  ExerciseRow,
  UUID,
} from "@/src/types";
import {
  anyErrorToString,
  capitalizeFirstLetter,
  requireGetUser,
  setsEqual,
  showAlert,
  stringifyList,
} from "@/src/utils";
import { VolumeRender } from "./VolumeRender";

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

  limitToExercisesIds?: Set<UUID> | null;
};

export function ExerciseModal(props: ExerciseModalProps) {
  const {
    visible,
    onRequestClose,
    autoCloseOnSelect = false,
    allowDeleteExercises = false,
    allowEditExercises = false,
    allowCreateExercises = false,
    allowSelectExercises = false,
    limitToExercisesIds = null,
  } = props;

  const [selection, setSelection] = useState<ExerciseRow | null>(null);

  const [mode, setMode] = useState<"Search" | "Create" | "Edit">("Search");

  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOnlyUserCreated, setSearchOnlyUserCreated] =
    useState<boolean>(false);

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

  const [selectedExerciseForVolume, setSelectedExerciseForVolume] =
    useState<ExerciseRow | null>(null);

  const [exerciseToDelete, setExerciseToDelete] = useState<ExerciseRow | null>(
    null,
  );

  const performSearch = async (
    q: string,
    tags: Set<ExerciseAndMuscleTag>,
    byUser: boolean,
  ) => {
    const trimmed = q.trim();
    if (!trimmed && tags.size === 0 && byUser === false) {
      await loadDefaultSearch();
      return;
    }

    setLoadingExercises(true);
    setExerciseError(null);
    try {
      const xs = await searchExercises(trimmed, tags, limitToExercisesIds);
      xs.sort((a, b) => a.name.localeCompare(b.name));
      if (byUser) {
        setExercises(xs.filter((ex) => ex.created_by_user !== null));
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
      [...(await searchExercises("Squat", null, limitToExercisesIds)).values()]
        .slice(0, 3)
        .forEach((er) => xs.push(er));
      [...(await searchExercises("Bench", null, limitToExercisesIds)).values()]
        .slice(0, 3)
        .forEach((er) => xs.push(er));
      [
        ...(
          await searchExercises("Deadlift", null, limitToExercisesIds)
        ).values(),
      ]
        .slice(0, 3)
        .forEach((er) => xs.push(er));
      xs = [...new Map(xs.map((er) => [er.id, er])).values()];
      xs.sort((a, b) => a.name.localeCompare(b.name));
      if (searchOnlyUserCreated) {
        xs = xs.filter((x) => x.created_by_user !== null);
      }
      setExercises(xs.slice(0, Math.min(xs.length, 10)));
    } catch (e: any) {
      setExerciseError(anyErrorToString(e, "Failed to search exercises"));
    } finally {
      setLoadingExercises(false);
    }
  };

  const resetAll = () => {
    setExercises([]);
    setSelectedExerciseForVolume(null);
    setSearchQuery("");
    setNewName("");
    setNewDescription("");
    setSelection(null);
    setSearchOnlyUserCreated(false);
    setMode("Search");
    initialEditValuesRef.current = {
      tags: new Set<ExerciseAndMuscleTag>(),
      name: "",
      description: "",
    };
    setExerciseToDelete(null);
    setSelectedTags(new Set());
    loadDefaultSearch();
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
      }
      resetAll();
      showAlert(`${ex.name} has been deleted`);
    } catch (e: any) {
      const msg = anyErrorToString(e, "Error deleting exercise");
      if (msg.includes("delete on table")) {
        if (msg.includes("workout_exercise_log")) {
          setExerciseError(
            "Cannot delete exercise as a workout log references it",
          );
        } else if (msg.includes("workout_exercise_template")) {
          setExerciseError(
            "Cannot delete exercise as a workout template references it",
          );
        } else {
          setExerciseError(
            "Cannot delete exercise as something references it that restricts deletion",
          );
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
                setSelectedExerciseForVolume(null);
              } else {
                setSelectedExerciseForVolume(item);
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
    if (selectedExerciseForVolume === null) {
      return (
        <Text style={{ ...typography.body, opacity: 0.6 }}>
          Select an exercise to configure muscle volumes.
        </Text>
      );
    }

    return (
      <VolumeRender
        exercise={selectedExerciseForVolume}
        onRequestClose={() => setSelectedExerciseForVolume(null)}
        allowEditing={true}
      />
    );
  };

  const renderSelectTags = () => {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          rowGap: spacing.xs,
          gap: spacing.xs,
        }}
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
                borderColor,
                backgroundColor,
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
          style={{ alignSelf: "flex-start", marginTop: spacing.xs }}
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
          style={{ marginTop: spacing.md }}
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
          style={{ marginTop: spacing.md }}
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

  const disabledActions = [
    !allowEditExercises && "Editing",
    !allowDeleteExercises && "Deleting",
    !allowCreateExercises && "Creating",
  ].filter(Boolean) as string[];

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
      {disabledActions.length > 0 && (
        <Text style={typography.body}>
          {stringifyList(disabledActions)} exercises{" "}
          {disabledActions.length === 1 ? "is" : "are"} disabled
        </Text>
      )}

      {/* Search */}
      {mode === "Search" && renderSearchMode()}

      {/* New exercise form */}
      {mode === "Create" && renderCreateMode()}

      {/* Edit existing exercise */}
      {mode === "Edit" && renderEditMode()}
    </ClosableModal>
  );
}
