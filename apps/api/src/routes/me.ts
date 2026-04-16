import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { store } from '../db/store.js';

export async function registerMeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (req, reply) => {
    const user = store.getUser(req.user.sub);
    if (!user) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ user });
  });

  app.patch('/', async (req, reply) => {
    const body = z
      .object({
        name: z.string().optional(),
        profession: z.enum(['doctor', 'architect', 'hr', 'business_owner', 'other']).optional(),
        voice_preference: z.enum(['female_warm', 'female_professional', 'male_professional']).optional(),
        language: z.enum(['en', 'hi', 'hinglish']).optional(),
      })
      .parse(req.body);
    const user = store.upsertUserByPhone(req.user.phone, body);
    return reply.send({ user });
  });

  // Provision a virtual number. Demo: we just assign a fake "+91-DEMO-<id>"
  // unless a real Twilio number is passed via env. Real Twilio provisioning
  // can be added later via `twilio.incomingPhoneNumbers.create(...)`.
  app.post('/virtual-number/provision', async (req, reply) => {
    const existing = [...store.virtualNumberToUserId.entries()].find(([, uid]) => uid === req.user.sub);
    if (existing) return reply.send({ e164: existing[0], alreadyProvisioned: true });

    const demoNumber = `+91DEMO${req.user.sub.slice(0, 6).toUpperCase()}`;
    store.assignVirtualNumber(req.user.sub, demoNumber);
    return reply.send({ e164: demoNumber, alreadyProvisioned: false });
  });
}
