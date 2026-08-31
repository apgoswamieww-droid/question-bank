export interface RecentFileItem {
  name: string;
  openedAt: string;
}

export type ConfirmCloseResult = "save" | "dontsave" | "cancel";
