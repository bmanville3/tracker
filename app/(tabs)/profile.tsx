import { Button, RadioRow, Screen, TextField } from "@/src/components";
import { DistanceUnit, WeightUnit } from "@/src/enums";
import { supabase } from "@/src/supabase";
import { typography } from "@/src/theme";
import { showAlert } from "@/src/utils";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function Profile() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lb");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("yd");

  const [initial, setInitial] = useState<{
    displayName: string;
    weightUnit: WeightUnit;
    distanceUnit: DistanceUnit;
  } | null>(null);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return (
      displayName !== initial.displayName ||
      weightUnit !== initial.weightUnit ||
      distanceUnit !== initial.distanceUnit
    );
  }, [displayName, weightUnit, distanceUnit, initial]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          router.replace("/");
          return;
        }

        const { data: profile, error } = await supabase
          .from("user_profile")
          .select("*")
          .eq("user_id", userData.user.id)
          .single();

        if (error) {
          showAlert("Error", error.message);
          return;
        }

        setDisplayName(profile.display_name ?? "");
        setWeightUnit(profile.default_weight_unit);
        setDistanceUnit(profile.default_distance_unit);

        setInitial({
          displayName: profile.display_name ?? "",
          weightUnit: profile.default_weight_unit,
          distanceUnit: profile.default_distance_unit,
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const clearChanges = () => {
    if (!initial) {
      return;
    }
    setDisplayName(initial.displayName);
    setDistanceUnit(initial.distanceUnit);
    setWeightUnit(initial.weightUnit);
  }

  const onSave = async () => {
    const dn = displayName.trim();
    if (!dn) {
      showAlert("Missing info", "Display name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from("user_profile")
        .update({
          display_name: dn,
          default_weight_unit: weightUnit,
          default_distance_unit: distanceUnit,
        })
        .eq("user_id", userData.user.id);

      if (error) {
        showAlert("Save failed", error.message);
        return;
      }

      setInitial({
        displayName: dn,
        weightUnit,
        distanceUnit,
      });

      showAlert("Saved", "Profile updated.");
    } finally {
      setIsSaving(false);
    }
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <Screen>
      <Text style={typography.title}>Profile</Text>

      <Text style={typography.label}>Display Name</Text>
      <TextField
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="John Doe"
      />

      <Text style={typography.label}>Default Weight Unit</Text>
      <RadioRow
        label="Pounds (lb)"
        selected={weightUnit === "lb"}
        onPress={() => setWeightUnit("lb")}
      />
      <RadioRow
        label="Kilograms (kg)"
        selected={weightUnit === "kg"}
        onPress={() => setWeightUnit("kg")}
      />

      <Text style={typography.label}>Default Distance Unit</Text>
      {(["ft", "yd", "mi", "m", "km"] as const).map((u) => (
        <RadioRow
          key={u}
          label={
            u === "ft"
              ? "Feet (ft)"
              : u === "yd"
              ? "Yards (yd)"
              : u === "mi"
              ? "Miles (mi)"
              : u === "m"
              ? "Meters (m)"
              : "Kilometers (km)"
          }
          selected={distanceUnit === u}
          onPress={() => setDistanceUnit(u)}
        />
      ))}

      {isDirty && initial && <TouchableOpacity
        style={{ marginTop: 16, marginBottom: -20 }}
        onPress={clearChanges}
        disabled={isLoading}
      >
        <Text style={{ color: '#9aa0a6', fontWeight: '600' }}>
          Revert Changes
        </Text>
      </TouchableOpacity>}

      <View style={{ marginTop: 16 }}>
        <Button
          title={isSaving ? "Saving..." : "Save changes"}
          onPress={onSave}
          disabled={!isDirty || isSaving}
        />
      </View>

      <View style={{ marginTop: -4 }}>
        <Button title="Log out" onPress={onLogout} variant="revert" />
      </View>
    </Screen>
  );
}
