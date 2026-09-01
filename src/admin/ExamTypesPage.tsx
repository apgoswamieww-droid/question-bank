import { useCallback, useEffect, useState } from "react";
import { Plus, ClipboardList } from "lucide-react";
import { api, ApiError, type ExamType } from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { MasterDataModal, type MasterField } from "./components/MasterDataModal";
import { TableSkeleton } from "./components/Skeleton";

const CATEGORY_COLORS: Record<string, string> = {
  board: "bg-blue-50 text-blue-700 ring-blue-200",
  unit: "bg-amber-50 text-amber-700 ring-amber-200",
  competitive: "bg-purple-50 text-purple-700 ring-purple-200",
  practice: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const fields: MasterField[] = [
  { key: "name", label: "Exam Type Name", placeholder: "e.g. Board Exam (GSEB)", required: true, colSpan: 2 },
  { key: "category", label: "Category", type: "select", required: true, options: [
    { value: "board", label: "Board Exam" },
    { value: "unit", label: "Unit / Term Exam" },
    { value: "competitive", label: "Competitive Exam" },
    { value: "practice", label: "Practice / Homework" },
  ]},
  { key: "sort_order", label: "Sort Order", type: "number", placeholder: "0" },
  { key: "description", label: "Description", type: "textarea", placeholder: "Optional description", colSpan: 2 },
];

export default function ExamTypesPage() {
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.examTypes.list();
      setExamTypes(res.examTypes);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load exam types.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    await api.examTypes.create(data as { name: string; category?: string; description?: string; sort_order?: number });
    await load();
  };

  const columns: DataTableColumn<ExamType>[] = [
    {
      key: "name",
      header: "Exam Type",
      sortValue: (e) => e.name,
      render: (e) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <ClipboardList className="h-4 w-4" aria-hidden />
          </div>
          <span className="font-medium text-slate-900">{e.name}</span>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortValue: (e) => e.category ?? "",
      render: (e) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${CATEGORY_COLORS[e.category ?? ""] ?? "bg-slate-50 text-slate-700 ring-slate-200"}`}>
          {e.category ?? "—"}
        </span>
      ),
    },
    {
      key: "sort_order",
      header: "Order",
      sortValue: (e) => e.sort_order,
      render: (e) => <span className="text-sm text-slate-500">{e.sort_order}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Types"
        subtitle="Manage exam type categories"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Add Exam Type
          </Button>
        }
      />

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <DataTable
          columns={columns}
          data={examTypes}
          rowKey={(e) => e.id}
          searchPlaceholder="Search exam types…"
          emptyIcon={<ClipboardList className="h-6 w-6" aria-hidden />}
          emptyTitle="No exam types"
          emptyDescription="Add an exam type to get started."
          emptyAction={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add Exam Type
            </Button>
          }
          initialSortedColumn="sort_order"
        />
      )}

      <MasterDataModal
        open={modalOpen}
        title="Add Exam Type"
        fields={fields}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
