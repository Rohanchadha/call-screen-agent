import type {
  AgentDecision,
  AgentLLMOutput,
  ScreeningProfile,
  ScreeningRuleCondition,
} from '@gatekeep/shared-types';

export interface CollectedSignals {
  caller_name?: string;
  is_existing_patient?: boolean;
  is_emergency?: boolean;
  intent?: string;
  summary?: string;
  caller_text?: string;
}

/**
 * Hard-rule evaluator. Runs BEFORE trusting the LLM's decision.
 * If any rule matches, its action wins and short-circuits.
 */
export function evaluateHardRules(
  profile: ScreeningProfile,
  signals: CollectedSignals,
): { decision: AgentDecision; reason: string } | null {
  for (const rule of [...profile.rules].sort((a, b) => a.order_idx - b.order_idx)) {
    if (matches(rule.condition, signals)) {
      return {
        decision: rule.action === 'forward' ? 'FORWARD' : 'REJECT',
        reason: `Hard rule: ${rule.condition.field} ${rule.condition.op} "${rule.condition.value}"`,
      };
    }
  }
  return null;
}

function matches(cond: ScreeningRuleCondition, s: CollectedSignals): boolean {
  const raw = (s as Record<string, unknown>)[cond.field];
  const strVal = raw === undefined || raw === null ? '' : String(raw).toLowerCase();
  const target = cond.value.toLowerCase();
  switch (cond.op) {
    case 'equals':
      return strVal === target;
    case 'not_equals':
      return strVal !== '' && strVal !== target;
    case 'includes':
      return strVal.includes(target);
    default:
      return false;
  }
}

/**
 * Combines the LLM's suggested decision with the hard-rule result.
 * Hard rules always win.
 */
export function combineDecision(
  llm: AgentLLMOutput,
  hard: { decision: AgentDecision; reason: string } | null,
): { decision: AgentDecision; reason: string; next_utterance: string } {
  if (hard && hard.decision !== 'CONTINUE') {
    return {
      decision: hard.decision,
      reason: hard.reason,
      // fall back to a safe default utterance if LLM disagreed
      next_utterance:
        llm.decision === hard.decision
          ? llm.next_utterance
          : hard.decision === 'FORWARD'
            ? "Please hold, I'll connect you now."
            : 'Thank you for calling. Unfortunately we cannot take this call right now. Goodbye.',
    };
  }
  return {
    decision: llm.decision,
    reason: llm.reason,
    next_utterance: llm.next_utterance,
  };
}
