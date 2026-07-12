import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "../../lib/utils";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      className={cn(
        "m-auto w-[calc(100%-40px)] max-w-3xl rounded-2xl border border-[var(--border)] bg-white p-0 text-[var(--ink)] shadow-[0_18px_50px_color-mix(in_oklch,var(--ink)_15%,transparent)] backdrop:bg-[color-mix(in_oklch,var(--ink)_34%,transparent)]",
        className,
      )}
    >
      <div className="border-b border-[var(--border)] px-6 py-5">
        <h2 className="text-lg font-semibold text-[var(--ink)]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}
