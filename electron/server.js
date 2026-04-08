import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const LIBRARIES_DIR = path.join(ROOT_DIR, 'libraries');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const DEFAULT_BOAT_WIND_STATE = {
  speed: 1,
  strength: 1
};

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
}

function getAccessibleHost(host) {
  if (host !== '0.0.0.0' && host !== '::') {
    return host;
  }

  const networkInterfaces = os.networkInterfaces();

  for (const entries of Object.values(networkInterfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return '127.0.0.1';
}

function remapHtmlRequest(pathname) {
  if (pathname === '/') {
    return '/control.html';
  }

  if (pathname === '/control') {
    return '/control.html';
  }

  if (pathname === '/output') {
    return '/output.html';
  }

  return pathname;
}

async function serveViteHtml(vite, pathname, res) {
  const filePath = remapHtmlRequest(pathname);
  const htmlFile = path.join(PUBLIC_DIR, filePath.slice(1));
  const template = await readFile(htmlFile, 'utf8');
  const html = await vite.transformIndexHtml(pathname, template);

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8'
  });
  res.end(html);
}

async function serveStaticFile(pathname, res) {
  if (pathname.startsWith('/assets/')) {
    const relativePath = pathname.replace(/^\/assets\//, '');
    const safePath = path.normalize(relativePath);

    if (safePath.startsWith('..')) {
      return false;
    }

    const filePath = path.join(PUBLIC_DIR, 'assets', safePath);
    const contents = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath)] ?? 'text/plain; charset=utf-8';

    res.writeHead(200, {
      'Content-Type': contentType
    });
    res.end(contents);
    return true;
  }

  if (pathname.startsWith('/libraries/')) {
    const relativePath = pathname.replace(/^\/libraries\//, '');
    const safePath = path.normalize(relativePath);

    if (safePath.startsWith('..')) {
      return false;
    }

    const filePath = path.join(LIBRARIES_DIR, safePath);
    const contents = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath)] ?? 'text/plain; charset=utf-8';

    res.writeHead(200, {
      'Content-Type': contentType
    });
    res.end(contents);
    return true;
  }

  const routes = new Map([
    ['/', path.join(PUBLIC_DIR, 'control.html')],
    ['/control', path.join(PUBLIC_DIR, 'control.html')],
    ['/output', path.join(PUBLIC_DIR, 'output.html')],
    ['/control.html', path.join(PUBLIC_DIR, 'control.html')],
    ['/output.html', path.join(PUBLIC_DIR, 'output.html')],
    ['/styles.css', path.join(PUBLIC_DIR, 'styles.css')],
    ['/control.js', path.join(PUBLIC_DIR, 'control.js')],
    ['/output.js', path.join(PUBLIC_DIR, 'output.js')]
  ]);

  const filePath = routes.get(pathname);

  if (!filePath) {
    return false;
  }

  const contents = await readFile(filePath);
  const contentType = CONTENT_TYPES[path.extname(filePath)] ?? 'text/plain; charset=utf-8';

  res.writeHead(200, {
    'Content-Type': contentType
  });
  res.end(contents);
  return true;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      resolve(body);
    });

    req.on('error', reject);
  });
}

function normaliseDimensions(payload, fallback) {
  const width = Number(payload.width ?? fallback.width);
  const height = Number(payload.height ?? fallback.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid output dimensions.');
  }

  return {
    width,
    height
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normaliseBoatWindState(payload = {}, fallback = DEFAULT_BOAT_WIND_STATE) {
  const strength = Number(payload.strength ?? fallback.strength);
  const speed = Number(payload.speed ?? fallback.speed);

  if (!Number.isFinite(strength) || !Number.isFinite(speed)) {
    throw new Error('Invalid boat wind settings.');
  }

  return {
    strength: clamp(strength, 0, 2),
    speed: clamp(speed, 0, 4)
  };
}

export async function startServer({ host = '127.0.0.1', port = 3030, ndiController = null, dev = false } = {}) {
  let outputState = {
    active: false,
    height: 720,
    sizeLocked: false,
    width: 1280
  };
  let boatWindState = { ...DEFAULT_BOAT_WIND_STATE };

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && requestUrl.pathname === '/api/config') {
      const address = server.address();
      const boundPort = typeof address === 'object' && address ? address.port : port;
      const accessibleHost = getAccessibleHost(host);

      return json(res, 200, {
        host,
        port: boundPort,
        controlUrl: `http://127.0.0.1:${boundPort}/control`,
        localOutputUrl: `http://127.0.0.1:${boundPort}/output`,
        outputUrl: `http://${accessibleHost}:${boundPort}/output`,
        ndiAvailable: Boolean(ndiController),
        vite: dev
      });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/output/status') {
      return json(res, 200, outputState);
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/boat/wind') {
      return json(res, 200, boatWindState);
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/boat/wind') {
      try {
        const rawBody = await readRequestBody(req);
        const payload = rawBody ? JSON.parse(rawBody) : {};
        boatWindState = normaliseBoatWindState(payload, boatWindState);
        return json(res, 200, boatWindState);
      } catch (error) {
        return json(res, 400, {
          error: error instanceof Error ? error.message : 'Expected valid JSON.'
        });
      }
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/output/start') {
      try {
        const rawBody = await readRequestBody(req);
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const nextDimensions = normaliseDimensions(payload, outputState);

        if (
          outputState.active &&
          (nextDimensions.width !== outputState.width || nextDimensions.height !== outputState.height)
        ) {
          return json(res, 409, {
            error: `Output size is locked to ${outputState.width}x${outputState.height} while output is running.`
          });
        }

        const nextOutputState = {
          active: true,
          sizeLocked: true,
          ...nextDimensions
        };

        outputState = nextOutputState;

        if (!ndiController) {
          return json(res, 200, {
            ndiStatus: {
              available: false,
              reason: 'unavailable',
              running: false
            },
            outputState
          });
        }

        try {
          const ndiStatus = await ndiController.start({
            fps: payload.fps,
            height: nextOutputState.height,
            sourceName: payload.sourceName,
            width: nextOutputState.width
          });

          return json(res, 200, {
            ndiStatus,
            outputState
          });
        } catch (error) {
          outputState = {
            ...nextOutputState,
            active: false,
            sizeLocked: false
          };

          return json(res, 500, {
            error: error instanceof Error ? error.message : 'Unable to start output.'
          });
        }
      } catch (error) {
        return json(res, 400, {
          error: error instanceof Error ? error.message : 'Expected valid JSON.'
        });
      }
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/output/stop') {
      outputState = {
        ...outputState,
        active: false,
        sizeLocked: false
      };

      let ndiStatus = {
        available: false,
        reason: 'unavailable',
        running: false
      };

      if (ndiController) {
        ndiStatus = await ndiController.stop();
      }

      return json(res, 200, {
        ndiStatus,
        outputState
      });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/ndi/status') {
      if (!ndiController) {
        return json(res, 200, {
          available: false,
          lastError: 'NDI is only available from the Electron control app.',
          reason: 'unavailable',
          running: false
        });
      }

      return json(res, 200, ndiController.getStatus());
    }

    if (requestUrl.pathname.startsWith('/libraries/')) {
      try {
        const served = await serveStaticFile(requestUrl.pathname, res);

        if (served) {
          return;
        }
      } catch {
        return json(res, 500, {
          error: 'Unable to read requested library file.'
        });
      }
    }

    if (dev) {
      if (req.method === 'GET' && ['/', '/control', '/output', '/control.html', '/output.html'].includes(requestUrl.pathname)) {
        try {
          await serveViteHtml(vite, requestUrl.pathname, res);
          return;
        } catch (error) {
          json(res, 500, {
            error: error instanceof Error ? error.message : 'Unable to render Vite HTML.'
          });
          return;
        }
      }

      const originalUrl = req.url;

      req.url = `${requestUrl.pathname}${requestUrl.search}`;

      return vite.middlewares(req, res, (error) => {
        req.url = originalUrl;

        if (error) {
          json(res, 500, {
            error: error instanceof Error ? error.message : 'Vite middleware error.'
          });
          return;
        }

        json(res, 404, {
          error: 'Not found.'
        });
      });
    }

    try {
      const served = await serveStaticFile(requestUrl.pathname, res);

      if (served) {
        return;
      }
    } catch {
      return json(res, 500, {
        error: 'Unable to read requested file.'
      });
    }

    return json(res, 404, {
      error: 'Not found.'
    });
  });

  let vite = null;

  if (dev) {
    const { createServer: createViteServer } = await import('vite');

    vite = await createViteServer({
      appType: 'custom',
      root: PUBLIC_DIR,
      server: {
        hmr: {
          server
        },
        middlewareMode: {
          server
        }
      }
    });
  }

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  const accessibleHost = getAccessibleHost(host);

  return {
    host,
    port: boundPort,
    controlUrl: `http://127.0.0.1:${boundPort}/control`,
    localOutputUrl: `http://127.0.0.1:${boundPort}/output`,
    outputUrl: `http://${accessibleHost}:${boundPort}/output`,
    close: async () => {
      if (vite) {
        await vite.close();
      }

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}
