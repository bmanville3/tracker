import { Button, Screen } from "@/src/components";
import { TextField } from "@/src/components/TextField";
import { supabase } from "@/src/supabase";
import { colors, spacing, typography } from "@/src/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, useWindowDimensions, View } from "react-native";

type WorkoutRow = {
  id: string;
  name: string;
  notes: string | null;
  scheduled_date: string | null; // "YYYY-MM-DD"
  is_complete: boolean;
  created_at?: string | null;
};

type CoachAccessRow = {
  coach_user_id: string;
  can_edit: boolean;
  display_name: string | null;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function compareISODate(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function addMonths(year: number, month0: number, delta: number): { y: number; m0: number } {
  const total = year * 12 + month0 + delta;
  const y = Math.floor(total / 12);
  const m0 = total % 12;
  return { y, m0 };
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function weekday0Sun(year: number, month0: number, day: number): number {
  // 0=Sun..6=Sat
  return new Date(year, month0, day).getDay();
}

function isoFromYMD(y: number, m0: number, d: number): string {
  const mm = String(m0 + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function formatMonthTitle(y: number, m0: number): string {
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${monthNames[m0]} ${y}`;
}

function SectionHeader({
  title,
  subtitle,
  expanded,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={({ pressed }) => [styles.sectionHeader, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.sectionChevron}>{expanded ? "▾" : "▸"}</Text>
    </Pressable>
  );
}

function WorkoutCard({
  item,
  clickable,
  onPress,
}: {
  item: WorkoutRow;
  clickable: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={clickable ? onPress : undefined}
      style={({ pressed }) => [
        styles.card,
        !clickable && styles.cardDisabled,
        pressed && clickable ? { opacity: 0.75 } : null,
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.is_complete ? "✓ " : ""}
          {item.name}
        </Text>

        {!!item.scheduled_date && (
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{item.scheduled_date}</Text>
          </View>
        )}
      </View>

      {!!item.notes && (
        <Text style={styles.cardNotes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}

      {!clickable && <Text style={styles.readOnlyHint}>Read-only (no edit permission)</Text>}
    </Pressable>
  );
}

function CalendarPickerModal({
  visible,
  initialISO,
  onClose,
  onSelect,
  title = "Pick a date",
}: {
  visible: boolean;
  initialISO: string | null;
  title?: string;
  onClose: () => void;
  onSelect: (iso: string) => void; // pass "" to clear if you want
}) {
  const { height: screenH, width: screenW } = useWindowDimensions();

  const now = new Date();
  const initial = useMemo(() => {
    if (initialISO && /^\d{4}-\d{2}-\d{2}$/.test(initialISO)) {
      const [yy, mm, dd] = initialISO.split("-").map((x) => Number(x));
      return { y: yy, m0: mm - 1, d: dd };
    }
    return { y: now.getFullYear(), m0: now.getMonth(), d: now.getDate() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialISO, visible]);

  const [y, setY] = useState(initial.y);
  const [m0, setM0] = useState(initial.m0);

  useEffect(() => {
    if (!visible) return;
    setY(initial.y);
    setM0(initial.m0);
  }, [visible, initial.y, initial.m0]);

  // ----- build a 6-week (42 cell) grid every time -----
  const firstW = weekday0Sun(y, m0, 1); // 0..6 (Sun..Sat)
  const dim = daysInMonth(y, m0);

  // 42 cells: null (padding) + days + trailing nulls
  const cells: Array<{ key: string; day: number | null; iso: string | null }> = useMemo(() => {
    const out: Array<{ key: string; day: number | null; iso: string | null }> = [];

    // leading blanks
    for (let i = 0; i < firstW; i++) out.push({ key: `p${i}`, day: null, iso: null });

    // month days
    for (let d = 1; d <= dim; d++) out.push({ key: `d${d}`, day: d, iso: isoFromYMD(y, m0, d) });

    // trailing blanks to reach exactly 42 cells
    while (out.length < 42) out.push({ key: `t${out.length}`, day: null, iso: null });

    // if somehow we overshoot (shouldn't), clamp
    return out.slice(0, 42);
  }, [dim, firstW, m0, y]);

  const today = todayISO();

  // ----- fixed sizing: compute a consistent day cell size -----
  // Modal width is capped; day cell size derives from that.
  const modalMaxW = Math.min(420, screenW - spacing.lg * 2); // adjust 420 to taste
  const gridHorizontalPadding = 0; // if your grid has padding, reflect it here

  const dayCellSize = Math.floor((modalMaxW - gridHorizontalPadding) / 7); // 7 columns
  const gridHeight = dayCellSize * 6; // ALWAYS 6 rows

  // cap modal height so it never exceeds screen
  const modalMaxH = Math.floor(screenH * 0.78);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.modalWrap}>
        <View style={[styles.modalCard, { maxWidth: modalMaxW, maxHeight: modalMaxH, width: "100%" }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.iconButtonText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.calendarTopRow}>
            <Pressable
              onPress={() => {
                const prev = addMonths(y, m0, -1);
                setY(prev.y);
                setM0(prev.m0);
              }}
              style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.navButtonText}>‹</Text>
            </Pressable>

            <Text style={styles.monthTitle}>{formatMonthTitle(y, m0)}</Text>

            <Pressable
              onPress={() => {
                const nxt = addMonths(y, m0, +1);
                setY(nxt.y);
                setM0(nxt.m0);
              }}
              style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.navButtonText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekHeaderRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((w) => (
              <Text key={w} style={styles.weekHeaderCell}>
                {w}
              </Text>
            ))}
          </View>

          {/* Fixed-size grid container */}
          <View style={{ height: gridHeight }}>
            <View style={styles.grid}>
              {cells.map((c) => {
                if (!c.day || !c.iso) {
                  return (
                    <View
                      key={c.key}
                      style={{
                        width: dayCellSize,
                        height: dayCellSize,
                        padding: 4,
                      }}
                    />
                  );
                }

                const isToday = c.iso === today;

                return (
                  <Pressable
                    key={c.key}
                    onPress={() => onSelect(c.iso!)}
                    style={({ pressed }) => [
                      {
                        width: dayCellSize,
                        height: dayCellSize,
                        padding: 4,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View
                      style={[
                        styles.dayCellButton,
                        { width: "100%", height: "100%" },
                        isToday && styles.dayCellToday,
                      ]}
                    >
                      <Text style={[styles.dayText, isToday && styles.dayTextToday]}>{c.day}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Button title="Clear" variant="secondary" onPress={() => onSelect("")} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ProgramWorkoutsScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const program_id = programId;

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Access control
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  // Access dropdown
  const [accessOpen, setAccessOpen] = useState(false);
  const [coaches, setCoaches] = useState<CoachAccessRow[]>([]);

  // Sections
  const [completedOpen, setCompletedOpen] = useState(false);
  const [futureOpen, setFutureOpen] = useState(true);

  // Create workout modal (FAB)
  const [createOpen, setCreateOpen] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState("");
  const [newWorkoutNotes, setNewWorkoutNotes] = useState("");
  const [newWorkoutDate, setNewWorkoutDate] = useState<string | null>(null);

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const canCreate = useMemo(() => newWorkoutName.trim().length > 0, [newWorkoutName]);
  const today = useMemo(() => todayISO(), []);

  const resetCreateForm = () => {
    setNewWorkoutName("");
    setNewWorkoutNotes("");
    setNewWorkoutDate(null);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
  };

  const load = async () => {
    if (!program_id) return;

    setLoading(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: program, error: programErr } = await supabase
        .from("program")
        .select("id,trainee_user_id")
        .eq("id", program_id)
        .single();
      if (programErr) throw programErr;

      const owner = program.trainee_user_id === user.id;
      setIsOwner(owner);

      const { data: coachRows, error: coachErr } = await supabase
        .from("program_coach")
        .select("coach_user_id,can_edit,user_profile(display_name)")
        .eq("program_id", program_id);
      if (coachErr) {
        // If relationship doesn't exist, still allow app to work without names.
        // We'll just show IDs and permissions.
        // (You can later add user_profile + FK if you want names.)
        setCoaches([]);
      } else {
        const coachList: CoachAccessRow[] = (coachRows ?? []).map((r: any) => ({
          coach_user_id: r.coach_user_id,
          can_edit: !!r.can_edit,
          display_name: r.user_profile?.display_name ?? null,
        }));
        setCoaches(coachList);

        if (owner) setCanEdit(true);
        else {
          const meCoach = coachList.find((c) => c.coach_user_id === user.id);
          setCanEdit(!!meCoach?.can_edit);
        }
      }

      if (coachErr) {
        // fallback canEdit without coach list
        if (owner) setCanEdit(true);
        else {
          const { data: myCoach, error: myCoachErr } = await supabase
            .from("program_coach")
            .select("can_edit")
            .eq("program_id", program_id)
            .eq("coach_user_id", user.id)
            .maybeSingle();
          if (myCoachErr) throw myCoachErr;
          setCanEdit(!!myCoach?.can_edit);
        }
      }

      // IMPORTANT: use workout (not workout_template)
      const { data: w, error: wErr } = await supabase
        .from("workout")
        .select("id,name,notes,scheduled_date,is_complete,created_at")
        .eq("program_id", program_id)
        .order("scheduled_date", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });

      if (wErr) throw wErr;

      setWorkouts(
        (w ?? []).map((x: any) => ({
          id: x.id,
          name: x.name,
          notes: x.notes,
          scheduled_date: x.scheduled_date,
          is_complete: !!x.is_complete,
          created_at: x.created_at ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program_id]);

  const createWorkout = async () => {
    const name = newWorkoutName.trim();
    if (!name || !program_id) return;
    if (!canEdit) return;

    setLoading(true);
    try {
      const payload = {
        program_id,
        name,
        notes: newWorkoutNotes.trim() || null,
        scheduled_date: newWorkoutDate,
        is_complete: false,
      };

      const { error } = await supabase.from("workout").insert(payload);
      if (error) throw error;

      closeCreate();
      await load();
    } finally {
      setLoading(false);
    }
  };

  const toggleCoachEdit = async (coach_user_id: string, next: boolean) => {
    if (!isOwner || !program_id) return;

    const { error } = await supabase
      .from("program_coach")
      .update({ can_edit: next })
      .eq("program_id", program_id)
      .eq("coach_user_id", coach_user_id);

    if (error) throw error;
    await load();
  };

  const todayWorkouts = useMemo(() => {
    return workouts
      .filter((w) => !w.is_complete && w.scheduled_date === today)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts, today]);

  const futureWorkouts = useMemo(() => {
    return workouts
      .filter((w) => !w.is_complete && !!w.scheduled_date && compareISODate(w.scheduled_date!, today) === 1)
      .sort((a, b) => compareISODate(a.scheduled_date!, b.scheduled_date!));
  }, [workouts, today]);

  const unscheduledOpenWorkouts = useMemo(() => {
    return workouts
      .filter((w) => !w.is_complete && !w.scheduled_date)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts]);

  const completedWorkouts = useMemo(() => {
    return workouts
      .filter((w) => w.is_complete)
      .sort((a, b) => (b.scheduled_date ?? "").localeCompare(a.scheduled_date ?? ""));
  }, [workouts]);

  const openWorkout = (workoutId: string) => {
    router.push(`/(tabs)/program/${program_id}/workout/${workoutId}`);
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={typography.title}>Workouts</Text>

        <Pressable onPress={() => setAccessOpen((v) => !v)} style={styles.accessButton}>
          <Text style={styles.accessButtonText}>Access</Text>
        </Pressable>
      </View>

      {accessOpen && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Program access</Text>

          <Text style={styles.panelLine}>
            • Owner (trainee): <Text style={styles.strongText}>{isOwner ? "You" : "Trainee"}</Text> (edit)
          </Text>

          <Text style={[styles.panelLine, { marginTop: 10 }]}>• Coaches:</Text>

          {coaches.length === 0 ? (
            <Text style={styles.panelLine}>  (none loaded)</Text>
          ) : (
            coaches.map((c) => {
              const isMe = c.coach_user_id === currentUserId;
              const label = c.display_name ?? (isMe ? "You" : c.coach_user_id.slice(0, 8));

              return (
                <View key={c.coach_user_id} style={styles.coachRow}>
                  <Text style={styles.coachName} numberOfLines={1}>
                    {label} {isMe ? <Text style={styles.mePill}>you</Text> : null}
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[styles.permPill, c.can_edit ? styles.permPillEdit : styles.permPillView]}>
                      <Text style={styles.permPillText}>{c.can_edit ? "edit" : "view"}</Text>
                    </View>

                    {isOwner && (
                      <Pressable
                        onPress={() => toggleCoachEdit(c.coach_user_id, !c.can_edit)}
                        style={({ pressed }) => [styles.toggleButton, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.toggleButtonText}>{c.can_edit ? "Set view" : "Set edit"}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {!isOwner && <Text style={[styles.panelHint, { marginTop: 10 }]}>Only the owner can change permissions.</Text>}
        </View>
      )}

      {!canEdit && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={typography.hint}>You have view-only access to this program.</Text>
        </View>
      )}

      {todayWorkouts.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={styles.todayTitle}>Today</Text>
          {todayWorkouts.map((w) => (
            <WorkoutCard key={w.id} item={w} clickable={canEdit} onPress={() => openWorkout(w.id)} />
          ))}
        </View>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader
          title="Future workouts"
          subtitle={futureWorkouts.length ? `${futureWorkouts.length} scheduled` : "None scheduled"}
          expanded={futureOpen}
          onToggle={() => setFutureOpen((v) => !v)}
        />

        {futureOpen && (
          <View style={styles.panel}>
            {futureWorkouts.length === 0 ? (
              <Text style={typography.hint}>No future workouts scheduled.</Text>
            ) : (
              <FlatList
                data={futureWorkouts}
                keyExtractor={(w) => w.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
                renderItem={({ item }) => (
                  <WorkoutCard item={item} clickable={canEdit} onPress={() => openWorkout(item.id)} />
                )}
              />
            )}

            {unscheduledOpenWorkouts.length > 0 && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.subSectionTitle}>Unscheduled</Text>
                {unscheduledOpenWorkouts.map((w) => (
                  <WorkoutCard key={w.id} item={w} clickable={canEdit} onPress={() => openWorkout(w.id)} />
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <View style={{ marginTop: spacing.lg, flex: 1 }}>
        <SectionHeader
          title="Completed workouts"
          subtitle={completedWorkouts.length ? `${completedWorkouts.length} completed` : "None completed"}
          expanded={completedOpen}
          onToggle={() => setCompletedOpen((v) => !v)}
        />

        {completedOpen && (
          <View style={styles.panel}>
            {completedWorkouts.length === 0 ? (
              <Text style={typography.hint}>No completed workouts yet.</Text>
            ) : (
              <FlatList
                data={completedWorkouts}
                keyExtractor={(w) => w.id}
                refreshing={loading}
                onRefresh={load}
                ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
                renderItem={({ item }) => (
                  <WorkoutCard item={item} clickable={canEdit} onPress={() => openWorkout(item.id)} />
                )}
              />
            )}
          </View>
        )}
      </View>

      {/* FAB */}
      {canEdit && (
        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Add workout"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}

      {/* Create Workout Modal */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={closeCreate}>
        <Pressable style={styles.backdrop} onPress={closeCreate} />

        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>New workout</Text>
              <Pressable onPress={closeCreate} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.8 }]}>
                <Text style={styles.iconButtonText}>✕</Text>
              </Pressable>
            </View>

            <Text style={typography.label}>Name</Text>
            <TextField value={newWorkoutName} onChangeText={setNewWorkoutName} placeholder="Upper A" />

            <Text style={typography.label}>Notes</Text>
            <TextField value={newWorkoutNotes} onChangeText={setNewWorkoutNotes} placeholder="Optional notes" />

            <Text style={typography.label}>Scheduled date</Text>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={({ pressed }) => [styles.datePickerField, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.datePickerText}>
                {newWorkoutDate ? newWorkoutDate : "Tap to pick a date"}
              </Text>
            </Pressable>

            <View style={{ marginTop: spacing.lg }}>
              <Button title="Create workout" onPress={createWorkout} disabled={!canCreate || loading} />
              <Button title="Cancel" onPress={closeCreate} disabled={loading} variant="secondary" />
            </View>
          </View>
        </View>
      </Modal>

      <CalendarPickerModal
        visible={datePickerOpen}
        initialISO={newWorkoutDate}
        title="Select scheduled date"
        onClose={() => setDatePickerOpen(false)}
        onSelect={(iso) => {
          setDatePickerOpen(false);
          // "Clear" returns "", normalize to null
          setNewWorkoutDate(iso ? iso : null);
        }}
      />
    </Screen>
  );
}

const styles = {
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: spacing.md,
  },

  accessButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  accessButtonText: {
    ...typography.body,
    fontWeight: "800" as const,
  },

  // Panels (dropdown contents) — distinct background from Screen
  panel: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.surface, // brighter than screen bg
  },
  panelTitle: {
    ...typography.body,
    fontWeight: "900" as const,
  },
  panelLine: {
    ...typography.hint,
    marginTop: 6,
  },
  panelHint: {
    ...typography.hint,
  },
  strongText: {
    fontWeight: "900" as const,
  },

  coachRow: {
    marginTop: 10,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  coachName: {
    ...typography.body,
    flexShrink: 1,
  },
  mePill: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800" as const,
  },

  permPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permPillEdit: {
    backgroundColor: colors.primary,
  },
  permPillView: {
    backgroundColor: colors.bg,
  },
  permPillText: {
    ...typography.hint,
    fontWeight: "900" as const,
  },

  toggleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  toggleButtonText: {
    ...typography.hint,
    fontWeight: "800" as const,
  },

  todayTitle: {
    ...typography.body,
    fontWeight: "900" as const,
    marginBottom: spacing.md,
  },

  sectionHeader: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface, // make header itself look like a dropdown card
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: "900" as const,
  },
  sectionSubtitle: {
    ...typography.hint,
    marginTop: 2,
  },
  sectionChevron: {
    ...typography.body,
    fontWeight: "900" as const,
  },

  subSectionTitle: {
    ...typography.hint,
    fontWeight: "900" as const,
    marginBottom: spacing.sm,
  },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },
  cardDisabled: {
    opacity: 0.85,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: "900" as const,
    flexShrink: 1,
  },
  datePill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bg,
    alignSelf: "flex-start" as const,
  },
  datePillText: {
    ...typography.hint,
    fontWeight: "800" as const,
  },
  cardNotes: {
    ...typography.hint,
    marginTop: 6,
  },
  readOnlyHint: {
    ...typography.hint,
    marginTop: 8,
  },

  // FAB
  fab: {
    position: "absolute" as const,
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fabText: {
    color: colors.surface,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "900" as const,
    marginTop: -2,
  },

  // Create modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalWrap: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalHeaderRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 10,
  },
  modalTitle: {
    ...typography.title,
    fontSize: 22,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  iconButtonText: {
    ...typography.body,
    fontWeight: "900" as const,
  },

  datePickerField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 6,
  },
  datePickerText: {
    ...typography.body,
    fontWeight: "800" as const,
  },

  // Calendar modal
  calendarTopRow: {
    marginTop: spacing.sm,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  navButtonText: {
    ...typography.body,
    fontWeight: "900" as const,
    fontSize: 20,
  },
  monthTitle: {
    ...typography.body,
    fontWeight: "900" as const,
  },
  weekHeaderRow: {
    marginTop: spacing.md,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
  },
  weekHeaderCell: {
    ...typography.hint,
    width: "14.2857%" as any,
    textAlign: "center" as const,
    fontWeight: "900" as const,
  },
  grid: {
    marginTop: spacing.sm,
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
  },
  dayCell: {
    width: "14.2857%" as any,
    aspectRatio: 1,
    padding: 4,
  },
  dayCellButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  dayCellToday: {
    backgroundColor: colors.primary,
  },
  dayText: {
    ...typography.body,
    fontWeight: "900" as const,
  },
  dayTextToday: {
    color: colors.surface,
  },
};
