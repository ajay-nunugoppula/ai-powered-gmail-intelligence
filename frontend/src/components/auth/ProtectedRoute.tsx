import { Navigate, Outlet } from "react-router-dom";

import { DashboardLoader } from "@/components/common/DashboardLoader";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <DashboardLoader message="Signing you in…" />;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
