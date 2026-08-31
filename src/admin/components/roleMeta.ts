import type { UserRole } from "../../api/client";

export const ROLE_META: Record<UserRole, { label: string; color: string; chip: string }> = {
  super_admin: {
    label: "Super Admin",
    color: "bg-primary/10 text-primary ring-primary/30",
    chip: "bg-primary text-white",
  },
  teacher: {
    label: "Teacher",
    color: "bg-sky-500/10 text-sky-700 ring-sky-500/30",
    chip: "bg-sky-600 text-white",
  },
  student: {
    label: "Student",
    color: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30",
    chip: "bg-emerald-600 text-white",
  },
  parent: {
    label: "Parent",
    color: "bg-amber-500/10 text-amber-700 ring-amber-500/30",
    chip: "bg-amber-600 text-white",
  },
};

export const ROLE_ORDER: UserRole[] = ["super_admin", "teacher", "student", "parent"];
