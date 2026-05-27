import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { ErrorAlert } from "../components/ErrorAlert";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export function LoginPage() {
  const { isAuthenticated, initializing, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: { email: "", password: "" },
  });

  if (!initializing && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values) => {
    setServerError("");
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        setError(issue.path[0], { message: issue.message });
      });
      return;
    }

    try {
      setSubmitting(true);
      await login(parsed.data.email, parsed.data.password);
      const destination = location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    } catch (error) {
      setServerError(error.message || "Login failed. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-slate-100 px-4 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)] lg:px-10">
      <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Civic Engagement Platform</p>
          <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Policy feedback, organized for action.</h1>
          <p className="mt-5 text-lg leading-8 text-teal-50">
            Sign in as a planner or admin to manage policies, review public sentiment, and keep participation workflows moving.
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
        <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-8">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">CP</span>
            <h2 className="mt-5 text-2xl font-bold text-slate-950">Login</h2>
            <p className="mt-1 text-sm text-slate-600">Use your planner or admin account.</p>
          </div>

          <ErrorAlert message={serverError} />

          <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email ? <span className="mt-1 block text-xs font-semibold text-rose-600">{errors.email.message}</span> : null}
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password ? (
                <span className="mt-1 block text-xs font-semibold text-rose-600">{errors.password.message}</span>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Login"}
            </button>

            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-teal-700 hover:text-teal-800"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
