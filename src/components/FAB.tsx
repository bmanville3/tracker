import { colors, spacing } from "@/src/theme";
import { Pressable, PressableProps, Text } from "react-native";

export default function FAB(props: PressableProps) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.fabText}>+</Text>
    </Pressable>
  );
}

const styles = {
  fab: {
    position: "absolute" as const,
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fabText: {
    color: colors.surface,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "900" as const,
    marginTop: -2,
  },
};
