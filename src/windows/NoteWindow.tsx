import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ExternalLink, X } from "lucide-react";
import * as api from "../lib/api";
import { cn } from "../lib/cn";
import { emitNoteFocus, onNoteChanged } from "../lib/events";
import { paperSurface } from "../lib/paper";
import { PAPER } from "../theme/tokens";
import type { Note } from "../types";
import { NoteEditor } from "../components/editor/NoteEditor";
import { EditorToolbar } from "../components/editor/EditorToolbar";
import type { Editor } from "@tiptap/react";

const SAVE_DELAY = 400;

function noteIdFromLabel(): string {
  if (!("__TAURI_INTERNALS__" in window)) return "";
  return getCurrentWebviewWindow().label.replace(/^note-/, "");
}

/** 桌面便签小窗：一块真实的便签纸，贴在桌面上 */
export function NoteWindow() {
  const noteId = useMemo(noteIdFromLabel, []);
  const [note, setNote] = useState<Note | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const timer = useRef<number | null>(null);
  const pending = useRef<{ html: string; text: string } | null>(null);
  const titleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!noteId) return;
    api
      .getNote(noteId)
      .then(setNote)
      .catch((err) => console.error("load note failed", err));
  }, [noteId]);

  // 主窗口编辑同一条便签时同步过来
  useEffect(() => {
    if (!noteId) return;
    let off: (() => void) | undefined;
    const self = getCurrentWebviewWindow().label;
    onNoteChanged((payload) => {
      if (payload.id !== noteId || payload.source === self) return;

      // 正在输入（或还有未落库的内容）时绝不覆盖，否则会把用户刚敲的字冲掉
      const editing =
        document.activeElement?.closest(".ProseMirror") != null || pending.current !== null;
      if (editing) return;

      api
        .getNote(noteId)
        .then((latest) => {
          if (!latest) return;
          setNote(latest);
          setReloadToken((n) => n + 1);
        })
        .catch((err) => console.error("sync failed", err));
    })
      .then((fn) => {
        off = fn;
      })
      .catch((err) => console.error(err));
    return () => off?.();
  }, [noteId]);

  const flush = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const data = pending.current;
    if (!data || !noteId) return;
    pending.current = null;
    api
      .updateNote({ id: noteId, contentHtml: data.html, contentText: data.text })
      .catch((err) => console.error("save failed", err));
  }, [noteId]);

  const handleChange = useCallback(
    (html: string, text: string) => {
      pending.current = { html, text };
      setNote((prev) => (prev ? { ...prev, contentHtml: html, contentText: text } : prev));
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY);
    },
    [flush],
  );

  const handleTitle = (title: string) => {
    setNote((prev) => (prev ? { ...prev, title } : prev));
    if (titleTimer.current) window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      api.updateNote({ id: noteId, title }).catch((err) => console.error("rename failed", err));
    }, SAVE_DELAY);
  };

  useEffect(() => {
    const handler = () => flush();
    window.addEventListener("blur", handler);
    return () => window.removeEventListener("blur", handler);
  }, [flush]);

  const close = () => {
    flush();
    // 标题的防抖定时器也要立刻落地，否则最后 400ms 内改的标题会丢
    if (titleTimer.current) {
      window.clearTimeout(titleTimer.current);
      titleTimer.current = null;
      if (note) {
        api
          .updateNote({ id: noteId, title: note.title })
          .catch((err) => console.error("save title failed", err));
      }
    }
    api.unpinNoteFromDesktop(noteId).catch((err) => console.error("unpin failed", err));
  };

  const openInMain = () => {
    emitNoteFocus(noteId).catch((err) => console.error(err));
    api.showMainWindow().catch((err) => console.error(err));
  };

  if (!note) {
    return <div className="h-full w-full rounded-btn bg-surface" />;
  }

  const token = PAPER[note.color] ?? PAPER.cream;
  const isDark = note.color === "charcoal";

  return (
    <div
      style={paperSurface(note.color)}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-btn shadow-card",
        isDark && "paper-dark",
      )}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[4px] opacity-80"
        style={{ backgroundColor: token.deep }}
      />

      <div data-tauri-drag-region className="h-6 w-full shrink-0" aria-hidden="true" />

      <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          type="button"
          title="在主窗口中打开"
          aria-label="在主窗口中打开"
          onClick={openInMain}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-black/12 text-current backdrop-blur-sm transition-colors hover:bg-black/22"
        >
          <ExternalLink size={11} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="收回便签（内容保留）"
          aria-label="收回便签"
          onClick={close}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-black/12 text-current backdrop-blur-sm transition-colors hover:bg-black/22"
        >
          <X size={11} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-2">
        <input
          value={note.title}
          onChange={(e) => handleTitle(e.target.value)}
          onBlur={flush}
          placeholder="无标题"
          className="w-full shrink-0 border-0 bg-transparent p-0 text-[15px] font-semibold tracking-[-0.01em] outline-none placeholder:opacity-35"
          style={{ color: "inherit" }}
        />

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          <NoteEditor
            noteId={note.id}
            html={note.contentHtml}
            compact
            fontSize={13.5}
            reloadToken={reloadToken}
            onChange={handleChange}
            onReady={setEditor}
          />
        </div>

        {/* 工具栏贴底，鼠标进入便签才出现 */}
        <div className="mt-1.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <EditorToolbar editor={editor} compact />
        </div>
      </div>
    </div>
  );
}
