use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::commands;

const ID_SHOW: &str = "show-main";
const ID_NEW: &str = "new-note";
const ID_UNPIN_ALL: &str = "unpin-all";
const ID_SETTINGS: &str = "settings";
const ID_QUIT: &str = "quit";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, ID_SHOW, "显示主窗口", true, None::<&str>)?;
    let new_note = MenuItem::with_id(app, ID_NEW, "新建便签", true, None::<&str>)?;
    let unpin_all = MenuItem::with_id(app, ID_UNPIN_ALL, "收回全部桌面便签", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, ID_SETTINGS, "设置", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, ID_QUIT, "退出", true, None::<&str>)?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[&show, &new_note, &unpin_all, &sep1, &settings, &sep2, &quit],
    )?;

    let mut builder = TrayIconBuilder::with_id("tray")
        .tooltip("浮签")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            ID_SHOW => {
                let _ = commands::window::window_show_main(app.clone());
            }
            ID_NEW => {
                let _ = commands::window::window_show_main(app.clone());
                let _ = app.emit("app://new-note", ());
            }
            ID_UNPIN_ALL => {
                let app2 = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = commands::desktop::desktop_unpin_all(app2).await;
                });
            }
            ID_SETTINGS => {
                let _ = commands::window::window_show_main(app.clone());
                let _ = app.emit("app://open-settings", ());
            }
            ID_QUIT => quit_app(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

/// 真正退出应用。
///
/// 顺序按 Tauri 官方语义：`exit()` 触发 `RunEvent::ExitRequested` → `Exit`，
/// 框架会在 `Exit` 分支里自动调 `cleanup_before_exit()` 再结束进程。
/// 但本应用实测会卡在清理 WebView2 这一步，事件循环回不到结束进程那一步，
/// 所以再补一层兜底：先自己跑一次 cleanup（按文档要求「返回后立刻退出」），
/// 清理放独立线程、最多等 400ms，之后无条件强退，避免托盘图标一直残留。
pub fn quit_app(app: &AppHandle) {
    log::info!("quit requested");

    // 标记真退出，让主窗口的 CloseRequested 不再把它当成「收进托盘」拦下
    crate::QUITTING.store(true, std::sync::atomic::Ordering::SeqCst);

    // 先收掉所有桌面小窗，减少退出阶段要销毁的 WebView2 数量
    let pinned: Vec<String> = app
        .state::<crate::state::AppState>()
        .windows
        .all()
        .into_iter()
        .map(|(note_id, _)| note_id)
        .collect();
    for note_id in pinned {
        commands::desktop::unpin_internal(app, &note_id);
    }

    app.exit(0);

    let cleanup_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(900));
        std::thread::spawn(move || cleanup_handle.cleanup_before_exit());
        std::thread::sleep(std::time::Duration::from_millis(400));
        std::process::exit(0);
    });
}

fn toggle_main(app: &AppHandle) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let visible = win.is_visible().unwrap_or(false);
    let focused = win.is_focused().unwrap_or(false);

    if visible && focused {
        let _ = win.hide();
    } else {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}
