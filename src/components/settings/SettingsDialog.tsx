import { useEffect, useState, type ReactNode } from "react";
import * as api from "../../lib/api";
import { cn } from "../../lib/cn";
import { useUiStore } from "../../store/uiStore";
import { PAPER, PAPER_ORDER } from "../../theme/tokens";
import { PaperDialog } from "../ui/PaperDialog";
import { Toggle } from "../ui/Toggle";

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-2.5 mt-5 text-[12px] font-medium tracking-wide text-ink-faint first:mt-0">
      {children}
    </h3>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <p className="text-[13px] text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-[11.5px] text-ink-faint">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const defaultColor = useUiStore((s) => s.defaultColor);
  const fontSize = useUiStore((s) => s.fontSize);
  const pinEnabled = useUiStore((s) => s.pinEnabled);
  const setPreferences = useUiStore((s) => s.setPreferences);
  const setToast = useUiStore((s) => s.setToast);

  const [autostart, setAutostart] = useState(false);
  const [dir, setDir] = useState("");

  useEffect(() => {
    if (!open) return;
    api
      .autostartEnabled()
      .then(setAutostart)
      .catch((err) => console.error("read autostart failed", err));
    api
      .dataDir()
      .then(setDir)
      .catch((err) => console.error("read data dir failed", err));
  }, [open]);

  const persist = (key: string, value: string) => {
    api.writeSetting(key, value).catch((err) => console.error("save setting failed", err));
  };

  const pickColor = (color: typeof defaultColor) => {
    setPreferences({ defaultColor: color, fontSize, pinEnabled });
    persist("defaultColor", color);
  };

  const pickFontSize = (size: number) => {
    setPreferences({ defaultColor, fontSize: size, pinEnabled });
    persist("fontSize", String(size));
  };

  const togglePin = (enabled: boolean) => {
    setPreferences({ defaultColor, fontSize, pinEnabled: enabled });
    persist("pinEnabled", String(enabled));
  };

  const toggleAutostart = (enabled: boolean) => {
    api
      .setAutostart(enabled)
      .then((state) => {
        setAutostart(state);
        setToast(state ? "已开启开机自启" : "已关闭开机自启");
      })
      .catch((err) => {
        console.error("set autostart failed", err);
        setToast("修改开机自启失败");
      });
  };

  return (
    <PaperDialog open={open} onOpenChange={setOpen} title="设置">
      <Row label="默认纸色" hint="新建便签时使用的颜色">
        <div className="flex gap-1.5">
          {PAPER_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              title={PAPER[color].label}
              aria-label={`默认纸色 ${PAPER[color].label}`}
              onClick={() => pickColor(color)}
              className={cn(
                "h-6 w-6 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110",
                defaultColor === color && "outline outline-2 outline-offset-1 outline-accent",
              )}
              style={{ backgroundColor: PAPER[color].bg }}
            />
          ))}
        </div>
      </Row>
      <Row label="正文字号">
        <div className="flex items-center gap-1 rounded-btn bg-black/[0.05] p-0.5">
          {[14, 15, 16, 17].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => pickFontSize(size)}
              className={cn(
                "rounded-[6px] px-2 py-1 font-mono text-[11.5px] transition-colors",
                fontSize === size
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </Row>

      <Row label="允许钉到桌面" hint="关闭后右键菜单将无法把小窗贴到桌面">
        <Toggle checked={pinEnabled} onCheckedChange={togglePin} label="允许钉到桌面" />
      </Row>

      <Row label="开机自动启动" hint="登录 Windows 后自动在托盘待命">
        <Toggle checked={autostart} onCheckedChange={toggleAutostart} label="开机自动启动" />
      </Row>

      <SectionTitle>数据</SectionTitle>
      <p className="select-text break-all rounded-btn bg-black/[0.04] px-2.5 py-2 font-mono text-[11px] text-ink-muted">
        {dir || "读取中…"}
      </p>
    </PaperDialog>
  );
}
