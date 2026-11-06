import { useEffect, useRef, useState } from "react";
import { FilePlus2 } from "lucide-react";
import * as api from "../lib/api";
import { onAppNewNote, onAppOpenSettings, onNoteFocus } from "../lib/events";
import { useNotes } from "../hooks/useNotes";
import { useNoteSync } from "../hooks/useNoteSync";
import { usePinnedNote } from "../hooks/usePinnedNote";
import { useUiStore } from "../store/uiStore";
import type { Note } from "../types";
import { NoteList } from "../components/notes/NoteList";
import { EditorPane } from "../components/editor/EditorPane";
import { WindowChrome } from "../components/layout/WindowChrome";
import { SettingsDialog } from "../components/settings/SettingsDialog";
import { PaperDialog } from "../components/ui/PaperDialog";

export function MainWindow() {
  const notesApi = useNotes();
  const pinned = usePinnedNote();
  const { reloadToken } = useNoteSync(notesApi.currentNoteId);

  const scope = useUiStore((s) => s.scope);
  const query = useUiStore((s) => s.query);
  const archivedCount = useUiStore((s) => s.archivedCount);
  const saveState = useUiStore((s) => s.saveState);
  const fontSize = useUiStore((s) => s.fontSize);
  const toast = useUiStore((s) => s.toast);
  const staleNoteId = useUiStore((s) => s.staleNoteId);
  const setQuery = useUiStore((s) => s.setQuery);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setStaleNoteId = useUiStore((s) => s.setStaleNoteId);
  const patchNote = useUiStore((s) => s.patchNote);
  const setToast = useUiStore((s) => s.setToast);

  const [renameTarget, setRenameTarget] = useState<Note | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [forceReload, setForceReload] = useState(0);

  const current = notesApi.current;

  // useNotes 每次渲染都会返回新对象，用 ref 持有最新值，避免事件监听被重复订阅
  const apiRef = useRef(notesApi);
  apiRef.current = notesApi;

  // 快捷键：Ctrl+N 新建、Ctrl+S 立即保存
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        apiRef.current.createNote().catch((err) => console.error("create failed", err));
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        apiRef.current.flush().catch((err) => console.error("flush failed", err));
      }
      if (event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSettingsOpen]);

  // 托盘菜单触发（异步 listen，卸载时要能正确清理）
  useEffect(() => {
    let cancelled = false;
    const offs: Array<() => void> = [];

    const bind = async () => {
      const fns = await Promise.all([
        onAppNewNote(() => {
          apiRef.current.createNote().catch((err) => console.error(err));
        }),
        onAppOpenSettings(() => setSettingsOpen(true)),
        onNoteFocus((id) => {
          apiRef.current.selectNote(id).catch((err) => console.error(err));
        }),
      ]);

      if (cancelled) {
        fns.forEach((fn) => fn());
        return;
      }
      offs.push(...fns);
    };

    bind().catch((err) => console.error("bind app events failed", err));

    return () => {
      cancelled = true;
      offs.forEach((fn) => fn());
    };
  }, [setSettingsOpen]);

  const openRename = (note: Note) => {
    setRenameTarget(note);
    setRenameValue(note.title);
  };

  const commitRename = () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    setRenameTarget(null);
    notesApi
      .renameNote(renameTarget.id, title)
      .catch((err) => console.error("rename failed", err));
  };

  const handleArchive = (id: string) => {
    notesApi.archive(id).catch((err) => {
      console.error("archive failed", err);
      setToast("归档失败");
    });
  };

  const handleUnarchive = (id: string) => {
    notesApi.unarchive(id).catch((err) => {
      console.error("unarchive failed", err);
      setToast("取消归档失败");
    });
  };

  const handlePin = (id: string) => {
    pinned.pin(id).catch((err) => {
      console.error("pin failed", err);
      setToast(`钉到桌面失败：${String(err)}`);
    });
  };

  const handleUnpin = (id: string) => {
    pinned.unpin(id).catch((err) => {
      console.error("unpin failed", err);
      setToast("取消钉桌面失败");
    });
  };

  const reloadLatest = () => {
    if (!current) return;
    setStaleNoteId(null);
    api
      .getNote(current.id)
      .then((latest) => {
        if (!latest) return;
        patchNote(latest);
        setForceReload((n) => n + 1);
      })
      .catch((err) => console.error("reload failed", err));
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-surface">
      <WindowChrome />

      <NoteList
        notes={notesApi.notes}
        currentNoteId={notesApi.currentNoteId}
        scope={scope}
        query={query}
        archivedCount={archivedCount}
        isPinnedToDesktop={pinned.isPinned}
        onQuery={setQuery}
        onScope={(next) => {
          notesApi.switchScope(next).catch((err) => console.error(err));
        }}
        onSelect={(id) => {
          notesApi.selectNote(id).catch((err) => console.error(err));
        }}
        onCreate={() => {
          notesApi.createNote().catch((err) => console.error(err));
        }}
        onRename={openRename}
        onTogglePin={(id) => {
          notesApi.togglePin(id).catch((err) => console.error(err));
        }}
        onColor={(id, color) => {
          notesApi.changeColor(id, color).catch((err) => console.error(err));
        }}
        onPinDesktop={handlePin}
        onUnpinDesktop={handleUnpin}
        onDuplicate={(id) => {
          notesApi.duplicate(id).catch((err) => console.error(err));
        }}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onDelete={(id) => {
          const target = notesApi.notes.find((n) => n.id === id) ?? null;
          setDeleteTarget(target);
        }}
      />

      {current ? (
        <EditorPane
          note={current}
          fontSize={fontSize}
          reloadToken={reloadToken + forceReload}
          saveState={saveState}
          stale={staleNoteId === current.id}
          onContentChange={notesApi.scheduleSave}
          onTitleChange={(title) => patchNote({ ...current, title })}
          onTitleCommit={() => {
            notesApi.renameNote(current.id, current.title).catch((err) => console.error(err));
          }}
          onReloadLatest={reloadLatest}
        />
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center bg-[#FAF9F6]">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-black/[0.13] text-ink-faint">
            <FilePlus2 size={26} strokeWidth={1.4} />
          </div>
          <p className="mt-4 text-[14px] text-ink">
            {scope === "archived" ? "这里是归档区" : "还没有便签"}
          </p>
          <button
            type="button"
            onClick={() => {
              notesApi.createNote().catch((err) => console.error(err));
            }}
            className="mt-3 rounded-btn bg-accent/16 px-3 py-1.5 text-[13px] font-medium text-accent-deep transition-colors hover:bg-accent/24"
          >
            新建便签
          </button>
        </section>
      )}

      <SettingsDialog />

      <PaperDialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="重命名便签"
        width={380}
      >
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
          }}
          className="w-full rounded-btn bg-black/[0.05] px-3 py-2 text-[13.5px] text-ink outline-none focus:ring-1 focus:ring-accent"
          placeholder="便签标题"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRenameTarget(null)}
            className="rounded-btn px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-black/[0.05]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={commitRename}
            className="rounded-btn bg-accent/20 px-3 py-1.5 text-[13px] font-medium text-accent-deep transition-colors hover:bg-accent/30"
          >
            保存
          </button>
        </div>
      </PaperDialog>

      <PaperDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除这条便签？"
        description="删除后无法恢复，桌面上的小窗也会一并关闭。"
        width={380}
      >
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="rounded-btn px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-black/[0.05]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (!deleteTarget) return;
              const id = deleteTarget.id;
              setDeleteTarget(null);
              notesApi.remove(id).catch((err) => console.error("delete failed", err));
            }}
            className="rounded-btn bg-[#C4453F]/12 px-3 py-1.5 text-[13px] font-medium text-[#C4453F] transition-colors hover:bg-[#C4453F]/20"
          >
            删除
          </button>
        </div>
      </PaperDialog>

      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center">
          <div className="animate-fade-in rounded-full bg-ink/88 px-3.5 py-1.5 text-[12px] text-white shadow-pop">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
