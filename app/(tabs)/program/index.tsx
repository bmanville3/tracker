import { Button, Screen, TextField } from "@/src/components";
import { supabase } from "@/src/supabase";
import { colors, spacing, typography } from "@/src/theme";
import { getUser, showAlert } from "@/src/utils";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

type ProgramRow = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;

  trainee_user_id: string;
  created_by_user_id: string;

  coach_can_edit: boolean | null;
  role: "trainee" | "coach";
};

function formatDateRange(start: string | null, end: string | null): string {
  const s = start ?? "No start";
  const e = end ?? "No end";
  return `${s} → ${e}`;
}

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);


  // Create-program inputs
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const canCreate = useMemo(() => newName.trim().length > 0, [newName]);

  const load = async () => {
    setLoading(true);
    try {
      const user = await getUser();
      if (!user) return;

      const traineeQuery = supabase
        .from("program")
        .select("id,name,start_date,end_date,notes,trainee_user_id,created_by_user_id")
        .eq("trainee_user_id", user.id);

      const coachQuery = supabase
        .from("program_coach")
        .select("program_id,can_edit,program(id,name,start_date,end_date,notes,trainee_user_id,created_by_user_id)")
        .eq("coach_user_id", user.id);

      const [{ data: traineePrograms, error: traineeErr }, { data: coachRows, error: coachErr }] =
        await Promise.all([traineeQuery, coachQuery]);

      if (traineeErr) {
        showAlert("Problem getting trainee data", traineeErr.message);
        return;
      };
      if (coachErr) {
        showAlert("Problem getting coach data", coachErr.message);
        return;
      };

      const traineeMapped: ProgramRow[] = (traineePrograms ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        start_date: p.start_date,
        end_date: p.end_date,
        notes: p.notes,
        trainee_user_id: p.trainee_user_id,
        created_by_user_id: p.created_by_user_id,
        coach_can_edit: null,
        role: "trainee",
      }));

      const coachMapped: ProgramRow[] = (coachRows ?? [])
        .map(
          (row: any) =>
            row.program && ({
              id: row.program.id,
              name: row.program.name,
              start_date: row.program.start_date,
              end_date: row.program.end_date,
              notes: row.program.notes,
              trainee_user_id: row.program.trainee_user_id,
              created_by_user_id: row.program.created_by_user_id,
              coach_can_edit: row.can_edit ?? false,
              role: "coach" as const,
            })
        )
        .filter(Boolean) as ProgramRow[];

      const byId = new Map<string, ProgramRow>();
      for (const p of coachMapped) byId.set(p.id, p);
      for (const p of traineeMapped) byId.set(p.id, p);

      const merged = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
      setPrograms(merged);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetCreateForm = () => {
    setNewName("");
    setNewStart("");
    setNewEnd("");
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
  };

  const createProgram = async () => {
    const name = newName.trim();
    if (!name) return;

    const user = await getUser();
    if (!user) return;

    const payload = {
      trainee_user_id: user.id,
      created_by_user_id: user.id,
      name,
      start_date: newStart.trim() || null,
      end_date: newEnd.trim() || null,
      notes: null,
    };

    setLoading(true);
    try {
      const { error } = await supabase.from("program").insert(payload);
      if (error) throw error;

      closeCreate();
      await load();
    } finally {
      setLoading(false);
    }
  };

  const renderProgram = ({ item }: { item: ProgramRow }) => {
    const roleLabel =
      item.role === "trainee"
        ? "Trainee"
        : item.coach_can_edit
          ? "Coach (edit)"
          : "Coach (view)";

    return (
      <Pressable
        onPress={() => router.push(`/(tabs)/program/${item.id}`)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
        </View>

        <Text style={styles.cardSub}>{formatDateRange(item.start_date, item.end_date)}</Text>

        {!!item.notes && (
          <Text numberOfLines={2} style={styles.cardNotes}>
            {item.notes}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <Screen>
      <Text style={typography.title}>Programs</Text>

      <View style={{ flex: 1, marginTop: spacing.lg }}>
        <FlatList
          data={programs}
          keyExtractor={(p) => p.id}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            <Text style={typography.hint}>
              No programs yet. Tap “+” to create one, or have a coach share one with you.
            </Text>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={renderProgram}
          contentContainerStyle={{ paddingBottom: 110 }} // space for FAB
        />
      </View>

      {/* Floating Add Button */}
      <Pressable
        onPress={openCreate}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Create program"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Create Program Modal */}
      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCreate}
      >
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={closeCreate} />

        {/* Sheet/Card */}
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={[typography.title, { fontSize: 22, marginBottom: 12 }]}>
              Create program
            </Text>

            <Text style={typography.label}>Program name</Text>
            <TextField value={newName} onChangeText={setNewName} placeholder="Winter Bulk 2026" />

            <Text style={typography.label}>Start date (YYYY-MM-DD)</Text>
            <TextField value={newStart} onChangeText={setNewStart} placeholder="2026-01-05" />

            <Text style={typography.label}>End date (YYYY-MM-DD)</Text>
            <TextField value={newEnd} onChangeText={setNewEnd} placeholder="2026-04-10" />

            <View style={{ marginTop: spacing.lg }}>
              <Button title="Create" onPress={createProgram} disabled={!canCreate || loading} />
              <Button title="Cancel" onPress={closeCreate} disabled={loading} variant="secondary" />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = {
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: "800" as const,
    flexShrink: 1,
  },
  cardSub: {
    ...typography.hint,
    marginTop: 6,
  },
  cardNotes: {
    ...typography.hint,
    marginTop: 8,
  },
  rolePill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start" as const,
  },
  rolePillText: {
    color: colors.textPrimary,
    fontWeight: "800" as const,
    fontSize: 12,
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

  // Modal
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
};
