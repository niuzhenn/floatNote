export type PaperColor =
  | "cream"
  | "mint"
  | "sakura"
  | "lilac"
  | "sky"
  | "stone"
  | "charcoal";

export type NoteScope = "active" | "archived";

export interface Note {
  id: string;
  title: string;
  contentHtml: string;
  contentText: string;
  color: PaperColor;
  pinned: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  deletedAt: number | null;
}

export interface NoteCounts {
  active: number;
  archived: number;
}

export interface NotePatch {
  id: string;
  title?: string;
  contentHtml?: string;
  contentText?: string;
  color?: PaperColor;
  pinned?: boolean;
}

export interface AppSettings {
  defaultColor: PaperColor;
  fontSize: number;
  pinEnabled: boolean;
}

export interface NoteEventPayload {
  id: string;
  source: string;
  updatedAt: number;
}

export type SaveState = "idle" | "saving" | "saved" | "error";
