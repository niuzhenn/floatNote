use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use super::now_ms;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content_html: String,
    pub content_text: String,
    pub color: String,
    pub pinned: bool,
    pub sort_order: f64,
    pub created_at: i64,
    pub updated_at: i64,
    pub archived_at: Option<i64>,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotePatch {
    pub id: String,
    pub title: Option<String>,
    pub content_html: Option<String>,
    pub content_text: Option<String>,
    pub color: Option<String>,
    pub pinned: Option<bool>,
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get("id")?,
        title: row.get("title")?,
        content_html: row.get("content_html")?,
        content_text: row.get("content_text")?,
        color: row.get("color")?,
        pinned: row.get::<_, i64>("pinned")? != 0,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        archived_at: row.get("archived_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

/// scope: "active" | "archived"
pub fn list(conn: &Connection, scope: &str, query: &str) -> rusqlite::Result<Vec<Note>> {
    let archived_clause = if scope == "archived" {
        "archived_at IS NOT NULL"
    } else {
        "archived_at IS NULL"
    };
    let keyword = query.trim();

    let mut stmt = conn.prepare(&format!(
        "SELECT * FROM notes
         WHERE deleted_at IS NULL AND {archived_clause}
           AND (?1 = '' OR title LIKE ?2 OR content_text LIKE ?2)
         ORDER BY pinned DESC, updated_at DESC"
    ))?;

    let like = format!("%{keyword}%");
    let rows = stmt.query_map(params![keyword, like], map_row)?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Note>> {
    conn.query_row("SELECT * FROM notes WHERE id = ?1", params![id], map_row)
        .optional()
}

pub fn create(conn: &Connection, color: &str) -> rusqlite::Result<Note> {
    let now = now_ms();
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, title, content_html, content_text, color, pinned, sort_order, created_at, updated_at)
         VALUES (?1, '', '', '', ?2, 0, ?3, ?4, ?4)",
        params![id, color, now as f64, now],
    )?;
    get(conn, &id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

/// 只更新 patch 里出现的字段。
///
/// 不能"读出整行 → 改内存 → 整行写回"：主窗口存正文、小窗改标题是并发的，
/// 整行写回会把对方刚写的字段回滚（lost update）。
pub fn update(conn: &Connection, patch: &NotePatch) -> rusqlite::Result<Option<Note>> {
    if get(conn, &patch.id)?.is_none() {
        return Ok(None);
    }

    if let Some(v) = &patch.title {
        conn.execute(
            "UPDATE notes SET title = ?1 WHERE id = ?2",
            params![v, patch.id],
        )?;
    }
    if let Some(v) = &patch.content_html {
        conn.execute(
            "UPDATE notes SET content_html = ?1 WHERE id = ?2",
            params![v, patch.id],
        )?;
    }
    if let Some(v) = &patch.content_text {
        conn.execute(
            "UPDATE notes SET content_text = ?1 WHERE id = ?2",
            params![v, patch.id],
        )?;
    }
    if let Some(v) = &patch.color {
        conn.execute(
            "UPDATE notes SET color = ?1 WHERE id = ?2",
            params![v, patch.id],
        )?;
    }
    if let Some(v) = patch.pinned {
        conn.execute(
            "UPDATE notes SET pinned = ?1 WHERE id = ?2",
            params![v as i64, patch.id],
        )?;
    }

    conn.execute(
        "UPDATE notes SET updated_at = ?1 WHERE id = ?2",
        params![now_ms(), patch.id],
    )?;
    get(conn, &patch.id)
}

pub fn duplicate(conn: &Connection, id: &str) -> rusqlite::Result<Option<Note>> {
    let Some(src) = get(conn, id)? else {
        return Ok(None);
    };
    let now = now_ms();
    let new_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, title, content_html, content_text, color, pinned, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?7)",
        params![
            new_id,
            format!("{} 副本", if src.title.is_empty() { "无标题" } else { &src.title }),
            src.content_html,
            src.content_text,
            src.color,
            now as f64,
            now
        ],
    )?;
    get(conn, &new_id)
}

pub fn remove(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM attachments WHERE note_id = ?1", params![id])?;
    conn.execute("DELETE FROM note_windows WHERE note_id = ?1", params![id])?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn set_archived(conn: &Connection, id: &str, archived: bool) -> rusqlite::Result<Option<Note>> {
    let value: Option<i64> = if archived { Some(now_ms()) } else { None };
    conn.execute(
        "UPDATE notes SET archived_at = ?1, updated_at = ?2 WHERE id = ?3",
        params![value, now_ms(), id],
    )?;
    get(conn, id)
}

pub fn toggle_pin(conn: &Connection, id: &str) -> rusqlite::Result<Option<Note>> {
    let Some(note) = get(conn, id)? else {
        return Ok(None);
    };
    conn.execute(
        "UPDATE notes SET pinned = ?1 WHERE id = ?2",
        params![(!note.pinned) as i64, id],
    )?;
    get(conn, id)
}

pub fn count(conn: &Connection, scope: &str) -> rusqlite::Result<i64> {
    let clause = if scope == "archived" {
        "archived_at IS NOT NULL"
    } else {
        "archived_at IS NULL"
    };
    conn.query_row(
        &format!("SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL AND {clause}"),
        [],
        |row| row.get(0),
    )
}
