import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, type AuthEnv } from '../lib/auth-middleware';
import { MAX_TRANSACTION_AMOUNT_CENTS, TRANSACTION_NOTE_MAX } from '../lib/limits';
import {
  parseJsonBody,
  parseTransactionsQuery,
  requireUuidParam,
  transactionDateSchema,
  uuidSchema,
} from '../lib/resource-http';
import type { ResourceDeps } from '../services/resource-deps';
import {
  createTransaction,
  listAccountTransactions,
  updateUserTransaction,
  voidUserTransaction,
} from '../services/transaction-service';

// JSON entero: una cadena o un decimal no pasan z.number().int().
const montoSchema = z.number().int().min(1).max(MAX_TRANSACTION_AMOUNT_CENTS);
// Recorta, '' pasa a null y se limita a 500 caracteres.
const notaSchema = z
  .string()
  .trim()
  .max(TRANSACTION_NOTE_MAX)
  .transform((value) => (value === '' ? null : value))
  .nullable();

// strictObject: tipo, categoryId, accountId y cualquier otro campo desconocido responden 400.
const createTransactionSchema = z.strictObject({
  accountId: uuidSchema,
  categoryId: uuidSchema,
  tipo: z.enum(['ingreso', 'gasto']),
  monto: montoSchema,
  fecha: transactionDateSchema,
  nota: notaSchema.optional(),
});

const patchTransactionSchema = z
  .strictObject({
    monto: montoSchema.optional(),
    fecha: transactionDateSchema.optional(),
    nota: notaSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined));

export function transactionRoutes(deps: Partial<ResourceDeps> = {}, now?: () => Date) {
  const routes = new Hono<AuthEnv>();
  const auth = authMiddleware(now);

  routes.post('/transactions', auth, async (c) => {
    const body = await parseJsonBody(c.req.raw, createTransactionSchema);
    const transaction = await createTransaction(
      c.env.DB as D1Database,
      c.get('user').id,
      { ...body, nota: body.nota ?? null },
      deps,
    );
    return c.json({ transaction }, 201);
  });

  routes.get('/transactions', auth, async (c) => {
    const options = parseTransactionsQuery(c);
    return c.json(await listAccountTransactions(c.env.DB as D1Database, c.get('user').id, options));
  });

  routes.patch('/transactions/:id', auth, async (c) => {
    const body = await parseJsonBody(c.req.raw, patchTransactionSchema);
    const id = requireUuidParam(c.req.param('id'));
    const transaction = await updateUserTransaction(
      c.env.DB as D1Database,
      c.get('user').id,
      id,
      body,
      deps,
    );
    return c.json({ transaction });
  });

  routes.delete('/transactions/:id', auth, async (c) => {
    const id = requireUuidParam(c.req.param('id'));
    await voidUserTransaction(c.env.DB as D1Database, c.get('user').id, id, deps);
    return c.body(null, 204);
  });

  return routes;
}
