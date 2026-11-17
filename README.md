# ⚗ Grimoire Launcher

Un launcher de juegos unificado con estética de manuscrito alquímico. Reúne tu
biblioteca de Steam, Epic y juegos sueltos (emuladores, Kenshi, ROMs) en una
sola ventana que da gusto abrir, con portadas, horas jugadas, último guardado,
notas y etiquetas tuyas.

Hecho con **Tauri v2 + React + TypeScript** (frontend) y **Rust** (backend).

---

## Qué hace ya (v0.3)

- **Escaneo de Steam** con **horas reales**: lee tu `localconfig.vdf` y muestra
  las horas jugadas y la última partida que Steam ya tiene registradas, desde el
  primer momento (sin tener que jugar dentro de Grimoire).
- **Escaneo de Epic** (Windows): parsea los manifiestos `.item`.
- **Portadas automáticas**: usa primero la caché local de Steam (instantáneo) y
  descarga el resto (portada + banner *hero*) desde la CDN de Cloudflare,
  cacheándolas en disco.
- **Metadata de Steam**: géneros, desarrollador, fecha y descripción corta.
- **Banner hero** grande en el panel de detalle.
- **Stats globales**: nº de juegos, horas totales y juego más jugado.
- **Ordenar**: recién jugado, más horas, alfabético.
- **Juegos externos**: añade cualquier `.exe` o ROM fuera de Steam/Epic
  (emuladores, portables, instalados a mano) con su portada y carpeta de saves.
- **Ejecutar como administrador**: para juegos externos, botón que lanza con
  elevación UAC.
- **Lanzar juegos** + **cronómetro** propio para los externos.
- **Último guardado** vigilando la carpeta de saves.
- **Estado, notas y tags** por juego, en SQLite local.
- **Filtros, búsqueda** y **estética alquímica oscura** (bruma que respira,
  brillos rúnicos, sello que parpadea).

## Notas técnicas importantes

- Las **horas de Steam** se leen de `localconfig.vdf`. Para que estén al día,
  conviene haber cerrado Steam al menos una vez tras jugar (Steam vuelca las
  horas a ese fichero al cerrar sesión o salir). Grimoire toma siempre el
  máximo entre lo que reporta Steam y lo que él mismo haya cronometrado.
- Las **imágenes** se sirven vía el *asset protocol* de Tauri, habilitado en
  `tauri.conf.json` con un scope que cubre la carpeta de caché. Sin esa
  configuración el webview no las mostraría aunque estén descargadas.

## Estética (v0.4 · Dark Fantasy)

La identidad visual nace del sello de Grimoire: una rosa de sangre sobre un
escudo rúnico de metal y obsidiana. La paleta se extrajo directamente de esa
imagen:

- **Obsidiana** `#0c0708` — fondo, negro cálido casi rojo
- **Sangre** `#a8313f` / `#c8434f` — el rojo de la rosa, acento principal
- **Vino** `#6b222e` — rojos profundos de sombra
- **Hierro** `#18100f` / óxido `#3a2622` — superficies y bordes
- **Hueso** `#e6dcd0` y **plata** `#c3b5a8` — textos

Tipografía: **Cinzel** (títulos, inscripción tallada en mayúsculas),
**Cormorant Garamond** (nombres de juego, serif elegante), IBM Plex Mono (datos).
Ambiente: una brasa de sangre que late desde abajo y oscuridad que envuelve los
bordes. El icono del ejecutable es el propio sello.

## Pendiente

- Cronometraje en vivo de juegos de Steam mientras Grimoire está abierto.
- Detección de GOG y otros launchers.
- Buscador de portadas custom para juegos externos.



---

## Requisitos

- **Node.js** 18+ y npm
- **Rust** (vía [rustup](https://rustup.rs))
- Dependencias de sistema de Tauri según tu SO:
  <https://v2.tauri.app/start/prerequisites/>
  - En Windows: Microsoft C++ Build Tools + WebView2 (suele venir ya en Win11).

## Arranque en desarrollo

```bash
npm install
npm run tauri dev
```

La primera compilación de Rust tarda un rato (baja y compila las dependencias).
A partir de ahí, recarga en caliente del frontend al instante.

## Compilar el ejecutable final

```bash
npm run tauri build
```

El instalador queda en `src-tauri/target/release/bundle/`.

---

## Arquitectura

```
src/                        Frontend (React + TS)
  components/
    GameCard.tsx            La "carta del grimorio" del grid
    GameDrawer.tsx          Panel de detalle: play, stats, notas, tags
    AddGameModal.tsx        Alta de juegos manuales
  lib/
    types.ts                Tipos espejo de los structs de Rust
    api.ts                  Wrapper de invoke() + cronómetro de sesión
    format.ts               Formato de tiempo y fechas en español
  styles/
    global.css              Tokens de diseño (paleta, tipografía)
    components.css          Estilos de componentes
  App.tsx                   Orquestador

src-tauri/                  Backend (Rust)
  src/
    models.rs               Game, Source, Status (serde)
    steam.rs                Parser de libraryfolders.vdf + appmanifest.acf
    epic.rs                 Parser de manifiestos de Epic
    launcher.rs             Lanzar procesos/URIs + comprobar PID vivo
    saves.rs                Timestamp del save más reciente
    db.rs                   Persistencia SQLite
    lib.rs                  Comandos Tauri (#[tauri::command])
    main.rs                 Punto de entrada
```

### Cómo identifica los juegos

| Fuente | Detección | Lanzamiento |
|--------|-----------|-------------|
| Steam | `libraryfolders.vdf` → `appmanifest_*.acf` | `steam://rungameid/<appid>` |
| Epic | manifiestos `.item` en ProgramData | `com.epicgames.launcher://...` |
| Manual | el usuario apunta al `.exe`/ROM | spawn directo del proceso |

Los datos detectados y los que tú editas se guardan juntos en SQLite
(`%APPDATA%/grimoire-launcher/library.db` en Windows). Un re-escaneo nunca pisa
tus notas, tags ni estados: solo refresca nombre, ruta de lanzamiento y portada.

---

## Notas de diseño

La estética es deliberada: tinta violácea (`#0d0b14`), pergamino (`#e8e0cf`),
oro alquímico (`#c9a25a`) y violeta arcano (`#8a6ec4`). Tipografía Cormorant
Garamond para los títulos (aire de manuscrito) y IBM Plex Mono para los datos.
La idea es que no parezca un dashboard más, sino un libro que te apetece abrir.
