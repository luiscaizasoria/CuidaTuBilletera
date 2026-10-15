import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, type AuthEnv } from '../lib/auth-middleware';
import { parseJsonBody, requireUuidParam } from '../lib/resource-http';
import { deleteUserCategory, updateUserCategory } from '../services/category-service';
import type { ResourceDeps } from '../services/resource-deps';
import {
  categoryColorSchema,
  categoryDescriptionSchema,
  categoryIconSchema,
  categoryNameSchema,
} from './accounts';

// strictObject rechaza `tipo` (inmutable) y cualquier campo desconocido con 400.
const patchCategorySchema = z
  .strictObject({
    nombre: categoryNameSchema.optional(),
    descripcion: categoryDescriptionSchema.nullable().optional(),
    icono: categoryIconSchema.optional(),
    color: categoryColorSchema.optional(),
    archivada: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined));

export function categoryRoutes(deps: Partial<ResourceDeps> = {}, now?: () => Date) {
  const routes = new Hono<AuthEnv>();
  const auth = authMiddleware(now);

  routes.patch('/categories/:id', auth, async (c) => {
    const body = await parseJsonBody(c.req.raw, patchCategorySchema);
    const id = requireUuidParam(c.req.param('id'));
    const category = await updateUserCategory(
      c.env.DB as D1Database,
      c.get('user').id,
      id,
      body,
      deps,
    );
    return c.json({ category });
  });

  routes.delete('/categories/:id', auth, async (c) => {
    const id = requireUuidParam(c.req.param('id'));
    await deleteUserCategory(c.env.DB as D1Database, c.get('user').id, id, deps);
    return c.body(null, 204);
  });

  return routes;
}
