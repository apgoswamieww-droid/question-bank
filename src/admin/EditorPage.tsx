import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import App from "../App";

export default function EditorPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate("/admin/dashboard")}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Dashboard
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <App />
      </div>
    </div>
  );
}
