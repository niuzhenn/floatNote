use tauri::{AppHandle, Emitter, State, WebviewWindow};

use crate::db::notes_repo::{self, Note, NotePatch};
use crate::state::AppState;

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteCounts {
    pub active: i64,
    pub archived: i64,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NoteEvent {
    id: String,
    source: String,
    updated_at: i64,
}

fn broadcast(app: &AppHandle, channel: &str, note: &Note, source: &str) {
    let payload = NoteEvent {
        id: note.id.clone(),
        source: source.to_string(),
        updated_at: note.updated_at,
    };
    let _ = app.emit(channel, payload);
}

#[tauri::command]
pub fn notes_list(
    state: State<'_, AppState>,
    scope: String,
    query: String,
) -> Result<Vec<Note>, String> {
    log::info!("notes_list scope={scope} query={query:?}");
    let conn = state.conn();
    let list = notes_repo::list(&conn, &scope, &query).map_err(|e| format!("读取便签失败: {e}"))?;
    log::info!("notes_list -> {} notes", list.len());
    Ok(list)
}

#[tauri::command]
pub fn notes_get(state: State<'_, AppState>, id: String) -> Result<Option<Note>, String> {
    let conn = state.conn();
    notes_repo::get(&conn, &id).map_err(|e| format!("读取便签失败: {e}"))
}

#[tauri::command]
pub fn notes_create(state: State<'_, AppState>, color: String) -> Result<Note, String> {
    let conn = state.conn();
    notes_repo::create(&conn, &color).map_err(|e| format!("新建便签失败: {e}"))
}

#[tauri::command]
pub fn notes_counts(state: State<'_, AppState>) -> Result<NoteCounts, String> {
    let conn = state.conn();
    Ok(NoteCounts {
        active: notes_repo::count(&conn, "active").unwrap_or(0),
        archived: notes_repo::count(&conn, "archived").unwrap_or(0),
    })
}

#[tauri::command]
pub fn notes_update(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    patch: NotePatch,
) -> Result<Note, String> {
    let note = {
        let conn = state.conn();
        notes_repo::update(&conn, &patch)
            .map_err(|e| format!("保存便签失败: {e}"))?
            .ok_or_else(|| "便签不存在".to_string())?
    };

    broadcast(&app, "note://changed", &note, window.label());
    Ok(note)
}

#[tauri::command]
pub fn notes_toggle_pin(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    id: String,
) -> Result<Note, String> {
    let note = {
        let conn = state.conn();
        notes_repo::toggle_pin(&conn, &id)
            .map_err(|e| format!("更新置顶失败: {e}"))?
            .ok_or_else(|| "便签不存在".to_string())?
    };

    broadcast(&app, "note://changed", &note, window.label());
    Ok(note)
}

#[tauri::command]
pub fn notes_duplicate(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Note, String> {
    let note = {
        let conn = state.conn();
        notes_repo::duplicate(&conn, &id)
            .map_err(|e| format!("复制便签失败: {e}"))?
            .ok_or_else(|| "便签不存在".to_string())?
    };

    broadcast(&app, "note://created", &note, "main");
    Ok(note)
}

#[tauri::command]
pub fn notes_archive(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<Note, String> {
    // 归档前先收回桌面小窗，避免「库里已归档、桌面上还挂着」
    crate::commands::desktop::unpin_internal(&app, &id);

    let note = {
        let conn = state.conn();
        notes_repo::set_archived(&conn, &id, true)
            .map_err(|e| format!("归档失败: {e}"))?
            .ok_or_else(|| "便签不存在".to_string())?
    };

    broadcast(&app, "note://archived", &note, "main");
    Ok(note)
}

#[tauri::command]
pub fn notes_unarchive(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Note, String> {
    let note = {
        let conn = state.conn();
        notes_repo::set_archived(&conn, &id, false)
            .map_err(|e| format!("取消归档失败: {e}"))?
            .ok_or_else(|| "便签不存在".to_string())?
    };

    broadcast(&app, "note://unarchived", &note, "main");
    Ok(note)
}

#[tauri::command]
pub fn notes_delete(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    // 删除前同样先收回小窗
    crate::commands::desktop::unpin_internal(&app, &id);

    let conn = state.conn();
    notes_repo::remove(&conn, &id).map_err(|e| format!("删除便签失败: {e}"))?;
    drop(conn);

    let _ = app.emit("note://deleted", id);
    Ok(())
}
