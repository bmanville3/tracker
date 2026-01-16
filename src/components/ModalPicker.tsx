import { colors, spacing, typography } from "@/src/theme";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import { ClosableModal } from "./ClosableModal";

export type ModalPickerOption<T> = {
  value: T;
  label: string;
  description?: string;
};

export type ModalPickerProps<T> = {
  /** Title shown inside the modal (optional) */
  title?: string;

  /** Help message shown inside the modal (optional) */
  help?: string;

  options: ModalPickerOption<T>[];

  /** Currently selected value */
  value: T | null;

  /** Called when the user chooses a value */
  onChange: (value: T) => void;

  /** Placeholder when nothing is selected */
  placeholder?: string;

  textProps?: TextProps;

  disabled?: boolean;

  pressableProps?: Omit<PressableProps, "style" | "disabled"> & {
    style?: StyleProp<ViewStyle>;
  };
};

export function ModalPicker<T>({
  title,
  help,
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  textProps,
  pressableProps,
}: ModalPickerProps<T>) {
  const [visible, setVisible] = useState(false);
  const { style: textStyle, ...textRest } = textProps ?? {};
  const { style: pressStyle, ...pressRest } = pressableProps ?? {};

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  );

  return (
    <>
      {/* This is the "dropdown" field the user taps */}
      <Pressable
        style={[styles.field, pressStyle]}
        onPress={() => setVisible(true)}
        disabled={disabled}
        {...pressRest}
      >
        <Text
          style={[
            typography.body,
            !selectedOption && { color: colors.textSecondary },
            textStyle,
          ]}
          {...textRest}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
      </Pressable>

      {/* Your existing modal with the options list */}
      <ClosableModal visible={visible} onRequestClose={() => setVisible(false)}>
        {/* Header */}
        <View style={{ position: "relative", paddingRight: 28 }}>
          {title && (
            <Text
              style={[
                typography.title,
                { marginBottom: help ? spacing.xs : spacing.md },
              ]}
            >
              {title}
            </Text>
          )}

          <Feather
            name="x"
            size={22}
            onPress={() => setVisible(false)}
            style={{ position: "absolute", right: 0, top: 0 }}
          />
        </View>
        {help && (
          <Text style={[typography.hint, { marginBottom: spacing.md }]}>
            {help}
          </Text>
        )}

        {/* Options */}
        <View style={styles.list}>
          {options.map((opt, idx) => {
            const selected = value === opt.value;
            return (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => {
                  onChange(opt.value);
                  setVisible(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.body,
                      selected && { fontWeight: "600" },
                      textStyle,
                    ]}
                    {...textRest}
                  >
                    {opt.label}
                  </Text>
                  {opt.description ? (
                    <Text style={[typography.hint, { marginTop: 2 }]}>
                      {opt.description}
                    </Text>
                  ) : null}
                </View>

                {selected && (
                  <Text style={[typography.hint, { marginLeft: spacing.sm }]}>
                    ✓
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ClosableModal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  list: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  rowSelected: {
    backgroundColor: colors.surfaceAlt,
  },
  rowPressed: {
    opacity: 0.7,
  },
});
