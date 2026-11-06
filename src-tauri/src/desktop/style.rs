//! 窗口外观相关的 Win32 辅助。

#![cfg(target_os = "windows")]

use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;

/// DWMWA_WINDOW_CORNER_PREFERENCE (Windows 11)
const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
/// DWMWCP_ROUND
const DWMWCP_ROUND: i32 = 2;

/// Win11 上给无边框窗口加系统圆角；Win10 上调用无副作用。
pub fn apply_round_corners(hwnd: isize) {
    unsafe {
        let preference = DWMWCP_ROUND;
        let _ = DwmSetWindowAttribute(
            hwnd as HWND,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &preference as *const i32 as *const core::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        );
    }
}
