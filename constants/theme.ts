import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

// ─── Dark palette ───
export const getDarkColors = (primary: string = "#6366f1") => ({
  primary: primary,
  primaryLight: primary + "99", // Simple opacity/manipulation or we can use a library if needed, but for now string manip is risky without a library. Let's assume input is hex.
  // Ideally we should generate shades, but to keep it simple we'll just use the primary.
  // For proper color manipulation we might need 'color' package, but let's stick to what we have.
  // We'll trust the user to provide a good color or just use it as is.
  primaryDark: primary,
  accent: "#8b5cf6",
  background: "#0f0d23",
  surface: "#1a1833",
  surfaceVariant: "#252340",
  card: "#1e1c36",
  text: "#f1f0f5",
  textSecondary: "#9e9bb3",
  border: "rgba(255,255,255,0.08)",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
});

// ─── Light palette ───
export const getLightColors = (primary: string = "#6366f1") => ({
  primary: primary,
  primaryLight: primary,
  primaryDark: primary,
  accent: "#8b5cf6",
  background: "#f5f5f7",
  surface: "#ffffff",
  surfaceVariant: "#f0eef6",
  card: "#ffffff",
  text: "#1a1a2e",
  textSecondary: "#6b6b80",
  border: "rgba(0,0,0,0.08)",
  success: "#16a34a",
  error: "#dc2626",
  warning: "#d97706",
  info: "#2563eb",
});

export const DarkColors = getDarkColors();
export const LightColors = getLightColors();

export type AppColors = ReturnType<typeof getDarkColors>;

// Default export for backward compatibility (dark)
export const Colors = DarkColors;

// ─── Paper themes ───
export const getPaperTheme = (isDark: boolean, primary: string) => {
  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;
  const colors = isDark ? getDarkColors(primary) : getLightColors(primary);

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      secondary: colors.accent,
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.surface, // prevent yellow input fill
      surfaceDisabled: colors.surfaceVariant,
      error: colors.error,
      onPrimary: "#ffffff",
      onBackground: colors.text,
      onSurface: colors.text,
      onSurfaceVariant: colors.textSecondary,
      onSurfaceDisabled: colors.textSecondary,
      outline: colors.border,
      outlineVariant: colors.border,
      elevation: {
        ...baseTheme.colors.elevation,
        level0: "transparent",
        level1: colors.surface,
        level2: colors.surfaceVariant,
        level3: colors.card,
      },
    },
  };
};

export const darkPaperTheme = getPaperTheme(true, "#6366f1");
export const lightPaperTheme = getPaperTheme(false, "#6366f1");

// Keep backward compat
export const appTheme = darkPaperTheme;

// inputTheme override for TextInput components
export const makeInputTheme = (colors: AppColors) => ({
  colors: {
    onSurfaceVariant: colors.textSecondary,
    surfaceVariant: colors.surface,
    background: colors.surface,
    onSurface: colors.text,
    surface: colors.surface,
    primary: colors.primary,
    outline: colors.border,
  },
});

export const inputTheme = makeInputTheme(DarkColors);

export const statusColor = (status: string, colors?: AppColors) => {
  switch (status) {
    case "running":
    case "online":
    case "success":
      return colors?.success || "#22c55e";
    case "stopped":
    case "failed":
    case "offline":
      return colors?.error || "#ef4444";
    case "deploying":
    case "building":
    case "cloning":
    case "installing":
    case "starting":
      return colors?.warning || "#f59e0b";
    default:
      return colors?.textSecondary || "#9e9bb3";
  }
};
