import type { Employee } from "../../org-setup/api";

type AuditorMultiSelectProps = {
  label: string;
  employees: Employee[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabledIds?: string[];
  error?: string;
  emptyMessage?: string;
};

export function AuditorMultiSelect({
  label,
  employees,
  selectedIds,
  onToggle,
  disabledIds = [],
  error,
  emptyMessage = "No active employees available.",
}: AuditorMultiSelectProps) {
  const disabled = new Set(disabledIds);

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      <div
        className={
          "max-h-56 overflow-y-auto rounded-lg border bg-white " +
          (error ? "border-[var(--danger)]" : "border-[var(--border)]")
        }
      >
        {employees.length === 0 ? (
          <p className="px-3 py-4 text-sm text-[var(--muted)]">{emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {employees.map((employee) => {
              const isDisabled = disabled.has(employee.id);
              const isChecked = isDisabled || selectedIds.includes(employee.id);
              return (
                <li key={employee.id}>
                  <label
                    className={
                      "flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-[var(--surface)] " +
                      (isDisabled ? "cursor-not-allowed opacity-60" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-[var(--border)]"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => onToggle(employee.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--ink)]">
                        {employee.name}
                        {isDisabled ? (
                          <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                            Already assigned
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {employee.email}
                        {employee.department ? ` · ${employee.department.name}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
