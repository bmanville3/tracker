import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";

export function ErrorBanner({ errorText }: { errorText: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{errorText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: "#581818ff",
    borderWidth: 1,
    borderColor: "crimson",
    margin: spacing.md,
  },
  errorText: {
    ...typography.hint,
    color: colors.revert,
  },
});
