import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Field, SelectField } from "../../../components/ui/Field";
import type { Department, Employee } from "../../org-setup/api";
import type { CreateAuditCyclePayload } from "../api";
import { AuditorMultiSelect } from "./AuditorMultiSelect";

const schema = z
  .object({
    name: z.string().trim().min(3, "Name must be at least 3 characters.").max(200),
    scopeDepartmentId: z.string().optional(),
    scopeLocation: z.string().trim().max(200).optional(),
    startDate: z.string().min(1, "Choose a start date."),
    endDate: z.string().min(1, "Choose an end date."),
  })
  .refine((input) => new Date(input.endDate).getTime() > new Date(input.startDate).getTime(), {
    message: "End date must be after start date.",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  name: "",
  scopeDepartmentId: "",
  scopeLocation: "",
  startDate: "",
  endDate: "",
};

type Props = {
  open: boolean;
  onClose: () => void;
  departments: Department[];
  employees: Employee[];
  submitting: boolean;
  onSubmit: (values: { payload: CreateAuditCyclePayload; auditorIds: string[] }) => void | Promise<unknown>;
};

export function CreateCycleDialog({ open, onClose, departments, employees, submitting, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [auditorIds, setAuditorIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      reset(defaults);
      setAuditorIds([]);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, reset]);

  const toggleAuditor = (id: string) => {
    setAuditorIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      payload: {
        name: values.name.trim(),
        scopeDepartmentId: values.scopeDepartmentId || undefined,
        scopeLocation: values.scopeLocation?.trim() || undefined,
        startDate: values.startDate,
        endDate: values.endDate,
      },
      auditorIds,
    });
  });

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      className="m-auto w-[calc(100%-40px)] max-w-2xl rounded-xl border border-[var(--border)] bg-white p-0 text-[var(--ink)] shadow-[0_8px_24px_color-mix(in_oklch,var(--ink)_12%,transparent)] backdrop:bg-[color-mix(in_oklch,var(--ink)_36%,transparent)]"
    >
      <form onSubmit={submit} className="flex max-h-[85vh] flex-col gap-5 overflow-y-auto p-6" noValidate>
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Create audit cycle</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Leave scope fields blank to audit every active asset in the organization.
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

        <div className="grid gap-4">
          <Field label="Cycle name" placeholder="Engineering Q3 Audit" error={errors.name?.message} {...register("name")} />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Scope: department (optional)" error={errors.scopeDepartmentId?.message} {...register("scopeDepartmentId")}>
              <option value="">No department scope</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </SelectField>
            <Field
              label="Scope: location (optional)"
              placeholder="IT Storage · 3F"
              error={errors.scopeLocation?.message}
              {...register("scopeLocation")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" type="date" error={errors.startDate?.message} {...register("startDate")} />
            <Field label="End date" type="date" error={errors.endDate?.message} {...register("endDate")} />
          </div>

          <AuditorMultiSelect
            label="Assign auditors (optional — you can also add them later)"
            employees={employees}
            selectedIds={auditorIds}
            onToggle={toggleAuditor}
          />
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create audit cycle
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
