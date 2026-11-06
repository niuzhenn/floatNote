import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as api from "../lib/api";
import { onNoteChanged } from "../lib/events";
import { useUiStore } from "../store/uiStore";

function currentLabel(): string {
  if (!("__TAURI_INTERNALS__" in window)) return "main";
  return getCurrentWebviewWindow().label;
}

/**
 * 跨窗口同步：同一条便签在别处被编辑时，
 * - 本窗口没在编辑 → 静默重载
 * - 本窗口正在编辑 → 只提示，不覆盖用户输入
 */
export function useNoteSync(currentNoteId: string | null) {
  const [reloadToken, setReloadToken] = useState(0);
  const setStaleNoteId = useUiStore((s) => s.setStaleNoteId);
  const patchNote = useUiStore((s) => s.patchNote);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    const self = currentLabel();
    let off: (() => void) | undefined;

    onNoteChanged((payload) => {
      if (payload.id !== currentNoteId) return;
      if (payload.source === self) return;

      const active = document.activeElement;
      const editing = active?.closest(".ProseMirror") != null;

      api
        .getNote(payload.id)
        .then((latest) => {
          if (!latest) return;
          patchNote(latest);
          if (editing) {
            setStaleNoteId(payload.id);
          } else {
            setReloadToken((n) => n + 1);
          }
        })
        .catch((err) => console.error("sync note failed", err));
    })
      .then((fn) => {
        off = fn;
      })
      .catch((err) => console.error("bind note changed failed", err));

    return () => {
      off?.();
    };
  }, [currentNoteId, patchNote, setStaleNoteId]);

  return { reloadToken };
}
