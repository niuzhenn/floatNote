//! 桌面层封装。
//!
//! 实现选择说明：WebView2 窗口被 SetParent 成桌面（Progman/WorkerW）的子窗口后，
//! 会在 1~2 秒内被 WebView2 自身重建，父关系随即失效（实测 SetParent 返回的错误码为 87）。
//! 因此这里采用更可靠的等价方案：
//!   - 窗口不进入任务栏、不进 Alt+Tab（skip_taskbar）
//!   - 从未聚焦时把窗口压到 Z 序最底部（HWND_BOTTOM），于是它始终贴在桌面之上、
//!     所有普通应用窗口之下，切回桌面即可见，效果与腾讯桌面整理的分区一致
//!   - 聚焦时临时浮到前面以便编辑，失焦后自动回到底部
//!   - 被「显示桌面」(Win+D) 移到屏幕外时自动复位

#![cfg(target_os = "windows")]

pub mod style;
pub mod watcher;
pub mod workerw;

use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use tauri::WebviewWindow;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetAncestor, IsWindow, SetWindowPos, GA_ROOT, HWND_BOTTOM, HWND_TOP, SWP_NOACTIVATE,
    SWP_NOMOVE, SWP_NOSIZE,
};

/// 取 WebviewWindow 对应的原生顶层 HWND。
///
/// Tauri 2 没有 `hwnd()`，必须走 raw-window-handle；
/// window_handle() 可能给出 WebView2 内部子窗口，需用 GetAncestor(GA_ROOT) 提到顶层。
pub fn hwnd_of(window: &WebviewWindow) -> Option<isize> {
    let handle = window.window_handle().ok()?;
    let raw = match handle.as_raw() {
        RawWindowHandle::Win32(h) => h.hwnd.get() as isize,
        _ => return None,
    };

    unsafe {
        let top = GetAncestor(raw as _, GA_ROOT);
        if top.is_null() {
            Some(raw)
        } else {
            Some(top as isize)
        }
    }
}

/// 把窗口插到桌面窗口的正上方：
/// 高于壁纸与桌面图标、低于所有普通应用窗口。
fn insert_after_desktop(hwnd: isize) {
    let anchor = workerw::find_desktop_host().unwrap_or(HWND_BOTTOM);
    unsafe {
        SetWindowPos(
            hwnd as _,
            anchor,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

/// 贴在桌面上（Z 序：桌面图标之上、普通窗口之下）。
pub fn pin_to_bottom(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = hwnd_of(window).ok_or_else(|| "无法获取窗口句柄".to_string())?;
    unsafe {
        if IsWindow(hwnd as _) == 0 {
            return Err("窗口句柄无效".to_string());
        }
    }
    insert_after_desktop(hwnd);
    Ok(())
}

/// 取消贴桌面：恢复正常 Z 序（显示到最前）。
pub fn unpin_from_bottom(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = hwnd_of(window).ok_or_else(|| "无法获取窗口句柄".to_string())?;
    unsafe {
        if IsWindow(hwnd as _) == 0 {
            return Ok(());
        }
        SetWindowPos(
            hwnd as _,
            HWND_TOP,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
    Ok(())
}

/// 窗口被「显示桌面」丢到屏幕外时，用保存的坐标复位。
pub fn restore_offscreen(window: &WebviewWindow, x: f64, y: f64, w: f64, h: f64) {
    let _ = window.show();
    unsafe {
        let Some(hwnd) = hwnd_of(window) else { return };
        if IsWindow(hwnd as _) == 0 {
            return;
        }
        SetWindowPos(
            hwnd as _,
            HWND_BOTTOM,
            x as i32,
            y as i32,
            w as i32,
            h as i32,
            SWP_NOACTIVATE,
        );
        insert_after_desktop(hwnd);
    }
}
