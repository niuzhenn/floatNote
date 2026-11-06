import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  /** 深色纸面上使用 */
  inverse?: boolean;
  active?: boolean;
  size?: "sm" | "md";
}

/**
 * 圆形纸片按钮：默认低透明度，hover 才显形。
 * 用于窗口控制、工具胶囊、便签小窗的浮层按钮。
 */
export function IconButton({
  label,
  children,
  inverse = false,
  active = false,
  size = "md",
  className,
  ...rest
}: IconButtonProps) {
  const dimension = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-btn transition-all duration-150 ease-paper",
        dimension,
        inverse
          ? "text-white/85 hover:bg-white/18 hover:text-white"
          : "text-ink-muted hover:bg-black/[0.06] hover:text-ink",
        active && (inverse ? "bg-white/20 text-white" : "bg-accent/18 text-accent-deep"),
        "active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
