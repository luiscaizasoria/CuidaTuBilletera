import { Hono } from 'hono';
import { errorHandler, notFoundHandler } from './lib/errors';

export function createApp() {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
