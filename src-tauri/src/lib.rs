mod commands;
mod db;
pub mod desktop;
mod state;
mod tray;
mod windows;

use rusqlite::Connection;
use tauri::{Manager, WindowEvent};

use crate::commands::desktop as desktop_cmds;
use crate::state::AppState;

/// 首次启动时写入一条示例便签（含待办清单，方便立刻看到勾选效果）。
fn seed_if_empty(conn: &Connection) {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
        .unwrap_or(0);
    if count > 0 {
        return;
    }

    let Ok(note) = db::notes_repo::create(conn, "cream") else {
        return;
    };

    let html = concat!(
        "<p>这是一条示例便签，内容会自动保存。</p>",
        "<ul data-type=\"taskList\">",
        "<li data-checked=\"false\"><label><input type=\"checkbox\"></label><div><p>在便签栏右键，选择「钉到桌面」</p></div></li>",
        "<li data-checked=\"false\"><label><input type=\"checkbox\"></label><div><p>勾掉这一项，文字会自动划掉</p></div></li>",
        "</ul>",
        "<p>工具栏里有加粗、列表、待办、高亮等常用格式。</p>"
    );
    let text = "这是一条示例便签，内容会自动保存。在便签栏右键，选择「钉到桌面」。勾掉这一项，文字会自动划掉。";

    let patch = db::notes_repo::NotePatch {
        id: note.id,
        title: Some("欢迎使用便签".to_string()),
        content_html: Some(html.to_string()),
        content_text: Some(text.to_string()),
        color: None,
        pinned: None,
    };
    let _ = db::notes_repo::update(conn, &patch);
}

fn save_window_bounds(window: &tauri::Window) {
    let Some(note_id) = windows::note_window::note_id_from_label(window.label()) else {
        return;
    };
    let note_id = note_id.to_string();

    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };

    let state = window.state::<AppState>();
    let conn = state.conn();
    let _ = db::window_repo::save_bounds(
        &conn,
        &note_id,
        position.x as f64,
        position.y as f64,
        size.width as f64,
        size.height as f64,
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// 隐藏 tao 事件循环与 single-instance 插件创建的辅助消息窗口。
///
/// 它们本应是屏幕外的纯消息窗口，但在部分机器上会以 160x28 的灰色小块
/// 显示在桌面上（DWM 会绘制未设置样式的窗口背景）。消息投递不依赖
/// 窗口可见性，隐藏不影响功能。
fn hide_aux_message_windows() {
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::Foundation::HWND;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetClassNameW, ShowWindow, SW_HIDE,
        };

        unsafe extern "system" fn callback(hwnd: HWND, _lparam: isize) -> i32 {
            let mut buf = [0u16; 64];
            let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            if len > 0 {
                let name = String::from_utf16_lossy(&buf[..len as usize]);
                if name == "Tao Thread Event Target" || name.starts_with("com.niuz.floatnote-sic")
                {
                    ShowWindow(hwnd, SW_HIDE);
                }
            }
            1
        }

        EnumWindows(Some(callback), 0);
    }
}

/// 应用从 StickyNote 更名为 FloatNote，identifier 也随之变化，
/// 数据目录从 `com.niuz.stickynote` 变为 `com.niuz.floatnote`。
/// 启动时若发现旧目录且新目录不存在，则把旧目录整体迁移过去。
fn migrate_data_dir() {
    #[cfg(windows)]
    {
        for base in [std::env::var("APPDATA"), std::env::var("LOCALAPPDATA")] {
            let Ok(base) = base else { continue };
            let old = std::path::Path::new(&base).join("com.niuz.stickynote");
            let new = std::path::Path::new(&base).join("com.niuz.floatnote");
            if old.exists() && !new.exists() {
                if let Err(e) = std::fs::rename(&old, &new) {
                    eprintln!("数据目录迁移失败 {old:?} -> {new:?}: {e}");
                } else {
                    eprintln!("数据目录已迁移 {old:?} -> {new:?}");
                }
            }
        }
    }
}

pub fn run() {
    migrate_data_dir();

    // 桌面便签小窗被压到桌面层后，WebView2 会判定自己"被遮挡"而暂停渲染，
    // 结果窗口整块变透明（只剩零星残留）。关掉遮挡检测与后台节流，
    // 保证贴在桌面上的便签始终有画面。必须在创建任何 WebView 之前设置。
    #[cfg(windows)]
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--disable-features=CalculateNativeWinOcclusion \
         --disable-background-timer-throttling \
         --disable-backgrounding-occluded-windows \
         --disable-renderer-backgrounding",
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = commands::window::window_show_main(app.clone());
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(data_dir.join("attachments"))?;

            let conn = db::open(&data_dir).map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            seed_if_empty(&conn);

            app.manage(AppState::new(conn, data_dir));
            tray::create(app.handle())?;

            if let Some(main) = app.get_webview_window("main") {
                if let Some(hwnd) = desktop::hwnd_of(&main) {
                    desktop::style::apply_round_corners(hwnd);
                }
                let _ = main.show();
                let _ = main.set_focus();
            }

            desktop_cmds::restore_pinned(app.handle());
            desktop::watcher::start(app.handle().clone());
            hide_aux_message_windows();

            // 自检：`note.exe --pin-test` 会自动把第一条便签钉到桌面，用于验证 WorkerW 链路
            if std::env::args().any(|arg| arg == "--pin-test") {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(2500));
                    let note_id = {
                        let state = handle.state::<AppState>();
                        let conn = state.conn();
                        db::notes_repo::list(&conn, "active", "")
                            .unwrap_or_default()
                            .first()
                            .map(|note| note.id.clone())
                    };
                    match note_id {
                        Some(id) => {
                            let state = handle.state::<AppState>();
                            match tauri::async_runtime::block_on(
                                desktop_cmds::desktop_pin(handle.clone(), state, id),
                            ) {
                                Ok(()) => log::info!("PIN_TEST_OK"),
                                Err(err) => log::error!("PIN_TEST_FAIL: {err}"),
                            }
                        }
                        None => log::error!("PIN_TEST_FAIL: no note"),
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    // 关闭 = 收进托盘，不退出进程
                    api.prevent_close();
                    let _ = window.hide();
                } else if let Some(note_id) =
                    windows::note_window::note_id_from_label(window.label())
                {
                    // 小窗关闭 = 取消钉桌面（不删便签）
                    api.prevent_close();
                    let note_id = note_id.to_string();
                    desktop_cmds::unpin_internal(window.app_handle(), &note_id);
                }
            }
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                if window.label() != "main" {
                    save_window_bounds(window);
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::notes_list,
            commands::notes::notes_get,
            commands::notes::notes_create,
            commands::notes::notes_counts,
            commands::notes::notes_update,
            commands::notes::notes_toggle_pin,
            commands::notes::notes_duplicate,
            commands::notes::notes_archive,
            commands::notes::notes_unarchive,
            commands::notes::notes_delete,
            commands::desktop::desktop_pin,
            commands::desktop::desktop_unpin,
            commands::desktop::desktop_list_pinned,
            commands::desktop::desktop_unpin_all,
            commands::window::window_minimize_to_tray,
            commands::window::window_show_main,
            commands::window::window_hide_main,
            commands::window::window_quit,
            commands::settings::settings_get_all,
            commands::settings::settings_set,
            commands::settings::settings_set_autostart,
            commands::settings::settings_autostart_enabled,
            commands::settings::settings_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
