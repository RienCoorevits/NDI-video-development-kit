# De Avonturen van Prins Achmed

Rebuild baseline for a procedural generative storytelling app inspired by the 1926 film *The Adventures of Prince Achmed*.

The earlier story-generation scaffold has been removed. The project now keeps only the parts that are still valid for the next implementation pass:

- Electron control window
- Browser-accessible `/output` route
- Vite middleware dev server on the same app origin for HTML/CSS/JS live updates
- Minimally styled control UI with browser-default buttons and inputs
- Shared output width and height config
- Optional NDI sender path driven from the Electron control app

## Run

```bash
npm install
npm start
```

`npm start` runs the browser preview server.

In development, the existing app server now hosts Vite in middleware mode. That means `/control` and `/output` stay on the same server origin as the API routes, while HTML, CSS, and JavaScript changes live-update during development.

For the Electron control window:

```bash
npm run start:electron
```

For the Electron dev loop with auto-restart on Electron/main-server file changes:

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

## Current baseline

The control window now only handles:

- control and output routing
- output start and stop
- output width and height
- NDI source name and frame rate

The control window intentionally uses plain DOM elements with light page-level styling. Buttons and inputs stay browser-default, the layout is a five-column shell, and the currently active controls live in the first column.

`Start Output` now applies the current width and height values, marks the output as active, and starts NDI in the Electron control app. `Stop Output` deactivates the output and stops NDI.

The output route is only a single HTML canvas. When output is inactive it shows a loading screen. When output is active it switches to a blank black frame at the started size. This keeps the output surface clean while the real rendering system is redeveloped.

Output width and height are a shared setting:

- the values are read when `Start Output` is pressed
- the output canvas internal size uses those started values
- the hidden Electron offscreen renderer uses those same values
- the NDI sender uses those same values

This keeps browser output and NDI output matched at all times.

## NDI streaming

NDI streaming is available from the Electron control app, not from the plain browser preview.

- The app uses a hidden offscreen Electron renderer to load `/output`
- Frames are forwarded to a small native helper linked against the installed NDI SDK for Apple
- NDI start uses the current shared output width and height rather than a separate resolution setting
- NDI stop guards the helper pipe shutdown so broken-pipe writes do not crash the Electron control app
- The helper source lives in [native/ndi_sender.c](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/native/ndi_sender.c)
- The build script lives in [scripts/build-ndi-helper.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/scripts/build-ndi-helper.js)
- The Electron-side controller lives in [electron/ndi-manager.js](/Users/u0127995/Documents/Developer/De%20Avonturen%20van%20Prins%20Achmed/Achmed_0.0.1_PB2/electron/ndi-manager.js)

Requirements on this machine:

- NDI SDK for Apple installed under `/Library/NDI SDK for Apple`
- Xcode command line toolchain available so `clang` can build the helper

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

## Documentation rule

From this point forward, every substantive code change should be reflected in this README so the repository description stays current.

## Git workflow

Use this as the default loop:

```bash
git status
git add .
git commit -m "Describe the change"
git push
```

If this machine still needs your git identity configured:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```
