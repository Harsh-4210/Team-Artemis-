import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import {
  ErrorState,
  PageSkeleton,
} from "../../../components/shared/Feedback";
import { Modal } from "../../../components/shared/Modal";
import { PageHeader } from "../../../components/shared/PageHeader";
import { AutocompleteField } from "../../../components/ui/AutocompleteField";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { getErrorMessage } from "../../../lib/utils";
import { orgApi, orgQueryKeys } from "../../org-setup/api";
import { assetsApi, assetsQueryKeys } from "../../assets/api";
import {
  allocationsApi,
  allocationsQueryKeys,
  type AllocationConflictDetails,
} from "../api";
import { TransferRequestDialog } from "../components/TransferRequestDialog";

const schema = z.object({
  assetId: z.string().min(1, "Choose an asset."),
  employeeId: z.string().min(1, "Choose an employee."),
  expectedReturnDate: z.string().optional(),
  notes: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AllocationCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [conflict, setConflict] = useState<AllocationConflictDetails | null>(
    null,
  );
  const [transferPrefill, setTransferPrefill] = useState<{
    assetId: string;
    fromEmployeeId: string;
    toEmployeeId: string;
    currentHolder: string;
  } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const initialAssetId = searchParams.get("assetId") ?? "";
  const initialHolderId = searchParams.get("holderId") ?? "";

  const assetsQuery = useQuery({
    queryKey: assetsQueryKeys.list({ limit: 100 }),
    queryFn: () => assetsApi.listAssets({ limit: 100 }),
  });
  const employeesQuery = useQuery({
    queryKey: orgQueryKeys.employees,
    queryFn: () => orgApi.listEmployees({ status: "ACTIVE" }),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      assetId: initialAssetId,
      employeeId: "",
      expectedReturnDate: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: allocationsApi.createAllocation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: allocationsQueryKeys.all,
      });
      await queryClient.invalidateQueries({ queryKey: assetsQueryKeys.all });
      toast.success("Asset allocated");
      navigate("/app/allocations");
    },
    onError: (error) => {
      const details = (
        error as {
          response?: {
            status?: number;
            data?: { error?: { details?: AllocationConflictDetails } };
          };
        }
      )?.response;
      if (details?.status === 409) {
        const payload = details.data?.error?.details ?? null;
        if (payload) {
          setConflict(payload);
          return;
        }
      }
      toast.error(getErrorMessage(error, "Allocation could not be created."));
    },
  });

  const transferMutation = useMutation({
    mutationFn: allocationsApi.requestTransfer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: allocationsQueryKeys.all,
      });
      toast.success("Transfer request sent — the current holder was notified");
      setTransferOpen(false);
      setConflict(null);
      navigate("/app/transfers");
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, "Transfer request could not be sent."),
      ),
  });

  const assets = assetsQuery.data?.items ?? [];
  const employees = employeesQuery.data ?? [];
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === form.watch("assetId")),
    [assets, form],
  );

  const submitAllocation = form.handleSubmit((values) =>
    createMutation.mutate({
      assetId: values.assetId,
      employeeId: values.employeeId,
      expectedReturnDate: values.expectedReturnDate || undefined,
      notes: values.notes || undefined,
    }),
  );

  const submitTransfer = (values: {
    fromEmployeeId: string;
    toEmployeeId: string;
    reason: string;
  }) => {
    if (!transferPrefill?.assetId) return;
    transferMutation.mutate({
      assetId: transferPrefill.assetId,
      fromEmployeeId: values.fromEmployeeId,
      toEmployeeId: values.toEmployeeId,
      reason: values.reason,
    });
  };

  if (assetsQuery.isLoading || employeesQuery.isLoading)
    return <PageSkeleton />;
  if (assetsQuery.isError)
    return (
      <ErrorState
        message={getErrorMessage(
          assetsQuery.error,
          "Assets could not be loaded.",
        )}
        onRetry={() => void assetsQuery.refetch()}
      />
    );
  if (employeesQuery.isError)
    return (
      <ErrorState
        message={getErrorMessage(
          employeesQuery.error,
          "Employees could not be loaded.",
        )}
        onRetry={() => void employeesQuery.refetch()}
      />
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="New allocation"
        description="Allocate an available asset to an employee and set the expected return date."
        actions={
          <Button variant="secondary" onClick={() => navigate("/app/allocations")}>
            <ArrowLeft
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
            Back
          </Button>
        }
      />

      <form
        className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2"
        onSubmit={submitAllocation}
        noValidate
      >
        <AutocompleteField
          label="Asset"
          placeholder="Search by tag or name"
          error={form.formState.errors.assetId?.message}
          value={form.watch("assetId")}
          onChange={(value) =>
            form.setValue("assetId", value, { shouldValidate: true })
          }
          options={assets.map((asset) => ({
            value: asset.id,
            label: `${asset.assetTag} · ${asset.name}`,
            description: `${asset.status} · ${asset.location}`,
          }))}
        />
        <AutocompleteField
          label="Employee"
          placeholder="Search by employee name"
          error={form.formState.errors.employeeId?.message}
          value={form.watch("employeeId")}
          onChange={(value) =>
            form.setValue("employeeId", value, { shouldValidate: true })
          }
          options={employees.map((employee) => ({
            value: employee.id,
            label: employee.name,
            description: employee.email,
          }))}
        />
        <Field
          label="Expected return date"
          type="date"
          error={form.formState.errors.expectedReturnDate?.message}
          {...form.register("expectedReturnDate")}
        />
        <Field
          label="Notes"
          placeholder="Optional allocation notes"
          error={form.formState.errors.notes?.message}
          {...form.register("notes")}
        />
        {selectedAsset ? (
          <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
            Selected asset:{" "}
            <span className="font-medium text-[var(--ink)]">
              {selectedAsset.assetTag}
            </span>{" "}
            · {selectedAsset.name}
          </div>
        ) : null}
        <div className="md:col-span-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/app/allocations")}
          >
            Cancel
          </Button>
          <Button type="submit" loading={createMutation.isPending}>
            Allocate asset
          </Button>
        </div>
      </form>

      <Modal
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        title={
          conflict?.currentHolder
            ? `Currently held by ${conflict.currentHolder} — Request Transfer?`
            : "Asset already allocated"
        }
        description="This asset cannot be allocated twice. Request a transfer to move custody."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-4 text-sm text-[var(--ink)]">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={1.75}
            />
            <span>
              Open a transfer request so the current holder is notified and an
              asset manager can approve the move.
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConflict(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (!conflict) return;
                setTransferPrefill({
                  assetId: conflict.assetId ?? "",
                  fromEmployeeId: conflict.currentHolderId ?? initialHolderId,
                  toEmployeeId: form.getValues("employeeId"),
                  currentHolder: conflict.currentHolder ?? "the current holder",
                });
                setConflict(null);
                setTransferOpen(true);
              }}
            >
              Request Transfer
            </Button>
          </div>
        </div>
      </Modal>

      <TransferRequestDialog
        open={transferOpen}
        currentHolderName={
          transferPrefill?.currentHolder ??
          conflict?.currentHolder ??
          "the current holder"
        }
        defaultFromEmployeeId={
          transferPrefill?.fromEmployeeId ??
          conflict?.currentHolderId ??
          initialHolderId
        }
        defaultToEmployeeId={
          transferPrefill?.toEmployeeId ?? form.getValues("employeeId")
        }
        assetLabel={
          selectedAsset
            ? `${selectedAsset.assetTag} · ${selectedAsset.name}`
            : "Selected asset"
        }
        employeeOptions={employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
        }))}
        loading={transferMutation.isPending}
        onClose={() => {
          setTransferOpen(false);
          setTransferPrefill(null);
        }}
        onSubmit={submitTransfer}
      />
    </div>
  );
}
