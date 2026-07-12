import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  FolderClosed,
  PlusCircle,
  RefreshCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Modal } from "../../../components/shared/Modal";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "../../../components/shared/Feedback";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Field, SelectField } from "../../../components/ui/Field";
import { getErrorMessage } from "../../../lib/utils";
import { orgApi, orgQueryKeys } from "../../org-setup/api";
import {
  AssetCondition,
  assetsApi,
  assetsQueryKeys,
  type AssetListFilters,
  type AssetStatus,
} from "../api";
import {
  assetStatusLabel,
  assetStatusTone,
  formatCurrency,
  formatDate,
} from "../utils";

const assetSchema = z.object({
  name: z.string().trim().min(2, "Enter an asset name."),
  categoryId: z.string().min(1, "Choose a category."),
  serialNumber: z.string().trim().optional(),
  acquisitionDate: z.string().min(1, "Choose an acquisition date."),
  acquisitionCost: z.coerce.number().positive("Enter a positive cost."),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR"]),
  location: z.string().trim().min(2, "Enter a location."),
  photoUrl: z.string().trim().optional(),
  isBookable: z.boolean().optional(),
});

type AssetFormValues = z.infer<typeof assetSchema>;

const statusFilters: Array<{ value: "ALL" | AssetStatus; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "AVAILABLE", label: "Available" },
  { value: "ALLOCATED", label: "Allocated" },
  { value: "UNDER_MAINTENANCE", label: "Maintenance" },
  { value: "LOST", label: "Lost" },
  { value: "RETIRED", label: "Retired" },
  { value: "DISPOSED", label: "Disposed" },
];

export function AssetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | AssetStatus>("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [location, setLocation] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);

  const filters = useMemo<AssetListFilters>(
    () => ({
      search: search.trim() || undefined,
      status: status === "ALL" ? undefined : status,
      categoryId: categoryId === "ALL" ? undefined : categoryId,
      departmentId: departmentId === "ALL" ? undefined : departmentId,
      location: location.trim() || undefined,
      limit: 50,
    }),
    [search, status, categoryId, departmentId, location],
  );

  const assetsQuery = useQuery({
    queryKey: assetsQueryKeys.list(filters),
    queryFn: () => assetsApi.listAssets(filters),
  });
  const categoriesQuery = useQuery({
    queryKey: orgQueryKeys.categories,
    queryFn: orgApi.listCategories,
    staleTime: 60_000,
  });
  const departmentsQuery = useQuery({
    queryKey: orgQueryKeys.departments,
    queryFn: orgApi.listDepartments,
    staleTime: 60_000,
  });

  const assetForm = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      serialNumber: "",
      acquisitionDate: new Date().toISOString().slice(0, 10),
      acquisitionCost: 0,
      condition: "GOOD",
      location: "",
      photoUrl: "",
      isBookable: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: assetsApi.createAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assetsQueryKeys.all });
      toast.success("Asset registered");
      setRegisterOpen(false);
      setPhotoFileName(null);
      assetForm.reset();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Asset could not be registered.")),
  });

  const assets = assetsQuery.data?.items ?? [];
  const categories = categoriesQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];

  const submitAsset = assetForm.handleSubmit((values) =>
    createMutation.mutate({
      name: values.name,
      categoryId: values.categoryId,
      serialNumber: values.serialNumber?.trim() || undefined,
      acquisitionDate: values.acquisitionDate,
      acquisitionCost: values.acquisitionCost,
      condition: values.condition as AssetCondition,
      location: values.location,
      photoUrl: values.photoUrl?.trim() || undefined,
      isBookable: values.isBookable,
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Register assets, inspect custody, and keep allocation state consistent across the team."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void assetsQuery.refetch()}
            >
              <RefreshCcw
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/allocations/new")}
            >
              <ArrowRightLeft
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Allocate
            </Button>
            <Button onClick={() => setRegisterOpen(true)}>
              <PlusCircle
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Register asset
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Filters</h2>
          <Field
            label="Search"
            placeholder="Tag, name, or serial"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "ALL" | AssetStatus)
            }
          >
            {statusFilters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="ALL">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Department"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="ALL">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </SelectField>
          <Field
            label="Location"
            placeholder="Floor, building…"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </aside>

        <div>
          {assetsQuery.isLoading ? (
            <PageSkeleton />
          ) : assetsQuery.isError ? (
            <ErrorState
              message={getErrorMessage(
                assetsQuery.error,
                "Assets could not be loaded.",
              )}
              onRetry={() => void assetsQuery.refetch()}
            />
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)]">
              <EmptyState
                title="No assets yet"
                description="Register the first asset to start tracking custody and allocation state."
                icon={FolderClosed}
                action={
                  <Button onClick={() => setRegisterOpen(true)}>
                    Register asset
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[var(--surface)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Holder</th>
                    <th className="px-4 py-3">Acquired</th>
                    <th className="px-4 py-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface)]"
                      onClick={() => navigate(`/assets/${asset.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--ink)]">
                          {asset.name}
                        </div>
                        <div className="font-mono text-xs text-[var(--muted)]">
                          {asset.assetTag}
                          {asset.serialNumber
                            ? ` · ${asset.serialNumber}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {asset.category?.name ?? "Uncategorized"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={assetStatusTone(asset.status)}>
                          {assetStatusLabel(asset.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {asset.location}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {asset.currentHolder?.name ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {formatDate(asset.acquisitionDate)}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--muted)]">
                        {formatCurrency(asset.acquisitionCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={registerOpen}
        onClose={() => {
          setRegisterOpen(false);
          setPhotoFileName(null);
        }}
        title="Register asset"
        description="Add a new asset with the fields required for allocation and reporting."
      >
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={submitAsset}
          noValidate
        >
          <Field
            label="Asset name"
            placeholder="ThinkPad T14"
            error={assetForm.formState.errors.name?.message}
            {...assetForm.register("name")}
          />
          <SelectField
            label="Category"
            error={assetForm.formState.errors.categoryId?.message}
            {...assetForm.register("categoryId")}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <Field
            label="Serial number"
            placeholder="SN-12345"
            error={assetForm.formState.errors.serialNumber?.message}
            {...assetForm.register("serialNumber")}
          />
          <Field
            label="Acquisition date"
            type="date"
            error={assetForm.formState.errors.acquisitionDate?.message}
            {...assetForm.register("acquisitionDate")}
          />
          <Field
            label="Acquisition cost"
            type="number"
            step="0.01"
            min="0"
            error={assetForm.formState.errors.acquisitionCost?.message}
            {...assetForm.register("acquisitionCost", { valueAsNumber: true })}
          />
          <SelectField
            label="Condition"
            error={assetForm.formState.errors.condition?.message}
            {...assetForm.register("condition")}
          >
            <option value="NEW">New</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="POOR">Poor</option>
          </SelectField>
          <Field
            label="Location"
            placeholder="HQ - Floor 3"
            error={assetForm.formState.errors.location?.message}
            {...assetForm.register("location")}
          />
          <div className="grid gap-2">
            <label className="text-sm font-medium text-[var(--ink)]">
              Photo
            </label>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-strong)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--ink)]"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  setPhotoFileName(null);
                  assetForm.setValue("photoUrl", "");
                  return;
                }
                setPhotoFileName(file.name);
                assetForm.setValue("photoUrl", `stub://${file.name}`);
              }}
            />
            <p className="text-sm text-[var(--muted)]">
              File upload stub — stores a placeholder path until Phase 4
              storage. {photoFileName ? `Selected: ${photoFileName}` : null}
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--ink)] md:col-span-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              {...assetForm.register("isBookable")}
            />
            Mark this asset as bookable for shared reservations
          </label>
          <div className="md:col-span-2 flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRegisterOpen(false);
                setPhotoFileName(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Register asset
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
