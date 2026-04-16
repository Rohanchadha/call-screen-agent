import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { store } from '../db/store.js';
import { createDialogueState, greetingUtterance, stepDialogue } from '../voice/dialogue.js';

/**
 * Twilio Voice webhooks.
 *
 * Strategy (demo-grade): we use Twilio's built-in <Gather input="speech"> loop
 * instead of Media Streams. Twilio does STT, we call the LLM, and we reply with
 * <Say> (and can use <Say voice="Polly.Aditi"> for Hindi). This is much simpler
 * than raw μ-law media streams for a demo and needs no external STT/TTS costs.
 *
 * Flow:
 *   POST /twilio/voice        → greet caller, start Gather loop
 *   POST /twilio/collect      → STT result arrives, run one dialogue step,
 *                               respond with either another Gather, a Dial,
 *                               or a goodbye Hangup.
 *
 * State is keyed by Twilio CallSid in memory.
 */

interface ActiveCall {
  state: ReturnType<typeof createDialogueState>;
  callId: string;
  userPhone: string; // to dial on forward
}

const activeByCallSid = new Map<string, ActiveCall>();

export async function registerTwilioRoutes(app: FastifyInstance) {
  // Twilio sends x-www-form-urlencoded. Fastify parses JSON by default; add a parser:
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const params = new URLSearchParams(body as string);
        const obj: Record<string, string> = {};
        params.forEach((v, k) => (obj[k] = v));
        done(null, obj);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post('/voice', async (req, reply) => {
    const body = req.body as Record<string, string>;
    const callSid = body.CallSid;
    const from = body.From;
    const to = body.To;
    app.log.info({ callSid, from, to }, 'Twilio inbound call');

    const user = store.getUserByVirtualNumber(to);
    if (!user) {
      return reply.type('text/xml').send(twimlSay('Sorry, this number is not configured. Goodbye.'));
    }

    // Known contact? Bridge immediately.
    if (store.isKnownContact(user.id, from)) {
      store.createCall({
        user_id: user.id,
        from_number: from,
        to_number: to,
        started_at: new Date().toISOString(),
        ended_at: null,
        outcome: 'bridged_known',
        decision_reason: 'Known contact',
        recording_url: null,
        summary: null,
      });
      return reply.type('text/xml').send(twimlDial(user.phone));
    }

    const profile = store.getActiveProfile(user.id);
    if (!profile) {
      return reply
        .type('text/xml')
        .send(twimlSay("Sorry, the user has not set up screening yet. Goodbye."));
    }

    const state = createDialogueState(user, profile);
    const call = store.createCall({
      user_id: user.id,
      from_number: from,
      to_number: to,
      started_at: new Date().toISOString(),
      ended_at: null,
      outcome: 'in_progress',
      decision_reason: null,
      recording_url: null,
      summary: null,
    });
    activeByCallSid.set(callSid, { state, callId: call.id, userPhone: user.phone });

    const greet = await greetingUtterance(state);
    store.appendTurn(call.id, {
      turn_idx: 0,
      speaker: 'agent',
      text: greet,
      started_at: new Date().toISOString(),
    });

    return reply.type('text/xml').send(twimlGather(greet, profile.language, env.API_PUBLIC_URL));
  });

  app.post('/collect', async (req, reply) => {
    const body = req.body as Record<string, string>;
    const callSid = body.CallSid;
    const speech = (body.SpeechResult ?? '').trim();
    const active = activeByCallSid.get(callSid);

    if (!active) {
      return reply.type('text/xml').send(twimlSay('Session expired. Goodbye.'));
    }

    if (!speech) {
      // No speech — re-prompt.
      return reply
        .type('text/xml')
        .send(twimlGather("Sorry, I didn't catch that. Could you repeat?", active.state.profile.language, env.API_PUBLIC_URL));
    }

    store.appendTurn(active.callId, {
      turn_idx: active.state.history.length,
      speaker: 'caller',
      text: speech,
      started_at: new Date().toISOString(),
    });

    const result = await stepDialogue(active.state, speech);

    store.appendTurn(active.callId, {
      turn_idx: active.state.history.length,
      speaker: 'agent',
      text: result.utterance,
      started_at: new Date().toISOString(),
    });

    if (result.decision === 'FORWARD') {
      store.updateCall(active.callId, {
        outcome: 'forwarded',
        ended_at: new Date().toISOString(),
        decision_reason: result.reason,
        summary: result.signals.summary ?? null,
      });
      activeByCallSid.delete(callSid);
      const whisper = `Incoming screened call. ${result.signals.caller_name ?? 'Unknown'}. Reason: ${result.signals.summary ?? result.signals.intent ?? 'not specified'}.`;
      return reply.type('text/xml').send(twimlForward(result.utterance, active.userPhone, whisper));
    }

    if (result.decision === 'REJECT') {
      store.updateCall(active.callId, {
        outcome: 'rejected',
        ended_at: new Date().toISOString(),
        decision_reason: result.reason,
        summary: result.signals.summary ?? null,
      });
      activeByCallSid.delete(callSid);
      return reply.type('text/xml').send(twimlSay(result.utterance));
    }

    return reply
      .type('text/xml')
      .send(twimlGather(result.utterance, active.state.profile.language, env.API_PUBLIC_URL));
  });

  app.post('/status', async (req, reply) => {
    const body = req.body as Record<string, string>;
    app.log.info({ status: body.CallStatus, sid: body.CallSid }, 'Twilio status callback');
    return reply.send({ ok: true });
  });
}

// ─── TwiML builders ──────────────────────────────────────────────────────────
function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

function voiceFor(lang: string): { voice: string; language: string } {
  // Twilio's Polly Neural voices.
  if (lang === 'hi' || lang === 'hinglish') return { voice: 'Polly.Aditi', language: 'hi-IN' };
  return { voice: 'Polly.Kajal-Neural', language: 'en-IN' };
}

function twimlSay(text: string, lang = 'en') {
  const v = voiceFor(lang);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${v.voice}" language="${v.language}">${escapeXml(text)}</Say>
  <Hangup/>
</Response>`;
}

function twimlGather(prompt: string, lang: string, publicUrl: string) {
  const v = voiceFor(lang);
  const sttLang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="${sttLang}" speechTimeout="auto"
          action="${publicUrl}/twilio/collect" method="POST">
    <Say voice="${v.voice}" language="${v.language}">${escapeXml(prompt)}</Say>
  </Gather>
  <Say voice="${v.voice}" language="${v.language}">Sorry, I didn't hear you. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

function twimlDial(toNumber: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${escapeXml(toNumber)}</Dial>
</Response>`;
}

function twimlForward(calleeMessage: string, userPhone: string, whisper: string) {
  const v = voiceFor('en');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${v.voice}" language="${v.language}">${escapeXml(calleeMessage)}</Say>
  <Dial>
    <Number>
      ${escapeXml(userPhone)}
    </Number>
  </Dial>
  <Say voice="${v.voice}" language="${v.language}">${escapeXml(whisper)}</Say>
</Response>`;
}
