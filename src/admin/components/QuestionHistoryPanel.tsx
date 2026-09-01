import { useEffect, useState } from "react";
import { Activity, BarChart3, Clock, FileClock, History, School, TrendingUp, UserRound, Users, X } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "./Button";

interface UsageLogRow {
  id?: string;
  test_id?: string | null;
  used_by?: string | null;
  school_id?: string | null;
  class_name?: string | null;
  usage_type?: string | null;
  student_count?: number | null;
  created_at?: string | null;
}

interface EditHistoryRow {
  id?: string;
  edited_by?: string | null;
  field_changed?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  change_summary?: string | null;
  created_at?: string | null;
}

interface PerformanceRow {
  question_id?: string;
  total_attempts?: number;
  correct_count?: number;
  incorrect_count?: number;
  skipped_count?: number;
  avg_time_sec?: number;
  success_rate?: number;
  difficulty_rating?: string | null;
  last_calculated?: string | null;
}

interface UsageSummary {
  total: number;
  teachers: { id: string; count: number }[];
  schools: { id: string; count: number }[];
}

interface HistoryData {
  edits: EditHistoryRow[];
  usage: UsageLogRow[];
  performance: PerformanceRow | null;
  summary: UsageSummary;
}

interface QuestionHistoryPanelProps {
  questionId: string | null;
  questionLabel: string | null;
  open: boolean;
  onClose: () => void;
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function QuestionHistoryPanel({ questionId, questionLabel, open, onClose }: QuestionHistoryPanelProps) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !questionId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setData(null);
    Promise.all([api.questions.history(questionId), api.questions.usage(questionId)])
      .then(([hist, summary]) => {
        setData({
          edits: (hist.edits ?? []) as EditHistoryRow[],
          usage: (hist.usage ?? []) as UsageLogRow[],
          performance: (hist.performance as PerformanceRow | null) ?? null,
          summary: summary as UsageSummary,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load question history."))
      .finally(() => setLoading(false));
  }, [open, questionId]);

  if (!open) return null;

  const perf = data?.performance;
  const attempts = perf?.total_attempts ?? 0;
  const correct = perf?.correct_count ?? 0;
  const incorrect = perf?.incorrect_count ?? 0;
  const skipped = perf?.skipped_count ?? 0;
  const success = perf?.success_rate ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Question history">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Question History</h2>
              <p className="max-w-[280px] truncate text-xs text-slate-500">{questionLabel ?? "Untitled question"}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && !data && <LoadingState />}
          {error && <ErrorState message={error} />}
          {!loading && !error && data && (
            <div className="space-y-5">
              {/* Usage summary */}
              <Section icon={<Activity className="h-4 w-4" />} title="Usage Summary">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatChip label="Total uses" value={data.summary.total} tone="primary" />
                  <StatChip label="Teachers" value={data.summary.teachers.length} tone="slate" />
                  <StatChip label="Schools" value={data.summary.schools.length} tone="slate" />
                </div>
              </Section>

              {/* Performance */}
              <Section icon={<BarChart3 className="h-4 w-4" />} title={`Performance (${attempts} attempts)`}>
                {attempts === 0 ? (
                  <p className="text-sm text-slate-500">No student attempts recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${success}%` }} />
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{Math.round(success)}%</span>
                    </div>
                    <div className="flex gap-1.5 text-center text-xs">
                      <div className="flex-1 rounded-lg bg-emerald-50 p-2 text-emerald-700">
                        <p className="text-sm font-bold">{correct}</p>
                        <p>Correct</p>
                      </div>
                      <div className="flex-1 rounded-lg bg-red-50 p-2 text-red-700">
                        <p className="text-sm font-bold">{incorrect}</p>
                        <p>Incorrect</p>
                      </div>
                      <div className="flex-1 rounded-lg bg-slate-100 p-2 text-slate-600">
                        <p className="text-sm font-bold">{skipped}</p>
                        <p>Skipped</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      {perf?.avg_time_sec != null && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4 text-slate-400" aria-hidden />
                          Avg {perf.avg_time_sec}s
                        </span>
                      )}
                      {perf?.difficulty_rating && (
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-slate-400" aria-hidden /> {perf.difficulty_rating}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{fmtDate(perf?.last_calculated)}</span>
                    </div>
                  </div>
                )}
              </Section>

              {/* Teachers */}
              <Section icon={<UserRound className="h-4 w-4" />} title="Used By Teachers">
                {data.summary.teachers.length === 0 ? (
                  <EmptyText />
                ) : (
                  <ul className="space-y-1">
                    {data.summary.teachers.map((t) => (
                      <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="truncate font-medium text-slate-700">{t.id}</span>
                        <span className="text-xs text-slate-500">{t.count}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Schools */}
              <Section icon={<School className="h-4 w-4" />} title="Used In Schools">
                {data.summary.schools.length === 0 ? (
                  <EmptyText />
                ) : (
                  <ul className="space-y-1">
                    {data.summary.schools.map((s) => (
                      <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="truncate font-medium text-slate-700">{s.id}</span>
                        <span className="text-xs text-slate-500">{s.count}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Usage log */}
              <Section icon={<Users className="h-4 w-4" />} title="Usage Log">
                {data.usage.length === 0 ? (
                  <EmptyText />
                ) : (
                  <ul className="space-y-1.5">
                    {data.usage.map((u) => (
                      <li
                        key={u.id ?? `${u.test_id}-${u.created_at}`}
                        className="rounded-lg border border-slate-100 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {u.usage_type ?? "usage"}
                          </span>
                          <span className="text-xs text-slate-400">{fmtDate(u.created_at)}</span>
                        </div>
                        <p className="mt-1 text-slate-700">
                          Test <code className="rounded bg-slate-100 px-1 text-xs">{u.test_id ?? "—"}</code>
                          {u.class_name ? ` · ${u.class_name}` : ""}
                          {u.student_count != null ? ` · ${u.student_count} students` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Edit timeline */}
              <Section icon={<FileClock className="h-4 w-4" />} title="Edit History">
                {data.edits.length === 0 ? (
                  <EmptyText />
                ) : (
                  <ol className="relative ml-2 border-l border-slate-200">
                    {data.edits.map((e) => (
                      <li key={e.id ?? `${e.field_changed}-${e.created_at}`} className="mb-4 ml-4">
                        <span
                          className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary"
                          aria-hidden
                        />
                        <p className="text-sm font-medium text-slate-800">
                          {e.change_summary || `Changed ${e.field_changed ?? "field"}`}
                        </p>
                        {e.field_changed && (
                          <p className="text-xs text-slate-400">
                            {e.field_changed} · {fmtDate(e.created_at)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: "primary" | "slate" }) {
  const cls =
    tone === "primary" ? "bg-primary/10 text-primary" : "bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-xl px-3 py-2.5 ring-1 ${cls}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs text-current opacity-70">{label}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 py-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>;
}

function EmptyText() {
  return <p className="text-sm text-slate-400">No data recorded yet.</p>;
}
