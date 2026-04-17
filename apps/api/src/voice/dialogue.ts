import OpenAI from 'openai';
import { env } from '../config/env.js';
import {
  AgentLLMOutput,
  type ScreeningProfile,
  type User,
} from '@gatekeep/shared-types';
import {
  buildSystemPrompt,
  buildUserTurnPrompt,
  combineDecision,
  evaluateHardRules,
  type CollectedSignals,
} from '@gatekeep/agent-core';

const client = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

// Log once at module load so we know which brain is active.
// eslint-disable-next-line no-console
console.log(
  client
    ? '[dialogue] ✓ Using OpenAI GPT-4o-mini (real LLM)'
    : '[dialogue] ⚠ No OPENAI_API_KEY — using deterministic mock LLM',
);

export interface DialogueTurn {
  speaker: 'agent' | 'caller';
  text: string;
}

export interface DialogueState {
  user: User;
  profile: ScreeningProfile;
  history: DialogueTurn[];
  signals: CollectedSignals;
}

export function createDialogueState(user: User, profile: ScreeningProfile): DialogueState {
  return { user, profile, history: [], signals: {} };
}

export async function greetingUtterance(state: DialogueState): Promise<string> {
  const utter = state.profile.greeting_text;
  state.history.push({ speaker: 'agent', text: utter });
  return utter;
}

export interface AgentStepResult {
  decision: 'FORWARD' | 'REJECT' | 'CONTINUE';
  reason: string;
  utterance: string;
  signals: CollectedSignals;
}

/**
 * Advance the dialogue by one caller turn.
 * 1. Record caller text
 * 2. Call LLM with JSON mode for suggestion
 * 3. Merge collected signals
 * 4. Evaluate hard rules
 * 5. Combine → final decision
 */
export async function stepDialogue(
  state: DialogueState,
  callerText: string,
): Promise<AgentStepResult> {
  state.history.push({ speaker: 'caller', text: callerText });
  state.signals.caller_text = callerText;

  const llm = await callLLM(state, callerText);

  // Merge any new signals the LLM extracted.
  if (llm.collected) Object.assign(state.signals, llm.collected);

  const hard = evaluateHardRules(state.profile, state.signals);
  const combined = combineDecision(llm, hard);

  state.history.push({ speaker: 'agent', text: combined.next_utterance });

  return {
    decision: combined.decision,
    reason: combined.reason,
    utterance: combined.next_utterance,
    signals: state.signals,
  };
}

async function callLLM(state: DialogueState, callerText: string) {
  // If no API key, fall back to a deterministic mock so the demo still runs.
  if (!client) return mockLLM(state, callerText);

  const system = buildSystemPrompt({
    userName: state.user.name,
    profession: state.user.profession,
    profile: state.profile,
    voice: state.user.voice_preference,
  });
  const user = buildUserTurnPrompt({
    transcriptSoFar: state.history.slice(0, -1), // exclude the just-pushed caller turn for clarity? include for context.
    latestCallerText: callerText,
  });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const raw = completion.choices[0]?.message.content ?? '{}';
  try {
    return AgentLLMOutput.parse(JSON.parse(raw));
  } catch {
    return {
      decision: 'CONTINUE' as const,
      reason: 'LLM parse fallback',
      next_utterance: "Sorry, could you repeat that?",
    };
  }
}

// Deterministic fallback so the demo runs without an OpenAI key.
function mockLLM(state: DialogueState, callerText: string) {
  const turnNo = state.history.filter((h) => h.speaker === 'caller').length;
  const lower = callerText.toLowerCase();

  const collected: CollectedSignals = {};
  if (turnNo === 1) collected.caller_name = callerText.split(' ').slice(0, 3).join(' ');
  if (/emergency|urgent|severe/.test(lower)) collected.is_emergency = true;
  if (/existing patient|already.*patient|follow[- ]?up/.test(lower)) collected.is_existing_patient = true;
  if (/sale|offer|discount|promo|insurance|loan/.test(lower)) collected.intent = 'sales';
  if (/appointment|consult|check[- ]?up/.test(lower)) collected.intent = 'appointment';
  if (/emergency|pain|bleeding|accident/.test(lower)) collected.intent = 'emergency';

  if (collected.is_emergency || collected.intent === 'emergency') {
    return {
      decision: 'FORWARD' as const,
      reason: '(mock) emergency detected',
      next_utterance: "Please hold, I'll connect you to the doctor right away.",
      collected,
    };
  }
  if (collected.intent === 'sales') {
    return {
      decision: 'REJECT' as const,
      reason: '(mock) sales intent',
      next_utterance: 'Thank you, but the doctor is not available for sales calls. Goodbye.',
      collected,
    };
  }
  if (turnNo < 3) {
    const questions = state.profile.questions.sort((a, b) => a.order_idx - b.order_idx);
    const next = questions[turnNo]?.question_text ?? 'Could you tell me more?';
    return {
      decision: 'CONTINUE' as const,
      reason: '(mock) gathering info',
      next_utterance: next,
      collected,
    };
  }
  return {
    decision: 'FORWARD' as const,
    reason: '(mock) default forward',
    next_utterance: "Alright, please hold while I connect you.",
    collected,
  };
}
