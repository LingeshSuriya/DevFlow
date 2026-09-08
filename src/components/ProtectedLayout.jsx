import { Navigate, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";

export default function ProtectedLayout() {
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading, orgs } = useOrg();

  if (authLoading || (user && orgLoading)) {
    return <div className="h-screen w-full bg-zinc-950 flex items-center justify-center text-sm text-zinc-500">Loading...</div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 font-sans">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {orgs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-zinc-500">
            You're not part of any organization yet — this shouldn't normally happen since signup creates one.
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
