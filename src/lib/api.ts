import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  Note,
  NoteCounts,
  NotePatch,
  NoteScope,
  PaperColor,
} from "../types";

export async function listNotes(scope: NoteScope, query = ""): Promise<Note[]> {
  return invoke<Note[]>("notes_list", { scope, query });
}

export async function getNote(id: string): Promise<Note | null> {
  return invoke<Note | null>("notes_get", { id });
}

export async function createNote(color: PaperColor): Promise<Note> {
  return invoke<Note>("notes_create", { color });
}

export async function updateNote(patch: NotePatch): Promise<Note> {
  return invoke<Note>("notes_update", { patch });
}

export async function togglePin(id: string): Promise<Note> {
  return invoke<Note>("notes_toggle_pin", { id });
}

export async function duplicateNote(id: string): Promise<Note> {
  return invoke<Note>("notes_duplicate", { id });
}

export async function archiveNote(id: string): Promise<Note> {
  return invoke<Note>("notes_archive", { id });
}

export async function unarchiveNote(id: string): Promise<Note> {
  return invoke<Note>("notes_unarchive", { id });
}

export async function deleteNote(id: string): Promise<void> {
  return invoke<void>("notes_delete", { id });
}

export async function noteCounts(): Promise<NoteCounts> {
  return invoke<NoteCounts>("notes_counts");
}

export async function pinNoteToDesktop(noteId: string): Promise<void> {
  return invoke<void>("desktop_pin", { noteId });
}

export async function unpinNoteFromDesktop(noteId: string): Promise<void> {
  return invoke<void>("desktop_unpin", { noteId });
}

export async function listPinnedNotes(): Promise<string[]> {
  return invoke<string[]>("desktop_list_pinned");
}

export async function unpinAllNotes(): Promise<void> {
  return invoke<void>("desktop_unpin_all");
}

export async function minimizeToTray(): Promise<void> {
  return invoke<void>("window_minimize_to_tray");
}

export async function showMainWindow(): Promise<void> {
  return invoke<void>("window_show_main");
}

export async function hideMainWindow(): Promise<void> {
  return invoke<void>("window_hide_main");
}

export async function quitApp(): Promise<void> {
  return invoke<void>("window_quit");
}

export async function readSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("settings_get_all");
}

export async function writeSetting(key: string, value: string): Promise<void> {
  return invoke<void>("settings_set", { key, value });
}

export async function setAutostart(enabled: boolean): Promise<boolean> {
  return invoke<boolean>("settings_set_autostart", { enabled });
}

export async function autostartEnabled(): Promise<boolean> {
  return invoke<boolean>("settings_autostart_enabled");
}

export async function dataDir(): Promise<string> {
  return invoke<string>("settings_data_dir");
}

/** 把 DB 里的字符串设置解析成结构化配置 */
export function parseSettings(raw: Record<string, string>): AppSettings {
  return {
    defaultColor: (raw.defaultColor as PaperColor) || "cream",
    fontSize: Number(raw.fontSize ?? 14) || 14,
    pinEnabled: raw.pinEnabled !== "false",
  };
}
