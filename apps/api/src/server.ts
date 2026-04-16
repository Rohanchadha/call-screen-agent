import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { env } from './config/env.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMeRoutes } from './routes/me.js';
import { registerProfileRoutes } from './routes/profiles.js';
import { registerContactRoutes } from './routes/contacts.js';
import { registerCallRoutes } from './routes/calls.js';
import { registerTwilioRoutes } from './routes/twilio.js';
import { registerDemoRoutes } from './routes/demo.js';

async function main() {
  const app = Fastify({
    logger: {
      transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    },
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(websocket);

  app.get('/health', async () => ({ ok: true, service: 'gatekeep-api', ts: new Date().toISOString() }));

  await app.register(registerAuthRoutes, { prefix: '/auth' });
  await app.register(registerMeRoutes, { prefix: '/me' });
  await app.register(registerProfileRoutes, { prefix: '/profiles' });
  await app.register(registerContactRoutes, { prefix: '/contacts' });
  await app.register(registerCallRoutes, { prefix: '/calls' });
  await app.register(registerTwilioRoutes, { prefix: '/twilio' });
  await app.register(registerDemoRoutes, { prefix: '/demo' });

  try {
    await app.listen({ host: '0.0.0.0', port: env.API_PORT });
    app.log.info(`Gatekeep API ready on :${env.API_PORT} (public: ${env.API_PUBLIC_URL})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
