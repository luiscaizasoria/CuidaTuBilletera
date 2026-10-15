import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { errorHandler, notFoundHandler } from './lib/errors';
import { authRoutes, type AuthRouteDeps } from './routes/auth';
import { meRoutes } from './routes/me';
import type { AuthBindings } from './lib/auth-config';

// Las respuestas con credenciales o datos del usuario nunca deben quedar en cachés. Se fija antes
// del manejador para que también lo lleven las respuestas de error generadas por onError.
const noStore = createMiddleware(async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});

// Las dependencias se inyectan para probar sin llamar a Google ni depender del reloj real.
export function createApp(deps: AuthRouteDeps = {}) {
  const app = new Hono<{ Bindings: AuthBindings }>();

  app.use('/auth/*', noStore);
  app.use('/me', noStore);

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/', authRoutes(deps));
  app.route('/', meRoutes(deps.now));

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
