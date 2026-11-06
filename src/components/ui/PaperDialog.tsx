import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface PaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: number;
}

export function PaperDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = 480,
}: PaperDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/[0.18] backdrop-blur-[2px]" />
        {/* 定位层与动画层必须分开：pop-in 用 fill-mode:both 会保留 transform，
            若和 -translate-1/2 写在同一元素上，居中位移会被 scale(1) 覆盖导致弹窗偏到右下。 */}
        <Dialog.Content
          style={{ width }}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none"
        >
          <div className="max-h-[86vh] overflow-y-auto rounded-window bg-surface p-6 shadow-pop animate-pop-in">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[12.5px] text-ink-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="关闭"
                className="flex h-7 w-7 items-center justify-center rounded-btn text-ink-muted transition-colors hover:bg-black/[0.06] hover:text-ink"
              >
                <X size={16} strokeWidth={1.6} />
              </button>
            </Dialog.Close>
          </div>
          {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
