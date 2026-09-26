"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDialogButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<string | null>;
  destructive?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  async function confirm() {
    setIsSubmitting(true);
    setError(null);
    try {
      const message = await onConfirm();
      if (message) {
        setError(message);
        return;
      }
      setIsOpen(false);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button" variant={destructive ? "destructive" : "outline"}>
        {triggerLabel}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
        onCancel={(event) => {
          event.preventDefault();
          setIsOpen(false);
        }}
        onClose={() => setIsOpen(false)}
        ref={dialogRef}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold" id={titleId}>{title}</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
          {error ? <p className="text-destructive mt-4 text-sm" role="alert">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button disabled={isSubmitting} onClick={() => setIsOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button disabled={isSubmitting} onClick={confirm} type="button" variant="destructive">
              {isSubmitting ? "Working…" : confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
