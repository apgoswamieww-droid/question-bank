import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { api, ApiError, type Permission, type UserRole } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { ROLE_META, ROLE_ORDER } from "./components/roleMeta";
import { useCan } from "../context/useAdminAuth";
import { TableSkeleton } from "./components/Skeleton";

export function RolesPermissionsPage() {
  const can = useCan();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.admin
      .listPermissions()
      .then((res) => {
        if (cancelled) return;
        setPermissions(res.permissions);
        setMatrix(res.matrix);
        setDraft(res.matrix);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load permissions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = useCallback(() => setDraft(matrix), [matrix]);

  const isDirty = useMemo(
    () => ROLE_ORDER.some((r) => {
      const a = (draft[r] ?? []).slice().sort();
      const b = (matrix[r] ?? []).slice().sort();
      return JSON.stringify(a) !== JSON.stringify(b);
    }),
    [draft, matrix]
  );

  const toggle = (role: UserRole, code: string) => {
    setDraft((prev) => {
      const current = prev[role] ?? [];
      const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
      return { ...prev, [role]: next };
    });
  };

  const saveRole = async (role: UserRole) => {
    setSavingRole(role);
    setMessage(null);
    setError(null);
    try {
      // super_admin always keeps full access server-side; still reflect locally.
      const perms = role === "super_admin" ? permissions.map((p) => p.code) : draft[role] ?? [];
      const res = await api.admin.setRolePermissions(role, perms);
      setMatrix((prev) => ({ ...prev, [role]: res.permissions }));
      setDraft((prev) => ({ ...prev, [role]: res.permissions }));
      setMessage(`Permissions saved for ${ROLE_META[role].label}.`);
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save permissions.");
    } finally {
      setSavingRole(null);
    }
  };

  if (loading) {
    return <TableSkeleton rows={4} cols={7} />;
  }

  if (!can("roles.manage")) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        You do not have permission to manage roles.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Control what each role can view and manage across the platform"
        actions={
          isDirty ? (
            <Button variant="secondary" onClick={reset}>
              Discard changes
            </Button>
          ) : undefined
        }
      />

      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                {permissions.map((p) => (
                  <th key={p.code} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span title={p.description}>{p.label}</span>
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ROLE_ORDER.map((role) => (
                <tr key={role} className="hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${ROLE_META[role].chip}`}>
                        <ShieldCheck className="h-4 w-4" aria-hidden />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{ROLE_META[role].label}</p>
                        {role === "super_admin" && (
                          <p className="text-xs text-slate-500">Always has full access</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {permissions.map((p) => (
                    <td key={p.code} className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={(draft[role] ?? []).includes(p.code)}
                        disabled={role === "super_admin"}
                        onChange={() => toggle(role, p.code)}
                        aria-label={`${ROLE_META[role].label}: ${p.label}`}
                        className="h-4 w-4 rounded border-slate-300 text-primary accent-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={role === "super_admin" || !dirtyFor(role, draft, matrix)}
                      loading={savingRole === role}
                      onClick={() => saveRole(role)}
                    >
                      <Save className="h-4 w-4" aria-hidden /> Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function dirtyFor(role: UserRole, draft: Record<string, string[]>, matrix: Record<string, string[]>) {
  const a = (draft[role] ?? []).slice().sort();
  const b = (matrix[role] ?? []).slice().sort();
  return JSON.stringify(a) !== JSON.stringify(b);
}
