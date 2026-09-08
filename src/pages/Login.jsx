import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Github } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("arjun@devflow.dev");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") ? "GitHub sign-in failed. Try again." : null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="devflow-team">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <ErrorBanner text={error} />}
        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        <button type="submit" disabled={submitting} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-medium py-2 rounded-md transition-colors">
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-[11px] text-zinc-600">or</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <a href={api.githubLoginUrl()} className="w-full flex items-center justify-center gap-2 border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-200 py-2 rounded-md transition-colors">
        <Github size={16} /> Continue with GitHub
      </a>

      <p className="text-xs text-zinc-500 text-center mt-4">
        No account? <Link to="/register" className="text-emerald-400 hover:underline">Sign up</Link>
      </p>
      <p className="text-[11px] text-zinc-600 text-center mt-2">Seeded login: arjun@devflow.dev / password123</p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="h-screen w-full bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="font-mono text-lg text-emerald-400">devflow</span>
          <div className="text-sm text-zinc-500 mt-1">{title} — {subtitle}</div>
        </div>
        <div className="border border-zinc-800 bg-zinc-900 rounded-lg p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required
        className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
    </label>
  );
}

export function ErrorBanner({ text }) {
  return <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{text}</div>;
}
