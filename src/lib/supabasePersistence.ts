/*
 * BMONI Embedded — Supabase persistence adapter.
 *
 * Maps the in-memory sandbox DB onto Supabase tables (see
 * supabase/migrations/001_init.sql) and wraps Supabase Auth. The mock
 * api.ts keeps owning the state machines and ledger rules; this file only
 * moves bytes. Swapping persistence never changes a screen.
 */
import { supabase } from "./supabase";
import { ApiError } from "../types";
import type {
  Beneficiary, Device, FundingIntent, KycProfile, LedgerEntry, Noti,
  RailAccount, Transfer,
} from "../types";
import type { DB, UserRecord } from "../mock/api";

export interface RemoteData {
  profile: UserRecord | null;
  ledger: LedgerEntry[];
  kyc: KycProfile | null;
  rails: RailAccount[];
  beneficiaries: Beneficiary[];
  funding: FundingIntent[];
  transfers: Transfer[];
  notifications: Noti[];
}

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */
export async function sbRestore(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function sbSignUp(name: string, email: string, password: string): Promise<string> {
  const { data, error } = await supabase().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim() } },
  });
  if (error) {
    if (/already|registered/i.test(error.message)) {
      throw new ApiError("An account already exists for this email.", { email: "Already registered — sign in instead." });
    }
    throw new ApiError(error.message);
  }
  if (!data.session?.user) {
    throw new ApiError("Almost there — confirm the email Supabase just sent you, then sign in. (To skip this in the sandbox: Auth → Providers → Email → disable “Confirm email”.)");
  }
  return data.session.user.id;
}

export async function sbSignIn(email: string, password: string): Promise<string> {
  const { data, error } = await supabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) throw new ApiError("Invalid email or password.");
  return data.user.id;
}

export async function sbSignOut(): Promise<void> {
  await supabase().auth.signOut();
}

export async function sbRequestReset(email: string): Promise<void> {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) throw new ApiError(error.message);
}

/* ------------------------------------------------------------------ */
/* load                                                                */
/* ------------------------------------------------------------------ */
export async function sbLoadAll(userId: string): Promise<RemoteData> {
  const s = supabase();
  const [p, k, l, r, b, f, t, n] = await Promise.all([
    s.from("profiles").select("*").eq("id", userId).maybeSingle(),
    s.from("kyc_profiles").select("*").eq("user_id", userId).maybeSingle(),
    s.from("ledger_entries").select("*").eq("user_id", userId).order("ts_ms", { ascending: true }),
    s.from("rail_accounts").select("*").eq("user_id", userId).order("added_at_ms", { ascending: false }),
    s.from("beneficiaries").select("*").eq("user_id", userId).order("created_at_ms", { ascending: false }),
    s.from("funding_intents").select("*").eq("user_id", userId).order("created_at_ms", { ascending: false }),
    s.from("transfers").select("*").eq("user_id", userId).order("created_at_ms", { ascending: false }),
    s.from("notifications").select("*").eq("user_id", userId).order("ts_ms", { ascending: false }),
  ]);
  const fail = [p, k, l, r, b, f, t, n].find((x) => x.error);
  if (fail) throw new ApiError(`Supabase read failed: ${fail.error!.message}`);

  return {
    profile: p.data ? {
      id: p.data.id, name: p.data.name ?? "", email: p.data.email, phone: p.data.phone ?? "",
      status: p.data.status ?? "ACTIVE", createdAt: Date.parse(p.data.created_at) || Date.now(), password: "",
    } : null,
    ledger: (l.data ?? []).map((x): LedgerEntry => ({
      id: x.id, userId: x.user_id, ts: Number(x.ts_ms), description: x.description,
      counterparty: x.counterparty ?? "", amountCents: Number(x.amount_cents),
      type: x.type, status: x.status, refKind: x.ref_kind, refId: x.ref_id,
    })),
    kyc: k.data ? {
      userId: k.data.user_id, status: k.data.status, attempts: k.data.attempts ?? 0,
      personalInfo: k.data.personal_info ?? undefined, documentType: k.data.document_type ?? undefined,
      reason: k.data.reason ?? undefined, events: k.data.events ?? [],
    } : null,
    rails: (r.data ?? []).map((x): RailAccount => ({
      id: x.id, userId: x.user_id, rail: x.rail, institution: x.institution,
      accountMasked: x.account_masked, status: x.status, failReason: x.fail_reason ?? undefined,
      addedAt: Number(x.added_at_ms), events: x.events ?? [],
    })),
    beneficiaries: (b.data ?? []).map((x): Beneficiary => ({
      id: x.id, userId: x.user_id, name: x.name, rail: x.rail, accountMasked: x.account_masked,
      institution: x.institution, status: x.status, failReason: x.fail_reason ?? undefined,
      createdAt: Number(x.created_at_ms), events: x.events ?? [],
    })),
    funding: (f.data ?? []).map((x): FundingIntent => ({
      id: x.id, userId: x.user_id, method: x.method, amountCents: Number(x.amount_cents),
      feeCents: Number(x.fee_cents), status: x.status, failReason: x.fail_reason ?? undefined,
      providerRef: x.provider_ref, referenceCode: x.reference_code ?? undefined,
      idempotencyKey: x.idempotency_key ?? undefined, createdAt: Number(x.created_at_ms), events: x.events ?? [],
    })),
    transfers: (t.data ?? []).map((x): Transfer => ({
      id: x.id, userId: x.user_id, kind: x.kind, amountCents: Number(x.amount_cents),
      feeCents: Number(x.fee_cents), destination: x.destination, note: x.note ?? undefined,
      status: x.status, failReason: x.fail_reason ?? undefined, providerRef: x.provider_ref,
      idempotencyKey: x.idempotency_key ?? undefined, createdAt: Number(x.created_at_ms), events: x.events ?? [],
    })),
    notifications: (n.data ?? []).map((x): Noti => ({
      id: x.id, userId: x.user_id, ts: Number(x.ts_ms), title: x.title, body: x.body ?? "",
      kind: x.kind, read: x.read ?? false,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* flush (debounced full-user sync — sandbox write model, Phase 1)      */
/* ------------------------------------------------------------------ */
export async function sbFlush(userId: string, db: DB): Promise<void> {
  const s = supabase();
  const me = db.users.find((u) => u.id === userId);

  if (me) {
    const { error } = await s.from("profiles").upsert({
      id: me.id, name: me.name, email: me.email, phone: me.phone, status: me.status,
    }, { onConflict: "id" });
    if (error) throw new Error(`profiles: ${error.message}`);
  }

  const { error: wErr } = await s.from("wallets").upsert({ user_id: userId }, { onConflict: "user_id" });
  if (wErr) throw new Error(`wallets: ${wErr.message}`);

  const mine = <T extends { userId: string }>(arr: T[]) => arr.filter((x) => x.userId === userId);

  const sync = async (
    table: string,
    rows: Record<string, unknown>[],
  ) => {
    const { error: dErr } = await s.from(table).delete().eq("user_id", userId);
    if (dErr) throw new Error(`${table} delete: ${dErr.message}`);
    if (rows.length) {
      const { error: iErr } = await s.from(table).insert(rows);
      if (iErr) throw new Error(`${table} insert: ${iErr.message}`);
    }
  };

  await sync("ledger_entries", mine(db.ledger).map((x) => ({
    id: x.id, user_id: x.userId, ts_ms: x.ts, description: x.description, counterparty: x.counterparty,
    amount_cents: x.amountCents, type: x.type, status: x.status, ref_kind: x.refKind, ref_id: x.refId,
  })));

  const kyc = db.kyc.find((x) => x.userId === userId);
  const { error: kErr } = await s.from("kyc_profiles").upsert({
    user_id: userId,
    status: kyc?.status ?? "NOT_STARTED",
    attempts: kyc?.attempts ?? 0,
    personal_info: kyc?.personalInfo ?? null,
    document_type: kyc?.documentType ?? null,
    reason: kyc?.reason ?? null,
    events: kyc?.events ?? [],
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (kErr) throw new Error(`kyc_profiles: ${kErr.message}`);

  await sync("rail_accounts", mine(db.rails).map((x) => ({
    id: x.id, user_id: x.userId, rail: x.rail, institution: x.institution, account_masked: x.accountMasked,
    status: x.status, fail_reason: x.failReason ?? null, added_at_ms: x.addedAt, events: x.events,
  })));

  await sync("beneficiaries", mine(db.beneficiaries).map((x) => ({
    id: x.id, user_id: x.userId, name: x.name, rail: x.rail, account_masked: x.accountMasked,
    institution: x.institution, status: x.status, fail_reason: x.failReason ?? null, created_at_ms: x.createdAt, events: x.events,
  })));

  await sync("funding_intents", mine(db.funding).map((x) => ({
    id: x.id, user_id: x.userId, method: x.method, amount_cents: x.amountCents, fee_cents: x.feeCents,
    status: x.status, fail_reason: x.failReason ?? null, provider_ref: x.providerRef,
    reference_code: x.referenceCode ?? null, idempotency_key: x.idempotencyKey ?? null,
    created_at_ms: x.createdAt, events: x.events,
  })));

  await sync("transfers", mine(db.transfers).map((x) => ({
    id: x.id, user_id: x.userId, kind: x.kind, amount_cents: x.amountCents, fee_cents: x.feeCents,
    destination: x.destination, note: x.note ?? null, status: x.status, fail_reason: x.failReason ?? null,
    provider_ref: x.providerRef, idempotency_key: x.idempotencyKey ?? null, created_at_ms: x.createdAt, events: x.events,
  })));

  await sync("notifications", mine(db.notifications).map((x) => ({
    id: x.id, user_id: x.userId, ts_ms: x.ts, title: x.title, body: x.body, kind: x.kind, read: x.read,
  })));
}

/* devices stay per-browser by design (they describe this device) */
export function loadLocalDevices(fresh: Device[]): Device[] {
  try {
    const raw = localStorage.getItem("bmoni.devices.v1");
    if (raw) {
      const parsed = JSON.parse(raw) as Device[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* fall through to fresh */ }
  return fresh;
}
export function saveLocalDevices(devices: Device[]) {
  try { localStorage.setItem("bmoni.devices.v1", JSON.stringify(devices)); } catch { /* noop */ }
}
