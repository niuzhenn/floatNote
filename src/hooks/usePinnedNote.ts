import { useCallback, useEffect, useState } from "react";
import * as api from "../lib/api";
import { onNotePinStateChanged } from "../lib/events";
import { useUiStore } from "../store/uiStore";

/**
 * 钉桌面状态：哪些便签已经在桌面上，以及钉 / 取消钉的动作。
 */
export function usePinnedNote() {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const setToast = useUiStore((s) => s.setToast);
  const pinEnabled = useUiStore((s) => s.pinEnabled);

  const refreshPinned = useCallback(async () => {
    const ids = await api.listPinnedNotes();
    setPinnedIds(ids);
  }, []);

  useEffect(() => {
    refreshPinned().catch((err) => console.error("load pinned failed", err));
    let off: (() => void) | undefined;
    onNotePinStateChanged(() => {
      refreshPinned().catch((err) => console.error(err));
    })
      .then((fn) => {
        off = fn;
      })
      .catch((err) => console.error("bind pinned events failed", err));

    return () => {
      off?.();
    };
  }, [refreshPinned]);

  const pin = useCallback(
    (id: string) => {
      if (!pinEnabled) {
        setToast("钉桌面已在设置中关闭");
        return Promise.resolve();
      }
      // 失败必须让用户看到原因，否则表现就是"点了没反应"
      return api
        .pinNoteToDesktop(id)
        .then(async () => {
          await refreshPinned();
          setToast("已钉到桌面，点开其他窗口后它会留在桌面上");
        })
        .catch((err) => {
          console.error("pin to desktop failed", err);
          setToast(`钉到桌面失败：${String(err)}`);
        });
    },
    [pinEnabled, refreshPinned, setToast],
  );

  const unpin = useCallback(
    (id: string) =>
      api
        .unpinNoteFromDesktop(id)
        .then(async () => {
          await refreshPinned();
          setToast("已收回便签");
        })
        .catch((err) => {
          console.error("unpin failed", err);
          setToast("收回便签失败");
        }),
    [refreshPinned, setToast],
  );

  const unpinAll = useCallback(
    () =>
      api
        .unpinAllNotes()
        .then(async () => {
          await refreshPinned();
          setToast("已收回全部桌面便签");
        })
        .catch((err) => {
          console.error("unpin all failed", err);
          setToast("收回失败");
        }),
    [refreshPinned, setToast],
  );

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  return { pinnedIds, isPinned, pin, unpin, unpinAll, refreshPinned };
}
