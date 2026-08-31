const RECENT_KEY = "qbank:recent-files";
const MAX_RECENT = 10;

import type { RecentFileItem } from "../types/files";

export function getRecentFiles(): RecentFileItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentFile(name: string): RecentFileItem[] {
  const list = getRecentFiles().filter((f) => f.name !== name);
  list.unshift({ name, openedAt: new Date().toISOString() });
  const trimmed = list.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function clearRecentFiles(): void {
  localStorage.removeItem(RECENT_KEY);
}
