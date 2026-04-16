import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { store } from '../db/store.js';
import { createDialogueState, greetingUtterance, stepDialogue } from '../voice/dialogue.js';

/**
 * Web-demo call simulator. A browser connects via WS, sends JSON text
 * messages, and receives agent replies + decisions. This lets us demo
 * the full decision loop without any telco.
 *
 * Protocol (JSON per WS message):
 *   client → server:
 *     { type: "start", userId: "<uuid>" }
 *     { type: "caller_text", text: "Hi, I'm calling about..." }
 *     { type: "end" }
 *   server → client:
 *     { type: "agent_text", text, decision }
 *     { type: "call_ended", outcome, reason }
 */
export async function registerDemoRoutes(app: FastifyInstance) {
  app.get('/call', { websocket: true }, (socket /* WebSocket */, _req) => {
    const ws = socket as unknown as WebSocket;
    let state: Awaited<ReturnType<typeof initState>> | null = null;
    let callId: string | null = null;

    ws.on('message', async (raw) => {
      let msg: { type: string; [k: string]: unknown };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      try {
        if (msg.type === 'start') {
          const userId = String(msg.userId ?? '');
          state = await initState(userId);
          if (!state) {
            ws.send(JSON.stringify({ type: 'error', error: 'user_not_found_or_no_profile' }));
            ws.close();
            return;
          }
          const fromNumber = String(msg.fromNumber ?? '+91DEMO_CALLER');
          const call = store.createCall({
            user_id: state.user.id,
            from_number: fromNumber,
            to_number: 'demo-sim',
            started_at: new Date().toISOString(),
            ended_at: null,
            outcome: 'in_progress',
            decision_reason: null,
            recording_url: null,
            summary: null,
          });
          callId = call.id;

          // Check contacts (skipping screening if known).
          const currentCallId = callId;
          if (store.isKnownContact(state.user.id, fromNumber)) {
            store.updateCall(currentCallId, {
              outcome: 'bridged_known',
              ended_at: new Date().toISOString(),
              decision_reason: 'Known contact — bypassed screening',
            });
            ws.send(
              JSON.stringify({
                type: 'call_ended',
                outcome: 'bridged_known',
                reason: 'Known contact',
              }),
            );
            ws.close();
            return;
          }

          const greet = await greetingUtterance(state);
          store.appendTurn(currentCallId, {
            turn_idx: 0,
            speaker: 'agent',
            text: greet,
            started_at: new Date().toISOString(),
          });
          ws.send(JSON.stringify({ type: 'agent_text', text: greet, decision: 'CONTINUE' }));
          return;
        }

        if (msg.type === 'caller_text' && state && callId) {
          const activeCallId = callId;
          const text = String(msg.text ?? '').trim();
          if (!text) return;
          store.appendTurn(activeCallId, {
            turn_idx: state.history.length,
            speaker: 'caller',
            text,
            started_at: new Date().toISOString(),
          });

          const result = await stepDialogue(state, text);

          store.appendTurn(activeCallId, {
            turn_idx: state.history.length,
            speaker: 'agent',
            text: result.utterance,
            started_at: new Date().toISOString(),
          });

          ws.send(
            JSON.stringify({
              type: 'agent_text',
              text: result.utterance,
              decision: result.decision,
              reason: result.reason,
            }),
          );

          if (result.decision === 'FORWARD' || result.decision === 'REJECT') {
            const outcome = result.decision === 'FORWARD' ? 'forwarded' : 'rejected';
            store.updateCall(activeCallId, {
              outcome,
              ended_at: new Date().toISOString(),
              decision_reason: result.reason,
              summary: result.signals.summary ?? null,
            });
            ws.send(
              JSON.stringify({
                type: 'call_ended',
                outcome,
                reason: result.reason,
                summary: result.signals.summary,
                collected: result.signals,
              }),
            );
            ws.close();
          }
          return;
        }

        if (msg.type === 'end' && callId) {
          const endingCallId = callId;
          store.updateCall(endingCallId, {
            outcome: 'hungup',
            ended_at: new Date().toISOString(),
          });
          ws.close();
        }
      } catch (err) {
        app.log.error({ err }, 'demo ws error');
        ws.send(JSON.stringify({ type: 'error', error: String((err as Error).message) }));
      }
    });
  });
}

async function initState(userId: string) {
  const user = store.getUser(userId);
  if (!user) return null;
  const profile = store.getActiveProfile(userId);
  if (!profile) return null;
  return createDialogueState(user, profile);
}
