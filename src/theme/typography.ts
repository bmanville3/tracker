import { colors } from "./colors";

export const typography = {
  title: {
    fontSize: 30,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
  section: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
  subsection: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
  label: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  body: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
};
