import { Hono } from 'hono';
import { errorHandler, notFoundHandler } from './lib/errors';
import { authRoutes, type AuthRouteDeps } from './routes/auth';
import { meRoutes } from './routes/me';
import type { AuthBindings } from './lib/auth-config';

// Las dependencias se inyectan para probar sin llamar a Google ni depender del reloj real.
export function createApp(deps: AuthRouteDeps = {}) {
  const app = new Hono<{ Bindings: AuthBindings }>();

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/', authRoutes(deps));
  app.route('/', meRoutes(deps.now));

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
