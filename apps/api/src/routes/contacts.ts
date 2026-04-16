import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { store } from '../db/store.js';

export async function registerContactRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (req, reply) => {
    return reply.send({ contacts: store.listContacts(req.user.sub) });
  });

  app.post('/bulk', async (req, reply) => {
    const body = z
      .object({
        contacts: z.array(z.object({ name: z.string(), phone_e164: z.string() })),
      })
      .parse(req.body);
    const list = store.upsertContacts(req.user.sub, body.contacts);
    return reply.send({ count: list.length, contacts: list });
  });
}
