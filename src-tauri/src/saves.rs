use anyhow::Result;
use std::path::Path;
use walkdir::WalkDir;

/// Recorre una carpeta de saves y devuelve el timestamp epoch (segundos)
/// del fichero modificado más recientemente. None si la carpeta no existe
/// o está vacía.
pub fn latest_save_timestamp(save_dir: &str) -> Result<Option<i64>> {
    let dir = Path::new(save_dir);
    if !dir.exists() {
        return Ok(None);
    }

    let mut latest: Option<i64> = None;
    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if let Ok(modified) = meta.modified() {
                if let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH) {
                    let secs = dur.as_secs() as i64;
                    latest = Some(latest.map_or(secs, |l| l.max(secs)));
                }
            }
        }
    }
    Ok(latest)
}
