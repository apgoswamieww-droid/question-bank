import { useCallback, useEffect, useState } from "react";
import { Plus, Globe } from "lucide-react";
import { api, ApiError, type Language } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { TableSkeleton } from "./components/Skeleton";

const fields: MasterField[] = [
  { key: "code", label: "Language Code", placeholder: "e.g. en, gu, hi", required: true },
  { key: "name", label: "Language Name", placeholder: "e.g. English", required: true },
  { key: "native_name", label: "Native Name", placeholder: "e.g. ગુજરાતી" },
];

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.languages.list();
      setLanguages(res.languages);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load languages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    await api.languages.create(data as { code: string; name: string; native_name?: string });
    await load();
  };

  const columns: DataTableColumn<Language>[] = [
    {
      key: "name",
      header: "Language",
      sortValue: (l) => l.name,
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
            <Globe className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <span className="font-medium text-slate-900">{l.name}</span>
            {l.native_name && <span className="ml-2 text-xs text-slate-400">{l.native_name}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortValue: (l) => l.code,
      render: (l) => (
        <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">{l.code}</code>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Languages"
        subtitle="Manage question languages"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Add Language
          </Button>
        }
      />

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={2} />
      ) : (
        <DataTable
          columns={columns}
          data={languages}
          rowKey={(l) => l.id}
          searchPlaceholder="Search languages…"
          emptyIcon={<Globe className="h-6 w-6" aria-hidden />}
          emptyTitle="No languages"
          emptyDescription="Add a language to get started."
          emptyAction={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add Language
            </Button>
          }
          initialSortedColumn="name"
        />
      )}

      <MasterDataModal
        open={modalOpen}
        title="Add Language"
        fields={fields}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
