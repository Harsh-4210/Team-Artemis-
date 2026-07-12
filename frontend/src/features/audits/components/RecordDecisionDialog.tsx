import { AlertTriangle, CheckCircle2, HelpCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import type { AuditRecord, AuditRecordStatus } from "../api";
import { recordStatusLabel, recordStatusTone } from "../utils";

type Mode = Extract<AuditRecordStatus, "VERIFIED" | "MISSING" | "DAMAGED">;

const modeCopy: Record<
  Mode,
  { title: string; description: string; icon: typeof CheckCircle2; iconClass: string; confirmVariant: "primary" | "danger" }
> = {
  VERIFIED: {
    title: "Mark Verified",
    description: "This asset was physically located and matches expectations.",
    icon: CheckCircle2,
    iconClass: "text-[color-mix(in_oklch,var(--success)_60%,black)]",
    confirmVariant: "primary",
  },
  MISSING: {
    title: "Mark Missing",
    description: "When the cycle closes, this asset's status will change to Lost.",
    icon: HelpCircle,
    iconClass: "text-[var(--danger)]",
    confirmVariant: "danger",
  },
  DAMAGED: {
    title: "Mark Damaged",
    description: "When the cycle closes, a high-priority maintenance request will be created automatically.",
    icon: AlertTriangle,
    iconClass: "text-[color-mix(in_oklch,var(--warning)_68%,black)]",
    confirmVariant: "danger",
  },
};

type Props = {
  open: boolean;
  mode: Mode;
  record: AuditRecord | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: { status: Mode; notes?: string }) => void;
};

export function RecordDecisionDialog({ open, mode, record, submitting, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setNotes("");
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, mode]);

  const copy = modeCopy[mode];
  const Icon = copy.icon;

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      className="m-auto w-[calc(100%-40px)] max-w-lg rounded-xl border border-[var(--border)] bg-white p-0 text-[var(--ink)] shadow-[0_8px_24px_color-mix(in_oklch,var(--ink)_12%,transparent)] backdrop:bg-[color-mix(in_oklch,var(--ink)_36%,transparent)]"
    >
      <div className="flex flex-col gap-5 p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Icon aria-hidden="true" className={`mt-0.5 size-6 shrink-0 ${copy.iconClass}`} strokeWidth={1.75} />
            <div>
              <h2 className="text-xl font-semibold">{copy.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{copy.description}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-strong)]"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
        </header>

        {record ? (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-mono text-[var(--muted)]">{record.asset.assetTag}</p>
              <Badge tone={recordStatusTone[record.status]}>{recordStatusLabel[record.status]}</Badge>
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{record.asset.name}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{record.asset.location}</p>
          </section>
        ) : null}

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="record-notes">
            Notes (optional)
          </label>
          <textarea
            id="record-notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus-visible:border-[var(--primary)]"
            placeholder="What did you observe?"
          />
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={copy.confirmVariant}
            loading={submitting}
            onClick={() => onConfirm({ status: mode, notes: notes.trim() || undefined })}
          >
            {copy.title}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
