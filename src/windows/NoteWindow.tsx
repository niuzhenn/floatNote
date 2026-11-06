import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalSize } from "@tauri-apps/api/dpi";
import { ExternalLink, Pin, PinOff, X } from "lucide-react";
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
  /** 固定位置：锁定后不能拖动、不能缩放 */
  const [locked, setLocked] = useState(false);

  /** 锁定时记住的窗口尺寸（物理像素），用于强制维持宽高 */
  const lockedSize = useRef<{ width: number; height: number } | null>(null);

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

  const toggleLock = () => {
    const win = getCurrentWebviewWindow();
    const next = !locked;
    setLocked(next);

    // 先把锁定状态同步给 Rust（不依赖 window 权限，务必先执行），
    // 再走 Tauri 的 setResizable / min-max 通道。
    // 无边框窗口能否缩放取决于父窗口的 WS_SIZEBOX 位，setResizable(false) 会把它去掉，
    // 这样 Tauri 的 TAURI_DRAG_RESIZE_BORDERS 子窗口就不再响应边缘拖拽。
    api
      .setNoteWindowLock(win.label, next)
      .then(() =>
        next
          ? win.innerSize().then((size) => {
              lockedSize.current = { width: size.width, height: size.height };
              return win
                .setMinSize(new PhysicalSize(size.width, size.height))
                .then(() => win.setMaxSize(new PhysicalSize(size.width, size.height)))
                .then(() => win.setResizable(false));
            })
          : Promise.resolve()
              .then(() => {
                lockedSize.current = null;
                return win.setMinSize(null);
              })
              .then(() => win.setMaxSize(null))
              .then(() => win.setResizable(true)),
      )
      .catch((err) => console.error("toggle lock failed", err));
  };

  // 锁定状态下尺寸被其他方式改动时，强制拉回锁定时的宽高
  useEffect(() => {
    if (!locked) return;
    let unlisten: (() => void) | undefined;
    const win = getCurrentWebviewWindow();

    win
      .onResized(() => {
        const target = lockedSize.current;
        if (!target) return;
        win
          .innerSize()
          .then((size) => {
            if (size.width !== target.width || size.height !== target.height) {
              return win.setSize(new PhysicalSize(target.width, target.height));
            }
            return undefined;
          })
          .catch((err) => console.error("restore size failed", err));
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => console.error("listen resize failed", err));

    return () => unlisten?.();
  }, [locked]);

  if (!note) {
    return <div className="h-full w-full rounded-sm bg-surface" />;
  }

  const token = PAPER[note.color] ?? PAPER.cream;
  const isDark = note.color === "charcoal";

  return (
    <div
      style={paperSurface(note.color)}
      className={cn(
        // 扁平化 + 轻投影：不用系统阴影，只用一圈淡淡的投影和细描边界定边缘
        "group relative flex h-full w-full flex-col overflow-hidden",
        "shadow-[0_2px_6px_rgba(0,0,0,.10)] ring-1 ring-black/[0.07]",
        isDark && "paper-dark",
      )}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[4px] opacity-80"
        style={{ backgroundColor: token.deep }}
      />

      {/* 标题与操作合并成一行：标题可编辑并自动省略，按钮固定在行尾。
          整行空白处都兼作拖动区（输入框和按钮会自己吃掉点击，不影响编辑与操作）。 */}
      <div
        data-tauri-drag-region={locked ? undefined : "true"}
        className="relative flex shrink-0 items-center gap-1 px-3.5 pb-1 pt-2"
      >
        {/* 顶部一条极窄拖动区，与标题行重叠但不挡输入框 */}
        <span
          data-tauri-drag-region={locked ? undefined : "true"}
          className="absolute inset-x-0 top-0 h-4"
          aria-hidden="true"
        />

        <input
          value={note.title}
          onChange={(e) => handleTitle(e.target.value)}
          onBlur={flush}
          placeholder="无标题"
          className="min-w-0 flex-1 truncate border-0 bg-transparent py-[6px] text-[15px] font-semibold tracking-[-0.01em] outline-none placeholder:opacity-35"
          style={{ color: "inherit" }}
        />

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            title={locked ? "解除固定" : "固定位置"}
            aria-label={locked ? "解除固定" : "固定位置"}
            onClick={toggleLock}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full backdrop-blur-sm transition-colors",
              locked
                ? "bg-accent/85 text-white hover:bg-accent"
                : "bg-black/12 text-current hover:bg-black/22",
            )}
          >
            {locked ? <Pin size={11} strokeWidth={2.1} /> : <PinOff size={11} strokeWidth={2.1} />}
          </button>
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
      </div>

      {/* 正文：右侧负边距让滚动条贴到卡片边缘；底部留白避免被浮动工具条遮住最后一行 */}
      <div className="mr-1 min-h-0 flex-1 overflow-y-auto pb-11 pl-3.5 pr-3.5">
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

      {/* 浮动工具条：不占布局高度，隐藏时没有任何留白 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-20 flex justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <div
          className={cn(
            "pointer-events-auto rounded-full px-2.5 py-0.5 ring-1 backdrop-blur-md",
            isDark ? "bg-black/35 ring-white/10" : "bg-white/52 ring-black/[0.06]",
          )}
        >
          <EditorToolbar editor={editor} compact />
        </div>
      </div>
    </div>
  );
}
