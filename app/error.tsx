"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 useEffect(() => {
 console.error(error);
 }, [error]);

 return (
 <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
 <h1 className="text-xl font-semibold">Something went wrong</h1>
 <p className="max-w-md text-sm text-muted-foreground">
 The page failed to load. Try again, or refresh if you just updated the site.
 </p>
 <div className="flex flex-wrap justify-center gap-2">
 <Button type="button" onClick={() => reset()}>
 Try again
 </Button>
 <Button type="button" variant="outline" onClick={() => window.location.reload()}>
 Refresh page
 </Button>
 </div>
 </main>
 );
}
