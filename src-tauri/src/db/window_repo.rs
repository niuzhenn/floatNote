use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::now_ms;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteWindowState {
    pub note_id: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub pinned: bool,
}

pub fn get(conn: &Connection, note_id: &str) -> rusqlite::Result<Option<NoteWindowState>> {
    conn.query_row(
        "SELECT note_id, x, y, w, h, pinned FROM note_windows WHERE note_id = ?1",
        params![note_id],
        |row| {
            Ok(NoteWindowState {
                note_id: row.get(0)?,
                x: row.get(1)?,
                y: row.get(2)?,
                w: row.get(3)?,
                h: row.get(4)?,
                pinned: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .optional()
}

pub fn save_bounds(
    conn: &Connection,
    note_id: &str,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO note_windows (note_id, x, y, w, h, pinned, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)
         ON CONFLICT(note_id) DO UPDATE SET x=?2, y=?3, w=?4, h=?5, updated_at=?6",
        params![note_id, x, y, w, h, now_ms()],
    )?;
    Ok(())
}

pub fn set_pinned(conn: &Connection, note_id: &str, pinned: bool) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO note_windows (note_id, pinned, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(note_id) DO UPDATE SET pinned=?2, updated_at=?3",
        params![note_id, pinned as i64, now_ms()],
    )?;
    Ok(())
}

pub fn pinned_ids(conn: &Connection) -> rusqlite::Result<Vec<NoteWindowState>> {
    let mut stmt = conn.prepare(
        "SELECT w.note_id, w.x, w.y, w.w, w.h, w.pinned
         FROM note_windows w
         JOIN notes n ON n.id = w.note_id
         WHERE w.pinned = 1 AND n.deleted_at IS NULL AND n.archived_at IS NULL",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(NoteWindowState {
            note_id: row.get(0)?,
            x: row.get(1)?,
            y: row.get(2)?,
            w: row.get(3)?,
            h: row.get(4)?,
            pinned: true,
        })
    })?;
    rows.collect()
}
