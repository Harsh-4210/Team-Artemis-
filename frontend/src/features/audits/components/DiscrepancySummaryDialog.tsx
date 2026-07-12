import { Link } from "react-router";

import { Modal } from "../../../components/shared/Modal";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import type { AuditCloseResponse } from "../api";

type Props = {
  open: boolean;
  result: AuditCloseResponse | null;
  onClose: () => void;
};

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export function DiscrepancySummaryDialog({ open, result, onClose }: Props) {
  if (!result) {
    return <Modal open={open} title="Audit cycle closed" onClose={onClose}><p /></Modal>;
  }

  const { summary, missingAssets, damagedAssets, cycle } = result;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`"${cycle.name}" closed`}
      description="Missing assets were flipped to Lost. Damaged assets each received a new high-priority maintenance request."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Verified" value={summary.verified} tone="text-[color-mix(in_oklch,var(--success)_60%,black)]" />
          <StatCard label="Missing" value={summary.missing} tone="text-[var(--danger)]" />
          <StatCard label="Damaged" value={summary.damaged} tone="text-[color-mix(in_oklch,var(--warning)_68%,black)]" />
          <StatCard label="Unverified" value={summary.pending} tone="text-[var(--muted)]" />
        </div>

        {missingAssets.length > 0 ? (
          <section>
            <h3 className="text-sm font-semibold text-[var(--ink)]">
              Missing assets — now <Badge tone="danger">Lost</Badge>
            </h3>
            <ul className="mt-2 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {missingAssets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <Link to={`/assets/${asset.id}`} className="min-w-0 truncate font-medium text-[var(--ink)] hover:underline">
                    {asset.name}
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-[var(--muted)]">{asset.assetTag}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {damagedAssets.length > 0 ? (
          <section>
            <h3 className="text-sm font-semibold text-[var(--ink)]">
              Damaged assets — new <Badge tone="warning">high-priority maintenance request</Badge>
            </h3>
            <ul className="mt-2 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {damagedAssets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <Link to={`/assets/${asset.id}`} className="min-w-0 truncate font-medium text-[var(--ink)] hover:underline">
                    {asset.name}
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-[var(--muted)]">{asset.assetTag}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {summary.pending > 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {summary.pending} record{summary.pending === 1 ? "" : "s"} stayed Pending — no one recorded a result
            before the cycle closed, so no asset status changed for those.
          </p>
        ) : null}

        <div className="flex justify-end border-t border-[var(--border)] pt-4">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
