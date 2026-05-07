export type AppLanguage = "en" | "sw";

export const LANGUAGE_STORAGE_KEY = "falco.settings.language";

export function isAppLanguage(value: string | null): value is AppLanguage {
 return value === "en" || value === "sw";
}
