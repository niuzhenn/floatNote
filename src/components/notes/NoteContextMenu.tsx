import { Archive, ArrowUpRight, Copy, Pencil, Pin, Trash2, Undo2 } from "lucide-react";
import { MenuContent, MenuItem, MenuLabel, MenuSeparator } from "../ui/Menu";
import { PAPER, PAPER_ORDER } from "../../theme/tokens";
import type { Note, NoteScope, PaperColor } from "../../types";

interface NoteContextMenuProps {
  note: Note;
  scope: NoteScope;
  pinnedToDesktop: boolean;
  onPinDesktop: () => void;
  onUnpinDesktop: () => void;
  onTogglePin: () => void;
  onColor: (color: PaperColor) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

export function NoteContextMenu({
  note,
  scope,
  pinnedToDesktop,
  onPinDesktop,
  onUnpinDesktop,
  onTogglePin,
  onColor,
  onRename,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
}: NoteContextMenuProps) {
  if (scope === "archived") {
    return (
      <MenuContent>
        <MenuItem icon={<Undo2 size={14} />} onSelect={onUnarchive}>
          取消归档
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 size={14} />} danger onSelect={onDelete}>
          删除便签
        </MenuItem>
      </MenuContent>
    );
  }

  return (
    <MenuContent>
      <MenuItem
        icon={<Pin size={14} />}
        onSelect={pinnedToDesktop ? onUnpinDesktop : onPinDesktop}
      >
        {pinnedToDesktop ? "取消钉桌面" : "钉到桌面"}
      </MenuItem>
      <MenuItem icon={<ArrowUpRight size={14} />} onSelect={onTogglePin}>
        {note.pinned ? "取消置顶" : "置顶"}
      </MenuItem>

      <MenuSeparator />
      <MenuLabel>纸色</MenuLabel>
      <div className="flex gap-1.5 px-2.5 pb-2 pt-0.5">
        {PAPER_ORDER.map((color) => (
          <button
            key={color}
            type="button"
            title={PAPER[color].label}
            aria-label={`改为${PAPER[color].label}`}
            onClick={() => onColor(color)}
            className="h-5 w-5 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110"
            style={{
              backgroundColor: PAPER[color].bg,
              outline: note.color === color ? "2px solid #E8B24A" : "none",
              outlineOffset: "1px",
            }}
          />
        ))}
      </div>

      <MenuSeparator />
      <MenuItem icon={<Pencil size={14} />} onSelect={onRename}>
        重命名
      </MenuItem>
      <MenuItem icon={<Copy size={14} />} onSelect={onDuplicate}>
        创建副本
      </MenuItem>

      <MenuSeparator />
      {/* 归档与删除一致：若钉在桌面上，后端会先收回小窗再归档 */}
      <MenuItem icon={<Archive size={14} />} onSelect={onArchive}>
        归档
      </MenuItem>
      <MenuItem icon={<Trash2 size={14} />} danger onSelect={onDelete}>
        删除便签
      </MenuItem>
    </MenuContent>
  );
}
