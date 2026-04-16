import type { Language, Profession, ScreeningProfile } from '@gatekeep/shared-types';

/** Doctor template — our priority persona. */
export function doctorTemplate(userId: string, language: Language = 'en'): Omit<ScreeningProfile, 'id'> {
  return {
    user_id: userId,
    name: 'Doctor — Default',
    is_active: true,
    language,
    greeting_text:
      language === 'hi'
        ? 'नमस्ते, आप डॉक्टर के सहायक से बात कर रहे हैं। कृपया अपना नाम और कॉल का कारण बताएं।'
        : language === 'hinglish'
          ? "Namaste, main Doctor ke AI assistant se baat kar raha hoon. Aap kaun bol rahe hain aur kis baare mein call kiya hai?"
          : "Hello, you've reached the doctor's AI assistant. May I know your name and the reason for your call?",
    policy_prompt:
      'Only forward calls that are: (1) medical emergencies, or (2) from existing patients with a genuine medical concern, or (3) from known hospitals/clinics about a patient. Politely reject: sales, diagnostic-lab promos, insurance, pharma reps without appointment, and personal calls. For new-patient appointments, take the details but do NOT forward — say the clinic will call back.',
    questions: [
      { id: '', profile_id: '', order_idx: 0, question_text: 'May I know your name please?', answer_type: 'text' },
      { id: '', profile_id: '', order_idx: 1, question_text: 'Are you an existing patient?', answer_type: 'yes_no' },
      { id: '', profile_id: '', order_idx: 2, question_text: 'Is this a medical emergency?', answer_type: 'yes_no' },
      { id: '', profile_id: '', order_idx: 3, question_text: 'Briefly, what is this call regarding?', answer_type: 'text' },
    ],
    rules: [
      {
        id: '', profile_id: '', order_idx: 0,
        condition: { field: 'is_emergency', op: 'equals', value: 'true' },
        action: 'forward',
      },
      {
        id: '', profile_id: '', order_idx: 1,
        condition: { field: 'intent', op: 'includes', value: 'sales' },
        action: 'reject',
      },
      {
        id: '', profile_id: '', order_idx: 2,
        condition: { field: 'intent', op: 'includes', value: 'insurance' },
        action: 'reject',
      },
    ],
  };
}

export function templateFor(profession: Profession, userId: string, language: Language = 'en') {
  switch (profession) {
    case 'doctor':
      return doctorTemplate(userId, language);
    default:
      // Generic fallback — caller-agnostic screening
      return {
        ...doctorTemplate(userId, language),
        name: 'General — Default',
        policy_prompt:
          'Only forward calls that are clearly personal, from a known organization, or about a scheduled appointment. Reject sales, promotions, and cold calls.',
      };
  }
}
