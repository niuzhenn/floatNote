use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub fn label_for(note_id: &str) -> String {
    format!("note-{note_id}")
}

pub fn note_id_from_label(label: &str) -> Option<&str> {
    label.strip_prefix("note-")
}

/// 创建桌面便签小窗（初始 visible=false，挂载成功后再 show，避免闪一下）。
pub fn build(
    app: &AppHandle,
    note_id: &str,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> tauri::Result<WebviewWindow> {
    let label = label_for(note_id);

    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("浮签")
        .inner_size(w, h)
        .position(x, y)
        .min_inner_size(220.0, 180.0)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .skip_taskbar(true)
        .always_on_top(false)
        .visible(false)
        .resizable(true)
        .focused(true);

    builder.build()
}

/// 关闭并销毁指定便签的小窗。
pub fn destroy(app: &AppHandle, note_id: &str) {
    if let Some(win) = app.get_webview_window(&label_for(note_id)) {
        let _ = win.destroy();
    }
}
