use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::{notes_repo, window_repo};
use crate::desktop;
use crate::state::AppState;
use crate::windows::note_window;

const DEFAULT_W: f64 = 300.0;
const DEFAULT_H: f64 = 320.0;

/// 钉到桌面：创建（或复用）桌面便签小窗并挂到 WorkerW。
///
/// 必须是 async 命令：`WebviewWindowBuilder::build()` 内部会把建窗调度到主线程并
/// 阻塞等待，同步命令若在主线程执行就会自锁（UI 点了没反应）。async 命令在后台
/// 线程运行，主线程保持空闲，建窗才能完成。
#[tauri::command]
pub async fn desktop_pin(
    app: AppHandle,
    state: State<'_, AppState>,
    note_id: String,
) -> Result<(), String> {
    log::info!("desktop_pin called for {note_id}");

    // 已钉 → 把它从桌面层提上来并聚焦。
    // 注意：只 show + focus 是不够的，窗口仍压在普通窗口之下，用户会以为"没反应"。
    if let Some(win) = app.get_webview_window(&note_window::label_for(&note_id)) {
        log::info!("desktop_pin: window exists, bring to front");
        let _ = win.show();
        let _ = win.unminimize();
        let _ = desktop::unpin_from_bottom(&win);
        let _ = win.set_focus();
        return Ok(());
    }

    {
        let conn = state.conn();
        let note = notes_repo::get(&conn, &note_id)
            .map_err(|e| format!("读取便签失败: {e}"))?
            .ok_or_else(|| "便签不存在".to_string())?;
        if note.archived_at.is_some() {
            return Err("已归档的便签不能钉到桌面".to_string());
        }
    }

    let enabled = *state.pin_enabled.lock().unwrap_or_else(|e| e.into_inner());
    if !enabled {
        return Err("钉桌面能力已在设置中关闭".to_string());
    }

    // 主窗口矩形（逻辑坐标），用于位置避让
    let main_rect = app.get_webview_window("main").and_then(|win| {
        let p = win.outer_position().ok()?;
        let s = win.outer_size().ok()?;
        let scale = win.scale_factor().ok()?;
        Some((
            p.x as f64 / scale,
            p.y as f64 / scale,
            s.width as f64 / scale,
            s.height as f64 / scale,
        ))
    });

    // 位置：优先用上次记忆，否则放到主窗口右侧
    let (mut x, mut y, w, h) = {
        let conn = state.conn();
        match window_repo::get(&conn, &note_id) {
            Ok(Some(st)) => (st.x, st.y, st.w, st.h),
            _ => {
                let (mx, my, mw) = main_rect
                    .map(|(x, y, w, _)| (x, y, w))
                    .unwrap_or((320.0, 200.0, 900.0));
                let offset = state.windows.all().len() as f64 * 26.0;
                (mx + mw + 20.0 + offset, my + 40.0 + offset, DEFAULT_W, DEFAULT_H)
            }
        }
    };

    // 避让：若小窗会盖在主窗口下面（用户看不到），就把它推到主窗口左右两侧的空白处
    if let Some((ml, mt, mw, mh)) = main_rect {
        let overlaps = x < ml + mw && x + w > ml && y < mt + mh && y + h > mt;
        if overlaps {
            let screen_w = app
                .primary_monitor()
                .ok()
                .flatten()
                .map(|m| m.size().width as f64 / m.scale_factor())
                .unwrap_or(1920.0);
            let right = ml + mw + 24.0;
            x = if right + w <= screen_w - 8.0 {
                right
            } else {
                (ml - w - 24.0).max(8.0)
            };
            y = mt.max(8.0);
        }
    }

    let win = note_window::build(&app, &note_id, x, y, w, h)
        .map_err(|e| format!("创建桌面便签失败: {e}"))?;

    // Tauri 的同步 command 由 WebView2 在主线程回调，这里直接调用即可。
    // 注意：绝对不要再用 run_on_main_thread + 阻塞等待，那会主线程自己等自己（自锁）。
    //
    // 也刻意不在这里立刻沉到桌面层：新窗口会一出现就被主窗口盖住，用户会以为"没反应"。
    // 先让它以普通窗口浮到前面，用户点开别处后由守护线程（watcher）自动沉回桌面层。
    let _ = win.show();
    let _ = desktop::unpin_from_bottom(&win);
    let _ = win.set_focus();

    state.windows.add(&note_id, win.label());
    {
        let conn = state.conn();
        let _ = window_repo::save_bounds(&conn, &note_id, x, y, w, h);
        let _ = window_repo::set_pinned(&conn, &note_id, true);
    }

    let _ = app.emit("note://pinned", note_id.clone());
    log::info!("desktop_pin ok for {note_id}");
    Ok(())
}

/// 取消钉桌面（供命令与内部调用共用）。
pub fn unpin_internal(app: &AppHandle, note_id: &str) {
    let label = note_window::label_for(note_id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.destroy();
    }

    let state = app.state::<AppState>();
    state.windows.remove(note_id);
    {
        let conn = state.conn();
        let _ = window_repo::set_pinned(&conn, note_id, false);
    }
    let _ = app.emit("note://unpinned", note_id.to_string());
}

#[tauri::command]
pub async fn desktop_unpin(app: AppHandle, note_id: String) -> Result<(), String> {
    unpin_internal(&app, &note_id);
    Ok(())
}

#[tauri::command]
pub fn desktop_list_pinned(state: State<'_, AppState>) -> Vec<String> {
    state.windows.all().into_iter().map(|(id, _)| id).collect()
}

#[tauri::command]
pub async fn desktop_unpin_all(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let ids: Vec<String> = state.windows.all().into_iter().map(|(id, _)| id).collect();
    for id in ids {
        unpin_internal(&app, &id);
    }
    Ok(())
}

/// 启动时恢复上次仍处于「已钉桌面」的便签小窗。
pub fn restore_pinned(app: &AppHandle) {
    let state = app.state::<AppState>();
    let list = {
        let conn = state.conn();
        window_repo::pinned_ids(&conn).unwrap_or_default()
    };

    for item in list {
        let win = match note_window::build(app, &item.note_id, item.x, item.y, item.w, item.h) {
            Ok(w) => w,
            Err(e) => {
                log::warn!("restore pinned window failed: {e}");
                continue;
            }
        };
        let _ = win.show();
        match desktop::pin_to_bottom(&win) {
            Ok(()) => {
                state.windows.add(&item.note_id, win.label());
            }
            Err(e) => {
                log::warn!("restore pinned failed for {}: {e}", item.note_id);
                let _ = win.destroy();
            }
        }
    }
}
