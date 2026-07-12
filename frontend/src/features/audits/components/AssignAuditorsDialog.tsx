import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../../../components/ui/Button";
import type { Employee } from "../../org-setup/api";
import { AuditorMultiSelect } from "./AuditorMultiSelect";

type Props = {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  alreadyAssignedIds: string[];
  submitting: boolean;
  onSubmit: (auditorIds: string[]) => void | Promise<unknown>;
};

export function AssignAuditorsDialog({ open, onClose, employees, alreadyAssignedIds, submitting, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setSelected([]);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const newSelections = selected.filter((id) => !alreadyAssignedIds.includes(id));

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      className="m-auto w-[calc(100%-40px)] max-w-lg rounded-xl border border-[var(--border)] bg-white p-0 text-[var(--ink)] shadow-[0_8px_24px_color-mix(in_oklch,var(--ink)_12%,transparent)] backdrop:bg-[color-mix(in_oklch,var(--ink)_36%,transparent)]"
    >
      <div className="flex flex-col gap-5 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Assign auditors</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Already-assigned auditors are shown checked and can't be removed here.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-strong)]"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
        </header>

        <AuditorMultiSelect
          label="Employees"
          employees={employees}
          selectedIds={selected}
          onToggle={toggle}
          disabledIds={alreadyAssignedIds}
        />

        <footer className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            disabled={newSelections.length === 0}
            onClick={() => onSubmit(newSelections)}
          >
            Assign {newSelections.length > 0 ? `(${newSelections.length})` : ""}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
