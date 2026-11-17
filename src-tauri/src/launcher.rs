use anyhow::{anyhow, Result};
use std::path::Path;
use std::process::Command;

/// Lanza un juego. `target` puede ser:
/// - Un URI de protocolo (steam://, com.epicgames.launcher://)
/// - Una ruta absoluta a un .exe o ROM (juegos manuales)
///
/// Devuelve el PID del proceso lanzado cuando es un ejecutable directo.
/// Para URIs de protocolo no podemos saber el PID del juego real (lo arranca
/// el launcher de la plataforma), así que devolvemos None y el cronometraje
/// se basa en heurística de proceso por nombre.
pub fn launch(target: &str) -> Result<Option<u32>> {
    launch_inner(target, false)
}

/// Lanza un juego pidiendo elevación de administrador (solo Windows, solo exe).
pub fn launch_as_admin(target: &str) -> Result<Option<u32>> {
    launch_inner(target, true)
}

fn launch_inner(target: &str, admin: bool) -> Result<Option<u32>> {
    let is_protocol = target.contains("://");

    if is_protocol {
        // Los protocolos no admiten elevación; se lanzan normal.
        open_uri(target)?;
        Ok(None)
    } else {
        let path = Path::new(target);
        if !path.exists() {
            return Err(anyhow!("El ejecutable no existe: {target}"));
        }
        let workdir = path.parent().unwrap_or(Path::new("."));

        if admin {
            launch_elevated(target, workdir)?;
            // Con elevación (ShellExecute) no obtenemos el PID directo.
            Ok(None)
        } else {
            let child = Command::new(target).current_dir(workdir).spawn()?;
            Ok(Some(child.id()))
        }
    }
}

/// Lanza un ejecutable con elevación de administrador.
fn launch_elevated(target: &str, _workdir: &Path) -> Result<()> {
    #[cfg(windows)]
    {
        // PowerShell Start-Process -Verb RunAs dispara el UAC de Windows.
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("Start-Process -FilePath '{}' -Verb RunAs", target.replace('\'', "''")),
            ])
            .spawn()?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        // En Linux usamos pkexec si está disponible.
        Command::new("pkexec")
            .arg(target)
            .current_dir(_workdir)
            .spawn()?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        // macOS: osascript con privilegios de administrador.
        Command::new("osascript")
            .args([
                "-e",
                &format!("do shell script \"{}\" with administrator privileges", target),
            ])
            .spawn()?;
        Ok(())
    }
}

/// Abre un URI de protocolo usando el handler del sistema operativo.
fn open_uri(uri: &str) -> Result<()> {
    #[cfg(windows)]
    {
        Command::new("cmd").args(["/C", "start", "", uri]).spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(uri).spawn()?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(uri).spawn()?;
    }
    Ok(())
}

/// Comprueba si un PID sigue vivo. Lo usa el cronómetro del frontend
/// para juegos manuales: hace polling hasta que el proceso muere.
pub fn is_running(pid: u32) -> bool {
    use sysinfo::{Pid, System};
    let mut sys = System::new();
    sys.refresh_processes();
    sys.process(Pid::from_u32(pid)).is_some()
}

/// Lanza una ROM con su emulador: ejecuta `emulador.exe "ruta/rom"`.
/// Devuelve el PID del emulador para poder cronometrar la sesión.
pub fn launch_rom(emu_exe: &str, rom_path: &str) -> Result<u32> {
    let emu = Path::new(emu_exe);
    if !emu.exists() {
        return Err(anyhow!("El emulador no existe: {emu_exe}"));
    }
    if !Path::new(rom_path).exists() {
        return Err(anyhow!("La ROM no existe: {rom_path}"));
    }
    let child = Command::new(emu_exe)
        .arg(rom_path)
        .current_dir(emu.parent().unwrap_or(Path::new(".")))
        .spawn()?;
    Ok(child.id())
}
