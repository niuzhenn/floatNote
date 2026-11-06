//! 桌面便签的窗口过程钩子。
//!
//! 「显示桌面」(Win + D) 由 explorer 驱动，会把桌面上所有窗口最小化或移到屏幕外。
//! 轮询检测有 2~3 秒延迟，恢复时还会闪一下。这里直接换掉窗口过程，在消息层面挡掉：
//!
//! - `WM_SYSCOMMAND` + `SC_MINIMIZE`：吞掉，不让便签被最小化
//! - `WM_WINDOWPOSCHANGING`：若要把窗口移到屏幕外（-32000），改成「只改尺寸不移位置」
//!
//! 其余消息原样转发给原来的窗口过程，不影响 WebView2 渲染、拖动、缩放与输入。
//! 注：windows-sys 0.59 没有绑定 SetWindowSubclass，所以这里用 GWLP_WNDPROC 替换。

#![cfg(target_os = "windows")]

use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallWindowProcW, DefWindowProcW, SetWindowLongPtrW, GWLP_WNDPROC, SC_MINIMIZE, SWP_HIDEWINDOW,
    SWP_NOMOVE, WINDOWPOS, WM_SYSCOMMAND, WM_WINDOWPOSCHANGING, WNDPROC,
};

/// 屏幕外的判定阈值，Windows 用 -32000 表示「移出可见区域」
const OFFSCREEN: i32 = -30000;

/// 命中测试相关：锁定后不再命中窗口边缘，用户就无法拖拽改尺寸
const WM_NCHITTEST: u32 = 0x0084;
const HTCLIENT: LRESULT = 1;

static OLD_PROCS: OnceLock<Mutex<HashMap<isize, isize>>> = OnceLock::new();
static LOCKED: OnceLock<Mutex<HashSet<isize>>> = OnceLock::new();

fn old_procs() -> &'static Mutex<HashMap<isize, isize>> {
    OLD_PROCS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn locked_set() -> &'static Mutex<HashSet<isize>> {
    LOCKED.get_or_init(|| Mutex::new(HashSet::new()))
}

fn is_locked(hwnd: isize) -> bool {
    locked_set()
        .lock()
        .map(|set| set.contains(&hwnd))
        .unwrap_or(false)
}

/// 设置窗口是否处于「固定位置」状态。
pub fn set_locked(hwnd: isize, locked: bool) {
    if hwnd == 0 {
        return;
    }
    if let Ok(mut set) = locked_set().lock() {
        if locked {
            set.insert(hwnd);
        } else {
            set.remove(&hwnd);
        }
    }
}

unsafe extern "system" fn guard_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    // 「显示桌面」会对窗口发 SC_MINIMIZE，直接吞掉即可保持在桌面上
    if msg == WM_SYSCOMMAND && (wparam & 0xFFF0) == SC_MINIMIZE as usize {
        return 0;
    }

    // 锁定后所有位置都算客户区：碰不到窗口边缘，也就拖不动尺寸
    if msg == WM_NCHITTEST && is_locked(hwnd as isize) {
        return HTCLIENT;
    }

    // 「显示桌面」(Win+D) 不走 SC_MINIMIZE，也不一定隐藏窗口，
    // 常见做法是把桌面窗口提到最前，把贴在桌面层的便签盖住。
    // 这里拦两件事：SWP_HIDEWINDOW（真隐藏）与移出屏幕，其余交给 Z 序修复。
    if msg == WM_WINDOWPOSCHANGING {
        let pos = lparam as *mut WINDOWPOS;
        if !pos.is_null() {
            (*pos).flags &= !(SWP_HIDEWINDOW as u32);

            let (x, y) = ((*pos).x, (*pos).y);
            if x <= OFFSCREEN || y <= OFFSCREEN {
                (*pos).flags |= SWP_NOMOVE;
            }
        }
    }

    let previous = old_procs()
        .lock()
        .map(|map| map.get(&(hwnd as isize)).copied().unwrap_or(0))
        .unwrap_or(0);

    if previous == 0 {
        DefWindowProcW(hwnd, msg, wparam, lparam)
    } else {
        let proc: WNDPROC = std::mem::transmute(previous);
        CallWindowProcW(proc, hwnd, msg, wparam, lparam)
    }
}

/// 给窗口换上新窗口过程（幂等，重复调用无副作用）。
pub fn install(hwnd: isize) {
    if hwnd == 0 {
        return;
    }

    let mut map = match old_procs().lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    if map.contains_key(&hwnd) {
        return;
    }

    let new_proc = guard_proc as *const () as isize;
    let previous = unsafe { SetWindowLongPtrW(hwnd as HWND, GWLP_WNDPROC, new_proc) };
    if previous != 0 {
        map.insert(hwnd, previous);
        log::info!("desktop guard installed on {hwnd}");
    } else {
        log::warn!("desktop guard install failed on {hwnd}");
    }
}
