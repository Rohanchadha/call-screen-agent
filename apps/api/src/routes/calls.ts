import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { store } from '../db/store.js';

export async function registerCallRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (req, reply) => {
    const q = z.object({ limit: z.coerce.number().int().max(200).default(50) }).parse(req.query);
    return reply.send({ calls: store.listCalls(req.user.sub, q.limit) });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const call = store.getCall(id);
    if (!call || call.user_id !== req.user.sub) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ call });
  });
}
