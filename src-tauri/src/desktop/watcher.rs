//! 桌面便签守护。
//!
//! 每 100ms 巡检一次已钉桌面的小窗：
//! - 被「显示桌面」(Win+D) 最小化或隐藏时自动恢复，并重新贴回桌面层
//! - 未聚焦时把窗口压回桌面层（用户点了别处之后它会自己回到底层）
//! - 被丢到屏幕外时按记忆坐标复位
//!
//! 之所以要这么快：Win+D 会把桌面窗口提到 Z 序最前，把便签压在桌面底下。
//! 只能靠「重新插回桌面之上」来恢复，间隔多长，用户就看到多长的空档。

#![cfg(target_os = "windows")]

use std::time::Duration;
use tauri::{AppHandle, Manager};
use windows_sys::Win32::UI::WindowsAndMessaging::{IsIconic, IsWindow, IsWindowVisible};

use crate::db::window_repo;
use crate::desktop;
use crate::state::AppState;

const OFFSCREEN_THRESHOLD: f64 = -30000.0;

/// 巡检间隔：直接等于「Win+D 之后便签被盖住的时长」。
/// 100ms 约 6 帧，肉眼基本察觉不到；再快收益很小，反而增加主线程负担。
const TICK: Duration = Duration::from_millis(100);

pub fn start(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(TICK);
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || supervise(&handle));
    });
}

fn supervise(app: &AppHandle) {
    let state = app.state::<AppState>();
    let pinned = state.windows.all();
    if pinned.is_empty() {
        return;
    }

    for (note_id, label) in pinned {
        let Some(win) = app.get_webview_window(&label) else {
            // 窗口已经不存在了，顺手清掉注册表里的僵尸条目
            log::warn!("pinned window missing, drop registry entry: {label}");
            state.windows.remove(&note_id);
            continue;
        };

        let Some(hwnd) = desktop::hwnd_of(&win) else {
            continue;
        };

        // 句柄可能在巡检与销毁之间失效，使用前必须校验，避免操作到被系统复用的句柄
        if unsafe { IsWindow(hwnd as _) } == 0 {
            state.windows.remove(&note_id);
            continue;
        }

        // 正在编辑时不动它，否则会把它从用户眼前压到别的窗口后面
        if win.is_focused().unwrap_or(false) {
            continue;
        }

        let (visible, iconic) = unsafe {
            (
                IsWindowVisible(hwnd as _) != 0,
                IsIconic(hwnd as _) != 0,
            )
        };

        if iconic || !visible {
            log::info!("restore hidden/minimized pinned window {label}");
            let _ = win.unminimize();
            let _ = win.show();
            let _ = desktop::pin_to_bottom(&win);
            continue;
        }

        let position = win.outer_position().ok();
        let offscreen = position
            .map(|pos| pos.x as f64 <= OFFSCREEN_THRESHOLD || pos.y as f64 <= OFFSCREEN_THRESHOLD)
            .unwrap_or(false);

        if offscreen {
            let bounds = {
                let conn = state.conn();
                window_repo::get(&conn, &note_id).ok().flatten()
            };
            if let Some(b) = bounds {
                log::info!("restore offscreen pinned window {label}");
                desktop::restore_offscreen(&win, b.x, b.y, b.w, b.h);
            }
            continue;
        }

        // 无条件压回桌面层：SetWindowPos 是幂等的，窗口已经在正确位置时不会引起任何视觉变化；
        // 一旦被「显示桌面」盖住，下一次巡检就能把它拉回来。
        let _ = desktop::pin_to_bottom(&win);
    }
}
