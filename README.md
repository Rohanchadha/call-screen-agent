# Gatekeep 🛡️

AI call-screening receptionist for India — **only the real calls get through.**

Unknown callers are answered by an AI agent that asks the caller who they are, why they're calling, and applies your rules. Based on the answers, it either forwards the call to you with a summary or politely declines.

> **Status:** Demo / MVP. In-memory store (no DB). Works out of the box via a browser-based **Call Simulator**. Twilio integration is ready but optional.

---

## Monorepo layout

```
apps/
  api/      Fastify backend + Twilio voice agent + WebSocket demo
  web/      Next.js dashboard (rules editor, call log, simulator)
  mobile/   Expo React Native app (call log)
packages/
  shared-types/  Zod schemas + TS types
  agent-core/    Prompts, decision engine, doctor template
```

## Quick start (web demo — no API keys needed)

```bash
# 1. Install
pnpm install

# 2. Copy env example (nothing required filled for the demo)
cp .env.example .env

# 3. Start API + web in parallel
pnpm dev:api   # → http://localhost:4000
pnpm dev:web   # → http://localhost:3000
```

Open **http://localhost:3000/simulator**:

1. Click **Sign in (demo)** — OTP is auto-filled as `123456`.
2. Click **📞 Place incoming call** — you role-play the unknown caller.
3. Type what the caller says; Gatekeep's agent will ask questions, apply rules, and decide to FORWARD or REJECT.
4. See the transcript in **/calls** and on the mobile app.

### Mobile app

```bash
pnpm dev:mobile
```
Scan the QR with Expo Go (iOS/Android) on the same Wi-Fi, or press `w` for web.

## Optional: real AI (nicer conversations)

Add to `.env`:
```
OPENAI_API_KEY=sk-...
```
The agent will switch from the built-in mock to GPT-4o-mini JSON mode.

## Optional: real phone calls (Twilio)

1. Create a Twilio trial account, buy a number.
2. In `.env`:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   API_PUBLIC_URL=https://<your-ngrok>.ngrok-free.app
   ```
3. Run `ngrok http 4000` and paste the public URL above.
4. In Twilio console, set the number's Voice webhook to `POST {API_PUBLIC_URL}/twilio/voice`.
5. In the app, after sign-in hit `POST /me/virtual-number/provision` and manually map your Twilio number to the returned user by setting it in `store.assignVirtualNumber` (demo mode).
6. Call the Twilio number → you'll hear Gatekeep answer.

## Call flow

```
Unknown caller → Twilio → /twilio/voice
  → known contact? → <Dial> user directly
  → else greet, <Gather input=speech> loop
       → /twilio/collect → LLM decides FORWARD | REJECT | CONTINUE
         FORWARD → <Dial> user + whispered summary
         REJECT  → <Say> goodbye + hangup
         CONTINUE → another <Gather>
```

## Key files to read

- `packages/agent-core/src/prompt.ts` — the LLM system prompt
- `packages/agent-core/src/decision.ts` — hard-rule override engine
- `packages/agent-core/src/templates.ts` — doctor preset
- `apps/api/src/voice/dialogue.ts` — dialogue state machine + mock/LLM
- `apps/api/src/routes/twilio.ts` — real phone integration via TwiML `<Gather>`
- `apps/api/src/routes/demo.ts` — WebSocket-based browser demo

## Roadmap (post-demo)

- [ ] Real Postgres via Supabase (swap `store.ts`)
- [ ] Deepgram streaming + Twilio Media Streams for lower latency
- [ ] ElevenLabs Hindi voices
- [ ] Expo Push on forwarded calls
- [ ] Razorpay subscription after 7-day trial
- [ ] Android `CallScreeningService` + iOS CallKit spam-label
- [ ] TRAI/DPDP compliance (AI disclosure, consent, hashed contacts)
