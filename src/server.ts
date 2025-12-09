import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { inspect } from 'node:util';
import { initRuntimeGuard } from './core/runtimeGuard.js';
import { setSecurityHeaders, verifyClient } from './middlewares/index.js';
import { loadServerConfig, getFrontendConfig } from './utils/index.js';
import configRouter from './routes/config.router.js';
import wireguardRouter from './routes/wireguard.router.js';
import frontendRouter from './routes/frontend.router.js';

await loadServerConfig();
const { frontServerPort, allowedOrigins, runtimeRotationMinutes } = getFrontendConfig();
initRuntimeGuard(runtimeRotationMinutes ?? 5);

const errorHandler = (err: unknown, _: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const status = (err as { status?: number })?.status || 500;
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('Unhandled error:', inspect(err, { depth: null, colors: true }));
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error. Please contact support.' : message,
    errorId: Date.now(),
  });
};

const server = express();
server.disable('x-powered-by');
server.use(cookieParser());
server.use(setSecurityHeaders);
server.use('/', frontendRouter);
const corsOptions = { origin: allowedOrigins && allowedOrigins.length ? allowedOrigins : undefined, credentials: true };

server.use('/api/config', cors(corsOptions), verifyClient, configRouter);
server.use('/api/wireguard', cors(corsOptions), verifyClient, wireguardRouter);
server.use(errorHandler);

server.listen(frontServerPort, () => {
  console.log(`Wireguard-control ready on http://localhost:${frontServerPort}`);
});
