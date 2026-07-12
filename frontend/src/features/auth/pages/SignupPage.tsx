import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { getErrorMessage } from "../../../lib/utils";
import { useAuthStore } from "../../../stores/authStore";
import { authApi } from "../api";
import { AuthShell } from "./AuthShell";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});
type SignupValues = z.infer<typeof schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ confirmPassword: _, ...values }) => {
    setFormError(null);
    try {
      await authApi.signup(values);
      const session = await authApi.login({ email: values.email, password: values.password });
      setSession(session.token, session.user);
      navigate("/app", { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error, "We could not create your account."));
    }
  });

  return (
    <AuthShell
      title="Create your account"
      description="New accounts start as Employees. An admin can assign additional responsibilities later."
      footer={<>Already have an account? <Link className="font-medium text-[var(--primary)] underline-offset-4 hover:underline" to="/login">Sign in</Link></>}
    >
      <form className="grid gap-5" onSubmit={onSubmit} noValidate>
        {formError ? <div role="alert" className="rounded-lg bg-[var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--danger)]">{formError}</div> : null}
        <Field label="Full name" autoComplete="name" placeholder="Your full name" error={errors.name?.message} {...register("name")} />
        <Field label="Work email" type="email" autoComplete="email" placeholder="you@organization.com" error={errors.email?.message} {...register("email")} />
        <Field label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" hint="Use 8 or more characters." error={errors.password?.message} {...register("password")} />
        <Field label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <Button type="submit" className="mt-1 min-h-11 w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthShell>
  );
}
