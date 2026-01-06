import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  deleteWorkoutLog,
  fetchLastNWorkoutLogs,
  FullAttachedWorkoutLog,
} from "@/src/api/workoutLogApi";
import { FullDetachedWorkoutForMode } from "@/src/api/workoutSharedApi";
import { Button, ClosableModal, Screen } from "@/src/components";
import { ErrorBanner } from "@/src/components/ErrorBanner";
import { logWorkoutStrategy } from "@/src/screens/workout/LogWorkoutEditorStrategy";
import { WorkoutView } from "@/src/screens/workout/WorkoutView";
import { colors, spacing, typography } from "@/src/theme";
import { UUID } from "@/src/types";
import { anyErrorToString, showAlert } from "@/src/utils";
import { Feather } from "@expo/vector-icons";

export default function WorkoutLogIndex() {
  // WorkoutView modal-ish state
  const [workoutViewIsActive, setWorkoutViewIsActive] =
    useState<boolean>(false);
  const [fromWorkout, setFromWorkout] =
    useState<FullDetachedWorkoutForMode<"log"> | null>(null);
  const [updateId, setUpdateId] = useState<UUID | null>(null);
  const [allowEdit, setAllowEdit] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<FullAttachedWorkoutLog | null>(null);

  const [displayedWorkouts, setDisplayedWorkouts] = useState<
    FullAttachedWorkoutLog[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const reloadWorkouts = async () => {
    const last30 = await fetchLastNWorkoutLogs(30);
    setDisplayedWorkouts(last30);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorText(null);
        setFromWorkout(null);
        setWorkoutViewIsActive(false);
        setUpdateId(null);
        setConfirmDelete(null);
        setAllowEdit(false);

        await reloadWorkouts();
      } catch (e: any) {
        setErrorText(anyErrorToString(e, "Failed to load workouts"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const previewByWorkoutId: Record<UUID, string> = useMemo(() => {
    const previews: Record<UUID, string> = {};
    for (const fw of displayedWorkouts) {
      const names: string[] = [];
      for (const i in fw.exercises) {
        const ex = fw.exercises[i];
        const sets = fw.sets[i];
        names.push(`${ex.exercise.name} \u00D7 ${sets.length} Set${sets.length === 1 ? '' : 's'}`);
        if (names.length >= 2) break;
      }

      if (names.length > 0) {
        let label = names.join(", ");
        if (fw.exercises.length > names.length) {
          label += "...";
        }
        previews[fw.logId] = label;
      } else {
        previews[fw.logId] = "No exercises logged";
      }
    }
    return previews;
  }, [displayedWorkouts]);

  function openCreateWorkout() {
    setFromWorkout(null);
    setUpdateId(null);
    setAllowEdit(true);
    setWorkoutViewIsActive(true);
  }

  function openEditWorkout(fullWorkout: FullAttachedWorkoutLog) {
    setAllowEdit(true);
    setWorkoutViewIsActive(true);
    const { logId, ...rest } = fullWorkout;
    setFromWorkout(rest satisfies FullDetachedWorkoutForMode<"log">);
    setUpdateId(logId satisfies UUID);
  }

  function openViewWorkout(fullWorkout: FullAttachedWorkoutLog) {
    setAllowEdit(false);
    setWorkoutViewIsActive(true);
    const { logId, ...rest } = fullWorkout;
    setFromWorkout(rest satisfies FullDetachedWorkoutForMode<"log">);
  }

  if (workoutViewIsActive) {
    return (
      <WorkoutView
        isActive={workoutViewIsActive}
        onSuccessfulSave={reloadWorkouts}
        requestClose={() => setWorkoutViewIsActive(false)}
        allowEditing={allowEdit}
        loadWithExisting={fromWorkout}
        updateWorkoutId={updateId}
        strategy={logWorkoutStrategy}
        requestCloseOnSuccessfulSave={true}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Render: main log screen
  // ---------------------------------------------------------------------------

  return (
    <Screen center={false}>
      {/* Top header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Workout Log</Text>
          <Text style={styles.headerSubtitle}>
            Review and manage your recent training sessions.
            {"\n"}
            Click on a workout to view it.
          </Text>
        </View>

        <Button
          title={"Log workout"}
          onPress={openCreateWorkout}
          variant='primary'
          style={{marginLeft: "auto", borderRadius: 999, padding: 10}}
          textProps={{ style: { ...typography.hint, color: colors.textOnPrimary } }}
        />
      </View>

      {/* Error banner */}
      {errorText ? (
        <ErrorBanner errorText={errorText}/>
      ) : null}

      {/* Content: loading / list / empty state */}
      <View>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading workouts…</Text>
          </View>
        ) : displayedWorkouts.length > 0 ? (
          displayedWorkouts.map((fw) => {
            const w = fw.workout;

            const preview = previewByWorkoutId[fw.logId] ?? "";

            return (
              <Pressable
                key={fw.logId}
                onPress={() => openViewWorkout(fw)}
                style={styles.workoutCard}
              >
                {/* Header row: date/name + icons */}
                <View style={styles.workoutHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.hint}>
                      {w.completed_on ?? "Uncompleted workout"}
                    </Text>
                    {w.name ? (
                      <Text style={typography.subsection}>{w.name}</Text>
                    ) : (
                      <Text style={typography.subsection}>Untitled Workout</Text>
                    )}
                  </View>

                  <View style={styles.iconRow}>
                    {/* Edit icon */}
                    <Pressable
                      hitSlop={8}
                      onPress={(e) => {
                        e.stopPropagation();
                        openEditWorkout(fw);
                      }}
                    >
                      <Feather name="edit-2" size={22} />
                    </Pressable>

                    {/* Delete icon */}
                    <Pressable
                      hitSlop={8}
                      style={{ marginLeft: 8 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(fw);
                      }}
                    >
                      <Feather name="trash-2" size={22} />
                    </Pressable>
                  </View>
                </View>
                <Text style={typography.hint}>
                  {fw.exercises.length} Exercise{fw.exercises.length === 1 ? '' : 's'}
                </Text>

                {/* Preview of exercises */}
                <Text
                  style={typography.hint}
                >
                  {preview || "No exercises logged"}
                </Text>

                {/* Notes */}
                {w.notes ? (
                  <Text style={styles.workoutNotesText} numberOfLines={2}>
                    Notes: {w.notes}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              You haven't logged any workouts in the last 30 days
            </Text>
            {
              <Pressable
                onPress={openCreateWorkout}
                style={styles.emptyCtaButton}
              >
                <Text style={styles.emptyCtaText}>Log your first workout</Text>
              </Pressable>
            }
          </View>
        )}
      </View>
      <ClosableModal
        visible={confirmDelete !== null}
      >
        <Text style={{...typography.section, marginBottom: 10}}>
          Delete Workout Log: "{confirmDelete?.workout.name}" completed on {confirmDelete?.workout.completed_on}
        </Text>
        <Button
          title={"Cancel Delete"}
          variant="primary"
          onPress={() => setConfirmDelete(null)}
          disabled={loading}
        />
        <Button
          title={"Confirm Delete"}
          variant="revert"
          onPress={() => {
            if (confirmDelete === null) {
              return;
            }
            setLoading(true);
            deleteWorkoutLog(confirmDelete.logId)
              .then(() => {
                setDisplayedWorkouts(displayedWorkouts.filter(f => f.logId !== confirmDelete.logId))
                showAlert("Log successfully deleted");
              })
              .catch((e) => setErrorText(anyErrorToString(e, 'Error deleting workout log')))
              .finally(() => {
                setConfirmDelete(null);
                setLoading(false);
              })
          }}
          disabled={loading}
        />
      </ClosableModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  workoutHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerTitle: {
    ...typography.title,
  },
  headerSubtitle: {
    ...typography.hint,
    marginTop: 2,
    color: colors.textSecondary,
  },
  primaryAction: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  primaryActionText: {
    ...typography.hint,
    color: colors.textOnPrimary,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  workoutCard: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  workoutNotesText: {
    ...typography.hint,
    marginTop: 6,
  },

  emptyState: {
    marginTop: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptyCtaButton: {
    marginTop: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  emptyCtaText: {
    ...typography.hint,
    color: colors.primary,
    fontWeight: "600",
    textAlign: "center",
  },
});
