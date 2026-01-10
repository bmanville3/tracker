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
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

export type ClosableModalProps = ModalProps & {
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: ScrollViewProps;
};

export function ClosableModal({
  children,
  sheetStyle,
  scrollViewProps,
  ...modalProps
}: ClosableModalProps) {
  const {
    style: scrollViewStyle,
    contentContainerStyle,
    ...rest
  } = scrollViewProps ?? {};
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
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={[styles.modalCard, sheetStyle]}>
            <ScrollView
              contentContainerStyle={[
                { paddingBottom: spacing.lg },
                contentContainerStyle,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={scrollViewStyle}
              {...rest}
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
