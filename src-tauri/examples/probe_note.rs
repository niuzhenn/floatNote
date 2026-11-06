use rusqlite::Connection;

fn main() {
    let base = std::env::var("APPDATA").expect("APPDATA");
    let path = format!("{base}\\com.niuz.floatnote\\notes.db");
    let conn = Connection::open(&path).expect("open db");

    let mut stmt = conn
        .prepare("SELECT title, content_html FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC")
        .expect("prepare");
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .expect("query");

    for row in rows {
        let (title, html) = row.expect("row");
        println!("=== {title}");
        println!("{html}");
        println!();
    }
}
