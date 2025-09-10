import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { inspect } from 'node:util'; // Встроенный модуль для обработки циклических структур

import { setSecurityHeaders, verifyClient } from '@middlewares';
import { loadServerConfig, getFrontendConfig } from '@utils';
import configRouter from './routes/config.router.js';
import wireguardRouter from './routes/wireguard.router.js';
import frontendRouter from './routes/frontend.router.js';

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

await loadServerConfig(); // Загружаем конфиги

const { frontServerPort, allowedOrigins } = getFrontendConfig();
// Важно! Слэш в конце адреса в allowedOrigins не нужен!

const errorHandler: ErrorRequestHandler = (err: unknown, _: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    // Определяем статус ошибки
    const status = (err as any)?.status || 500;
    const message = (err instanceof Error) ? err.message : 'Unknown error';

    // Логирование
    console.error('Unhandled error:', inspect(err, { depth: null, colors: true }));

    // Стандартизированный ответ с учетом статуса
    res.status(status).json({
        success: false,
        message: status === 500
            ? 'Internal server error. Please contact support.'
            : message,
        errorId: Date.now()
    });
};

const server = express();
server.disable('x-powered-by'); // Remove unnecs header

server.use(cookieParser());
server.use(setSecurityHeaders);

server.use('/', frontendRouter);
server.use('/api/config', cors({ origin: allowedOrigins, credentials: true }), verifyClient, configRouter);
server.use('/api/wireguard', cors({ origin: allowedOrigins, credentials: true }), verifyClient, wireguardRouter);

server.use(errorHandler);

/*
Все ошибки должны передаваться через next(err)
Для асинхронных обработчиков рекомендуется использовать обёртку:

const asyncHandler = (fn: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  // ... ваш код
}));
*/

const appServer = server.listen(frontServerPort, () => {
  console.log(`Wireguard-control ready on http://localhost:${frontServerPort}`)
})

// Обработчик graceful shutdown для PM2
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    console.log('Received shutdown message. Closing all connections...');

    // Закрываем HTTP-сервер для прекращения принятия новых соединений
    appServer.close((err) => {
      if (err) {
        console.error('Error during server close:', err);
        process.exit(1); // Завершаем с ошибкой, если не удалось закрыть сервер
      } else {
        console.log('HTTP server closed successfully.');
      }
    });

    // Здесь можно добавить закрытие других ресурсов:
    // - Базы данных (например, MongoDB, PostgreSQL)
    // - Внешних API-соединений
    // - Интервалов или таймеров (clearInterval, clearTimeout)
    // - Очередей (например, RabbitMQ, Redis)

    // Пример для MongoDB:
    // if (mongoose.connection.readyState === 1) {
    //   mongoose.connection.close(false, () => {
    //     console.log('MongoDB connection closed.');
    //   });
    // }

    // Даём время на корректное завершение операций, затем выходим
    setTimeout(() => {
      console.log('Finished closing connections. Exiting process.');
      process.exit(0); // Корректное завершение
    }, 1000);
  }
});
