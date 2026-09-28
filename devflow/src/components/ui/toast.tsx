"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 4500);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;
  return (
    <div
      className="bg-background fixed top-20 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg sm:right-6"
      role="status"
    >
      <CheckCircle2
        aria-hidden="true"
        className="text-success size-4 shrink-0"
      />
      <p>{message}</p>
      <button
        aria-label="Dismiss notification"
        className="text-muted-foreground hover:bg-accent -mr-2 grid size-8 shrink-0 place-items-center rounded"
        onClick={() => setVisible(false)}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
