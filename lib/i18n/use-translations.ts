"use client";

import { useCallback } from "react";
import { useLanguage } from "@/components/language-provider";
import { translate } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages";

export function useTranslations() {
 const { language } = useLanguage();

 const t = useCallback(
 (key: MessageKey | string, params?: Record<string, string | number>) =>
 translate(language, key, params),
 [language]
 );

 return { t, language };
}
