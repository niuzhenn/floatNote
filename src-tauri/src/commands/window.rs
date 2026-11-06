use tauri::{AppHandle, Manager, WebviewWindow};

/// 最小化到托盘：隐藏窗口，任务栏图标随消失（不是缩到任务栏）。
#[tauri::command]
pub fn window_minimize_to_tray(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| format!("隐藏窗口失败: {e}"))
}

#[tauri::command]
pub fn window_show_main(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn window_hide_main(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    Ok(())
}

/// 真正退出（托盘菜单使用）。
#[tauri::command]
pub fn window_quit(app: AppHandle) {
    app.exit(0);
}
