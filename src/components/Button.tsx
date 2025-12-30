import { colors, radius } from "@/src/theme";
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  ViewStyle,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "revert";

type ButtonProps = Omit<PressableProps, "style"> & {
  title: string;
  variant?: ButtonVariant;
  /** Extra props to pass to the inner Text (including style) */
  textProps?: TextProps;
  /** Optional style for the outer Pressable */
  style?: StyleProp<ViewStyle>;
};

export function Button(props: ButtonProps) {
  const { title, variant = "primary", style, textProps, ...rest } = props;
  const { style: textStyle, ...textRest } = textProps ?? {};
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";

  return (
    <Pressable
      style={[
        styles.base,
        isPrimary
          ? styles.primary
          : isSecondary
            ? styles.secondary
            : styles.revert,
        rest.disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.textBase,
          isPrimary
            ? styles.textPrimary
            : isSecondary
              ? styles.textSecondary
              : styles.textPrimary,
          textStyle,
        ]}
        {...textRest}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 14,
    borderRadius: radius.md,
    alignItems: "center",
    margin: 2,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  revert: {
    backgroundColor: colors.revert,
    borderColor: colors.border,
    borderWidth: 1,
  },
  textBase: {
    fontSize: 16,
    fontWeight: "700",
  },
  textPrimary: {
    color: colors.textOnPrimary,
  },
  textSecondary: {
    color: colors.textPrimary,
  },
  disabled: {
    opacity: 0.6,
  },
});
