pub mod notes_repo;
pub mod schema;
pub mod settings_repo;
pub mod window_repo;

use rusqlite::Connection;
use std::path::Path;

/// 打开（或创建）本地数据库，启用 WAL 与外键。
pub fn open(dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("创建数据目录失败: {e}"))?;
    let path = dir.join("notes.db");
    let conn = Connection::open(&path).map_err(|e| format!("打开数据库失败: {e}"))?;

    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("设置 WAL 失败: {e}"))?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(|e| format!("设置 synchronous 失败: {e}"))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| format!("启用外键失败: {e}"))?;

    schema::migrate(&conn).map_err(|e| format!("初始化表结构失败: {e}"))?;
    Ok(conn)
}

pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
