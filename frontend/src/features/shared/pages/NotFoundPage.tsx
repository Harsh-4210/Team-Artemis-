import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--surface)] px-5">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-[var(--primary)]">404</p>
        <h1 className="mt-2 text-[28px] font-semibold text-[var(--ink)]">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">The page may have moved, or you may not have access to it.</p>
        <Link className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] active:translate-y-px" to="/app">Return to dashboard</Link>
      </div>
    </main>
  );
}
