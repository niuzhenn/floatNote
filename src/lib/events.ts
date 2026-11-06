import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { NoteEventPayload } from "../types";

export const NOTE_CHANGED = "note://changed";
export const NOTE_CREATED = "note://created";
export const NOTE_ARCHIVED = "note://archived";
export const NOTE_UNARCHIVED = "note://unarchived";
export const NOTE_DELETED = "note://deleted";
export const NOTE_PINNED = "note://pinned";
export const NOTE_UNPINNED = "note://unpinned";
export const APP_NEW_NOTE = "app://new-note";
export const APP_OPEN_SETTINGS = "app://open-settings";

type Handler<T> = (payload: T) => void;

async function bind<T>(event: string, handler: Handler<T>): Promise<UnlistenFn> {
  return listen<T>(event, (e) => handler(e.payload));
}

export async function onNoteChanged(handler: Handler<NoteEventPayload>) {
  return bind<NoteEventPayload>(NOTE_CHANGED, handler);
}

export async function onNoteCreated(handler: Handler<NoteEventPayload>) {
  return bind<NoteEventPayload>(NOTE_CREATED, handler);
}

export async function onNoteArchived(handler: Handler<NoteEventPayload>) {
  return bind<NoteEventPayload>(NOTE_ARCHIVED, handler);
}

export async function onNoteUnarchived(handler: Handler<NoteEventPayload>) {
  return bind<NoteEventPayload>(NOTE_UNARCHIVED, handler);
}

export async function onNoteDeleted(handler: Handler<string>) {
  return bind<string>(NOTE_DELETED, handler);
}

export async function onNotePinned(handler: Handler<string>) {
  return bind<string>(NOTE_PINNED, handler);
}

export async function onNoteUnpinned(handler: Handler<string>) {
  return bind<string>(NOTE_UNPINNED, handler);
}

export async function onAppNewNote(handler: Handler<void>) {
  return bind<void>(APP_NEW_NOTE, handler);
}

/** 钉桌面状态变化（pinned / unpinned 合并成一个回调） */
export async function onNotePinStateChanged(handler: () => void) {
  const offPinned = await onNotePinned(() => handler());
  const offUnpinned = await onNoteUnpinned(() => handler());
  return () => {
    offPinned();
    offUnpinned();
  };
}

/** 从小窗请求主窗口打开这条便签 */
export const NOTE_FOCUS = "note://focus";

export async function emitNoteFocus(noteId: string) {
  await emit(NOTE_FOCUS, noteId);
}

export async function onNoteFocus(handler: (noteId: string) => void) {
  return bind<string>(NOTE_FOCUS, handler);
}

export async function onAppOpenSettings(handler: Handler<void>) {
  return bind<void>(APP_OPEN_SETTINGS, handler);
}
