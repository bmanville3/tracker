import { colors, radius } from "@/src/theme";
import { StyleSheet, TextInput } from "react-native";

export function TextField(props: React.ComponentProps<typeof TextInput>) {
  const style = props.style;
  return (
    <TextInput
      {...props}
      placeholderTextColor={
        props.placeholderTextColor ?? colors.placeholderTextColor
      }
      style={[styles.input, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
    color: colors.textPrimary,
  },
});
