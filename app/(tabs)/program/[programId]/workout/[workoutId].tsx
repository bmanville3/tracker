import { Button, Screen } from "@/src/components";
import { TextField } from "@/src/components/TextField";
import { supabase } from "@/src/supabase";
import { typography } from "@/src/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type {
  ExerciseRow,
  ModifierRow,
  ProgramCoachRow,
  ProgramRow,
  WorkoutExerciseModifierRow,
  WorkoutExerciseRow,
  WorkoutRow,
  WorkoutSetRow
} from "@/src/interfaces";

// -------------------------
// Joined / view helper types
// -------------------------

type WorkoutExerciseWithExercise = WorkoutExerciseRow & {
  exercise?: Pick<ExerciseRow, "name"> | null;
};

type WorkoutExerciseModifierWithModifier = WorkoutExerciseModifierRow & {
  modifier?: Pick<ModifierRow, "id" | "name"> | null;
};

type CoachAccessRow = {
  coach_user_id: string;
  can_edit: boolean;
  display_name: string | null;
};

export default function WorkoutEditorScreen() {
  const { programId, workoutId } = useLocalSearchParams<{ programId: string; workoutId: string }>();

  const [workout, setWorkout] = useState<WorkoutRow | null>(null);

  const [exercises, setExercises] = useState<WorkoutExerciseWithExercise[]>([]);
  const [setsByExercise, setSetsByExercise] = useState<Record<string, WorkoutSetRow[]>>({});
  const [modsByExercise, setModsByExercise] = useState<Record<string, ModifierRow[]>>({});

  const [allExercises, setAllExercises] = useState<Pick<ExerciseRow, "id" | "name">[]>([]);
  const [allModifiers, setAllModifiers] = useState<Pick<ModifierRow, "id" | "name">[]>([]);

  const [editingName, setEditingName] = useState("");
  const [editingNotes, setEditingNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  // optional: show who has access (if you want to display it in this screen too)
  const [coaches, setCoaches] = useState<CoachAccessRow[]>([]);

  const canSave = useMemo(() => editingName.trim().length > 0, [editingName]);

  const loadPermissions = async (program_id: string): Promise<boolean> => {
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    const user = auth.user;
    if (!user) return false;

    // Owner check
    const { data: program, error: pErr } = await supabase
      .from("program")
      .select("id,trainee_user_id")
      .eq("id", program_id)
      .single<Pick<ProgramRow, "id" | "trainee_user_id">>();

    if (pErr) throw pErr;

    if (program.trainee_user_id === user.id) return true;

    // Coach check
    const { data: coachRow, error: cErr } = await supabase
      .from("program_coach")
      .select("can_edit")
      .eq("program_id", program_id)
      .eq("coach_user_id", user.id)
      .maybeSingle<Pick<ProgramCoachRow, "can_edit">>();

    if (cErr) throw cErr;
    return !!coachRow?.can_edit;
  };

  const loadCoachAccessList = async (program_id: string) => {
    // optional convenience, not required for the editor itself
    // This requires the FK relationship coach_user_id -> user_profile.user_id in Supabase,
    // otherwise use the 2-step lookup approach.
    const { data, error } = await supabase
      .from("program_coach")
      .select("coach_user_id,can_edit,user_profile(display_name)")
      .eq("program_id", program_id);

    if (error) throw error;

    const rows: CoachAccessRow[] = (data ?? []).map((r: any) => ({
      coach_user_id: r.coach_user_id as string,
      can_edit: !!r.can_edit,
      display_name: (r.user_profile?.display_name ?? null) as string | null,
    }));

    setCoaches(rows);
  };

  const load = async () => {
    if (!workoutId) return;

    setLoading(true);
    try {
      // 1) Workout
      const { data: w, error: wErr } = await supabase
        .from("workout")
        .select("id,program_id,name,notes,scheduled_date,is_complete,created_at")
        .eq("id", workoutId)
        .single<WorkoutRow>();

      if (wErr) throw wErr;

      setWorkout(w);
      setEditingName(w.name);
      setEditingNotes(w.notes ?? "");

      // 2) Permissions
      const edit = await loadPermissions(w.program_id);
      setCanEdit(edit);

      // optional access list
      await loadCoachAccessList(w.program_id);

      // 3) Workout exercises (join global exercise)
      const { data: wes, error: weErr } = await supabase
        .from("workout_exercise")
        .select("id,workout_id,exercise_id,order,notes,exercise(name)")
        .eq("workout_id", workoutId)
        .order("order", { ascending: true });

      if (weErr) throw weErr;

      const weRows = (wes ?? []) as WorkoutExerciseWithExercise[];
      setExercises(weRows);

      const workoutExerciseIds = weRows.map((x) => x.id);

      // 4) Sets (bulk)
      if (workoutExerciseIds.length === 0) {
        setSetsByExercise({});
        setModsByExercise({});
      } else {
        const { data: allSets, error: sErr } = await supabase
          .from("workout_set")
          .select(
            "id,workout_exercise_id,set_index,reps,weight_value,weight_unit,rpe,rir,rest_sec,duration_sec,distance_value,distance_unit,calories,notes,created_at,is_complete"
          )
          .in("workout_exercise_id", workoutExerciseIds)
          .order("workout_exercise_id", { ascending: true })
          .order("set_index", { ascending: true });

        if (sErr) throw sErr;

        const bySets: Record<string, WorkoutSetRow[]> = {};
        for (const id of workoutExerciseIds) bySets[id] = [];
        for (const s of (allSets ?? []) as WorkoutSetRow[]) {
          (bySets[s.workout_exercise_id] ??= []).push(s);
        }
        setSetsByExercise(bySets);

        // 5) Modifiers (bulk)
        const { data: wem, error: wemErr } = await supabase
          .from("workout_exercise_modifier")
          .select("workout_exercise_id,modifier_id,modifier(id,name)")
          .in("workout_exercise_id", workoutExerciseIds);

        if (wemErr) throw wemErr;

        const byMods: Record<string, ModifierRow[]> = {};
        for (const id of workoutExerciseIds) byMods[id] = [];

        for (const row of (wem ?? []) as WorkoutExerciseModifierWithModifier[]) {
          if (row.modifier) {
            byMods[row.workout_exercise_id].push({
              id: row.modifier.id,
              name: row.modifier.name,
              description: null, // not selected
            });
          }
        }
        setModsByExercise(byMods);
      }

      // 6) Reference lists
      const [{ data: ex, error: exErr }, { data: mods, error: mErr }] = await Promise.all([
        supabase.from("exercise").select("id,name").order("name"),
        supabase.from("modifier").select("id,name").order("name"),
      ]);

      if (exErr) throw exErr;
      if (mErr) throw mErr;

      setAllExercises((ex ?? []) as Pick<ExerciseRow, "id" | "name">[]);
      setAllModifiers((mods ?? []) as Pick<ModifierRow, "id" | "name">[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  // ---------- Mutations (gated by canEdit) ----------

  const saveWorkoutMeta = async () => {
    if (!workout || !canEdit || !canSave) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("workout")
        .update({ name: editingName.trim(), notes: editingNotes.trim() || null })
        .eq("id", workoutId);

      if (error) throw error;
      await load();
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async () => {
    if (!workout || !canEdit) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("workout")
        .update({ is_complete: !workout.is_complete })
        .eq("id", workoutId);

      if (error) throw error;
      await load();
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkout = async () => {
    if (!canEdit) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("workout").delete().eq("id", workoutId);
      if (error) throw error;
      router.replace(`/(tabs)/program/${programId}`);
    } finally {
      setLoading(false);
    }
  };

  const addExerciseToWorkout = async (exerciseId: string) => {
    if (!canEdit) return;

    const nextOrder = exercises.length === 0 ? 0 : Math.max(...exercises.map((e) => e.order)) + 1;

    const { error } = await supabase.from("workout_exercise").insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      order: nextOrder,
      notes: null,
    } satisfies Partial<WorkoutExerciseRow>);

    if (error) throw error;
    await load();
  };

  const removeWorkoutExercise = async (workoutExerciseId: string) => {
    if (!canEdit) return;

    const { error } = await supabase.from("workout_exercise").delete().eq("id", workoutExerciseId);
    if (error) throw error;
    await load();
  };

  const addSet = async (workoutExerciseId: string) => {
    if (!canEdit) return;

    const existing = setsByExercise[workoutExerciseId] ?? [];
    const nextIndex = existing.length;

    const { error } = await supabase.from("workout_set").insert({
      workout_exercise_id: workoutExerciseId,
      set_index: nextIndex,
      reps: null,
      weight_value: null,
      weight_unit: null,
      rpe: null,
      rir: null,
      rest_sec: null,
      duration_sec: null,
      distance_value: null,
      distance_unit: null,
      calories: null,
      notes: null,
      is_complete: false,
    } satisfies Partial<WorkoutSetRow>);

    if (error) throw error;
    await load();
  };

  const updateSetField = async (
    setId: string,
    patch: Partial<
      Pick<
        WorkoutSetRow,
        | "reps"
        | "weight_value"
        | "weight_unit"
        | "rpe"
        | "rir"
        | "rest_sec"
        | "duration_sec"
        | "distance_value"
        | "distance_unit"
        | "calories"
        | "notes"
        | "is_complete"
      >
    >
  ) => {
    if (!canEdit) return;

    const { error } = await supabase.from("workout_set").update(patch).eq("id", setId);
    if (error) throw error;
    await load();
  };

  const deleteSet = async (setId: string) => {
    if (!canEdit) return;

    const { error } = await supabase.from("workout_set").delete().eq("id", setId);
    if (error) throw error;
    await load();
  };

  const addModifier = async (workoutExerciseId: string, modifierId: string) => {
    if (!canEdit) return;

    const { error } = await supabase.from("workout_exercise_modifier").insert({
      workout_exercise_id: workoutExerciseId,
      modifier_id: modifierId,
    } satisfies WorkoutExerciseModifierRow);

    if (error) throw error;
    await load();
  };

  const removeModifier = async (workoutExerciseId: string, modifierId: string) => {
    if (!canEdit) return;

    const { error } = await supabase
      .from("workout_exercise_modifier")
      .delete()
      .eq("workout_exercise_id", workoutExerciseId)
      .eq("modifier_id", modifierId);

    if (error) throw error;
    await load();
  };

  // ---------- UI ----------

  if (!workout) {
    return (
      <Screen>
        <Text style={typography.title}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={typography.title}>{canEdit ? "Edit workout" : "View workout"}</Text>
        {!canEdit && <Text style={typography.hint}>Read-only</Text>}
      </View>

      <Text style={typography.label}>Name</Text>
      <TextField value={editingName} onChangeText={setEditingName} placeholder="Upper A" editable={canEdit} />

      <Text style={typography.label}>Notes</Text>
      <TextField value={editingNotes} onChangeText={setEditingNotes} placeholder="Optional notes" editable={canEdit} />

      {canEdit && (
        <>
          <Button title="Save" onPress={saveWorkoutMeta} disabled={loading || !canSave} />
          <Button
            title={workout.is_complete ? "Mark incomplete" : "Mark complete"}
            onPress={toggleComplete}
            disabled={loading}
            variant="secondary"
          />
          <Button title="Delete workout" onPress={deleteWorkout} disabled={loading} variant="secondary" />
        </>
      )}

      <Text style={[typography.label, { marginTop: 18 }]}>Exercises</Text>

      {canEdit && (
        <View style={{ marginBottom: 10 }}>
          <Text style={typography.hint}>Tap an exercise to add it:</Text>
          <View style={{ maxHeight: 140 }}>
            {allExercises.slice(0, 10).map((ex) => (
              <Pressable key={ex.id} onPress={() => addExerciseToWorkout(ex.id)} style={{ paddingVertical: 6 }}>
                <Text style={typography.body}>+ Add: {ex.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {exercises.map((we) => {
        const sets = setsByExercise[we.id] ?? [];
        const mods = modsByExercise[we.id] ?? [];

        return (
          <View key={we.id} style={{ marginTop: 16, paddingVertical: 10 }}>
            <Text style={[typography.body, { fontWeight: "700" }]}>
              {we.exercise?.name ?? "Exercise"}
            </Text>

            {canEdit && (
              <Pressable onPress={() => removeWorkoutExercise(we.id)} style={{ paddingVertical: 4 }}>
                <Text style={typography.hint}>Remove exercise</Text>
              </Pressable>
            )}

            {mods.length > 0 && (
              <Text style={typography.hint}>
                Modifiers: {mods.map((m, idx) => `${m.name}${idx < mods.length - 1 ? ", " : ""}`).join("")}
              </Text>
            )}

            {canEdit && (
              <View style={{ marginTop: 6 }}>
                <Text style={typography.hint}>Add/remove modifier:</Text>
                {allModifiers.slice(0, 5).map((m) => {
                  const already = mods.some((x) => x.id === m.id);
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => (already ? removeModifier(we.id, m.id) : addModifier(we.id, m.id))}
                      style={{ paddingVertical: 4 }}
                    >
                      <Text style={typography.body}>
                        {already ? "− " : "+ "}
                        {m.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={{ marginTop: 8 }}>
              {canEdit && (
                <Pressable onPress={() => addSet(we.id)} style={{ paddingVertical: 6 }}>
                  <Text style={typography.body}>+ Add set</Text>
                </Pressable>
              )}

              {sets.length === 0 && <Text style={typography.hint}>No sets yet.</Text>}

              {sets.map((s) => (
                <View key={s.id} style={{ marginTop: 10 }}>
                  <Text style={typography.hint}>Set {s.set_index + 1}</Text>

                  <Text style={typography.label}>Reps</Text>
                  <TextField
                    value={s.reps?.toString() ?? ""}
                    onChangeText={(t) => updateSetField(s.id, { reps: t ? Number(t) : null })}
                    placeholder="8"
                    keyboardType="number-pad"
                    editable={canEdit}
                  />

                  <Text style={typography.label}>Weight</Text>
                  <TextField
                    value={s.weight_value?.toString() ?? ""}
                    onChangeText={(t) => updateSetField(s.id, { weight_value: t ? Number(t) : null })}
                    placeholder="225"
                    keyboardType="decimal-pad"
                    editable={canEdit}
                  />

                  <Text style={typography.label}>RPE</Text>
                  <TextField
                    value={s.rpe?.toString() ?? ""}
                    onChangeText={(t) => updateSetField(s.id, { rpe: t ? Number(t) : null })}
                    placeholder="8.5"
                    keyboardType="decimal-pad"
                    editable={canEdit}
                  />

                  {canEdit ? (
                    <>
                      <Button
                        title={s.is_complete ? "Uncomplete set" : "Complete set"}
                        onPress={() => updateSetField(s.id, { is_complete: !s.is_complete })}
                        variant="secondary"
                      />
                      <Button title="Delete set" onPress={() => deleteSet(s.id)} variant="secondary" />
                    </>
                  ) : (
                    <Text style={typography.hint}>{s.is_complete ? "Completed" : "Not completed"}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
