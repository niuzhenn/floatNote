import * as ContextMenu from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export const MenuRoot = ContextMenu.Root;
export const MenuTrigger = ContextMenu.Trigger;

export function MenuContent({ children }: { children: ReactNode }) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Content
        className={cn(
          "z-50 min-w-[188px] rounded-card bg-white/95 p-1.5 backdrop-blur-xl",
          "shadow-pop ring-1 ring-black/[0.06]",
          "animate-pop-in origin-top-left",
        )}
      >
        {children}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );
}

interface MenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

export function MenuItem({
  onSelect,
  children,
  icon,
  danger = false,
  disabled = false,
  shortcut,
}: MenuItemProps) {
  return (
    <ContextMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-[13px] outline-none",
        "transition-colors duration-100",
        danger
          ? "text-[#C4453F] data-[highlighted]:bg-[#C4453F]/10"
          : "text-ink data-[highlighted]:bg-black/[0.055]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {icon ? <span className="flex h-[15px] w-[15px] items-center justify-center opacity-70">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? <span className="font-mono text-[11px] text-ink-faint">{shortcut}</span> : null}
    </ContextMenu.Item>
  );
}

export function MenuSeparator() {
  return <ContextMenu.Separator className="my-1 h-px bg-black/[0.07]" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <ContextMenu.Label className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium tracking-wide text-ink-faint">
      {children}
    </ContextMenu.Label>
  );
}
