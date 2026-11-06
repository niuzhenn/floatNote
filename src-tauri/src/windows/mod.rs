pub mod note_window;

use std::collections::HashMap;
use std::sync::Mutex;

/// 记录「便签 id → 桌面小窗 label」的映射，避免重复创建窗口。
#[derive(Default)]
pub struct WindowRegistry {
    pinned: Mutex<HashMap<String, String>>,
}

impl WindowRegistry {
    pub fn label_for(&self, note_id: &str) -> Option<String> {
        self.pinned.lock().ok()?.get(note_id).cloned()
    }

    pub fn add(&self, note_id: &str, label: &str) {
        if let Ok(mut map) = self.pinned.lock() {
            map.insert(note_id.to_string(), label.to_string());
        }
    }

    pub fn remove(&self, note_id: &str) {
        if let Ok(mut map) = self.pinned.lock() {
            map.remove(note_id);
        }
    }

    pub fn remove_by_label(&self, label: &str) -> Option<String> {
        let mut map = self.pinned.lock().ok()?;
        let note_id = map
            .iter()
            .find(|(_, l)| l.as_str() == label)
            .map(|(k, _)| k.clone())?;
        map.remove(&note_id);
        Some(note_id)
    }

    pub fn is_pinned(&self, note_id: &str) -> bool {
        self.pinned
            .lock()
            .map(|m| m.contains_key(note_id))
            .unwrap_or(false)
    }

    pub fn all(&self) -> Vec<(String, String)> {
        self.pinned
            .lock()
            .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
            .unwrap_or_default()
    }

    pub fn clear(&self) {
        if let Ok(mut map) = self.pinned.lock() {
            map.clear();
        }
    }
}
