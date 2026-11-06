import { Minus, Settings, X } from "lucide-react";
import * as api from "../../lib/api";
import { useUiStore } from "../../store/uiStore";
import { IconButton } from "../ui/IconButton";

interface WindowChromeProps {
  /** 小窗用白色/反色按钮 */
  inverse?: boolean;
}

/**
 * 无标题栏窗口的控制层：
 * - 顶部一条透明拖动区（Tauri data-tauri-drag-region）
 * - 右上角一组圆形纸片按钮，hover 才显形
 */
export function WindowChrome({ inverse = false }: WindowChromeProps) {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const minimize = () => {
    api.minimizeToTray().catch((err) => console.error("minimize failed", err));
  };

  const close = () => {
    api.hideMainWindow().catch((err) => console.error("hide failed", err));
  };

  return (
    <>
      <div
        data-tauri-drag-region
        className="absolute inset-x-0 top-0 z-10 h-11"
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
