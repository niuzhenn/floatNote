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
        // 扁平化：不用投影，用 1px 细描边界定卡片；hover 只加深描边，不做位移
        // 紧凑高度：标题一行 + 摘要与时间同行，一屏能多放一张
        "group relative flex h-[56px] w-full flex-col justify-center gap-0.5 overflow-hidden rounded-check px-3 text-left",
        "ring-1 ring-black/[0.07] transition-[box-shadow] duration-150",
        "hover:ring-black/[0.16]",
        selected && "ring-[1.5px] ring-accent",
      )}
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="line-clamp-1 flex-1 text-list-title" style={{ color: token.ink }}>
          {note.title.trim() || "无标题"}
        </span>
        {note.pinned ? (
          <Pin size={11} strokeWidth={2.2} className="shrink-0 opacity-45" style={{ color: token.ink }} />
        ) : null}
        {pinnedToDesktop ? (
          <span className="h-1.5 w-1.5 shrink-0 animate-dot-in rounded-full bg-accent" />
        ) : null}
      </div>

      <div className="flex shrink-0 items-baseline gap-2">
        <p className="line-clamp-1 flex-1 text-micro" style={{ color: token.sub }}>
          {excerpt(note.contentText, 48) || "空白便签"}
        </p>
        <span className="shrink-0 font-mono text-micro opacity-60" style={{ color: token.sub }}>
          {relativeTime(note.updatedAt)}
        </span>
      </div>
    </button>
  );
}