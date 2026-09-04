# BMONI Embedded — Supabase backend integration guide

The console now runs in two modes with identical UIs:

| Mode | When | Auth | Persistence |
|---|---|---|---|
| **Local sandbox** (default) | env vars unset | mock login (`demo@bmoni.app` / `bmoni-demo`) | `localStorage` |
| **Supabase** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set | Supabase Auth (email/password) | Supabase Postgres, RLS-scoped |

All state machines, ledger rules, fees, limits and settlement timers still run
exactly as before — only persistence and auth moved. Screens were not touched.

---

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) → **New project** (any region).
2. Wait for it to provision.

## 2. Run the migration

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/migrations/001_init.sql` → **Run**.

This creates every entity from the build plan's Phase 0 list — `profiles`,
`wallets`, `ledger_entries`, `kyc_profiles`, `rail_accounts`, `beneficiaries`,
`funding_intents`, `transfers`, `notifications`, plus the backend-owned
`provider_events` / `webhook_events` / `audit_logs` / `idempotency_keys` —
with **Row Level Security enabled on all of them**, owner-only policies,
`wallet_balances` and `transactions` as *views projected from the ledger*
(the README's source-of-truth rule), and a trigger that auto-provisions a
profile, wallet and KYC row on signup.

## 3. Configure auth

Dashboard → **Authentication → Providers → Email**:
- For a frictionless sandbox, turn **off** “Confirm email”.
- Leave it on for the real flow — the app tells users to confirm, then sign in.

## 4. Wire the frontend

```bash
cp .env.example .env.local
```

Fill in (Project Settings → API):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

Restart the dev server (Vite only reads env at boot):

```bash
npm run dev        # or npm run build && npm run preview
```

## 5. Verify

1. Open the app → **Create account** → sign up with any email.
2. Dashboard → **Table Editor** in Supabase: `profiles`, `wallets`,
   `kyc_profiles` rows exist for the new user.
3. In the app: verify KYC, fund the wallet, send a transfer.
4. Watch `ledger_entries`, `funding_intents`, `transfers` fill up — including
   `RESERVE` → `RELEASE` entries and the `idempotency_key` column.
5. Reload the page — the session restores from Supabase Auth and all rows load.

---

## What's Supabase-backed now

Auth (signup / login / logout / reset request), profiles, wallets, the ledger,
KYC, rails, beneficiaries, funding intents, transfers, notifications.

**Stays per-browser by design:** the device/session list (it describes *this*
device), display settings, sandbox reset codes.

## Security model (the plan's non-negotiable rule)

- The browser holds **only the anon key**. Every table has RLS policies
  `using (user_id = auth.uid())`, so a stolen anon key can never read or
  write another user's money rows.
- The **service role key** is not in this repo and must never be — it belongs
  in the Phase 2 FastAPI backend's `.env`, where it will own webhook handling
  and cross-user ledger operations.
- In Supabase mode the reset flow uses Supabase's emailed link (the sandbox's
  `246810` code screen explains this inline).

## Sandbox write model (and when it changes)

Settlement timers still run in the browser and flush each user's rows to
Postgres (debounced, per-user). That's correct for a single signed-in client —
which is all Phases 1–8 need. In Phase 2+, the FastAPI server takes over
settlement and webhooks with the service role, and this adapter becomes a thin
read layer; no screen changes.

## Going back

Delete `.env.local` (or blank the two vars) and restart — the local sandbox
returns, untouched.
