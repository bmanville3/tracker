import { colors, radius, spacing } from '@/src/theme';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'revert';
}) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isPrimary ? styles.primary : isSecondary ? styles.secondary : styles.revert,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.textBase, isPrimary ? styles.textPrimary : isSecondary ? styles.textSecondary : styles.textPrimary]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface, // important: looks like a real button
    borderWidth: 1,
    borderColor: colors.border,
  },
  revert: {
    backgroundColor: colors.revert,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textBase: {
    fontSize: 16,
    fontWeight: '700',
  },
  textPrimary: {
    color: colors.textOnPrimary, // white text on blue
  },
  textSecondary: {
    color: colors.textPrimary, // dark text on light button
  },
  disabled: {
    opacity: 0.6,
  },
});
