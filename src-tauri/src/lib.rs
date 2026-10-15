#[cfg(desktop)]
use tauri::{Emitter, Manager};

#[cfg(desktop)]
fn desktop_menu(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem as P, Submenu};
    let item = |id, label, shortcut| MenuItem::with_id(app, id, label, true, Some(shortcut));
    let open = item("open", "Open File…", "CmdOrCtrl+O")?;
    let new = item("new-window", "New Window", "CmdOrCtrl+N")?;
    let export = item("export", "Export Measurements…", "CmdOrCtrl+Shift+E")?;
    let fit = item("fit", "Fit Model", "CmdOrCtrl+0")?;
    let iso = item("isometric", "Isometric View", "CmdOrCtrl+1")?;
    let front = item("front", "Front View", "CmdOrCtrl+2")?;
    let top = item("top", "Top View", "CmdOrCtrl+3")?;
    let right = item("right", "Right View", "CmdOrCtrl+4")?;
    let clear = item("clear", "Clear Measurements", "CmdOrCtrl+Backspace")?;
    let point = item("point", "Point Measurement", "CmdOrCtrl+Shift+P")?;
    let feature = item("feature", "Feature Measurement", "CmdOrCtrl+Shift+F")?;
    let help = item("help", "Navigation & Shortcuts", "CmdOrCtrl+/")?;
    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new,
            &open,
            &P::separator(app)?,
            &export,
            &P::separator(app)?,
            &P::close_window(app, None)?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &P::undo(app, None)?,
            &P::redo(app, None)?,
            &P::separator(app)?,
            &P::cut(app, None)?,
            &P::copy(app, None)?,
            &P::paste(app, None)?,
            &P::select_all(app, None)?,
        ],
    )?;
    let measure = Submenu::with_items(
        app,
        "Measure",
        true,
        &[&point, &feature, &P::separator(app)?, &clear],
    )?;
    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &fit,
            &P::separator(app)?,
            &iso,
            &front,
            &top,
            &right,
            &P::separator(app)?,
            &P::fullscreen(app, None)?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        "Window",
        true,
        &[&P::minimize(app, None)?, &P::maximize(app, None)?],
    )?;
    let help_menu = Submenu::with_items(app, "Help", true, &[&help])?;
    let about = P::about(
        app,
        Some("About Shenzhen 3D"),
        Some(tauri::menu::AboutMetadata {
            name: Some("Shenzhen 3D".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            copyright: Some("Casimir Engineering".into()),
            comments: Some("Local-first CAD, mesh and drawing viewer".into()),
            ..Default::default()
        }),
    )?;
    #[cfg(target_os = "macos")]
    let app_menu = Submenu::with_items(
        app,
        "Shenzhen 3D",
        true,
        &[
            &about,
            &P::separator(app)?,
            &P::services(app, None)?,
            &P::separator(app)?,
            &P::hide(app, None)?,
            &P::hide_others(app, None)?,
            &P::show_all(app, None)?,
            &P::separator(app)?,
            &P::quit(app, None)?,
        ],
    )?;
    #[cfg(target_os = "macos")]
    let menu = Menu::with_items(
        app,
        &[
            &app_menu, &file, &edit, &measure, &view, &window, &help_menu,
        ],
    )?;
    #[cfg(not(target_os = "macos"))]
    let menu = {
        help_menu.append(&about)?;
        file.append(&P::quit(app, None)?)?;
        Menu::with_items(app, &[&file, &edit, &measure, &view, &window, &help_menu])?
    };
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        let action = event.id().as_ref();
        if action == "new-window" {
            let label = format!(
                "viewer-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            );
            if let Err(error) =
                tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::default())
                    .title("Shenzhen 3D")
                    .inner_size(1440.0, 960.0)
                    .min_inner_size(360.0, 560.0)
                    .disable_drag_drop_handler()
                    .build()
            {
                log::error!("Could not open viewer: {error}");
            }
        } else if let Some(window) = app
            .webview_windows()
            .values()
            .find(|window| window.is_focused().unwrap_or(false))
        {
            let _ = window.emit("native-menu", serde_json::json!({"action": action}));
        }
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    builder
        .setup(|_app| {
            #[cfg(desktop)]
            desktop_menu(_app)?;
            #[cfg(desktop)]
            if cfg!(debug_assertions) {
                _app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Could not start Shenzhen 3D");
}
