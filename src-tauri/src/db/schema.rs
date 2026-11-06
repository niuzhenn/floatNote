use rusqlite::Connection;

/// 首次启动写入的示例便签。
///
/// 待办项必须带 `data-type="taskItem"`：TipTap 只认这个标记，
/// 少了它整段会被解析成「一个空复选框 + 若干条普通项目符号」。
pub const WELCOME_TITLE: &str = "欢迎使用浮签";

pub const WELCOME_HTML: &str = concat!(
    "<p>这是一条示例便签，随手写点什么，内容会自动保存。</p>",
    "<p>常用格式：<strong>加粗</strong>、<em>斜体</em>、<u>下划线</u>、<s>删除线</s>、<mark>高亮</mark>。</p>",
    "<ul data-type=\"taskList\">",
    "<li data-type=\"taskItem\" data-checked=\"false\"><label><input type=\"checkbox\"></label><div><p>点一下方框，这行文字会自动划掉</p></div></li>",
    "<li data-type=\"taskItem\" data-checked=\"true\"><label><input type=\"checkbox\" checked></label><div><p>这样就是完成的样子</p></div></li>",
    "</ul>",
    "<p>在左侧便签栏右键某条便签，选择「钉到桌面」，它就会变成一张小纸条贴在桌面上；再右键可以收回来。</p>",
    "<blockquote><p>工具栏里有加粗、列表、待办、高亮和文字颜色，想改纸色也可以右键。</p></blockquote>"
);

pub const WELCOME_TEXT: &str = "这是一条示例便签，随手写点什么，内容会自动保存。常用格式：加粗、斜体、下划线、删除线、高亮。点一下方框，这行文字会自动划掉。这样就是完成的样子。在左侧便签栏右键某条便签，选择「钉到桌面」，它就会变成一张小纸条贴在桌面上；再右键可以收回来。工具栏里有加粗、列表、待办、高亮和文字颜色，想改纸色也可以右键。";

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS notes (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL DEFAULT '',
    content_html TEXT NOT NULL DEFAULT '',
    content_text TEXT NOT NULL DEFAULT '',
    color        TEXT NOT NULL DEFAULT 'cream',
    pinned       INTEGER NOT NULL DEFAULT 0,
    sort_order   REAL NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    archived_at  INTEGER,
    deleted_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_notes_active
    ON notes(archived_at, deleted_at, pinned, updated_at);

CREATE TABLE IF NOT EXISTS note_windows (
    note_id  TEXT PRIMARY KEY,
    x        REAL NOT NULL DEFAULT 0,
    y        REAL NOT NULL DEFAULT 0,
    w        REAL NOT NULL DEFAULT 260,
    h        REAL NOT NULL DEFAULT 290,
    pinned   INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attachments (
    id         TEXT PRIMARY KEY,
    note_id    TEXT,
    path       TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"#;

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(SCHEMA)?;

    // 一次性迁移：桌面便签默认尺寸从 300×320 调小到 260×290。
    // 只改「仍然是旧默认尺寸」的记录（说明用户没手动调过），用标记保证只跑一次，
    // 否则用户主动调到 300×320 也会被反复重置。
    let done: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM settings WHERE key = 'migrated_note_window_size')",
        [],
        |row| row.get(0),
    )?;
    if !done {
        conn.execute(
            "UPDATE note_windows SET w = 260, h = 290 WHERE w = 300 AND h = 320",
            [],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO settings(key, value) VALUES ('migrated_note_window_size', '1')",
            [],
        )?;
    }

    // 一次性迁移：替换旧版示例便签。
    // 旧示例的待办项缺 data-type="taskItem"，会被渲染成「一个空复选框 + 两条项目符号」。
    // 仅当标题仍是默认的「欢迎使用便签」且正文仍是旧示例原文时才替换，
    // 用户自己改过或写过东西的便签不会被动。
    let welcome_done: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM settings WHERE key = 'migrated_welcome_note')",
        [],
        |row| row.get(0),
    )?;
    if !welcome_done {
        conn.execute(
            "UPDATE notes
                SET title = ?1, content_html = ?2, content_text = ?3
              WHERE title = '欢迎使用便签'
                AND content_html LIKE '%这是一条示例便签，内容会自动保存。%'
                AND content_html NOT LIKE '%data-type=\"taskItem\"%'",
            rusqlite::params![WELCOME_TITLE, WELCOME_HTML, WELCOME_TEXT],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO settings(key, value) VALUES ('migrated_welcome_note', '1')",
            [],
        )?;
    }

    Ok(())
}
