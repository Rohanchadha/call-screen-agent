/**
 * Demo-grade in-memory store. Lets us run the whole system without Supabase.
 * Swap for a real Postgres-backed repo later without changing route code.
 */
import { randomUUID } from 'node:crypto';
import { templateFor } from '@gatekeep/agent-core';
import type {
  Call,
  CallTurn,
  Contact,
  Profession,
  ScreeningProfile,
  ScreeningQuestion,
  ScreeningRule,
  User,
} from '@gatekeep/shared-types';

class Store {
  users = new Map<string, User>();
  usersByPhone = new Map<string, string>();
  virtualNumberToUserId = new Map<string, string>(); // E.164 → userId
  contactsByUser = new Map<string, Contact[]>();
  profilesByUser = new Map<string, ScreeningProfile[]>();
  calls = new Map<string, Call>();
  callsByUser = new Map<string, string[]>();
  pendingOtps = new Map<string, string>(); // phone → code

  // ─── Users ─────────────────────────────────────────────────────────────────
  upsertUserByPhone(phone: string, patch: Partial<User> = {}): User {
    const existingId = this.usersByPhone.get(phone);
    if (existingId) {
      const u = this.users.get(existingId)!;
      const merged = { ...u, ...patch };
      this.users.set(u.id, merged);
      return merged;
    }
    const id = randomUUID();
    const user: User = {
      id,
      phone,
      name: patch.name ?? 'New User',
      profession: (patch.profession as Profession) ?? 'doctor',
      voice_preference: patch.voice_preference ?? 'female_warm',
      language: patch.language ?? 'en',
      trial_started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    this.users.set(id, user);
    this.usersByPhone.set(phone, id);

    // Seed default profile for this user based on profession.
    const tpl = templateFor(user.profession, id, user.language);
    this.createProfile({ ...tpl, user_id: id });

    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  // ─── Virtual numbers ───────────────────────────────────────────────────────
  assignVirtualNumber(userId: string, e164: string) {
    this.virtualNumberToUserId.set(e164, userId);
  }

  getUserByVirtualNumber(e164: string): User | undefined {
    const uid = this.virtualNumberToUserId.get(e164);
    return uid ? this.users.get(uid) : undefined;
  }

  // ─── Profiles ──────────────────────────────────────────────────────────────
  createProfile(input: Omit<ScreeningProfile, 'id'>): ScreeningProfile {
    const id = randomUUID();
    const profile: ScreeningProfile = {
      ...input,
      id,
      questions: input.questions.map(
        (q): ScreeningQuestion => ({ ...q, id: randomUUID(), profile_id: id }),
      ),
      rules: input.rules.map(
        (r): ScreeningRule => ({ ...r, id: randomUUID(), profile_id: id }),
      ),
    };
    const list = this.profilesByUser.get(input.user_id) ?? [];
    // Ensure only one active profile at a time.
    if (profile.is_active) list.forEach((p) => (p.is_active = false));
    list.push(profile);
    this.profilesByUser.set(input.user_id, list);
    return profile;
  }

  getProfiles(userId: string): ScreeningProfile[] {
    return this.profilesByUser.get(userId) ?? [];
  }

  getActiveProfile(userId: string): ScreeningProfile | undefined {
    return (this.profilesByUser.get(userId) ?? []).find((p) => p.is_active);
  }

  updateProfile(userId: string, id: string, patch: Partial<ScreeningProfile>): ScreeningProfile | undefined {
    const list = this.profilesByUser.get(userId);
    if (!list) return undefined;
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return undefined;
    if (patch.is_active) list.forEach((p) => (p.is_active = false));
    list[idx] = { ...list[idx], ...patch, id };
    return list[idx];
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────
  upsertContacts(userId: string, contacts: Array<{ name: string; phone_e164: string }>): Contact[] {
    const existing = this.contactsByUser.get(userId) ?? [];
    const byPhone = new Map(existing.map((c) => [c.phone_e164, c]));
    for (const c of contacts) {
      const prev = byPhone.get(c.phone_e164);
      if (prev) byPhone.set(c.phone_e164, { ...prev, name: c.name });
      else byPhone.set(c.phone_e164, { id: randomUUID(), user_id: userId, ...c });
    }
    const list = [...byPhone.values()];
    this.contactsByUser.set(userId, list);
    return list;
  }

  isKnownContact(userId: string, phone_e164: string): boolean {
    return (this.contactsByUser.get(userId) ?? []).some((c) => c.phone_e164 === phone_e164);
  }

  listContacts(userId: string): Contact[] {
    return this.contactsByUser.get(userId) ?? [];
  }

  // ─── Calls ─────────────────────────────────────────────────────────────────
  createCall(input: Omit<Call, 'id' | 'turns'>): Call {
    const id = randomUUID();
    const call: Call = { ...input, id, turns: [] };
    this.calls.set(id, call);
    const list = this.callsByUser.get(input.user_id) ?? [];
    list.unshift(id);
    this.callsByUser.set(input.user_id, list);
    return call;
  }

  appendTurn(callId: string, turn: Omit<CallTurn, 'id' | 'call_id'>): CallTurn | undefined {
    const call = this.calls.get(callId);
    if (!call) return undefined;
    const t: CallTurn = { ...turn, id: randomUUID(), call_id: callId };
    call.turns.push(t);
    return t;
  }

  updateCall(callId: string, patch: Partial<Call>): Call | undefined {
    const call = this.calls.get(callId);
    if (!call) return undefined;
    Object.assign(call, patch);
    return call;
  }

  getCall(callId: string): Call | undefined {
    return this.calls.get(callId);
  }

  listCalls(userId: string, limit = 50): Call[] {
    const ids = this.callsByUser.get(userId) ?? [];
    return ids.slice(0, limit).map((id) => this.calls.get(id)!).filter(Boolean);
  }

  // ─── OTP ───────────────────────────────────────────────────────────────────
  setOtp(phone: string, code: string) {
    this.pendingOtps.set(phone, code);
  }
  consumeOtp(phone: string, code: string): boolean {
    const expected = this.pendingOtps.get(phone);
    if (expected && expected === code) {
      this.pendingOtps.delete(phone);
      return true;
    }
    return false;
  }
}

export const store = new Store();
