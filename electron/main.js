import * as electronMain from 'electron/main';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.js';
import { createNdiController } from './ndi-manager.js';

const { app, BrowserWindow } = electronMain;
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

function parseCliArguments(argv) {
  return argv.reduce((accumulator, entry) => {
    if (!entry.startsWith('--')) {
      return accumulator;
    }

    const [key, value] = entry.slice(2).split('=');
    accumulator[key] = value ?? true;
    return accumulator;
  }, {});
}

function createControlWindow(url) {
  const controlWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    title: 'Achmed Control',
    backgroundColor: '#11161b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  controlWindow.loadURL(url);
  return controlWindow;
}

const cli = parseCliArguments(process.argv);
const preferredPort = Number(cli.port ?? process.env.PORT ?? 3030);
const preferredHost = String(cli.host ?? process.env.HOST ?? '127.0.0.1');

let serverSession;
let closingServerPromise;
const ndiController = createNdiController({
  projectRoot: PROJECT_ROOT,
  resolveOutputUrl: () => serverSession?.localOutputUrl ?? null
});

async function closeServer() {
  if (!serverSession) {
    return;
  }

  if (!closingServerPromise) {
    closingServerPromise = Promise.allSettled([
      ndiController.shutdown(),
      serverSession.close()
    ]).then(() => {});
  }

  await closingServerPromise;
}

async function boot() {
  try {
    serverSession = await startServer({
      dev: true,
      host: preferredHost,
      port: preferredPort,
      ndiController
    });
  } catch (error) {
    if (error.code !== 'EADDRINUSE') {
      throw error;
    }

    serverSession = await startServer({
      dev: true,
      host: preferredHost,
      port: 0,
      ndiController
    });
  }

  createControlWindow(serverSession.controlUrl);

  console.log(`[achmed] Control URL: ${serverSession.controlUrl}`);
  console.log(`[achmed] Output URL: ${serverSession.outputUrl}`);
}

app.whenReady().then(boot);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverSession) {
    createControlWindow(serverSession.controlUrl);
  }
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await closeServer();
    app.quit();
  }
});

app.on('before-quit', async () => {
  await closeServer();
});
