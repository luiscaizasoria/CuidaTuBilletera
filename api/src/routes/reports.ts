import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../lib/auth-middleware';
import { parseReportPeriodQuery, parseReportQuery } from '../lib/resource-http';
import {
  getReportByCategory,
  getReportByPeriod,
  getReportSummary,
} from '../services/report-service';

// GET /reports/{summary,by-category,by-period}: orden 401, 400, 404. Solo lectura (sin deps).
export function reportRoutes(now?: () => Date) {
  const routes = new Hono<AuthEnv>();
  const auth = authMiddleware(now);

  routes.get('/reports/summary', auth, async (c) => {
    const { accountId, desde, hasta } = parseReportQuery(c);
    return c.json(
      await getReportSummary(c.env.DB as D1Database, c.get('user').id, accountId, desde, hasta),
    );
  });

  routes.get('/reports/by-category', auth, async (c) => {
    const { accountId, desde, hasta } = parseReportQuery(c);
    return c.json(
      await getReportByCategory(c.env.DB as D1Database, c.get('user').id, accountId, desde, hasta),
    );
  });

  routes.get('/reports/by-period', auth, async (c) => {
    const { accountId, desde, hasta, group } = parseReportPeriodQuery(c);
    return c.json(
      await getReportByPeriod(
        c.env.DB as D1Database,
        c.get('user').id,
        accountId,
        desde,
        hasta,
        group,
      ),
    );
  });

  return routes;
}
