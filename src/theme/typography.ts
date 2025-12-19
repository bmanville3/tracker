import { colors } from './colors';

export const typography = {
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    textAlign: 'center' as const,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  body: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
  },
};
