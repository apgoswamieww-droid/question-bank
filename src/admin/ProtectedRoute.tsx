import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/useAdminAuth";

export default function ProtectedRoute() {
  const { user, isBootstrapping } = useAdminAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}