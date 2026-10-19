import { Hono } from 'hono';
import { z } from 'zod';
import { ACCOUNT_COLORS, ACCOUNT_ICONS } from '../lib/account-appearance';
import { authMiddleware, type AuthEnv } from '../lib/auth-middleware';
import {
  ACCOUNT_NAME_MAX,
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_ICON_MAX,
  CATEGORY_NAME_MAX,
  MAX_AMOUNT_CENTS,
} from '../lib/limits';
import {
  accountsQuerySchema,
  categoriesQuerySchema,
  parseJsonBody,
  parseListQuery,
  requireUuidParam,
} from '../lib/resource-http';
import {
  createAccountWithDefaults,
  getAccountBalance,
  listUserAccounts,
  updateUserAccount,
} from '../services/account-service';
import { createCategory, listAccountCategories } from '../services/category-service';
import type { ResourceDeps } from '../services/resource-deps';

export const accountNameSchema = z.string().trim().min(1).max(ACCOUNT_NAME_MAX);
export const categoryNameSchema = z.string().trim().min(1).max(CATEGORY_NAME_MAX);
export const categoryDescriptionSchema = z.string().trim().min(1).max(CATEGORY_DESCRIPTION_MAX);
export const categoryIconSchema = z
  .string()
  .regex(new RegExp(`^[a-z0-9_-]{1,${CATEGORY_ICON_MAX}}$`));
export const categoryColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .transform((value) => value.toUpperCase());

const accountColorSchema = z.enum(ACCOUNT_COLORS);
const accountIconSchema = z.enum(ACCOUNT_ICONS);

const createAccountSchema = z.strictObject({
  nombre: accountNameSchema,
  // Ausente o null guardan NULL (apariencia predeterminada).
  color: accountColorSchema.nullish(),
  icono: accountIconSchema.nullish(),
  // `?? 0` y `+ 0`: el saldo es opcional y -0 se guarda como 0.
  saldoInicial: z.number().int().min(-MAX_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS).optional(),
});

// Ausente = sin cambio; null = volver al predeterminado; valor = fijar.
const patchAccountSchema = z
  .strictObject({
    nombre: accountNameSchema.optional(),
    archivada: z.boolean().optional(),
    color: accountColorSchema.nullable().optional(),
    icono: accountIconSchema.nullable().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined));

const createCategorySchema = z.strictObject({
  nombre: categoryNameSchema,
  descripcion: categoryDescriptionSchema.nullish(),
  tipo: z.enum(['ingreso', 'egreso']),
  icono: categoryIconSchema.default('tag'),
  color: categoryColorSchema.default('#6B7280'),
});

export function accountRoutes(deps: Partial<ResourceDeps> = {}, now?: () => Date) {
  const routes = new Hono<AuthEnv>();
  const auth = authMiddleware(now);

  routes.get('/accounts', auth, async (c) => {
    const options = parseListQuery(c, accountsQuerySchema, [
      'page',
      'page_size',
      'incluirArchivadas',
    ]);
    return c.json(await listUserAccounts(c.env.DB as D1Database, c.get('user').id, options));
  });

  routes.post('/accounts', auth, async (c) => {
    const body = await parseJsonBody(c.req.raw, createAccountSchema);
    const created = await createAccountWithDefaults(
      c.env.DB as D1Database,
      c.get('user').id,
      {
        nombre: body.nombre,
        saldoInicial: (body.saldoInicial ?? 0) + 0,
        color: body.color ?? null,
        icono: body.icono ?? null,
      },
      deps,
    );
    return c.json(created, 201);
  });

  routes.patch('/accounts/:id', auth, async (c) => {
    const body = await parseJsonBody(c.req.raw, patchAccountSchema);
    const id = requireUuidParam(c.req.param('id'));
    const account = await updateUserAccount(
      c.env.DB as D1Database,
      c.get('user').id,
      id,
      body,
      deps,
    );
    return c.json({ account });
  });

  routes.get('/accounts/:id/balance', auth, async (c) => {
    const id = requireUuidParam(c.req.param('id'));
    return c.json(await getAccountBalance(c.env.DB as D1Database, c.get('user').id, id));
  });

  routes.get('/accounts/:id/categories', auth, async (c) => {
    const options = parseListQuery(c, categoriesQuerySchema, [
      'page',
      'page_size',
      'incluirArchivadas',
      'tipo',
    ]);
    const id = requireUuidParam(c.req.param('id'));
    return c.json(
      await listAccountCategories(c.env.DB as D1Database, c.get('user').id, id, options),
    );
  });

  routes.post('/accounts/:id/categories', auth, async (c) => {
    const body = await parseJsonBody(c.req.raw, createCategorySchema);
    const id = requireUuidParam(c.req.param('id'));
    const category = await createCategory(
      c.env.DB as D1Database,
      c.get('user').id,
      id,
      { ...body, descripcion: body.descripcion ?? null },
      deps,
    );
    return c.json({ category }, 201);
  });

  return routes;
}
