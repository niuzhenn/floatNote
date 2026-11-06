import { Minus, Settings, X } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as api from "../../lib/api";
import { useUiStore } from "../../store/uiStore";
import { IconButton } from "../ui/IconButton";

interface WindowChromeProps {
  /** 小窗用白色/反色按钮 */
  inverse?: boolean;
  /** 拖动区左边界（px）：让开左侧便签列表，默认 240 */
  dragLeft?: number;
}

/**
 * 无标题栏窗口的控制层：
 * - 顶部一条透明拖动区（Tauri data-tauri-drag-region）
 * - 右上角一组圆形纸片按钮，hover 才显形
 */
export function WindowChrome({ inverse = false, dragLeft = 240 }: WindowChromeProps) {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  // 最小化：正常缩到任务栏（图标保留），不隐藏到托盘
  const minimize = () => {
    getCurrentWebviewWindow()
      .minimize()
      .catch((err) => console.error("minimize failed", err));
  };

  // 关闭：收进托盘（窗口隐藏、任务栏图标消失），进程继续驻留
  const close = () => {
    api.hideMainWindow().catch((err) => console.error("hide failed", err));
  };

  return (
    <>
      {/* 拖动区只覆盖右侧内容区顶部，左侧列表让出来给搜索框（起点跟着列表宽度走） */}
      <div
        data-tauri-drag-region
        style={{ left: dragLeft }}
        className="absolute right-0 top-0 z-10 h-11"
        aria-hidden="true"
      />
      <div className="absolute right-2.5 top-2.5 z-30 flex items-center gap-0.5 opacity-55 transition-opacity duration-150 hover:opacity-100">
        <IconButton label="设置" inverse={inverse} onClick={() => setSettingsOpen(true)}>
          <Settings size={15} strokeWidth={1.7} />
        </IconButton>
        <IconButton label="最小化到托盘" inverse={inverse} onClick={minimize}>
          <Minus size={15} strokeWidth={1.9} />
        </IconButton>
        <IconButton label="关闭到托盘" inverse={inverse} onClick={close}>
          <X size={15} strokeWidth={1.9} />
        </IconButton>
      </div>
    </>
  );
}
