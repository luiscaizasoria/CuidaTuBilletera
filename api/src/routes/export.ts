import { Hono } from 'hono';
import { authMiddleware, type AuthEnv } from '../lib/auth-middleware';
import { parseExportQuery } from '../lib/resource-http';
import { exportTransactionsCsv, exportTransactionsPdf } from '../services/export-service';

// GET /export?account_id&desde&hasta[&tipo&category_id&format=csv|pdf]: orden 401, 400, 404.
// Solo lectura. El nombre del archivo solo usa fechas ya validadas.
export function exportRoutes(now?: () => Date) {
  const routes = new Hono<AuthEnv>();
  const auth = authMiddleware(now);

  routes.get('/export', auth, async (c) => {
    const { accountId, desde, hasta, tipo, categoryId, format } = parseExportQuery(c);
    const filters = {
      accountId,
      desde,
      hasta,
      ...(tipo ? { tipo } : {}),
      ...(categoryId ? { categoryId } : {}),
    };
    const userId = c.get('user').id;
    const disposition = `attachment; filename="movimientos_${desde}_${hasta}.${format}"`;
    if (format === 'pdf') {
      const pdf = await exportTransactionsPdf(c.env.DB as D1Database, userId, filters);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', disposition);
      c.header('X-Content-Type-Options', 'nosniff');
      return c.body(pdf as Uint8Array<ArrayBuffer>);
    }
    const csv = await exportTransactionsCsv(c.env.DB as D1Database, userId, filters);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', disposition);
    c.header('X-Content-Type-Options', 'nosniff');
    return c.body(csv);
  });

  return routes;
}
