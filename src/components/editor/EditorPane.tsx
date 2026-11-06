import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { countChars, paperSurface } from "../../lib/paper";
import type { Note, SaveState } from "../../types";
import { EditorToolbar } from "./EditorToolbar";
import { NoteEditor } from "./NoteEditor";

interface EditorPaneProps {
  note: Note;
  fontSize: number;
  reloadToken: number;
  saveState: SaveState;
  stale: boolean;
  /** 归档视图只读：标题与正文都不可编辑 */
  readOnly?: boolean;
  onContentChange: (html: string, text: string) => void;
  onTitleChange: (title: string) => void;
  onTitleCommit: () => void;
  onReloadLatest: () => void;
}

export function EditorPane({
  note,
  fontSize,
  reloadToken,
  saveState,
  stale,
  readOnly = false,
  onContentChange,
  onTitleChange,
  onTitleCommit,
  onReloadLatest,
}: EditorPaneProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const token = paperSurface(note.color);

  return (
    <section
      style={token}
      className="group/pane relative flex h-full min-w-0 flex-1 flex-col overflow-hidden"
    >
      {stale ? (
        <div className="flex items-center justify-between gap-3 bg-black/[0.06] px-5 py-1.5 text-[12px]">
          <span style={{ color: "inherit", opacity: 0.75 }}>这条便签已在其他窗口更新</span>
          <button
            type="button"
            onClick={onReloadLatest}
            className="rounded px-1.5 py-0.5 font-medium underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-100"
            style={{ color: "inherit" }}
          >
            载入最新
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 pb-6 pt-12">
        <input
          value={note.title}
          readOnly={readOnly}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={readOnly ? undefined : onTitleCommit}
          placeholder="无标题"
          className={
            "w-full border-0 bg-transparent p-0 text-note-title outline-none placeholder:opacity-35" +
            (readOnly ? " cursor-default" : "")
          }
          style={{ color: "inherit" }}
        />

        {/* 工具栏常驻显示（用户明确要求不消失）；归档只读时不需要 */}
        {readOnly ? null : (
          <div className="mt-3 flex">
            <EditorToolbar editor={editor} />
          </div>
        )}

        <div className="mt-4 flex-1">
          <NoteEditor
            noteId={note.id}
            html={note.contentHtml}
            fontSize={fontSize}
            reloadToken={reloadToken}
            readOnly={readOnly}
            onChange={onContentChange}
            onReady={setEditor}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 px-10 pb-3 text-micro">
        {/* 左下角：归档只读说明（不放按钮，取消归档去列表右键） */}
        <span style={{ color: "inherit", opacity: 0.45 }}>
          {readOnly ? "已归档 · 只读，取消归档后可继续编辑" : ""}
        </span>

        <div
          className="flex items-center gap-2 font-mono"
          style={{ color: "inherit", opacity: 0.45 }}
        >
          <span>{countChars(note.contentText)} 字</span>
          {readOnly ? null : (
            <>
              <span>·</span>
              <span>
                {saveState === "saving"
                  ? "正在保存…"
                  : saveState === "saved"
                    ? "已保存"
                    : saveState === "error"
                      ? "保存失败"
                      : "已同步"}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
