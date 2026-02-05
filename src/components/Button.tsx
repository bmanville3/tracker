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

  const variantStyle = isPrimary
    ? styles.primary
    : isSecondary
      ? styles.secondary
      : styles.revert;

  const variantTextStyle = isPrimary
    ? styles.textPrimary
    : isSecondary
      ? styles.textSecondary
      : styles.textPrimary;

  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        rest.disabled && styles.disabled,
        pressed && !rest.disabled && styles.pressed,
        style,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.textBase,
            variantTextStyle,
            pressed && !rest.disabled && styles.textPressed,
            textStyle,
          ]}
          {...textRest}
        >
          {title}
        </Text>
      )}
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
  primary: { backgroundColor: colors.primary },
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

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  textPressed: {
    opacity: 0.95,
  },

  textBase: { fontSize: 16, fontWeight: "700" },
  textPrimary: { color: colors.textOnPrimary },
  textSecondary: { color: colors.textPrimary },

  disabled: { opacity: 0.6 },
});
