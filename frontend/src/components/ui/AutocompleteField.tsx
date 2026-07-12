import { useId, useMemo, useState } from "react";

import { cn } from "../../lib/utils";

export type AutocompleteOption = {
  value: string;
  label: string;
  description?: string;
};

type AutocompleteFieldProps = {
  label: string;
  error?: string;
  placeholder?: string;
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  emptyMessage?: string;
};

export function AutocompleteField({
  label,
  error,
  placeholder = "Type to search…",
  options,
  value,
  onChange,
  emptyMessage = "No matches.",
}: AutocompleteFieldProps) {
  const id = useId();
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options.slice(0, 12);
    return options
      .filter(
        (option) =>
          option.label.toLowerCase().includes(needle) ||
          option.description?.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [options, query]);

  return (
    <div className="relative grid gap-2">
      <label className="text-sm font-medium text-[var(--ink)]" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-autocomplete="list"
        aria-expanded={open}
        className={cn(
          "min-h-11 w-full rounded-lg border bg-white px-3 text-sm text-[var(--ink)]",
          error ? "border-[var(--danger)]" : "border-[var(--border)]",
        )}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          if (selected) setQuery(selected.label);
        }}
      />
      {open ? (
        <ul className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-sm">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--muted)]">
              {emptyMessage}
            </li>
          ) : (
            filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[var(--surface)]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setQuery(option.label);
                    setOpen(false);
                  }}
                >
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="text-xs text-[var(--muted)]">
                      {option.description}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
