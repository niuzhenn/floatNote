import { Pin } from "lucide-react";
import { cn } from "../../lib/cn";
import { excerpt, paperSurface, relativeTime } from "../../lib/paper";
import { PAPER } from "../../theme/tokens";
import type { Note } from "../../types";

interface NoteListCardProps {
  note: Note;
  selected: boolean;
  pinnedToDesktop: boolean;
  onSelect: () => void;
  onRename: () => void;
}

/** 一张便签缩略卡：底色即纸色，标题 + 两行摘要 + 相对时间 */
export function NoteListCard({
  note,
  selected,
  pinnedToDesktop,
  onSelect,
  onRename,
}: NoteListCardProps) {
  const token = PAPER[note.color] ?? PAPER.cream;

  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onRename}
      style={paperSurface(note.color)}
      className={cn(
        "group relative flex h-[96px] w-full flex-col gap-1.5 overflow-hidden rounded-card px-3 py-2 text-left",
        "shadow-card transition-all duration-150 ease-paper",
        "hover:-translate-y-px hover:shadow-card-hover",
        selected && "shadow-card-hover ring-[1.5px] ring-accent",
      )}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-70"
        style={{ backgroundColor: token.deep }}
      />

      <div className="flex shrink-0 items-start gap-1.5">
        <span className="line-clamp-1 flex-1 text-list-title" style={{ color: token.ink }}>
          {note.title.trim() || "无标题"}
        </span>
        {note.pinned ? (
          <Pin
            size={11}
            strokeWidth={2.2}
            className="mt-[3px] shrink-0 opacity-45"
            style={{ color: token.ink }}
          />
        ) : null}
        {pinnedToDesktop ? (
          <span className="mt-[6px] h-1.5 w-1.5 shrink-0 animate-dot-in rounded-full bg-accent" />
        ) : null}
      </div>

      <p
        className="line-clamp-2 shrink-0 pr-1 text-micro"
        style={{ color: token.sub }}
      >
        {excerpt(note.contentText, 48) || "空白便签"}
      </p>

      <span
        className="mt-auto shrink-0 font-mono text-micro opacity-60"
        style={{ color: token.sub }}
      >
        {relativeTime(note.updatedAt)}
      </span>
    </button>
  );
}
