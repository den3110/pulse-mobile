import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

// ─── Dark palette ───
export const DarkColors = {
  primary: "#6366f1",
  primaryLight: "#818cf8",
  primaryDark: "#4f46e5",
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
};

// ─── Light palette ───
export const LightColors = {
  primary: "#6366f1",
  primaryLight: "#818cf8",
  primaryDark: "#4f46e5",
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
};

export type AppColors = typeof DarkColors;

// Default export for backward compatibility (dark)
export const Colors = DarkColors;

// ─── Paper themes ───
export const darkPaperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: DarkColors.primary,
    secondary: DarkColors.accent,
    background: DarkColors.background,
    surface: DarkColors.surface,
    surfaceVariant: DarkColors.surface, // prevent yellow input fill
    surfaceDisabled: DarkColors.surfaceVariant,
    error: DarkColors.error,
    onPrimary: "#ffffff",
    onBackground: DarkColors.text,
    onSurface: DarkColors.text,
    onSurfaceVariant: DarkColors.textSecondary,
    onSurfaceDisabled: DarkColors.textSecondary,
    outline: DarkColors.border,
    outlineVariant: DarkColors.border,
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: "transparent",
      level1: DarkColors.surface,
      level2: DarkColors.surfaceVariant,
      level3: DarkColors.card,
    },
  },
};

export const lightPaperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: LightColors.primary,
    secondary: LightColors.accent,
    background: LightColors.background,
    surface: LightColors.surface,
    surfaceVariant: LightColors.surface, // prevent yellow input fill
    surfaceDisabled: LightColors.surfaceVariant,
    error: LightColors.error,
    onPrimary: "#ffffff",
    onBackground: LightColors.text,
    onSurface: LightColors.text,
    onSurfaceVariant: LightColors.textSecondary,
    onSurfaceDisabled: LightColors.textSecondary,
    outline: LightColors.border,
    outlineVariant: LightColors.border,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: "transparent",
      level1: LightColors.surface,
      level2: LightColors.surfaceVariant,
      level3: LightColors.card,
    },
  },
};

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

export const statusColor = (status: string) => {
  switch (status) {
    case "running":
    case "online":
    case "success":
      return "#22c55e";
    case "stopped":
    case "failed":
    case "offline":
      return "#ef4444";
    case "deploying":
    case "building":
    case "cloning":
    case "installing":
    case "starting":
      return "#f59e0b";
    default:
      return "#9e9bb3";
  }
};
