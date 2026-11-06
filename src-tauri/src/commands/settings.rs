use std::collections::HashMap;
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

use crate::db::settings_repo;
use crate::state::AppState;

#[tauri::command]
pub fn settings_get_all(state: State<'_, AppState>) -> Result<HashMap<String, String>, String> {
    let conn = state.conn();
    settings_repo::get_all(&conn).map_err(|e| format!("读取设置失败: {e}"))
}

#[tauri::command]
pub fn settings_set(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    if key == "pinEnabled" {
        let enabled = value != "false";
        *state.pin_enabled.lock().unwrap_or_else(|e| e.into_inner()) = enabled;
    }

    let conn = state.conn();
    settings_repo::set(&conn, &key, &value).map_err(|e| format!("保存设置失败: {e}"))
}

#[tauri::command]
pub fn settings_set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let launch = app.autolaunch();
    if enabled {
        launch.enable().map_err(|e| format!("开启自启动失败: {e}"))?;
    } else {
        launch.disable().map_err(|e| format!("关闭自启动失败: {e}"))?;
    }
    launch.is_enabled().map_err(|e| format!("读取自启动状态失败: {e}"))
}

#[tauri::command]
pub fn settings_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| format!("读取自启动状态失败: {e}"))
}

#[tauri::command]
pub fn settings_data_dir(state: State<'_, AppState>) -> String {
    state.data_dir.to_string_lossy().to_string()
}
