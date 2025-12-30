import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchExercises } from "@/src/api/exerciseApi";
import {
  fetchCompletedLast30Workouts,
  FullDetachedWorkout,
  fullToDetached,
  insertFullDetachedWorkout,
  updateFullDetachedWorkout,
  type FullWorkout,
} from "@/src/api/workoutApi";
import { Screen } from "@/src/components";
import { WorkoutView } from "@/src/components/WorkoutView";
import { ExerciseRow, type UUID } from "@/src/interfaces";
import { colors, spacing, typography } from "@/src/theme";
import { toISODate } from "@/src/utils";

export default function WorkoutLogIndex() {
  // WorkoutView modal-ish state
  const [workoutViewTitle, setWorkoutViewTitle] = useState<string | null>(null);
  const [saveFunctionForWorkoutView, setSaveFunctionForWorkoutView] = useState<
    ((w: FullDetachedWorkout) => Promise<boolean>) | null
  >(null);
  const [workoutViewIsActive, setWorkoutViewIsActive] =
    useState<boolean>(false);
  const [fromWorkout, setFromWorkout] = useState<FullDetachedWorkout | null>(
    null,
  );

  const [displayedWorkouts, setDisplayedWorkouts] = useState<FullWorkout[]>([]);
  const [exercises, setExercises] = useState<Map<UUID, ExerciseRow>>(new Map());

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const reloadWorkouts = async () => {
    const last30 = await fetchCompletedLast30Workouts();
    setExercises(await fetchExercises());
    setDisplayedWorkouts(last30);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrorText(null);
        setFromWorkout(null);
        setWorkoutViewIsActive(false);
        setWorkoutViewTitle(null);
        setSaveFunctionForWorkoutView(null);

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
      for (const ex of fw.exercises) {
        const name = ex.exercise_id;
        if (name && !names.includes(name)) {
          names.push(name);
        }
        if (names.length >= 2) break;
      }

      if (names.length > 0) {
        let label = names.join(", ");
        if (fw.exercises.length > names.length) {
          label += "…";
        }
        previews[fw.id] = label;
      } else {
        previews[fw.id] = "No exercises logged";
      }
    }
    return previews;
  }, [displayedWorkouts]);

  function openCreateWorkout() {
    setWorkoutViewTitle("Create");
    setWorkoutViewIsActive(true);
    setFromWorkout(null);

    setSaveFunctionForWorkoutView(() => async (wk: FullDetachedWorkout) => {
      await insertFullDetachedWorkout(wk, "completed", toISODate(new Date()));
      setWorkoutViewIsActive(false);
      return true;
    });
  }

  function openEditWorkout(fullWorkout: FullWorkout) {
    setWorkoutViewTitle("Edit");
    setWorkoutViewIsActive(true);
    (async () => setFromWorkout(await fullToDetached(fullWorkout)))();

    setSaveFunctionForWorkoutView(() => async (wk: FullDetachedWorkout) => {
      await updateFullDetachedWorkout(
        fullWorkout.id,
        wk,
        "completed",
        toISODate(new Date()),
      );
      setWorkoutViewIsActive(false);
      return true;
    });
  }

  if (workoutViewIsActive) {
    return (
      <WorkoutView
        isActive={workoutViewIsActive}
        onSave={async (wk) => {
          if (!saveFunctionForWorkoutView) return false;
          const success = saveFunctionForWorkoutView(wk);
          return success.then((successful) => {
            if (successful) {
              reloadWorkouts();
            }
            return successful;
          });
        }}
        requestClose={() => setWorkoutViewIsActive(false)}
        createAsTemplate={false}
        allowEditing={true}
        saveButtonTitle={workoutViewTitle}
        loadWithExisting={fromWorkout}
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
          displayedWorkouts.map((fw, idx) => {
            const w = fw.workout;
            const preview = previewByWorkoutId[w.id] ?? "";

            return (
              <Pressable
                key={`${fw.id}-${w.id}-${idx}`}
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
