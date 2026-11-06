import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

interface NoteEditorProps {
  noteId: string;
  html: string;
  compact?: boolean;
  fontSize?: number;
  reloadToken?: number;
  /** 只读（归档视图用）：能选中、复制、滚动，但不能编辑 */
  readOnly?: boolean;
  onChange: (html: string, text: string) => void;
  onReady?: (editor: Editor) => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function NoteEditor({
  noteId,
  html,
  compact = false,
  fontSize = 14,
  reloadToken = 0,
  readOnly = false,
  onChange,
  onReady,
}: NoteEditorProps) {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  // 供 handlePaste / handleDrop 在初始化闭包里安全访问实例
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder: compact ? "写点什么…" : "在这里记下想法…（Ctrl+Enter 可勾选待办）",
      }),
    ],
    content: html,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: compact ? "outline-none" : "outline-none",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;

        event.preventDefault();
        images.forEach((file) => {
          if (file.size > MAX_IMAGE_BYTES) {
            console.warn("image too large, skipped", file.size);
            return;
          }
          fileToDataUrl(file)
            .then((url) => editorRef.current?.chain().focus().setImage({ src: url }).run())
            .catch((err) => console.error("paste image failed", err));
        });
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;

        event.preventDefault();
        images.forEach((file) => {
          if (file.size > MAX_IMAGE_BYTES) {
            console.warn("image too large, skipped", file.size);
            return;
          }
          fileToDataUrl(file)
            .then((url) => editorRef.current?.chain().focus().setImage({ src: url }).run())
            .catch((err) => console.error("drop image failed", err));
        });
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      changeRef.current(instance.getHTML(), instance.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editorRef.current = editor;
    readyRef.current?.(editor);
    // Ctrl/Cmd + Enter 勾选当前待办项（只读时忽略）
    const onKeyDown = (event: KeyboardEvent) => {
      if (readOnly) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        editor.chain().focus().toggleTaskList().run();
      }
    };
    const node = editor.view.dom;
    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [editor, readOnly]);

  // 归档视图只读：切换 scope 时同步可编辑状态
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // 切换便签时整篇替换（不触发 onChange）
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(html, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, editor]);

  // 他处更新后按需重载
  useEffect(() => {
    if (!editor || reloadToken === 0) return;
    editor.commands.setContent(html, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  return (
    <EditorContent
      editor={editor}
      style={{ fontSize }}
      className={compact ? "note-editor-compact" : "note-editor"}
    />
  );
}
