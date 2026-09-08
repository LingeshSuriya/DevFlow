import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Github } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { AuthShell, Field, ErrorBanner } from "./Login";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, name, orgName);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="new organization">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <ErrorBanner text={error} />}
        <Field label="Full name" value={name} onChange={setName} />
        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        <Field label="Organization name" value={orgName} onChange={setOrgName} />
        <p className="text-[11px] text-zinc-600">
          You become <span className="text-emerald-400">Owner</span> of this new org. You can join other orgs later if someone invites you by email.
        </p>
        <button type="submit" disabled={submitting} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-medium py-2 rounded-md transition-colors">
          {submitting ? "Creating account..." : "Create account"}
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
      <p className="text-[11px] text-zinc-600 text-center mt-2">GitHub signups also get their own new org automatically.</p>

      <p className="text-xs text-zinc-500 text-center mt-4">
        Already have an account? <Link to="/login" className="text-emerald-400 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
