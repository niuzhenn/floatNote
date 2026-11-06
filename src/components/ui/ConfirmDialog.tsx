import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger：破坏性操作，用柔和的砖红；default：琥珀强调色 */
  tone?: "danger" | "default";
  icon?: ReactNode;
  onConfirm: () => void;
}

/**
 * 轻量确认弹窗。
 *
 * 和 PaperDialog（表单类大面板）区分开：这里结构固定为
 * 「小圆形图标 + 标题 + 一句说明 + 两个按钮」，宽 320、内边距紧凑，
 * 不画右上角关闭按钮（取消本身就是关闭），整体贴合纸面的扁平质感。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确定",
  cancelLabel = "取消",
  tone = "default",
  icon,
  onConfirm,
}: ConfirmDialogProps) {
  const danger = tone === "danger";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/[0.16] backdrop-blur-[2px]" />
        <Dialog.Content
          // 打开时不让焦点自动落到按钮上：否则「取消」一出现就带一圈焦点环
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[380px] -translate-x-1/2 -translate-y-1/2 outline-none"
        >
          <div className="animate-pop-in rounded-window bg-surface p-5 ring-1 ring-black/[0.07] shadow-[0_10px_30px_rgba(0,0,0,.12)]">
            {/* 图标与文字同行：图标当行首标记，不单独占一行 */}
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-[1px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  danger ? "bg-[#C4453F]/10 text-[#C4453F]" : "bg-black/[0.06] text-ink-muted",
                )}
              >
                {icon ?? <Trash2 size={14} strokeWidth={1.9} />}
              </span>

              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="h-8 rounded-btn px-3.5 text-[13px] text-ink-muted outline-none transition-colors hover:bg-black/[0.05] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
                >
                  {cancelLabel}
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  "h-8 rounded-btn px-3.5 text-[13px] font-medium text-white outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-accent/45",
                  danger ? "bg-[#C4453F] hover:bg-[#B23B36]" : "bg-accent hover:bg-accent-deep",
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
