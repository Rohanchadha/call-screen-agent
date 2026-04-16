import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { store } from '../db/store.js';

export async function registerProfileRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (req, reply) => {
    return reply.send({ profiles: store.getProfiles(req.user.sub) });
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        name: z.string().optional(),
        is_active: z.boolean().optional(),
        language: z.enum(['en', 'hi', 'hinglish']).optional(),
        greeting_text: z.string().optional(),
        policy_prompt: z.string().optional(),
        questions: z
          .array(
            z.object({
              id: z.string().optional(),
              profile_id: z.string().optional(),
              order_idx: z.number().int(),
              question_text: z.string().min(1),
              answer_type: z.enum(['text', 'yes_no']).default('text'),
            }),
          )
          .optional(),
        rules: z
          .array(
            z.object({
              id: z.string().optional(),
              profile_id: z.string().optional(),
              order_idx: z.number().int(),
              condition: z.object({
                field: z.enum(['intent', 'is_existing_patient', 'is_emergency', 'caller_text']),
                op: z.enum(['equals', 'includes', 'not_equals']),
                value: z.string(),
              }),
              action: z.enum(['forward', 'reject']),
            }),
          )
          .optional(),
      })
      .parse(req.body);
    const updated = store.updateProfile(req.user.sub, id, body as never);
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ profile: updated });
  });
}
