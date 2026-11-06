import type { Editor } from "@tiptap/react";
import {
  Bold,
  CheckSquare,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { IconButton } from "../ui/IconButton";

const TEXT_COLORS = ["#242424", "#C4453F", "#2C7A5B", "#2F6BB3", "#8A5BD6"];

interface EditorToolbarProps {
  editor: Editor | null;
  compact?: boolean;
  className?: string;
}

/** 浮动工具胶囊：不是横条，聚焦时才浮现 */
export function EditorToolbar({ editor, compact = false, className }: EditorToolbarProps) {
  if (!editor) return null;

  const chain = () => editor.chain().focus();
  const active = {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    bullet: editor.isActive("bulletList"),
    ordered: editor.isActive("orderedList"),
    task: editor.isActive("taskList"),
    quote: editor.isActive("blockquote"),
    highlight: editor.isActive("highlight"),
  };

  // 与主窗口一致：不用白底胶囊与投影，图标直接印在纸面上
  if (compact) {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        <IconButton label="加粗" size="sm" active={active.bold} onClick={() => chain().toggleBold().run()}>
          <Bold size={14} strokeWidth={2} />
        </IconButton>
        <IconButton label="斜体" size="sm" active={active.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic size={14} strokeWidth={2} />
        </IconButton>
        <IconButton
          label="下划线"
          size="sm"
          active={active.underline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <UnderlineIcon size={14} strokeWidth={1.9} />
        </IconButton>
        <IconButton
          label="删除线"
          size="sm"
          active={active.strike}
          onClick={() => chain().toggleStrike().run()}
        >
          <Strikethrough size={14} strokeWidth={1.9} />
        </IconButton>

        <span className="mx-1 h-3.5 w-px bg-black/[0.09]" />

        <IconButton label="无序列表" size="sm" active={active.bullet} onClick={() => chain().toggleBulletList().run()}>
          <List size={14} strokeWidth={1.9} />
        </IconButton>
        <IconButton label="待办" size="sm" active={active.task} onClick={() => chain().toggleTaskList().run()}>
          <CheckSquare size={14} strokeWidth={1.8} />
        </IconButton>
        <IconButton
          label="高亮"
          size="sm"
          active={active.highlight}
          onClick={() => chain().toggleHighlight().run()}
        >
          <Highlighter size={14} strokeWidth={1.9} />
        </IconButton>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // 无底色：图标直接印在纸面上，hover 时按钮才有浅底，不与纸色打架
        "flex items-center gap-0.5",
        className,
      )}
    >
      <IconButton label="加粗 Ctrl+B" size="sm" active={active.bold} onClick={() => chain().toggleBold().run()}>
        <Bold size={15} strokeWidth={2.1} />
      </IconButton>
      <IconButton label="斜体 Ctrl+I" size="sm" active={active.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic size={15} strokeWidth={2} />
      </IconButton>
      <IconButton
        label="下划线 Ctrl+U"
        size="sm"
        active={active.underline}
        onClick={() => chain().toggleUnderline().run()}
      >
        <UnderlineIcon size={15} strokeWidth={1.9} />
      </IconButton>
      <IconButton
        label="删除线"
        size="sm"
        active={active.strike}
        onClick={() => chain().toggleStrike().run()}
      >
        <Strikethrough size={15} strokeWidth={1.9} />
      </IconButton>

      <span className="mx-1 h-4 w-px bg-black/[0.09]" />

      <IconButton label="无序列表" size="sm" active={active.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List size={15} strokeWidth={1.9} />
      </IconButton>
      <IconButton
        label="有序列表"
        size="sm"
        active={active.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered size={15} strokeWidth={1.9} />
      </IconButton>
      <IconButton
        label="待办清单 Ctrl+Enter"
        size="sm"
        active={active.task}
        onClick={() => chain().toggleTaskList().run()}
      >
        <CheckSquare size={15} strokeWidth={1.9} />
      </IconButton>
      <IconButton label="引用" size="sm" active={active.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote size={15} strokeWidth={1.9} />
      </IconButton>

      <span className="mx-1 h-4 w-px bg-black/[0.09]" />

      <IconButton
        label="高亮"
        size="sm"
        active={active.highlight}
        onClick={() => chain().toggleHighlight().run()}
      >
        <Highlighter size={15} strokeWidth={1.9} />
      </IconButton>

      <div className="ml-1 flex items-center gap-1.5 pr-0.5">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={`文字颜色 ${color}`}
            aria-label={`文字颜色 ${color}`}
            onClick={() => chain().setColor(color).run()}
            className="h-3 w-3 rounded-full ring-1 ring-black/15 transition-transform hover:scale-110"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
