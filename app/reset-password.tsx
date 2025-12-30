import { Button, Screen, TextField } from "@/src/components";
import { supabase } from "@/src/supabase";
import { typography } from "@/src/theme";
import { showAlert } from "@/src/utils";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setIsReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsReady(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSetPassword = async () => {
    if (!newPassword || !confirm) {
      showAlert("Missing info", "Enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirm) {
      showAlert("Mismatch", "Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        showAlert("Update failed", error.message);
        return;
      }

      showAlert("Success", "Your password has been updated.");
      router.replace("/");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={typography.title}>Reset password</Text>

      {!isReady ? (
        <Text style={[typography.hint, { textAlign: "center", marginTop: 12 }]}>
          Open the password reset link from your email to continue.
        </Text>
      ) : (
        <View>
          <Text style={typography.label}>New password</Text>
          <TextField
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
          />

          <Text style={typography.label}>Confirm new password</Text>
          <TextField
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
          />

          <Button
            title={isLoading ? "Updating…" : "Update password"}
            onPress={onSetPassword}
            disabled={isLoading}
            variant="primary"
          />
        </View>
      )}
    </Screen>
  );
}
