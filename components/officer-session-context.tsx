"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/auth";

const OfficerSessionContext = createContext<SessionUser | null>(null);

export function OfficerSessionProvider({
 user,
 children,
}: {
 user: SessionUser;
 children: React.ReactNode;
}) {
 return (
 <OfficerSessionContext.Provider value={user}>{children}</OfficerSessionContext.Provider>
 );
}

/** Server-hydrated loan officer session (available on first paint). */
export function useOfficerSession(): SessionUser {
 const user = useContext(OfficerSessionContext);
 if (!user) {
 throw new Error("useOfficerSession must be used within OfficerSessionProvider");
 }
 return user;
}

/** Same as `useOfficerSession` but returns null outside the officer portal. */
export function useOptionalOfficerSession(): SessionUser | null {
 return useContext(OfficerSessionContext);
}
