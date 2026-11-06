use rusqlite::Connection;

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
    w        REAL NOT NULL DEFAULT 300,
    h        REAL NOT NULL DEFAULT 320,
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
    Ok(())
}
