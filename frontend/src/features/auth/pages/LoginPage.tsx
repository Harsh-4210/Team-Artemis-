import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { getErrorMessage } from "../../../lib/utils";
import { useAuthStore } from "../../../stores/authStore";
import { authApi } from "../api";
import { AuthShell } from "./AuthShell";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof schema>;

const demoAccounts = [
  { label: "Admin", email: "admin@artemis.com" },
  { label: "Asset Manager", email: "sarah-manager@artemis.com" },
  { label: "Department Head", email: "raj-head@artemis.com" },
  { label: "Employee", email: "priya-employee@artemis.com" },
] as const;

const demoPassword = "demo1234";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@artemis.com", password: "" },
  });

  const signIn = async (values: LoginValues) => {
    setFormError(null);
    try {
      const session = await authApi.login(values);
      setSession(session.token, session.user);
      const destination = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error, "Email or password is incorrect."));
    }
  };

  const onSubmit = handleSubmit(signIn);

  const signInAsDemo = async (account: (typeof demoAccounts)[number]) => {
    setActiveDemo(account.email);
    try {
      await signIn({ email: account.email, password: demoPassword });
    } finally {
      setActiveDemo(null);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to view assets, bookings, and pending work."
      footer={<>New to AssetFlow? <Link className="font-medium text-[var(--primary)] underline-offset-4 hover:underline" to="/signup">Create an account</Link></>}
    >
      <form className="grid gap-5" onSubmit={onSubmit} noValidate>
        {formError ? <div role="alert" className="rounded-lg bg-[var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--danger)]">{formError}</div> : null}
        <Field label="Email address" type="email" autoComplete="email" placeholder="you@organization.com" error={errors.email?.message} {...register("email")} />
        <Field label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" error={errors.password?.message} {...register("password")} />
        <Button type="submit" className="mt-1 min-h-11 w-full" loading={isSubmitting}>Sign in</Button>
      </form>
      <div className="relative my-7 flex items-center" aria-hidden="true">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="px-4 text-sm font-medium text-[var(--muted)]">Demo accounts</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Demo accounts">
        {demoAccounts.map((account) => (
          <Button
            key={account.email}
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            loading={activeDemo === account.email}
            disabled={Boolean(activeDemo) || isSubmitting}
            onClick={() => void signInAsDemo(account)}
          >
            {account.label}
          </Button>
        ))}
      </div>
    </AuthShell>
  );
}
