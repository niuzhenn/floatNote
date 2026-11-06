//! 查找桌面宿主窗口（Progman / 含 SHELLDLL_DefView 的 WorkerW）。
//!
//! 原理：桌面图标视图 SHELLDLL_DefView 挂在 Progman（或某个 WorkerW）下。
//! 这里只负责找到"桌面锚点窗口"，供 SetWindowPos 把便签窗插到桌面正上方。
//!
//! 注意：触发 WorkerW 拆分的 0x052C 是不可靠的内部消息，每次发送都可能让
//! 桌面重排。因此这里做了缓存，只在缓存句柄失效时才重新查找一次。

#![cfg(target_os = "windows")]

use std::sync::atomic::{AtomicIsize, Ordering};
use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, WPARAM};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowExW, FindWindowW, GetClassNameW, IsWindow, SendMessageTimeoutW,
    SMTO_ABORTIFHUNG, SMTO_NORMAL,
};

const SPY_MSG: u32 = 0x052C;

static CACHED_HOST: AtomicIsize = AtomicIsize::new(0);

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

unsafe extern "system" fn enum_workerw(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let out = &mut *(lparam as *mut HWND);
    let mut buf = [0u16; 128];
    let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
    if len <= 0 {
        return 1;
    }
    let name = String::from_utf16_lossy(&buf[..len as usize]);
    if name == "WorkerW" {
        let defview_class = to_wide("SHELLDLL_DefView");
        let defview = FindWindowExW(hwnd, std::ptr::null_mut(), defview_class.as_ptr(), std::ptr::null());
        if !defview.is_null() {
            *out = hwnd;
            return 0;
        }
    }
    1
}

fn has_defview(hwnd: HWND) -> bool {
    unsafe {
        let class = to_wide("SHELLDLL_DefView");
        let child = FindWindowExW(hwnd, std::ptr::null_mut(), class.as_ptr(), std::ptr::null());
        !child.is_null()
    }
}

/// 返回桌面锚点窗口：优先 Progman，其次含 DefView 的 WorkerW。
pub fn find_desktop_host() -> Option<HWND> {
    let cached = CACHED_HOST.load(Ordering::Relaxed);
    if cached != 0 && unsafe { IsWindow(cached as HWND) } != 0 {
        return Some(cached as HWND);
    }

    let host = unsafe { resolve_host() }?;
    CACHED_HOST.store(host as isize, Ordering::Relaxed);
    Some(host)
}

/// explorer 重启后调用，清掉缓存以便下次重新解析。
pub fn invalidate_cache() {
    CACHED_HOST.store(0, Ordering::Relaxed);
}

unsafe fn resolve_host() -> Option<HWND> {
    let progman_class = to_wide("Progman");
    let progman = FindWindowW(progman_class.as_ptr(), std::ptr::null());
    if progman.is_null() {
        return None;
    }

    // Win11 常见：DefView 直接挂在 Progman 下
    if has_defview(progman) {
        return Some(progman);
    }

    // 兜底：枚举顶层窗口找含 DefView 的 WorkerW
    let mut found: HWND = std::ptr::null_mut();
    EnumWindows(Some(enum_workerw), &mut found as *mut HWND as LPARAM);
    if !found.is_null() {
        return Some(found);
    }

    // 最后兜底：直接用 Progman 作为锚点
    let mut result: usize = 0;
    let _ = SendMessageTimeoutW(
        progman,
        SPY_MSG,
        0 as WPARAM,
        0 as LPARAM,
        SMTO_NORMAL | SMTO_ABORTIFHUNG,
        1000,
        &mut result,
    );
    Some(progman)
}
