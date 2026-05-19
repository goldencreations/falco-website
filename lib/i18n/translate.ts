import type { AppLanguage } from "@/lib/preferences";
import { MESSAGES, type MessageKey } from "@/lib/i18n/messages";

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
 const parts = path.split(".");
 let cur: unknown = obj;
 for (const part of parts) {
 if (!cur || typeof cur !== "object" || !(part in (cur as Record<string, unknown>))) {
 return undefined;
 }
 cur = (cur as Record<string, unknown>)[part];
 }
 return typeof cur === "string" ? cur : undefined;
}

/** Resolve a message key with optional `{param}` interpolation. Falls back to English then the key. */
export function translate(
 language: AppLanguage,
 key: MessageKey | string,
 params?: Record<string, string | number>
): string {
 const en = MESSAGES.en as Record<string, unknown>;
 const loc = MESSAGES[language] as Record<string, unknown>;
 let text = getNested(loc, key) ?? getNested(en, key) ?? key;

 if (params) {
 for (const [k, v] of Object.entries(params)) {
 text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
 }
 }
 return text;
}
