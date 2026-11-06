import type { CSSProperties } from "react";
import { PAPER } from "../theme/tokens";
import type { PaperColor } from "../types";

/**
 * 纸面光影：一层极轻的斜向高光/暗角，叠在纸色之上。
 * 与微软便签的纯平涂相比多一层"纸"的质感，但幅度很小，不喧哗。
 */
export function paperSurface(color: PaperColor): CSSProperties {
  const token = PAPER[color] ?? PAPER.cream;
  return {
    backgroundColor: token.bg,
    backgroundImage:
      "linear-gradient(158deg, rgba(255,255,255,.46) 0%, rgba(255,255,255,0) 44%, rgba(0,0,0,.045) 100%)",
    color: token.ink,
  };
}

/** 顶部 1px 内高光，模拟纸边反光 */
export const PAPER_EDGE_HIGHLIGHT = "inset 0 1px 0 rgba(255,255,255,.55)";

export function paperTextColor(color: PaperColor): string {
  return (PAPER[color] ?? PAPER.cream).ink;
}

export function paperSubColor(color: PaperColor): string {
  return (PAPER[color] ?? PAPER.cream).sub;
}

/** 摘要：把 HTML 正文压成一行纯文本 */
export function excerpt(text: string, limit = 60): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit)}…`;
}

/** 相对时间：刚刚 / 3 分钟前 / 昨天 / 6月12日 */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) return "昨天";

  const date = new Date(ts);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 字数统计（以纯文本为准，中文按字计） */
export function countChars(text: string): number {
  return text.replace(/\s/g, "").length;
}
