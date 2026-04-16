import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { store } from '../db/store.js';

// Demo OTP: always "123456" for any phone. Logs code to console for realism.
export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/request-otp', async (req, reply) => {
    const body = z.object({ phone: z.string().min(6) }).parse(req.body);
    const code = '123456';
    store.setOtp(body.phone, code);
    app.log.info(`[OTP] ${body.phone} → ${code}`);
    return reply.send({ ok: true, devHint: 'Use 123456 to verify (demo mode).' });
  });

  app.post('/verify-otp', async (req, reply) => {
    const body = z
      .object({
        phone: z.string().min(6),
        code: z.string().min(4),
        name: z.string().optional(),
        profession: z.enum(['doctor', 'architect', 'hr', 'business_owner', 'other']).optional(),
      })
      .parse(req.body);
    if (!store.consumeOtp(body.phone, body.code)) {
      return reply.code(400).send({ error: 'invalid_otp' });
    }
    const user = store.upsertUserByPhone(body.phone, {
      name: body.name,
      profession: body.profession,
    });
    const token = app.jwt.sign({ sub: user.id, phone: user.phone }, { expiresIn: '30d' });
    return reply.send({ token, user });
  });
}
