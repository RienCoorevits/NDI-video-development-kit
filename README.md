# NDI enabled realtime video development kit

Rebuild baseline kit for generative video development.

- Electron control window
- Browser-accessible `/output` route
- Root `/libraries` folder for vendored browser-side libraries
- Vite middleware dev server on the same app origin for HTML/CSS/JS live updates
- Minimally styled control UI
- Shared output width and height config
- Optional NDI sender path driven from the Electron control app

## Requirements

- NDI SDK for Apple installed under `/Library/NDI SDK for Apple`
- Xcode command line toolchain available so `clang` can build the helper
- `ffmpeg` installed and available on `PATH` for the media CLI tools

## Run

Open this repository in your IDE of choice, open terminal to run commands

```bash
npm install
npm start
```

`npm start` runs the browser preview server.

OR For the Electron control window:

```bash
npm run start:electron
```

OR For the Electron dev loop with auto-restart on Electron/main-server file changes:

```bash
npm run dev:electron
```

To build the native NDI helper manually:

```bash
npm run build:ndi-helper
```

For a LAN-accessible output route:

```bash
npm run start:network
```

## Media CLI

This repo includes a small command-line media toolkit for the video files under `Images/Scenes/`.

Run help:

```bash
npm run media -- --help
```

List scene files:

```bash
npm run media -- list
```

Probe one file:

```bash
npm run media -- probe Images/Scenes/Scene1.mp4
```

Trim a clip:

```bash
npm run media -- trim Images/Videos/Scenes/Scene1.mp4 --start 00:00:05 --duration 4 --output output/scene1-trim.mp4
```

Extract frames:

```bash
npm run media -- video-to-sequence Images/Video/Scenes
```

Single file example:

```bash
npm run media -- video-to-sequence "Images/Video/Locations/Location 2.mp4" --fps 12 --format jpg
```

Output path example:

```text
Images/Video/Scenes/Scene1.mp4
-> Images/Sequences/Scenes/Scene1/frame-00001.png
```

Build a temporal-average clean plate:

```bash
npm run media -- clean-plate Images/Video/Scenes/Scene1.mp4 --method median --samples 24
```

Batch clean plates for a folder:

```bash
npm run media -- clean-plate Images/Video/Scenes --method median --samples 16 --width 1280
```

Clean plate note:

- `--method median` is now the better default for actor removal
- `--method average` is still available, but it tends to leave dirtier ghosts
- both methods work best when actors keep moving through the shot
- if a character stands in one place for too long, you will still see residue in the plate

Build a contact sheet:

```bash
npm run media -- contact-sheet Images/Scenes/Scene1.mp4 --columns 4 --rows 3 --output output/scene1-sheet.jpg
```

Export a GIF:

```bash
npm run media -- gif Images/Scenes/Scene1.mp4 --start 2 --duration 3 --fps 10 --width 720 --output output/scene1.gif
```

Transcode to a runtime-friendly MP4:

```bash
npm run media -- transcode Images/Scenes/Scene1.mp4 --width 1280 --fps 24 --output output/scene1-h264.mp4
```

Requirements:

- `ffmpeg` is required for `trim`, `frames`, `contact-sheet`, `gif`, and `transcode`
- `ffprobe` is required for `probe`
- `list` works without ffmpeg
- on macOS with Homebrew: `brew install ffmpeg`

## Current baseline

The control window now handles:

- control and output routing
- output start and stop
- output width and height presets
- NDI source name and frame rate

The output route is only a single HTML canvas driven by p5.js. The current output renderer is a simple test sketch that lives directly in `public/output.js`.

The output now includes a test p5.js sketch loaded from the custom [libraries](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/libraries) folder. This is the reference pattern for adding more browser-side libraries to the project.

## Using this as a generative visual storytelling kit

The current repository should be treated as a rendering kit and delivery shell rather than a finished artwork system.

Use it like this:

1. Run `npm start` when you want the fastest browser-only development loop.
2. Open `/control` for transport controls and `/output` for the actual stage surface.
3. Build the visual storytelling system in `public/output.js`, because that file owns the output canvas and drawing logic.
4. Switch to `npm run start:electron` when you need the Electron control window and NDI output.

The practical division of responsibility is:

- `public/output.js` is the output surface. It owns size sync, canvas creation, the p5 lifecycle, and the drawing logic.
- `public/output.html` is the minimal output shell. Keep it lean unless the renderer truly needs more DOM structure.
- `libraries/` is the vendored browser-library area. Put custom frontend libraries here when they should be served at `/libraries/*`.
- `public/control.html` and `public/control.js` are the operator surface. Add knobs, toggles, cues, scene selectors, or debug readouts here.
- `electron/server.js` is the shared control API. Extend it when the control surface needs to send structured state into the output system.
- `electron/ndi-manager.js` should usually stay transport-focused. Its job is to mirror `/output` into NDI, not to own show logic.

Recommended development pattern:

- Treat `/output` as the single source of truth for what an audience should see.
- Keep rendering deterministic from explicit state where possible so browser preview and NDI output stay visually aligned.
- Use the existing output width and height settings as the base render resolution and make your drawing code respond to those dimensions.
- Iterate in the browser first, then validate in Electron when timing, offscreen rendering, or NDI delivery matters.

When you need more than the current baseline controls:

- Add UI fields in `public/control.html`.
- Read and send their values from `public/control.js`.
- Add or extend `/api/*` routes in `electron/server.js`.
- Read that state from the output renderer using polling, fetch-on-cue, or a future push channel if you decide to add one.

In short: build the artwork in `public/output.js`, build the operator experience in `public/control.js`, and use Electron plus NDI only when you need to deliver the browser-rendered stage to external displays or other video systems.

## Libraries folder

Files placed in [libraries](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/libraries) are served by the app at `/libraries/*`.

Current example:

- [libraries/p5/p5.min.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/libraries/p5/p5.min.js) is served at `/libraries/p5/p5.min.js`
- [public/output.html](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/public/output.html) loads that file directly
- [public/output.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/public/output.js) boots the p5 renderer, keeps the canvas size in sync, and renders the current test sketch

## NDI streaming

NDI streaming is available from the Electron control app, not from the plain browser preview.

- The app uses a hidden offscreen Electron renderer to load `/output`
- Frames are forwarded to a small native helper linked against the installed NDI SDK for Apple
- NDI start uses the current shared output width and height rather than a separate resolution setting
- NDI stop guards the helper pipe shutdown so broken-pipe writes do not crash the Electron control app
- The helper source lives in [native/ndi_sender.c](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/native/ndi_sender.c)
- The build script lives in [scripts/build-ndi-helper.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/scripts/build-ndi-helper.js)
- The Electron-side controller lives in [electron/ndi-manager.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/electron/ndi-manager.js)

## Electron note

This environment exports `ELECTRON_RUN_AS_NODE=1`, which breaks Electron by forcing it into plain Node mode. The launcher in [scripts/start-electron.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/scripts/start-electron.js) strips that variable before starting Electron, and the app bootstrap lives in [electron/main.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/electron/main.js).

Only the control surface is hosted in Electron. The output surface is intended to stay browser-accessible over the served URL for projection, monitoring, or NDI capture.

## Dev server note

Vite is integrated into the existing Node server rather than running on a separate frontend port. This keeps:

- Electron pointing at the same control/output URLs as before
- `/api/*` routes, output lifecycle, and NDI controls on the same origin
- live HTML/CSS/JS updates available during `npm start` and `npm run start:electron`

For Electron development:

- frontend changes in `public/` live-update in the Electron control window through Vite HMR
- Electron/server-side changes under `electron/` can be auto-restarted with `npm run dev:electron`
