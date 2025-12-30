import { colors, spacing } from "@/src/theme";
import React from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

type ClosableModalProps = ModalProps & {
  children: React.ReactNode;
};

export function ClosableModal({ children, ...modalProps }: ClosableModalProps) {
  return (
    <Modal transparent animationType="fade" {...modalProps}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={modalProps.onRequestClose}
        />

        {/* Sheet/Card */}
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    maxHeight: Dimensions.get("window").height * 0.8,
  },
});
