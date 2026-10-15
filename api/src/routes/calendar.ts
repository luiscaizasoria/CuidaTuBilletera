import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../lib/auth-middleware';
import { parseCalendarQuery } from '../lib/resource-http';
import { getCalendarMonth } from '../services/calendar-service';

// GET /calendar?account_id=&month=AAAA-MM: orden 401, 400, 404. No usa deps (solo lectura).
export function calendarRoutes(now?: () => Date) {
  const routes = new Hono<AuthEnv>();
  const auth = authMiddleware(now);

  routes.get('/calendar', auth, async (c) => {
    const { accountId, month } = parseCalendarQuery(c);
    return c.json(
      await getCalendarMonth(c.env.DB as D1Database, c.get('user').id, accountId, month),
    );
  });

  return routes;
}
