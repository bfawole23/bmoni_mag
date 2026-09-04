/*
 * BMONI Embedded — mock BMONI API (Phase 1).
 * The UI talks ONLY to this client layer, exactly like it will talk to the
 * real `/api/v1` server in Phase 2. Every call is async, latency-simulated,
 * and drives the full state machines from the build plan:
 *   KYC:      NOT_STARTED → IN_PROGRESS → PENDING → VERIFIED / REJECTED / RETRY_REQUIRED
 *   Rail:     VALIDATING → ACTIVE / FAILED
 *   Funding:  CREATED → REQUIRES_ACTION → PROCESSING → SUCCEEDED / FAILED / CANCELLED / EXPIRED
 *   Transfer: CREATED → PROCESSING (reserved) → COMPLETED / FAILED / CANCELLED / REVERSED
 * The ledger is the source of truth: balances are projected from entries.
 */
import {
  ApiError, type Beneficiary, type Device, type FundingIntent, type FundingMethod,
  type KycProfile, type LedgerEntry, type Noti, type RailAccount, type RailType,
  type Snapshot, type StateEvent, type Transaction, type Transfer, type TransferKind,
  type User,
} from "../types";
import { LS, maskAccount, sleep, uid } from "../lib/utils";

const DB_KEY = "bmoni.db.v2";
const SESSION_KEY = "bmoni.session.v2";

interface UserRecord extends User { password: string; }

interface DB {
  users: UserRecord[];
  ledger: LedgerEntry[];
  kyc: KycProfile[];
  rails: RailAccount[];
  beneficiaries: Beneficiary[];
  funding: FundingIntent[];
  transfers: Transfer[];
  notifications: Noti[];
  devices: Device[];
  resetCodes: Record<string, string>;
}

let db: DB = load() ?? seed();
let listeners: Array<() => void> = [];
const now = Date.now();
const H = 3600_000;
const D = 24 * H;

/* ------------------------------------------------------------------ */
/* seed                                                                */
/* ------------------------------------------------------------------ */
function seed(): DB {
  const demoId = "U_DEMO01";
  const entry = (
    ts: number, description: string, counterparty: string, amountCents: number,
    type: LedgerEntry["type"], refId: string,
  ): LedgerEntry => ({
    id: uid("LE"), userId: demoId, ts, description, counterparty,
    amountCents, type, status: "POSTED", refKind: "ADJUSTMENT", refId,
  });
  const t = (daysAgo: number, hour = 15) => now - daysAgo * D - hour * H;
  const ev = (state: string, at: number): StateEvent => ({ state, at });

  const fresh: DB = {
    users: [{
      id: demoId, name: "Ada Okonkwo", email: "demo@bmoni.app",
      password: "bmoni-demo", phone: "+1 415 555 0134", status: "ACTIVE", createdAt: now - 34 * D,
    }],
    ledger: [
      entry(t(30), "Founder advance", "BMONI Treasury", 200000, "CREDIT", "ADJ_01"),
      entry(t(21), "Stripe payout — week 12", "Stripe", 142055, "CREDIT", "ADJ_02"),
      entry(t(18), "Withdrawal to Chase ••4821", "Chase ••4821", -60000, "DEBIT", "SEED_W1"),
      entry(t(18), "Withdrawal fee", "BMONI", -100, "FEE", "SEED_W1"),
      entry(t(12), "Payment — INV-2041", "Acme Supplies Co.", -86040, "DEBIT", "ADJ_03"),
      entry(t(11), "Refund — INV-2041 (partial)", "Acme Supplies Co.", 12040, "CREDIT", "ADJ_04"),
      entry(t(6), "Stripe payout — week 13", "Stripe", 98010, "CREDIT", "ADJ_05"),
      entry(t(3), "Internal transfer", "jules@bmoni.app", 15000, "CREDIT", "ADJ_06"),
      entry(t(2), "Figma — team plan", "Figma", -4500, "DEBIT", "ADJ_07"),
    ],
    kyc: [{ userId: demoId, status: "NOT_STARTED", attempts: 0, events: [] }],
    rails: [{
      id: "RA_SEED1", userId: demoId, rail: "ACH", institution: "Chase",
      accountMasked: "•••• 4821", status: "ACTIVE", addedAt: now - 26 * D,
      events: [ev("VALIDATING", now - 26 * D), ev("ACTIVE", now - 26 * D + 40_000)],
    }],
    beneficiaries: [{
      id: "BN_SEED1", userId: demoId, name: "Acme Supplies Co.", rail: "ACH",
      accountMasked: "•••• 9917", institution: "Mercury", status: "VERIFIED", createdAt: now - 20 * D,
      events: [ev("PENDING", now - 20 * D), ev("VERIFIED", now - 20 * D + 90_000)],
    }],
    funding: [],
    transfers: [],
    notifications: [
      { id: uid("NT"), userId: demoId, ts: now - 26 * D, title: "Rail linked", body: "Chase •••• 4821 was verified over the ACH rail.", kind: "success", read: true },
      { id: uid("NT"), userId: demoId, ts: now - 34 * D, title: "Welcome to BMONI Embedded", body: "Your wallet W_DEMO01 is live on the sandbox ledger.", kind: "info", read: true },
    ],
    devices: [
      { id: "DV_1", label: "Chrome · macOS", location: "San Francisco, US", lastActive: now - 2 * 60_000, current: true },
      { id: "DV_2", label: "Safari · iPhone 15", location: "Lisbon, PT", lastActive: now - 5 * H, current: false },
      { id: "DV_3", label: "Firefox · Linux", location: "Berlin, DE", lastActive: now - 3 * D, current: false },
    ],
    resetCodes: {},
  };
  save(fresh);
  return fresh;
}

function load(): DB | null {
  const raw = LS.get<DB | null>(DB_KEY, null);
  if (!raw || !Array.isArray(raw.users)) return null;
  /* shape guard: a stale sandbox from an older build may be missing
     collections — fall back to a clean seed instead of crashing at boot */
  const arrays: Array<keyof DB> = ["ledger", "kyc", "rails", "beneficiaries", "funding", "transfers", "notifications", "devices"];
  if (!arrays.every((k) => Array.isArray(raw[k]))) return null;
  if (!raw.resetCodes || typeof raw.resetCodes !== "object") raw.resetCodes = {};
  return raw;
}
function save(d: DB = db) { LS.set(DB_KEY, d); }
function emit() { listeners.forEach((l) => l()); }
function after(ms: number, fn: () => void) {
  window.setTimeout(() => { fn(); save(); emit(); }, ms);
}

/* ------------------------------------------------------------------ */
/* internals                                                           */
/* ------------------------------------------------------------------ */
const sessionUserId = () => LS.get<string | null>(SESSION_KEY, null);
const me = (): UserRecord => {
  const u = db.users.find((x) => x.id === sessionUserId());
  if (!u) throw new ApiError("Session expired — sign in again.");
  return u;
};
const forMe = <T extends { userId: string }>(arr: T[]) => arr.filter((x) => x.userId === me().id);
const ev = (state: string, note?: string): StateEvent => ({ state, at: Date.now(), note });
/* Phase 2 idempotency-key foundation — every money-mutating intent carries one */
const idemKey = () => `idem_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

function notify(kind: Noti["kind"], title: string, body: string) {
  const userId = sessionUserId();
  if (!userId) return; // timer fired after sign-out — drop silently
  /* honour the notification preferences from Settings */
  const prefs = LS.get("bmoni.settings.v1", { notifyFunding: true, notifyTransfers: true, notifyKyc: true });
  const t = title.toLowerCase();
  if (prefs.notifyFunding === false && /fund/.test(t)) return;
  if (prefs.notifyTransfers === false && /transfer|revers/.test(t)) return;
  if (prefs.notifyKyc === false && /kyc|identity/.test(t)) return;
  db.notifications.unshift({ id: uid("NT"), userId, ts: Date.now(), title, body, kind, read: false });
}

function postEntry(e: Omit<LedgerEntry, "id" | "userId">) {
  db.ledger.push({ ...e, id: uid("LE"), userId: me().id });
}

function releaseReserve(refId: string) {
  const res = db.ledger.find((l) => l.refId === refId && l.type === "RESERVE" && l.status === "PENDING");
  if (res) {
    res.status = "RELEASED";
    postEntry({ ts: Date.now(), description: "Reservation released", counterparty: "BMONI Ledger", amountCents: -res.amountCents, type: "RELEASE", status: "POSTED", refKind: "TRANSFER", refId });
  }
}

function balancesFor(userId: string) {
  let posted = 0, reserved = 0, incoming = 0;
  for (const l of db.ledger) {
    if (l.userId !== userId) continue;
    if (l.status === "POSTED") posted += l.amountCents;
    else if (l.type === "RESERVE" && l.status === "PENDING") reserved += -l.amountCents;
  }
  for (const f of db.funding) if (f.userId === userId && f.status === "PROCESSING") incoming += f.amountCents;
  return { availableCents: posted - reserved, pendingCents: reserved + incoming };
}

const FEES: Record<FundingMethod, (a: number) => number> = {
  CARD: (a) => Math.max(50, Math.round(a * 0.015)),
  BANK_TRANSFER: () => 0,
  OPEN_BANKING: () => 0,
};
export function quoteTransferFee(kind: TransferKind, amountCents: number) {
  if (kind === "SEND") return Math.max(25, Math.round(amountCents * 0.005));
  if (kind === "WITHDRAW") return 100;
  return 0;
}

/* Phase 8 "apply fees & limits" — daily outflow limit, enforced in createTransfer */
export const DAILY_LIMIT_CENTS = 2_500_000; // $25,000 per calendar day
export function getDailyOutflowCents(): number {
  const id = sessionUserId();
  if (!id) return 0;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  return db.transfers
    .filter((x) => x.userId === id && x.createdAt >= dayStart.getTime() && x.status !== "FAILED" && x.status !== "CANCELLED")
    .reduce((s, x) => s + x.amountCents + x.feeCents, 0);
}

/* settlement engines (reused by reconcile after reload) */
function settleKyc(k: KycProfile, outcome: "APPROVE" | "REJECT" | "RETRY" | "AUTO") {
  after(2600, () => {
    const email = db.users.find((u) => u.id === k.userId)?.email ?? "";
    const decided =
      outcome === "REJECT" || email.includes("reject") ? "REJECTED"
      : outcome === "RETRY" || email.includes("retry") ? "RETRY_REQUIRED"
      : "VERIFIED";
    k.status = decided as KycProfile["status"];
    if (decided === "REJECTED") { k.reason = "Document check failed — image quality below provider threshold."; k.events.push(ev("REJECTED", k.reason)); }
    else if (decided === "RETRY_REQUIRED") { k.reason = "Address could not be matched against issuer records."; k.events.push(ev("RETRY_REQUIRED", k.reason)); }
    else { k.reason = undefined; k.events.push(ev("VERIFIED")); }
    if (k.userId === sessionUserId()) {
      notify(
        decided === "VERIFIED" ? "success" : "warning",
        decided === "VERIFIED" ? "Identity verified" : decided === "REJECTED" ? "KYC rejected" : "KYC needs another look",
        k.reason ?? "Your identity was verified by the provider sandbox. Funding and transfers are now unlocked.",
      );
    }
  });
}

function settleFunding(f: FundingIntent) {
  after(90_000, () => { if (f.status === "REQUIRES_ACTION") { f.status = "EXPIRED"; f.events.push(ev("EXPIRED", "Instructions were not completed in time.")); } });
  after(3400, () => {
    if (f.status !== "PROCESSING") return;
    if (f.amountCents % 100 === 13) {
      f.status = "FAILED";
      f.failReason = "Card issuer declined the charge (issuer code: insufficient_funds).";
      f.events.push(ev("FAILED", f.failReason));
      if (f.userId === sessionUserId()) notify("error", "Funding failed", `${f.providerRef} — ${f.failReason}`);
    } else {
      f.status = "SUCCEEDED";
      f.events.push(ev("SUCCEEDED", "Webhook signature verified · ledger posted"));
      postEntry({ ts: Date.now(), description: methodLabel(f.method), counterparty: methodSource(f.method), amountCents: f.amountCents, type: "CREDIT", status: "POSTED", refKind: "FUNDING", refId: f.id });
      if (f.feeCents > 0) postEntry({ ts: Date.now(), description: "Funding fee — card processing", counterparty: "BMONI", amountCents: -f.feeCents, type: "FEE", status: "POSTED", refKind: "FUNDING", refId: f.id });
      if (f.userId === sessionUserId()) notify("success", "Wallet funded", `${(f.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} settled to your available balance.`);
    }
  });
}

function settleTransfer(t: Transfer) {
  const ms = t.kind === "INTERNAL" ? 1100 : 3200;
  after(ms, () => {
    if (t.status !== "PROCESSING") return;
    const total = t.amountCents + t.feeCents;
    const fail = t.amountCents % 100 === 13 || (t.kind === "INTERNAL" && t.destination.includes("@fail"));
    const reverse = t.amountCents % 100 === 77;
    if (fail) {
      t.status = "FAILED";
      t.failReason = t.kind === "INTERNAL" ? "Recipient account not found on BMONI." : "Receiving institution rejected the transfer.";
      t.events.push(ev("FAILED", t.failReason));
      releaseReserve(t.id);
      if (t.userId === sessionUserId()) notify("error", "Transfer failed", `${t.providerRef} — ${t.failReason} Reserved funds were released.`);
    } else if (reverse) {
      t.status = "REVERSED";
      t.failReason = "Provider recalled the funds after settlement (sandbox reversal).";
      t.events.push(ev("REVERSED", t.failReason));
      releaseReserve(t.id);
      if (t.userId === sessionUserId()) notify("warning", "Transfer reversed", `${t.providerRef} — the full amount was returned to your balance.`);
    } else {
      t.status = "COMPLETED";
      t.events.push(ev("COMPLETED", "Webhook signature verified · ledger posted"));
      releaseReserve(t.id);
      postEntry({ ts: Date.now(), description: t.kind === "INTERNAL" ? "Internal transfer" : t.kind === "WITHDRAW" ? `Withdrawal to ${t.destination}` : `Payment — ${t.note || "transfer"}`, counterparty: t.destination, amountCents: -t.amountCents, type: "DEBIT", status: "POSTED", refKind: "TRANSFER", refId: t.id });
      if (t.feeCents > 0) postEntry({ ts: Date.now(), description: "Transfer fee", counterparty: "BMONI", amountCents: -t.feeCents, type: "FEE", status: "POSTED", refKind: "TRANSFER", refId: t.id });
      if (t.userId === sessionUserId()) notify("success", "Transfer completed", `${t.providerRef} settled to ${t.destination}.`);
    }
  });
}

function reconcile() {
  for (const k of db.kyc) if (k.status === "PENDING") settleKyc(k, "AUTO");
  for (const r of db.rails) if (r.status === "VALIDATING") after(1800, () => { r.status = "ACTIVE"; r.events.push(ev("ACTIVE", "Re-verified after reload")); });
  for (const b of db.beneficiaries) if (b.status === "PENDING") after(1800, () => { b.status = "VERIFIED"; b.events.push(ev("VERIFIED", "Re-verified after reload")); });
  for (const f of db.funding) {
    if (f.status === "REQUIRES_ACTION") settleFunding(f);
    if (f.status === "PROCESSING") after(2400, () => settleFunding(f));
  }
  for (const t of db.transfers) if (t.status === "PROCESSING" || t.status === "CREATED" || t.status === "PENDING") after(2400, () => { t.status = "PROCESSING"; settleTransfer(t); });
}

/* ------------------------------------------------------------------ */
/* labels                                                              */
/* ------------------------------------------------------------------ */
export const methodLabel = (m: FundingMethod) =>
  m === "CARD" ? "Card funding" : m === "BANK_TRANSFER" ? "Bank transfer funding" : "Open banking funding";
export const methodSource = (m: FundingMethod) =>
  m === "CARD" ? "Visa •• 4412" : m === "BANK_TRANSFER" ? "Wire — Meridian Bank" : "Open banking — Teller API";
export const kindLabel = (k: TransferKind) =>
  k === "SEND" ? "Payment" : k === "WITHDRAW" ? "Withdrawal" : "Internal transfer";

/* ------------------------------------------------------------------ */
/* transactions projection                                             */
/* ------------------------------------------------------------------ */
function buildTransactions(userId: string): Transaction[] {
  const entriesByRef = new Map<string, LedgerEntry[]>();
  for (const l of db.ledger) {
    if (l.userId !== userId) continue;
    entriesByRef.set(l.refId, [...(entriesByRef.get(l.refId) ?? []), l]);
  }
  const txs: Transaction[] = [];
  const covered = new Set<string>();

  for (const f of db.funding.filter((x) => x.userId === userId)) {
    covered.add(f.id);
    txs.push({
      id: f.id, ts: f.createdAt, title: methodLabel(f.method), counterparty: methodSource(f.method),
      amountCents: f.amountCents, feeCents: f.feeCents, status: f.status, kind: "FUNDING",
      subKind: f.method, providerRef: f.providerRef, events: f.events,
      entries: entriesByRef.get(f.id) ?? [],
    });
  }
  for (const t of db.transfers.filter((x) => x.userId === userId)) {
    covered.add(t.id);
    txs.push({
      id: t.id, ts: t.createdAt,
      title: t.kind === "SEND" ? `Payment — ${t.note || t.destination}` : t.kind === "WITHDRAW" ? `Withdrawal to ${t.destination}` : `Internal transfer to ${t.destination}`,
      counterparty: t.destination, amountCents: -t.amountCents, feeCents: t.feeCents,
      status: t.status, kind: "TRANSFER", subKind: t.kind, providerRef: t.providerRef,
      events: t.events, entries: entriesByRef.get(t.id) ?? [],
    });
  }
  for (const [refId, entries] of entriesByRef) {
    if (covered.has(refId)) continue;
    const gross = entries.filter((e) => e.type !== "FEE").reduce((s, e) => s + e.amountCents, 0);
    const fee = -entries.filter((e) => e.type === "FEE").reduce((s, e) => s + e.amountCents, 0);
    const head = entries[0];
    txs.push({
      id: refId, ts: head.ts, title: head.description,
      counterparty: gross >= 0 ? head.counterparty : entries.find((e) => e.type !== "FEE")?.counterparty ?? head.counterparty,
      amountCents: gross, feeCents: fee, status: "COMPLETED", kind: "TRANSFER", subKind: "SEND",
      providerRef: refId, events: [{ state: "COMPLETED", at: head.ts }], entries,
    });
  }
  return txs.sort((a, b) => b.ts - a.ts);
}

/* ------------------------------------------------------------------ */
/* snapshot + subscribe                                                */
/* ------------------------------------------------------------------ */
function snapshot(): Snapshot {
  const uid_ = sessionUserId();
  const user = db.users.find((u) => u.id === uid_) ?? null;
  if (!user) {
    return { user: null, wallet: null, kyc: null, rails: [], beneficiaries: [], funding: [], transfers: [], transactions: [], notifications: [], devices: [] };
  }
  const bal = balancesFor(user.id);
  return {
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, status: user.status, createdAt: user.createdAt },
    wallet: { id: `W_${user.id.slice(2)}`, currency: "USD", status: "ACTIVE", ...bal, createdAt: user.createdAt },
    kyc: db.kyc.find((k) => k.userId === user.id) ?? null,
    rails: forMe(db.rails).sort((a, b) => b.addedAt - a.addedAt),
    beneficiaries: forMe(db.beneficiaries).sort((a, b) => b.createdAt - a.createdAt),
    funding: forMe(db.funding).sort((a, b) => b.createdAt - a.createdAt),
    transfers: forMe(db.transfers).sort((a, b) => b.createdAt - a.createdAt),
    transactions: buildTransactions(user.id),
    notifications: forMe(db.notifications).sort((a, b) => b.ts - a.ts),
    devices: db.devices,
  };
}

/* ------------------------------------------------------------------ */
/* public API — every route mirrors a /api/v1 endpoint                 */
/* ------------------------------------------------------------------ */
export const api = {
  subscribe(fn: () => void) { listeners.push(fn); return () => { listeners = listeners.filter((l) => l !== fn); }; },
  getSnapshot(): Snapshot { return snapshot(); },

  async init() {
    await sleep(500);
    reconcile();
    save(); emit();
  },

  /* --- auth: POST /api/v1/auth/{login,signup,logout,password-reset} --- */
  async login(email: string, password: string) {
    await sleep(750);
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) throw new ApiError("Invalid email or password. Try the demo credentials below.");
    LS.set(SESSION_KEY, u.id);
    emit();
  },
  async signup(name: string, email: string, password: string) {
    await sleep(900);
    const fields: Record<string, string> = {};
    if (name.trim().length < 2) fields.name = "Enter your full legal name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Enter a valid email address.";
    if (password.length < 8) fields.password = "Password must be at least 8 characters.";
    if (db.users.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) fields.email = "An account already exists for this email.";
    if (Object.keys(fields).length) throw new ApiError("Check the highlighted fields.", fields);
    const u: UserRecord = {
      id: uid("U"), name: name.trim(), email: email.trim().toLowerCase(), password,
      phone: "", status: "ACTIVE", createdAt: Date.now(),
    };
    db.users.push(u);
    db.kyc.push({ userId: u.id, status: "NOT_STARTED", attempts: 0, events: [] });
    db.notifications.unshift({ id: uid("NT"), userId: u.id, ts: Date.now(), title: "Welcome to BMONI Embedded", body: "Your wallet is live on the sandbox ledger. Verify your identity to unlock funding and transfers.", kind: "info", read: false });
    LS.set(SESSION_KEY, u.id);
    save(); emit();
  },
  async logout() { await sleep(300); LS.del(SESSION_KEY); emit(); },
  async requestReset(email: string) {
    await sleep(800);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError("Enter a valid email address.", { email: "Enter a valid email address." });
    db.resetCodes[email.trim().toLowerCase()] = "246810";
    save();
  },
  async confirmReset(email: string, code: string, newPassword: string) {
    await sleep(700);
    const key = email.trim().toLowerCase();
    if (db.resetCodes[key] !== code.trim()) throw new ApiError("That code doesn't match.", { code: "Code mismatch — sandbox code is 246810." });
    if (newPassword.length < 8) throw new ApiError("Password too short.", { password: "Use at least 8 characters." });
    const u = db.users.find((x) => x.email.toLowerCase() === key);
    if (!u) throw new ApiError("No account found for that email.", { email: "No account found." });
    u.password = newPassword;
    delete db.resetCodes[key];
    save();
  },

  /* --- users: PATCH /api/v1/users/me --- */
  async updateProfile(name: string, phone: string) {
    await sleep(650);
    const fields: Record<string, string> = {};
    if (name.trim().length < 2) fields.name = "Name is required.";
    if (phone.trim() && !/^[+\d][\d\s\-()]{6,}$/.test(phone.trim())) fields.phone = "Enter a valid phone number.";
    if (Object.keys(fields).length) throw new ApiError("Check the highlighted fields.", fields);
    const u = me();
    u.name = name.trim(); u.phone = phone.trim();
    save(); emit();
  },

  /* --- devices --- */
  async revokeDevice(id: string) {
    await sleep(550);
    db.devices = db.devices.filter((d) => d.id !== id || d.current);
    notify("info", "Session revoked", "A device session was signed out of your account.");
    save(); emit();
  },

  /* --- notifications --- */
  markAllRead() {
    const id = sessionUserId();
    db.notifications.forEach((n) => { if (n.userId === id) n.read = true; });
    save(); emit();
  },

  /* --- kyc: POST /api/v1/kyc/submit --- */
  async submitKyc(payload: {
    personalInfo: NonNullable<KycProfile["personalInfo"]>;
    documentType: NonNullable<KycProfile["documentType"]>;
    outcome: "APPROVE" | "REJECT" | "RETRY";
  }) {
    await sleep(800);
    const p = payload.personalInfo;
    const fields: Record<string, string> = {};
    if (p.legalName.trim().split(/\s+/).length < 2) fields.legalName = "Enter first and last name.";
    const dob = new Date(p.dob);
    if (!p.dob || Number.isNaN(dob.getTime())) fields.dob = "Enter your date of birth.";
    else if (Date.now() - dob.getTime() < 18 * 365 * D) fields.dob = "You must be at least 18.";
    if (!p.addressLine1.trim()) fields.addressLine1 = "Required.";
    if (!p.city.trim()) fields.city = "Required.";
    if (!p.postalCode.trim()) fields.postalCode = "Required.";
    if (!p.country.trim()) fields.country = "Required.";
    if (p.idNumber.replace(/\s/g, "").length < 6) fields.idNumber = "Enter a valid ID number (6+ chars).";
    if (Object.keys(fields).length) throw new ApiError("Check the highlighted fields.", fields);

    const u = me();
    let k = db.kyc.find((x) => x.userId === u.id)!;
    if (!k) { k = { userId: u.id, status: "NOT_STARTED", attempts: 0, events: [] }; db.kyc.push(k); }
    k.personalInfo = { ...p, legalName: p.legalName.trim() };
    k.documentType = payload.documentType;
    k.attempts += 1;
    k.status = "IN_PROGRESS";
    k.events.push(ev("IN_PROGRESS", `Attempt ${k.attempts} — documents uploaded to provider sandbox`));
    k.status = "PENDING";
    k.events.push(ev("PENDING", "Awaiting provider decision"));
    save(); emit();
    settleKyc(k, payload.outcome);
  },

  /* --- rails: POST /api/v1/rails/accounts --- */
  async addRail(rail: RailType, institution: string, accountNumber: string) {
    await sleep(700);
    const acct = accountNumber.replace(/\s/g, "");
    const fields: Record<string, string> = {};
    if (institution.trim().length < 2) fields.institution = "Enter the institution name.";
    const minLen = rail === "SEPA" ? 15 : rail === "FPS" ? 8 : rail === "WIRE" ? 9 : 8;
    if (acct.length < minLen) fields.accountNumber = `${rail} account numbers need at least ${minLen} characters.`;
    if (Object.keys(fields).length) throw new ApiError("Check the highlighted fields.", fields);
    const u = me();
    const r: RailAccount = {
      id: uid("RA"), userId: u.id, rail, institution: institution.trim(),
      accountMasked: maskAccount(acct), status: "VALIDATING", addedAt: Date.now(),
      events: [ev("VALIDATING", `Micro-check sent over the ${rail} rail`)],
    };
    db.rails.push(r);
    save(); emit();
    after(2300, () => {
      if (r.status !== "VALIDATING") return;
      if (acct.endsWith("0000")) {
        r.status = "FAILED";
        r.failReason = "Account could not be confirmed with the institution (sandbox: numbers ending 0000 always fail).";
        r.events.push(ev("FAILED", r.failReason));
      } else {
        r.status = "ACTIVE";
        r.events.push(ev("ACTIVE", "Account ownership confirmed"));
        notify("success", "Rail linked", `${institution} ${r.accountMasked} is active on the ${rail} rail.`);
      }
    });
  },
  async deactivateRail(id: string) {
    await sleep(500);
    const r = forMe(db.rails).find((x) => x.id === id);
    if (r) { r.status = "DEACTIVATED"; r.events.push(ev("DEACTIVATED")); }
    save(); emit();
  },
  async reactivateRail(id: string) {
    const r = forMe(db.rails).find((x) => x.id === id);
    if (!r) return;
    r.status = "VALIDATING";
    r.events.push(ev("VALIDATING", "Re-validation requested"));
    save(); emit();
    after(1800, () => { r.status = "ACTIVE"; r.events.push(ev("ACTIVE", "Re-validated")); notify("success", "Rail re-activated", `${r.institution} ${r.accountMasked} is active again.`); });
  },
  async removeRail(id: string) {
    await sleep(450);
    db.rails = db.rails.filter((x) => !(x.id === id && x.userId === me().id));
    save(); emit();
  },

  /* --- beneficiaries: POST /api/v1/rails/beneficiaries --- */
  async addBeneficiary(name: string, rail: RailType, institution: string, accountNumber: string) {
    await sleep(700);
    const fields: Record<string, string> = {};
    if (name.trim().length < 2) fields.name = "Enter the beneficiary's name.";
    if (institution.trim().length < 2) fields.institution = "Enter the institution.";
    if (accountNumber.replace(/\s/g, "").length < 8) fields.accountNumber = "Account number looks too short.";
    if (!forMe(db.rails).some((r) => r.rail === rail && r.status === "ACTIVE"))
      fields.rail = `Link an active ${rail} account first.`;
    if (Object.keys(fields).length) throw new ApiError("Check the highlighted fields.", fields);
    const b: Beneficiary = {
      id: uid("BN"), userId: me().id, name: name.trim(), rail,
      institution: institution.trim(), accountMasked: maskAccount(accountNumber),
      status: "PENDING", createdAt: Date.now(),
      events: [ev("PENDING", `Verification request sent over ${rail}`)],
    };
    db.beneficiaries.push(b);
    save(); emit();
    after(2400, () => {
      if (b.status !== "PENDING") return;
      if (b.name.toLowerCase().includes("reject")) {
        b.status = "REJECTED";
        b.failReason = "Receiving institution rejected this account (sandbox: names containing “reject” fail).";
        b.events.push(ev("REJECTED", b.failReason));
      } else {
        b.status = "VERIFIED";
        b.events.push(ev("VERIFIED", "Account ownership confirmed"));
        notify("success", "Beneficiary verified", `${b.name} can now receive payments.`);
      }
    });
  },
  async retryBeneficiary(id: string, newName: string) {
    const b = forMe(db.beneficiaries).find((x) => x.id === id);
    if (!b) return;
    b.name = newName.trim();
    b.status = "PENDING";
    b.failReason = undefined;
    b.events.push(ev("PENDING", "Resubmitted for verification"));
    save(); emit();
    after(2200, () => {
      if (b.status !== "PENDING") return;
      if (b.name.toLowerCase().includes("reject")) {
        b.status = "REJECTED"; b.failReason = "Still rejected by the receiving institution."; b.events.push(ev("REJECTED", b.failReason));
      } else { b.status = "VERIFIED"; b.events.push(ev("VERIFIED")); notify("success", "Beneficiary verified", `${b.name} can now receive payments.`); }
    });
  },
  async deactivateBeneficiary(id: string) {
    await sleep(450);
    const b = forMe(db.beneficiaries).find((x) => x.id === id);
    if (b) { b.status = "DEACTIVATED"; b.events.push(ev("DEACTIVATED")); }
    save(); emit();
  },
  async removeBeneficiary(id: string) {
    await sleep(450);
    db.beneficiaries = db.beneficiaries.filter((x) => !(x.id === id && x.userId === me().id));
    save(); emit();
  },

  /* --- funding: POST /api/v1/funding/intents --- */
  quoteFundingFee(method: FundingMethod, amountCents: number) { return FEES[method](amountCents); },

  async createFunding(method: FundingMethod, amountCents: number) {
    await sleep(650);
    const u = me();
    const k = db.kyc.find((x) => x.userId === u.id);
    if (k?.status !== "VERIFIED") throw new ApiError("KYC gate: identity must be verified before funding.");
    if (!Number.isFinite(amountCents) || amountCents < 100)
      throw new ApiError("Amount too small.", { amount: "Minimum funding amount is $1.00." });
    if (amountCents > 1_000_000)
      throw new ApiError("Amount too large.", { amount: "Maximum per funding intent is $10,000." });
    const f: FundingIntent = {
      id: uid("FD"), userId: u.id, method, amountCents, feeCents: FEES[method](amountCents),
      status: "REQUIRES_ACTION", providerRef: `pv_${uid("rf")}`,
      idempotencyKey: idemKey(),
      referenceCode: method === "BANK_TRANSFER" ? `BMONI-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : undefined,
      createdAt: Date.now(),
      events: [ev("CREATED", "Idempotency-Key accepted"), ev("REQUIRES_ACTION", "Awaiting your payment")],
    };
    db.funding.push(f);
    save(); emit();
    settleFunding(f);
    return f.id;
  },
  async confirmFundingPayment(id: string) {
    await sleep(900);
    const f = forMe(db.funding).find((x) => x.id === id);
    if (!f || f.status !== "REQUIRES_ACTION") throw new ApiError("This funding intent can no longer be confirmed.");
    f.status = "PROCESSING";
    f.events.push(ev("PROCESSING", "Payment captured — awaiting provider webhook"));
    save(); emit();
  },
  async cancelFunding(id: string) {
    await sleep(500);
    const f = forMe(db.funding).find((x) => x.id === id);
    if (!f || (f.status !== "REQUIRES_ACTION" && f.status !== "PROCESSING"))
      throw new ApiError("Only pending funding intents can be cancelled.");
    f.status = "CANCELLED";
    f.events.push(ev("CANCELLED", "Cancelled by user before settlement"));
    notify("info", "Funding cancelled", `${f.providerRef} was cancelled. No funds moved.`);
    save(); emit();
  },

  /* --- transfers: POST /api/v1/transfers | withdrawals | internal-transfers --- */
  async createTransfer(kind: TransferKind, amountCents: number, dest: { beneficiaryId?: string; railId?: string; email?: string }, note?: string, reuseKey?: string) {
    await sleep(750);
    const u = me();
    const k = db.kyc.find((x) => x.userId === u.id);
    if (k?.status !== "VERIFIED") throw new ApiError("KYC gate: identity must be verified before moving money.");
    const fee = quoteTransferFee(kind, amountCents);
    const total = amountCents + fee;
    const fields: Record<string, string> = {};
    if (!Number.isFinite(amountCents) || amountCents < 100) fields.amount = "Minimum transfer is $1.00.";
    let destination = "";
    if (kind === "SEND") {
      const b = forMe(db.beneficiaries).find((x) => x.id === dest.beneficiaryId);
      if (!b) fields.beneficiary = "Select a beneficiary.";
      else if (b.status !== "VERIFIED") fields.beneficiary = "Beneficiary must be verified first.";
      else destination = b.name;
    } else if (kind === "WITHDRAW") {
      const r = forMe(db.rails).find((x) => x.id === dest.railId);
      if (!r) fields.rail = "Select a linked account.";
      else if (r.status !== "ACTIVE") fields.rail = "Linked account must be active.";
      else destination = `${r.institution} ${r.accountMasked}`;
    } else {
      const email = (dest.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Enter the recipient's BMONI email.";
      else if (email === u.email) fields.email = "That's you — pick another account.";
      else destination = email;
    }
    const bal = balancesFor(u.id);
    if (!fields.amount && total > bal.availableCents)
      fields.amount = `Insufficient balance — you need ${(total / 100).toFixed(2)} but only have ${(bal.availableCents / 100).toFixed(2)} available.`;
    if (!fields.amount && getDailyOutflowCents() + total > DAILY_LIMIT_CENTS)
      fields.amount = `Daily outflow limit of $${(DAILY_LIMIT_CENTS / 100).toLocaleString("en-US")} reached — retry tomorrow or move a smaller amount.`;
    if (Object.keys(fields).length) throw new ApiError("Check the highlighted fields.", fields);

    const t: Transfer = {
      id: uid("TR"), userId: u.id, kind, amountCents, feeCents: fee, destination,
      note: note?.trim() || undefined, status: "PROCESSING", providerRef: `pv_${uid("rf")}`,
      idempotencyKey: reuseKey ?? idemKey(),
      createdAt: Date.now(),
      events: [
        ev("CREATED", reuseKey ? `Idempotency-Key replayed (${reuseKey.slice(0, 14)}…) — safe retry, no double-post` : "Idempotency-Key accepted"),
        ev("PROCESSING", `${(total / 100).toFixed(2)} USD reserved on ledger`),
      ],
    };
    postEntry({ ts: Date.now(), description: `Reservation — ${kindLabel(kind).toLowerCase()} to ${destination}`, counterparty: destination, amountCents: -total, type: "RESERVE", status: "PENDING", refKind: "TRANSFER", refId: t.id });
    db.transfers.push(t);
    save(); emit();
    settleTransfer(t);
    return t.id;
  },
  async cancelTransfer(id: string) {
    await sleep(500);
    const t = forMe(db.transfers).find((x) => x.id === id);
    if (!t || t.status !== "PROCESSING") throw new ApiError("Only processing transfers can be cancelled.");
    t.status = "CANCELLED";
    t.events.push(ev("CANCELLED", "Cancelled before settlement — reservation released"));
    releaseReserve(t.id);
    notify("info", "Transfer cancelled", `${t.providerRef} was cancelled. Reserved funds were released.`);
    save(); emit();
  },
};

export const SANDBOX_HINTS = [
  { trigger: "Amount ending in .13", result: "Provider declines → FAILED" },
  { trigger: "Amount ending in .77", result: "Settles, then REVERSED (refunded)" },
  { trigger: "Account number ending 0000", result: "Rail validation fails" },
  { trigger: "Beneficiary name containing “reject”", result: "Beneficiary rejected" },
  { trigger: "Sandbox outcome switch on KYC", result: "Force Approve / Reject / Retry" },
  { trigger: "Leave funding instructions 90s", result: "Intent EXPIRED" },
];
