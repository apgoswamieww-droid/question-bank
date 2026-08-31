import { Link } from "react-router-dom";
import { BookOpenCheck, Construction } from "lucide-react";
import { useCan, PERMISSIONS } from "../context/useAdminAuth";

export default function QuestionBanksPage() {
  const can = useCan();

  if (!can(PERMISSIONS.QUESTION_BANKS_VIEW)) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        You do not have permission to view question banks.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">Question Banks</h1>
        <p className="text-sm text-slate-600">
          Central library of question banks shared across the platform. Building this module next.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
          <Construction className="h-7 w-7" aria-hidden />
        </div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <BookOpenCheck className="h-5 w-5 text-primary" aria-hidden /> Under construction
        </h3>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Question bank management (create, share, and organize banks for teachers) is a planned module.
        </p>
        <Link to="/admin/editor" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-primary-600">
          Open the question bank editor →
        </Link>
      </div>
    </div>
  );
}
