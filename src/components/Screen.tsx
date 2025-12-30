import { colors, spacing } from "@/src/theme";
import React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

export function Screen({
  children,
  center = true,
}: {
  children?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoider}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={styles.container}
        onStartShouldSetResponderCapture={() => {
          Keyboard.dismiss();
          return false;
        }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            center && styles.centerContent,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  centerContent: {
    justifyContent: "center",
  },
});
