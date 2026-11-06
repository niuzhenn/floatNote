import type { PaperColor } from "../types";

export interface PaperToken {
  /** 纸面主色 */
  bg: string;
  /** 同族加深色（渐变尾色 / 顶部色带） */
  deep: string;
  /** 纸面主文字色 */
  ink: string;
  /** 纸面次级文字色 */
  sub: string;
  /** 中文名（设置面板用） */
  label: string;
}

export const PAPER: Record<PaperColor, PaperToken> = {
  cream: { bg: "#FFF4B8", deep: "#F3E39B", ink: "#3B3524", sub: "#7C7358", label: "奶黄" },
  mint: { bg: "#D9F0CF", deep: "#C3E1B4", ink: "#2C3A2B", sub: "#6A7C67", label: "薄荷" },
  sakura: { bg: "#FFD9E1", deep: "#F6C3CE", ink: "#3F2A2E", sub: "#7E6569", label: "樱粉" },
  lilac: { bg: "#E6DBF8", deep: "#D5C6F1", ink: "#322B41", sub: "#6F6683", label: "淡紫" },
  sky: { bg: "#CDE8FB", deep: "#B2D7F2", ink: "#22323D", sub: "#5F7382", label: "天青" },
  stone: { bg: "#ECECEC", deep: "#DCDCDC", ink: "#2B2B2B", sub: "#6E6E6E", label: "石膏灰" },
  charcoal: { bg: "#2C2C2C", deep: "#232323", ink: "#F2F0EC", sub: "#A8A29B", label: "深色" },
};

export const PAPER_ORDER: PaperColor[] = [
  "cream",
  "mint",
  "sakura",
  "lilac",
  "sky",
  "stone",
  "charcoal",
];

export const WINDOW_BG = "#F4F3F0";
export const WINDOW_BG_DARK = "#1F1F1F";
export const ACCENT = "#E8B24A";
export const INK = "#242424";
export const INK_MUTED = "#6E6A64";
export const INK_FAINT = "#A8A29B";

export const SHADOW_CARD = "0 1px 2px rgba(0,0,0,.05), 0 6px 20px rgba(0,0,0,.07)";
export const SHADOW_CARD_HOVER = "0 2px 4px rgba(0,0,0,.06), 0 12px 28px rgba(0,0,0,.10)";
export const SHADOW_POP = "0 8px 32px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06)";
