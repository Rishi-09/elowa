import http from 'node:http';
import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { logger } from './lib/logger';
import { attachSocketServer } from './realtime/socketServer';

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  attachSocketServer(server);
  server.listen(env.PORT,"0.0.0.0", () => {
    logger.info({ port: env.PORT }, 'server + socket.io listening');
  });

  const shutdown = (sig: string) => {
    logger.info({ sig }, 'shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'failed to start');
  process.exit(1);
});
