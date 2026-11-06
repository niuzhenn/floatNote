import { useCallback, useEffect, useRef } from "react";
import * as api from "../lib/api";
import {
  onNoteArchived,
  onNoteCreated,
  onNoteDeleted,
  onNotePinStateChanged,
  onNoteUnarchived,
} from "../lib/events";
import { useUiStore } from "../store/uiStore";
import type { Note, NoteScope, PaperColor } from "../types";

const SAVE_DELAY = 400;

/**
 * 便签列表 + 当前便签的唯一数据入口。
 * 数据真源在 Rust 侧，前端只做缓存与乐观更新。
 */
export function useNotes() {
  const scope = useUiStore((s) => s.scope);
  const query = useUiStore((s) => s.query);
  const notes = useUiStore((s) => s.notes);
  const currentNoteId = useUiStore((s) => s.currentNoteId);
  const defaultColor = useUiStore((s) => s.defaultColor);

  const setNotes = useUiStore((s) => s.setNotes);
  const setCurrentNote = useUiStore((s) => s.setCurrentNote);
  const setArchivedCount = useUiStore((s) => s.setArchivedCount);
  const setSaveState = useUiStore((s) => s.setSaveState);
  const setPreferences = useUiStore((s) => s.setPreferences);
  const patchNote = useUiStore((s) => s.patchNote);
  const mergeNoteMeta = useUiStore((s) => s.mergeNoteMeta);
  const setToast = useUiStore((s) => s.setToast);

  const saveTimer = useRef<number | null>(null);
  const pending = useRef<{ id: string; html: string; text: string } | null>(null);

  const current = notes.find((n) => n.id === currentNoteId) ?? null;

  const refresh = useCallback(
    async (nextScope?: NoteScope) => {
      const targetScope = nextScope ?? useUiStore.getState().scope;
      const targetQuery = useUiStore.getState().query;
      const list = await api.listNotes(targetScope, targetQuery);

      // 保留当前便签的本地正文：列表返回的是 DB 里的版本，
      // 用户可能刚敲了几个字还没落库（400ms 防抖窗口内），不能被他处数据冲掉。
      const state0 = useUiStore.getState();
      const localCurrent = state0.notes.find((n) => n.id === state0.currentNoteId);
      const merged = localCurrent
        ? list.map((n) =>
            n.id === localCurrent.id
              ? {
                  ...n,
                  contentHtml: localCurrent.contentHtml,
                  contentText: localCurrent.contentText,
                }
              : n,
          )
        : list;

      setNotes(merged);

      const counts = await api.noteCounts();
      setArchivedCount(counts.archived);

      const state = useUiStore.getState();
      if (!state.currentNoteId || !merged.some((n) => n.id === state.currentNoteId)) {
        setCurrentNote(merged[0]?.id ?? null);
      }
    },
    [setNotes, setArchivedCount, setCurrentNote],
  );

  // 首次加载：设置 + 列表
  useEffect(() => {
    (async () => {
      const raw = await api.readSettings();
      const prefs = api.parseSettings(raw);
      setPreferences(prefs);
      await refresh();
    })().catch((err) => console.error("initial load failed", err));
  }, [refresh, setPreferences]);

  // 搜索词变化 → 重新查询
  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh().catch((err) => console.error("search failed", err));
    }, 140);
    return () => window.clearTimeout(timer);
  }, [query, refresh]);

  // 监听其他窗口/托盘的事件
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    const bind = async () => {
      unlisteners.push(
        await onNoteCreated(() => {
          refresh().catch((err) => console.error(err));
        }),
      );
      unlisteners.push(
        await onNoteArchived(() => {
          refresh().catch((err) => console.error(err));
        }),
      );
      unlisteners.push(
        await onNoteUnarchived(() => {
          refresh().catch((err) => console.error(err));
        }),
      );
      unlisteners.push(
        await onNoteDeleted(() => {
          refresh().catch((err) => console.error(err));
        }),
      );
      unlisteners.push(
        await onNotePinStateChanged(() => {
          refresh().catch((err) => console.error(err));
        }),
      );
    };
    bind().catch((err) => console.error("bind events failed", err));

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [refresh]);

  const flush = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const data = pending.current;
    if (!data) return;
    pending.current = null;
    setSaveState("saving");

    await api
      .updateNote({
        id: data.id,
        contentHtml: data.html,
        contentText: data.text,
      })
      .then((saved) => {
        patchNote(saved);
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1600);
      })
      .catch((err) => {
        console.error("save failed", err);
        // 保存失败不能丢内容：放回队列等下一次触发，并明确告知用户
        if (!pending.current) pending.current = data;
        setSaveState("error");
        setToast("保存失败，稍后会自动重试");
      });
  }, [patchNote, setSaveState, setToast]);

  /** 编辑器内容变化 → 防抖落库 */
  const scheduleSave = useCallback(
    (html: string, text: string) => {
      const state = useUiStore.getState();
      if (!state.currentNoteId) return;
      pending.current = { id: state.currentNoteId, html, text };
      setSaveState("saving");

      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        flush().catch((err) => {
          console.error("save failed", err);
          setSaveState("idle");
        });
      }, SAVE_DELAY);
    },
    [flush, setSaveState],
  );

  const selectNote = useCallback(
    async (id: string) => {
      if (useUiStore.getState().currentNoteId === id) return;
      await flush();
      setCurrentNote(id);
    },
    [flush, setCurrentNote],
  );

  const createNote = useCallback(async () => {
    await flush();
    const note = await api.createNote(defaultColor);
    await refresh();
    setCurrentNote(note.id);
    return note;
  }, [defaultColor, flush, refresh, setCurrentNote]);

  const renameNote = useCallback(
    async (id: string, title: string) => {
      // 用 mergeNoteMeta：只合并标题等元数据，绝不用 DB 里的旧正文覆盖用户正在编辑的内容
      const saved = await api.updateNote({ id, title });
      mergeNoteMeta(saved);
      if (useUiStore.getState().scope === "archived") return;
      await refresh();
    },
    [mergeNoteMeta, refresh],
  );

  const changeColor = useCallback(
    async (id: string, color: PaperColor) => {
      const saved = await api.updateNote({ id, color });
      mergeNoteMeta(saved);
      await refresh();
    },
    [mergeNoteMeta, refresh],
  );

  const togglePin = useCallback(
    async (id: string) => {
      const saved = await api.togglePin(id);
      mergeNoteMeta(saved);
      await refresh();
    },
    [mergeNoteMeta, refresh],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const note = await api.duplicateNote(id);
      await refresh();
      setCurrentNote(note.id);
    },
    [refresh, setCurrentNote],
  );

  const archive = useCallback(
    async (id: string) => {
      await flush();
      await api
        .archiveNote(id)
        .then(() => refresh())
        .then(() => setToast("已归档"))
        // 被拒绝时（比如便签正钉在桌面上）要让人看到原因，不能静默失败
        .catch((err) => {
          console.error("archive failed", err);
          setToast(typeof err === "string" ? err : "归档失败");
        });
    },
    [flush, refresh, setToast],
  );

  const unarchive = useCallback(
    async (id: string) => {
      await api.unarchiveNote(id);
      await refresh();
      setToast("已取消归档");
    },
    [refresh, setToast],
  );

  const remove = useCallback(
    async (id: string) => {
      await api.deleteNote(id);
      if (useUiStore.getState().currentNoteId === id) setCurrentNote(null);
      await refresh();
      setToast("已删除便签");
    },
    [refresh, setCurrentNote, setToast],
  );

  const switchScope = useCallback(
    async (next: NoteScope) => {
      await flush();
      useUiStore.getState().setScope(next);
      await refresh(next);
    },
    [flush, refresh],
  );

  // 窗口失焦 / 退出前强制落库
  useEffect(() => {
    const handler = () => {
      flush().catch((err) => console.error(err));
    };
    window.addEventListener("blur", handler);
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("blur", handler);
      window.removeEventListener("beforeunload", handler);
    };
  }, [flush]);

  return {
    notes,
    current,
    currentNoteId,
    refresh,
    selectNote,
    createNote,
    renameNote,
    changeColor,
    togglePin,
    duplicate,
    archive,
    unarchive,
    remove,
    switchScope,
    scheduleSave,
    flush,
  };
}

export type NotesApi = ReturnType<typeof useNotes>;
export type NoteItem = Note;
