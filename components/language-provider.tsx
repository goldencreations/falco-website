"use client";

import {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useMemo,
 useState,
 type ReactNode,
} from "react";
import {
 type AppLanguage,
 isAppLanguage,
 LANGUAGE_STORAGE_KEY,
} from "@/lib/preferences";
import { parseProfileResponse } from "@/lib/settings-adapters";

export const LANGUAGE_CHANGE_EVENT = "falco-language-change";

type LanguageContextValue = {
 language: AppLanguage;
 setLanguage: (language: AppLanguage) => void;
 ready: boolean;
 refreshFromServer: () => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyLanguageToDom(language: AppLanguage) {
 if (typeof window === "undefined") return;
 localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
 document.documentElement.setAttribute("lang", language === "sw" ? "sw" : "en");
 window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: language }));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
 const [language, setLanguageState] = useState<AppLanguage>("en");
 const [ready, setReady] = useState(false);

 const setLanguage = useCallback((next: AppLanguage) => {
 setLanguageState(next);
 applyLanguageToDom(next);
 }, []);

 const refreshFromServer = useCallback(async () => {
 try {
 const sessionRes = await fetch("/api/session", { credentials: "include" });
 if (!sessionRes.ok) return;
 const res = await fetch("/api/settings/profile", { credentials: "include" });
 if (!res.ok) return;
 const json = (await res.json().catch(() => ({}))) as unknown;
 const { preferences } = parseProfileResponse(json);
 setLanguage(preferences.language);
 } catch {
 /* keep current */
 }
 }, [setLanguage]);

 useEffect(() => {
 const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
 if (isAppLanguage(saved)) {
 setLanguageState(saved);
 document.documentElement.setAttribute("lang", saved === "sw" ? "sw" : "en");
 }
 setReady(true);
 const path = window.location.pathname;
 if (path === "/" || path === "/login") return;
 void refreshFromServer();
 }, [refreshFromServer]);

 const value = useMemo(
 () => ({ language, setLanguage, ready, refreshFromServer }),
 [language, setLanguage, ready, refreshFromServer]
 );

 return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
 const ctx = useContext(LanguageContext);
 if (!ctx) {
 throw new Error("useLanguage must be used within LanguageProvider");
 }
 return ctx;
}

export function useOptionalLanguage(): LanguageContextValue | null {
 return useContext(LanguageContext);
}
