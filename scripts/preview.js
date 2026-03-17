import { startServer } from '../electron/server.js';

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

const cli = parseCliArguments(process.argv);
const preferredPort = Number(cli.port ?? process.env.PORT ?? 3030);
const preferredHost = String(cli.host ?? process.env.HOST ?? '127.0.0.1');

const serverSession = await startServer({
  dev: true,
  host: preferredHost,
  port: preferredPort
});

console.log(`[achmed-preview] Control URL: ${serverSession.controlUrl}`);
console.log(`[achmed-preview] Output URL: ${serverSession.outputUrl}`);
console.log('[achmed-preview] Press Ctrl+C to stop.');

const shutdown = async () => {
  await serverSession.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
