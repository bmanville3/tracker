import { colors, radius } from '@/src/theme';
import { StyleSheet, TextInput } from 'react-native';

export function TextField(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput
        {...props}
        style={[styles.input, props.style]}
        placeholderTextColor={props.placeholderTextColor ?? colors.placeholderTextColor}
    />;
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
});
