import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      loginWithToken(token);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login?error=github_no_token", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen w-full bg-zinc-950 flex items-center justify-center text-sm text-zinc-500">
      Signing you in...
    </div>
  );
}
