import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AuthUser {
  sub: string; // user id
  phone: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'unauthorized' });
  }
}

export function authHook(app: FastifyInstance) {
  return app.addHook('preHandler', requireAuth);
}
