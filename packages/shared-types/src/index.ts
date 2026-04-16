import { z } from 'zod';

// ─── Enums ─────────────────────────────────────────────────────────────────────
export const Profession = z.enum(['doctor', 'architect', 'hr', 'business_owner', 'other']);
export type Profession = z.infer<typeof Profession>;

export const Language = z.enum(['en', 'hi', 'hinglish']);
export type Language = z.infer<typeof Language>;

export const VoicePreset = z.enum(['female_warm', 'female_professional', 'male_professional']);
export type VoicePreset = z.infer<typeof VoicePreset>;

export const CallOutcome = z.enum([
  'forwarded',
  'rejected',
  'hungup',
  'bridged_known',
  'in_progress',
  'error',
]);
export type CallOutcome = z.infer<typeof CallOutcome>;

export const AgentDecision = z.enum(['FORWARD', 'REJECT', 'CONTINUE']);
export type AgentDecision = z.infer<typeof AgentDecision>;

// ─── Domain models ─────────────────────────────────────────────────────────────
export const User = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  name: z.string(),
  profession: Profession,
  voice_preference: VoicePreset.default('female_warm'),
  language: Language.default('en'),
  trial_started_at: z.string().datetime(),
  created_at: z.string().datetime(),
});
export type User = z.infer<typeof User>;

export const ScreeningQuestion = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  order_idx: z.number().int(),
  question_text: z.string(),
  answer_type: z.enum(['text', 'yes_no']).default('text'),
});
export type ScreeningQuestion = z.infer<typeof ScreeningQuestion>;

export const ScreeningRuleCondition = z.object({
  // simple, demo-grade. Future: extend with AND/OR groups.
  field: z.enum(['intent', 'is_existing_patient', 'is_emergency', 'caller_text']),
  op: z.enum(['equals', 'includes', 'not_equals']),
  value: z.string(),
});
export type ScreeningRuleCondition = z.infer<typeof ScreeningRuleCondition>;

export const ScreeningRule = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  order_idx: z.number().int(),
  condition: ScreeningRuleCondition,
  action: z.enum(['forward', 'reject']),
});
export type ScreeningRule = z.infer<typeof ScreeningRule>;

export const ScreeningProfile = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  is_active: z.boolean(),
  language: Language,
  greeting_text: z.string(),
  policy_prompt: z.string(),
  questions: z.array(ScreeningQuestion).default([]),
  rules: z.array(ScreeningRule).default([]),
});
export type ScreeningProfile = z.infer<typeof ScreeningProfile>;

export const Contact = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  phone_e164: z.string(),
});
export type Contact = z.infer<typeof Contact>;

export const CallTurn = z.object({
  id: z.string().uuid(),
  call_id: z.string().uuid(),
  turn_idx: z.number().int(),
  speaker: z.enum(['agent', 'caller']),
  text: z.string(),
  started_at: z.string().datetime(),
});
export type CallTurn = z.infer<typeof CallTurn>;

export const Call = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  from_number: z.string(),
  to_number: z.string(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  outcome: CallOutcome,
  decision_reason: z.string().nullable(),
  recording_url: z.string().url().nullable(),
  summary: z.string().nullable(),
  turns: z.array(CallTurn).default([]),
});
export type Call = z.infer<typeof Call>;

// ─── Agent LLM I/O contract ────────────────────────────────────────────────────
export const AgentLLMOutput = z.object({
  decision: AgentDecision,
  reason: z.string(),
  next_utterance: z.string(),
  collected: z
    .object({
      caller_name: z.string().optional(),
      is_existing_patient: z.boolean().optional(),
      is_emergency: z.boolean().optional(),
      intent: z.string().optional(),
      summary: z.string().optional(),
    })
    .partial()
    .optional(),
});
export type AgentLLMOutput = z.infer<typeof AgentLLMOutput>;
