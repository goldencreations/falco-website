"use client";

import Link from "next/link";
import {
 type ComponentProps,
 createContext,
 type MouseEvent,
 type ReactNode,
 forwardRef,
 useContext,
} from "react";

export type NavigationTransitionContextValue = {
 activePath: string;
 pendingPath: string | null;
 startNavigation: (href: string, event?: MouseEvent<HTMLElement>) => void;
};

export const NavigationTransitionContext =
 createContext<NavigationTransitionContextValue | null>(null);

export function useNavigationTransition() {
 const context = useContext(NavigationTransitionContext);
 if (!context) {
 throw new Error("useNavigationTransition must be used within NavigationTransitionContext.");
 }
 return context;
}

/** Same as `useNavigationTransition` but returns null outside the shell (e.g. manager layout). */
export function useOptionalNavigationTransition() {
 return useContext(NavigationTransitionContext);
}

type NavigationLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
 href: string;
 children: ReactNode;
};

export const NavigationLink = forwardRef<HTMLAnchorElement, NavigationLinkProps>(
 function NavigationLink({ href, onClick, children, ...props }, ref) {
 const { startNavigation } = useNavigationTransition();
 return (
 <Link
 ref={ref}
 href={href}
 onClick={(event) => {
 onClick?.(event);
 startNavigation(href, event);
 }}
 {...props}
 >
 {children}
 </Link>
 );
 }
);
