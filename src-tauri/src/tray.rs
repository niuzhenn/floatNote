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
            ID_QUIT => {
                app.exit(0);
            }
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
