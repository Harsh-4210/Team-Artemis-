import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "../../../components/shared/Modal";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/ui/Field";
import type { Allocation } from "../api";

const schema = z.object({
  conditionOnReturn: z.enum(["NEW", "GOOD", "FAIR", "POOR"]),
  notes: z.string().trim().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

export function ReturnAllocationDialog({
  open,
  allocation,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  allocation: Allocation | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { conditionOnReturn: "GOOD", notes: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ conditionOnReturn: "GOOD", notes: "" });
    }
  }, [form, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        allocation ? `Return ${allocation.asset.assetTag}` : "Return allocation"
      }
      description={
        allocation
          ? `${allocation.asset.name} is currently allocated to ${allocation.employee.name}.`
          : undefined
      }
    >
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <SelectField
          label="Condition on return"
          error={form.formState.errors.conditionOnReturn?.message}
          {...form.register("conditionOnReturn")}
        >
          <option value="NEW">New</option>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="POOR">Poor</option>
        </SelectField>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-[var(--ink)]">Notes</span>
          <textarea
            rows={4}
            className="min-h-28 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            placeholder="Optional return notes"
            {...form.register("notes")}
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Return allocation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
