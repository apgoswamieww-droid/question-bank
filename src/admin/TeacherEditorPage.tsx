import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import App from "../App";

export default function TeacherEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/admin/teachers")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Teachers
        </button>
        <span className="text-xs text-slate-500">Teacher ID: {id}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <App />
      </div>
    </div>
  );
}
