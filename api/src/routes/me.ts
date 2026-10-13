import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../lib/auth-middleware';

export function meRoutes(now?: () => Date) {
  const routes = new Hono<AuthEnv>();
  routes.get('/me', authMiddleware(now), (c) => c.json({ user: c.get('user') }));
  return routes;
}
