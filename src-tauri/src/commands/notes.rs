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
    log::info!(
        "notes_update id={} title={} html_len={} text_len={}",
        patch.id,
        patch.title.is_some(),
        patch.content_html.as_ref().map(|s| s.chars().count()).unwrap_or(0),
        patch.content_text.as_ref().map(|s| s.chars().count()).unwrap_or(0),
    );

    let note = {
        let conn = state.conn();

        // 归档便签只读：标题与正文一律拒绝修改（颜色、置顶等元数据不在此限制内）。
        // 前端在归档视图已禁用编辑与双击改名，这里再兜一层，防止绕过入口改到归档内容。
        let touches_content = patch.title.is_some()
            || patch.content_html.is_some()
            || patch.content_text.is_some();
        if touches_content {
            let existing = notes_repo::get(&conn, &patch.id)
                .map_err(|e| format!("读取便签失败: {e}"))?;

            // 已归档：静默忽略这次写入，直接返回当前内容。
            // 不用 Err —— 前端把「保存失败」当成需要重试的错误，会反复重发同一个请求
            //（切换视图时的 flush 就会不断撞上它），对用户表现为一直在报错。
            // 只读本身由前端保证，这里只是兜底，不需要把拒绝变成异常。
            if let Some(note) = existing {
                if note.archived_at.is_some() {
                    log::warn!("notes_update skipped: note {} is archived", patch.id);
                    return Ok(note);
                }
            }
        }

        notes_repo::update(&conn, &patch)
            .map_err(|e| {
                log::error!("notes_update db error id={}: {e}", patch.id);
                format!("保存便签失败: {e}")
            })?
            .ok_or_else(|| {
                log::warn!("notes_update: note {} not found", patch.id);
                "便签不存在".to_string()
            })?
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
    // 与删除保持一致：归档前先收回桌面小窗，避免「库里已归档、桌面上还挂着」
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
