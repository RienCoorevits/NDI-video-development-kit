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
- `ffmpeg` is required for `trim`, `frames`, `contact-sheet`, `gif`, and `transcode`
- `ffprobe` is required for `probe`
- on macOS with Homebrew: `brew install ffmpeg`

Install the local Python dependencies used by the rigid stabilizer:

```bash
python3 -m pip install --target .python-packages -r requirements-media.txt
```

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

# Media CLI

This repo includes a small command-line media toolkit for the video files under `Images/Video/`.

## Helper functions

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
npm run media -- trim Images/Video/Scenes/Scene1.mp4 --start 00:00:05 --duration 4 --output output/scene1-trim.mp4
```
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

## Image Sequencing

Convert videos into image sequences:

```bash
npm run media -- video-to-sequence Images/Video/Scenes
```

Single file example:

```bash
npm run media -- video-to-sequence "Images/Video/Locations/Location 2.mp4" --fps 12 --format jpg
```

## Stabilizing

Stabilize a shot into `Images/Stabilize/...`:

```bash
npm run media -- stabilize-shot Images/Video/Scenes/Scene1.mp4
```

Faster estimation on a smaller analysis image while keeping normal output rendering:

```bash
npm run media -- stabilize-shot Images/Video/Scenes/Scene1.mp4 --analysis-width 240
```

More conservative clamp settings for film-weave style material:

```bash
--smooth-radius 21 --max-shift-ratio 0.01 --max-rotation-deg 1.0
```

The default stabilizer is now more assertive than before:

- it favors brighter background regions during motion estimation, which helps suppress dark moving silhouettes
- its default smoothing radius is lower, so small x/y and rotation corrections stay visible instead of being averaged away
- it now estimates motion on a smaller analysis frame by default, then scales those transforms back up for output, which makes batch stabilization much faster

## Clean plate masking
Build the Photoshop-style median stack clean plate from the stabilized result:

```bash
npm run media -- clean-plate-stack Images/Stabilize/Scenes/Scene1.mp4 --samples 48
```

Use every frame in the selected span:

```bash
npm run media -- clean-plate-stack Images/Stabilize/Scenes/Scene1.mp4 --samples all
```

Bias the stack toward brighter pixels when the actors are darker than the background:

```bash
npm run media -- clean-plate-stack Images/Stabilize/Scenes/Scene1.mp4 --samples all --prefer-bright
```

Or keep the top brightest percentile of samples per pixel:

```bash
npm run media -- clean-plate-stack Images/Stabilize/Scenes/Scene1.mp4 --samples all --prefer-bright --bright-percentile 35
```

Advanced clean plate note:

- the recommended flow is `stabilize-shot` first, then `clean-plate-stack`
- `stabilize-shot` now uses rigid stabilization only: x/y drift plus rotation, with no perspective warp
- it estimates euclidean motion, rejects large outlier jumps, and smooths the remaining motion before rendering the stabilized shot
- `clean-plate-stack` is intended to mirror the Photoshop workflow: aligned frame stack first, then a straight per-pixel median across the sampled frames
- the default stack sampling is `48`; `--samples all` uses one sample per source frame inside the selected time range
- `--prefer-bright` keeps only the brighter samples at each pixel when enough of them exist, then falls back to the full stack when they do not
- `--bright-window` controls how close a sample's brightness must be to the brightest sample at that pixel; the default is `24`
- `--bright-percentile` keeps the brightest fraction of samples at each pixel instead; for example `35` keeps the top 35 percent by luma
- if `--bright-percentile` is set, it takes precedence over `--bright-window`
- `--bright-min-samples` controls how many bright samples must survive before the command trusts that bright subset
- if the input lives under `Images/Stabilize` or `Images/Video`, output still mirrors into `Images/CleanPlates`
- for arbitrary files or folders elsewhere, output falls back to `output/clean-plates/...`
- this usually works better when silhouettes keep moving through the frame and the stabilized shot is clean
- `clean-plate-masked` is still available as an alternate experimental method when the plain stack median is not enough
- if a figure covers the same region for too much of the shot, you may still need manual cleanup

# Current baseline

The control window now handles:

- control and output routing
- output start and stop
- output width and height presets
- NDI source name and frame rate
- Flying Horse shader controls

The output route is a single HTML canvas driven by the Flying Horse WebGL shader renderer in `public/output.js`.

The Flying Horse control values live in the shared server state exposed by `/api/shader/params`, so the separate control page can drive the separate output page.

## Using this as a generative visual storytelling kit

The current repository should be treated as a rendering kit and delivery shell rather than a finished artwork system.

Use it like this:

1. Run `npm start` when you want the fastest browser-only development loop.
2. Open `/control` for transport controls and `/output` for the actual stage surface.
3. Build the visual storytelling system in `public/output.js`, because that file owns the output canvas and drawing logic.
4. Switch to `npm run start:electron` when you need the Electron control window and NDI output.

The practical division of responsibility is:

- `public/output.js` is the output surface. It owns size sync, canvas rendering, the WebGL shader, and the drawing loop.
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
- [public/output.html](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/public/output.html) is now the minimal output shell
- [public/output.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/public/output.js) boots the Flying Horse WebGL renderer, keeps the canvas size in sync, and reads shader control values from the server

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
