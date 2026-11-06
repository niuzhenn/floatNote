import { create } from "zustand";
import type { Note, NoteScope, PaperColor, SaveState } from "../types";

interface UiState {
  scope: NoteScope;
  query: string;
  currentNoteId: string | null;
  notes: Note[];
  archivedCount: number;
  saveState: SaveState;
  settingsOpen: boolean;
  defaultColor: PaperColor;
  fontSize: number;
  pinEnabled: boolean;
  toast: string | null;
  /** 当前便签在他处被修改，且本窗口正在编辑 */
  staleNoteId: string | null;

  setScope: (scope: NoteScope) => void;
  setQuery: (query: string) => void;
  setNotes: (notes: Note[]) => void;
  setCurrentNote: (id: string | null) => void;
  setArchivedCount: (count: number) => void;
  setSaveState: (state: SaveState) => void;
  setSettingsOpen: (open: boolean) => void;
  setPreferences: (prefs: {
    defaultColor: PaperColor;
    fontSize: number;
    pinEnabled: boolean;
  }) => void;
  setToast: (message: string | null) => void;
  setStaleNoteId: (id: string | null) => void;
  patchNote: (note: Note) => void;
  /** 只合并元数据（标题/纸色/置顶），保留本地正文，避免被 DB 里的旧正文回冲 */
  mergeNoteMeta: (note: Note) => void;
}

export const useUiStore = create<UiState>((set) => ({
  scope: "active",
  query: "",
  currentNoteId: null,
  notes: [],
  archivedCount: 0,
  saveState: "idle",
  settingsOpen: false,
  defaultColor: "cream",
  fontSize: 14,
  pinEnabled: true,
  toast: null,
  staleNoteId: null,

  setScope: (scope) => set({ scope }),
  setQuery: (query) => set({ query }),
  setNotes: (notes) => set({ notes }),
  setCurrentNote: (currentNoteId) => set({ currentNoteId }),
  setArchivedCount: (archivedCount) => set({ archivedCount }),
  setSaveState: (saveState) => set({ saveState }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPreferences: ({ defaultColor, fontSize, pinEnabled }) =>
    set({ defaultColor, fontSize, pinEnabled }),
  setToast: (toast) => {
    set({ toast });
    if (toast) {
      window.setTimeout(() => {
        if (useUiStore.getState().toast === toast) set({ toast: null });
      }, 2400);
    }
  },
  setStaleNoteId: (staleNoteId) => set({ staleNoteId }),
  patchNote: (note) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? note : n)),
    })),
  mergeNoteMeta: (note) =>
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === note.id
          ? {
              ...n,
              title: note.title,
              color: note.color,
              pinned: note.pinned,
              archivedAt: note.archivedAt,
              updatedAt: note.updatedAt,
            }
          : n,
      ),
    })),
}));
