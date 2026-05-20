"use client";

import type { ReactNode } from "react";
import { ClientChunkRecovery } from "@/components/client-chunk-recovery";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
 return (
 <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
 <LanguageProvider>
 <ClientChunkRecovery />
 {children}
 </LanguageProvider>
 </ThemeProvider>
 );
}
