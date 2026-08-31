import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from "lucide-react";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchFn?: (row: T, query: string) => boolean;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  pageSize?: number;
  initialSortedColumn?: string;
  initialSortDirection?: "asc" | "desc";
  toolbar?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  searchPlaceholder = "Search…",
  searchFn,
  emptyIcon,
  emptyTitle = "No records found",
  emptyDescription,
  emptyAction,
  pageSize = 8,
  initialSortedColumn,
  initialSortDirection = "asc",
  toolbar,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string | undefined>(initialSortedColumn);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDirection);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    const fn =
      searchFn ??
      ((row: T, needle: string) =>
        Object.values(row as Record<string, unknown>)
          .filter((v): v is string | number | null => typeof v === "string" || typeof v === "number" || v === null)
          .some((v) => v !== null && String(v).toLowerCase().includes(needle)));
    return data.filter((row) => fn(row, q));
  }, [data, query, searchFn]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const col = columns.find((c) => c.key === sortCol);
    if (!col?.sortValue) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sortCol, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortValue) return;
    if (sortCol === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col.key);
      setSortDir("asc");
    }
    setPage(0);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {(toolbar || searchFn !== undefined || columns.some((c) => c.sortValue)) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          {toolbar && <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>}
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-black placeholder:text-slate-400 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>
        </div>
      )}

      {pageRows.length === 0 ? (
        <EmptyState
          icon={emptyIcon ?? <Search className="h-6 w-6" aria-hidden />}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col)}
                    className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                      col.sortValue ? "cursor-pointer select-none hover:text-slate-700" : ""
                    } ${col.headerClassName ?? ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortValue && sortCol === col.key && (
                        sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-slate-50/60">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-6 py-4 ${col.className ?? ""}`}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">
            Showing <span className="font-medium text-slate-700">{safePage * pageSize + 1}</span>–
            <span className="font-medium text-slate-700">{Math.min((safePage + 1) * pageSize, sorted.length)}</span> of{" "}
            <span className="font-medium text-slate-700">{sorted.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="px-2 text-sm text-slate-600">
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
