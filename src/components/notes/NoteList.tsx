import { Archive, Plus, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import type { Note, NoteScope, PaperColor } from "../../types";
import { NoteContextMenu } from "./NoteContextMenu";
import { NoteListCard } from "./NoteListCard";
import { MenuRoot, MenuTrigger } from "../ui/Menu";

interface NoteListProps {
  notes: Note[];
  currentNoteId: string | null;
  scope: NoteScope;
  query: string;
  archivedCount: number;
  isPinnedToDesktop: (id: string) => boolean;
  onQuery: (query: string) => void;
  onScope: (scope: NoteScope) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (note: Note) => void;
  onTogglePin: (id: string) => void;
  onColor: (id: string, color: PaperColor) => void;
  onPinDesktop: (id: string) => void;
  onUnpinDesktop: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  /** 列表宽度（px），由外层拖动分隔条控制 */
  width: number;
}

const TAB_BASE =
  "relative pb-1.5 text-[12.5px] transition-colors duration-150 focus-visible:outline-none";

export function NoteList({
  notes,
  currentNoteId,
  scope,
  query,
  archivedCount,
  isPinnedToDesktop,
  onQuery,
  onScope,
  onSelect,
  onCreate,
  onRename,
  onTogglePin,
  onColor,
  onPinDesktop,
  onUnpinDesktop,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
  width,
}: NoteListProps) {
  return (
    <aside
      style={{ width }}
      className="flex h-full shrink-0 flex-col bg-surface px-2 pb-3 pt-3"
    >
      {/* 搜索：无边框，只有 hover/focus 时的浅底 */}
      <div className="group flex items-center gap-2 rounded-btn px-2 py-1.5 transition-colors hover:bg-black/[0.04] focus-within:bg-black/[0.045]">
        <Search size={14} strokeWidth={1.8} className="shrink-0 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="搜索便签"
          className="w-full border-0 bg-transparent p-0 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQuery("")}
            className="shrink-0 rounded px-1 text-[11px] text-ink-faint transition-colors hover:text-ink"
          >
            清除
          </button>
        ) : null}
      </div>

      {/* 范围切换 */}
      <div className="mt-2 flex items-center gap-4 px-2">
        <button
          type="button"
          onClick={() => onScope("active")}
          className={cn(
            TAB_BASE,
            scope === "active"
              ? "font-medium text-ink"
              : "text-ink-muted hover:text-ink",
          )}
        >
          便签
          {scope === "active" ? (
            <span className="absolute -inset-x-1 -bottom-px h-[2px] rounded-full bg-accent" />
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => onScope("archived")}
          className={cn(
            TAB_BASE,
            scope === "archived"
              ? "font-medium text-ink"
              : "text-ink-muted hover:text-ink",
          )}
        >
          已归档
          {archivedCount > 0 ? (
            <span className="ml-1 font-mono text-[11px] text-ink-faint">{archivedCount}</span>
          ) : null}
          {scope === "archived" ? (
            <span className="absolute -inset-x-1 -bottom-px h-[2px] rounded-full bg-accent" />
          ) : null}
        </button>
      </div>

      {/* 列表：顶部留出描边空间，否则第一张卡片的选中 ring 会被滚动容器裁掉 */}
      <div className="-mx-1 mt-3 flex-1 space-y-2 overflow-y-auto px-1 pt-1.5 pb-2">
        {notes.map((note) => (
          <MenuRoot key={note.id}>
            <MenuTrigger asChild>
              <div>
                <NoteListCard
                  note={note}
                  selected={note.id === currentNoteId}
                  pinnedToDesktop={isPinnedToDesktop(note.id)}
                  onSelect={() => onSelect(note.id)}
                  // 归档视图只读，双击不再进入改名
                  onRename={scope === "archived" ? undefined : () => onRename(note)}
                />
              </div>
            </MenuTrigger>
            <NoteContextMenu
              note={note}
              scope={scope}
              pinnedToDesktop={isPinnedToDesktop(note.id)}
              onPinDesktop={() => onPinDesktop(note.id)}
              onUnpinDesktop={() => onUnpinDesktop(note.id)}
              onTogglePin={() => onTogglePin(note.id)}
              onColor={(color) => onColor(note.id, color)}
              onRename={() => onRename(note)}
              onDuplicate={() => onDuplicate(note.id)}
              onArchive={() => onArchive(note.id)}
              onUnarchive={() => onUnarchive(note.id)}
              onDelete={() => onDelete(note.id)}
            />
          </MenuRoot>
        ))}

        {notes.length === 0 ? (
          <div className="mt-10 flex flex-col items-center px-4 text-center">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-black/[0.14] text-ink-faint">
              {scope === "archived" ? (
                <Archive size={26} strokeWidth={1.3} />
              ) : (
                <Plus size={26} strokeWidth={1.4} />
              )}
            </div>
            <p className="mt-4 text-[14px] text-ink">
              {scope === "archived" ? "还没有归档的便签" : "新建一条便签"}
            </p>
            <p className="mt-1 text-[12px] text-ink-faint">
              {query
                ? "试试别的关键词"
                : scope === "archived"
                  ? "在便签上右键可以归档"
                  : "Ctrl + N"}
            </p>
          </div>
        ) : null}
      </div>

      {/* 新建：只在「便签」视图提供，归档区不该在这里创建新便签 */}
      {scope === "active" ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-1 flex items-center gap-1.5 rounded-btn px-2 py-2 text-[13px] text-ink-muted transition-colors hover:bg-black/[0.045] hover:text-ink"
        >
          <Plus size={15} strokeWidth={2} />
          新建便签
        </button>
      ) : null}
    </aside>
  );
}
