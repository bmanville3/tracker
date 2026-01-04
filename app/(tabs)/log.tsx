import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  fetchLastNWorkoutLogs,
  FullAttachedWorkoutLog,
} from "@/src/api/workoutLogApi";
import { FullDetachedWorkoutForMode } from "@/src/api/workoutSharedApi";
import { Screen } from "@/src/components";
import { logWorkoutStrategy } from "@/src/screens/workout/LogWorkoutEditorStrategy";
import { WorkoutView } from "@/src/screens/workout/WorkoutView";
import { colors, spacing, typography } from "@/src/theme";
import { UUID } from "@/src/types";

export default function WorkoutLogIndex() {
  // WorkoutView modal-ish state
  const [workoutViewIsActive, setWorkoutViewIsActive] =
    useState<boolean>(false);
  const [fromWorkout, setFromWorkout] =
    useState<FullDetachedWorkoutForMode<"log"> | null>(null);
  const [updateId, setUpdateId] = useState<UUID | null>(null);

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

        await reloadWorkouts();
      } catch (e: any) {
        setErrorText(e?.message ?? "Failed to load workouts");
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
        names.push(`${sets.length} Sets - ${ex.exercise.name}`);
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
    setWorkoutViewIsActive(true);
  }

  function openEditWorkout(fullWorkout: FullAttachedWorkoutLog) {
    setWorkoutViewIsActive(true);
    const { logId, ...rest } = fullWorkout;
    setFromWorkout(rest satisfies FullDetachedWorkoutForMode<"log">);
    setUpdateId(logId satisfies UUID);
  }

  if (workoutViewIsActive) {
    return (
      <WorkoutView
        isActive={workoutViewIsActive}
        onSuccessfulSave={reloadWorkouts}
        requestClose={() => setWorkoutViewIsActive(false)}
        allowEditing={true}
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
          </Text>
        </View>

        <Pressable style={styles.primaryAction} onPress={openCreateWorkout}>
          <Text style={styles.primaryActionText}>Log workout</Text>
        </Pressable>
      </View>

      {/* Error banner */}
      {errorText ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      {/* Content: loading / list / empty state */}
      <View style={styles.listContainer}>
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
                key={`${fw.logId}`}
                onPress={() => openEditWorkout(fw)}
                style={styles.workoutCard}
              >
                {/* Date / Name */}
                <Text style={styles.workoutDateText}>
                  {w.completed_on ?? "Uncompleted workout"}
                </Text>
                {w.name ? (
                  <Text style={styles.workoutNameText}>{w.name}</Text>
                ) : null}

                {/* Preview of exercises */}
                <Text
                  style={[
                    styles.workoutPreviewText,
                    { opacity: preview ? 1 : 0.6 },
                  ]}
                >
                  {preview || "No exercises logged"}
                </Text>

                {/* Notes */}
                {w.notes ? (
                  <Text style={styles.workoutNotesText} numberOfLines={2}>
                    {w.notes}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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

  calendarCard: {
    borderRadius: 16,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  calendarSubtitle: {
    ...typography.hint,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },

  errorBanner: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: "#330000",
    borderWidth: 1,
    borderColor: "crimson",
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.hint,
    color: "crimson",
  },

  listContainer: {
    flex: 1,
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
  workoutDateText: {
    ...typography.hint,
    color: colors.textSecondary,
  },
  workoutNameText: {
    ...typography.body,
    fontWeight: "700",
    marginTop: 2,
  },
  workoutPreviewText: {
    ...typography.body,
    marginTop: 6,
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
