import { Button, Screen, TextField } from "@/src/components";
import { ProgramEditorRole, ProgramUserRole } from "@/src/enums";
import { ProgramRow } from "@/src/interfaces";
import { supabase } from "@/src/supabase";
import { colors, spacing, typography } from "@/src/theme";
import { getUser, showAlert } from "@/src/utils";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";


type ProgramRowAndRole = {
  editor_role: ProgramEditorRole;
  user_role: ProgramUserRole;
  program: ProgramRow;
}

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<ProgramRowAndRole[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);

  const [newProgramName, setNewProgramName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newNumWeeks, setNewNumWeeks] = useState(1);
  const [newRole, setNewRole] = useState<ProgramUserRole>("trainee");

  const [useSmartCreator, setUseSmartCreator] = useState(false);
  const [smartCreatorOpen, setSmartCreatorOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const user = await getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("program_membership")
        .select(`
          editor_role,
          user_role,
          program:program_id (
            *
          )
        `);
      if (error) {
        showAlert("Error getting programs", error.message);
        return;
      }
      console.log(data);
      setPrograms(data as unknown as ProgramRowAndRole[])
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => void load(), []);

  const resetCreateForm = () => {
    setNewProgramName("");
    setNewDescription("");
    setSmartCreatorOpen(false);
    setUseSmartCreator(false);
    setNewNumWeeks(1);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setSmartCreatorOpen(false);
  };

  const createProgram = async () => {
    const name = newProgramName.trim();
    if (!name) {
      showAlert('Name must be present');
      return;
    }

    const description = newDescription.trim();

    const numWeeks = newNumWeeks;
    if (numWeeks < 1 || numWeeks > 52 || !Number.isInteger(numWeeks)) {
      showAlert("Must have a positive, whole number of weeks (max 52 weeks)");
      return;
    }

    setLoading(true);
    try {
      const { data: _programId, error } = await supabase.rpc(
        "create_program_with_membership",
        {
          p_name: name,
          p_description: description,
          p_num_weeks: numWeeks,
          p_user_role: newRole,
        }
      );

      if (error) {
        showAlert("Problem creating program", error.message);
        return;
      }

      closeCreate();
      await load();
    } finally {
      setLoading(false);
    }
  };

  const renderProgram = ({ item }: { item: ProgramRowAndRole }) => {
    const roleLabel =
      item.user_role === "trainee"
        ? "Trainee"
        : item.user_role === "coach"
          ? "Coach"
          : "Uknown role";

    const editPermission = 
      item.editor_role === "editor"
        ? "Editor"
        : item.editor_role === "owner"
          ? "Owner"
          : item.editor_role === "viewer"
            ? "Viewer"
            : "Unknown edit permissions";

    return (
      <Pressable
        onPress={() => router.push(`/(tabs)/program/${item.program.id}`)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text style={styles.cardTitle}>{item.program.name}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel} ({editPermission})</Text>
          </View>
        </View>

        {item.program.description !== '' ? 
          <Text numberOfLines={2} style={styles.cardNotes}>
            {item.program.description}
          </Text> : (<Text>No description</Text>)
        }
      </Pressable>
    );
  };

  return (
    <Screen>
      <Text style={typography.title}>Programs</Text>

      <View style={{ flex: 1, marginTop: spacing.lg }}>
        <FlatList
          data={programs}
          keyExtractor={(p) => p.program.id}
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
        transparent={true}
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
            <TextField value={newProgramName} onChangeText={setNewProgramName} placeholder="Winter Bulk 2026" />

            <Text style={typography.label}>Number of Weeks</Text>
            <TextField
              keyboardType="numeric"
              value={newNumWeeks.toString()}
              onChangeText={text => {
                const num = +text;
                if (Number.isNaN(num)) {
                  return;
                }
                setNewNumWeeks(num);
              }}
            />

            <Text style={typography.label}>Your Role</Text>
            <Text style={typography.body}>
              <input
                type="radio"
                name="role"
                value="trainee"
                checked={newRole === "trainee"}
                onChange={() => setNewRole("trainee")}
              />
              Trainee
              <span style={{ marginRight: '10px' }}></span>
              <input
                type="radio"
                name="role"
                value="coach"
                checked={newRole === "coach"}
                onChange={() => setNewRole("coach")}
              />
              Coach
            </Text>

            <Text style={typography.label}>Description</Text>
            <TextField
              value={newDescription}
              onChangeText={setNewDescription}
              multiline={true}
              numberOfLines={4}
              placeholder="Enter description..."
            />

            <View style={{ marginTop: spacing.lg }}>
              <Button title="Create" onPress={createProgram} disabled={loading} />
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
    color: colors.surfaceAlt,
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
