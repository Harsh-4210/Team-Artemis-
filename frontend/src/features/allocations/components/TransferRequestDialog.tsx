import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "../../../components/shared/Modal";
import { Button } from "../../../components/ui/Button";
import { Field, SelectField } from "../../../components/ui/Field";

const schema = z.object({
  fromEmployeeId: z.string().min(1),
  toEmployeeId: z.string().min(1),
  reason: z.string().trim().min(5, "Add a short reason.").max(500),
});

type FormValues = z.infer<typeof schema>;

export function TransferRequestDialog({
  open,
  currentHolderName,
  defaultFromEmployeeId,
  defaultToEmployeeId,
  assetLabel,
  employeeOptions,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  assetLabel: string;
  currentHolderName: string;
  defaultFromEmployeeId: string;
  defaultToEmployeeId: string;
  employeeOptions: Array<{ id: string; name: string }>;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromEmployeeId: defaultFromEmployeeId,
      toEmployeeId: defaultToEmployeeId,
      reason: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        fromEmployeeId: defaultFromEmployeeId,
        toEmployeeId: defaultToEmployeeId,
        reason: "",
      });
    }
  }, [defaultFromEmployeeId, defaultToEmployeeId, form, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request transfer"
      description={`${assetLabel} is currently held by ${currentHolderName}.`}
    >
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <SelectField
          label="Current holder"
          error={form.formState.errors.fromEmployeeId?.message}
          {...form.register("fromEmployeeId")}
        >
          <option value="">Choose current holder</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Transfer to"
          error={form.formState.errors.toEmployeeId?.message}
          {...form.register("toEmployeeId")}
        >
          <option value="">Choose recipient</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="Reason"
          placeholder="Why should the asset be transferred?"
          error={form.formState.errors.reason?.message}
          {...form.register("reason")}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Send request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
