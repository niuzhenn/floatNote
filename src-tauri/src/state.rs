use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use crate::windows::WindowRegistry;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub windows: WindowRegistry,
    pub data_dir: PathBuf,
    /// 用户是否关闭了「钉桌面」能力（降级开关）
    pub pin_enabled: Mutex<bool>,
}

impl AppState {
    pub fn new(conn: Connection, data_dir: PathBuf) -> Self {
        Self {
            db: Mutex::new(conn),
            windows: WindowRegistry::default(),
            data_dir,
            pin_enabled: Mutex::new(true),
        }
    }

    /// 取数据库连接；即使锁被毒化也继续复用内部连接。
    pub fn conn(&self) -> MutexGuard<'_, Connection> {
        self.db.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn attachments_dir(&self) -> PathBuf {
        self.data_dir.join("attachments")
    }
}
