export type ThemeMode = "light" | "dark" | "system";
export type AppLanguage = "en" | "sw";

export const THEME_STORAGE_KEY = "falco.settings.theme";
export const LANGUAGE_STORAGE_KEY = "falco.settings.language";

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "en" || value === "sw";
}
