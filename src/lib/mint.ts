/**
 * mint.ts
 *
 * All participant/mint operations as plain async functions that call Supabase
 * directly from the browser. Replaces the TanStack Start server functions.
 *
 * NOTE: These use the anon/publishable key, so your Supabase RLS policies must
 * allow the required operations (or you can use a Supabase Edge Function for
 * any server-side logic that needs the service-role key).
 */

import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const codeSchema = z.string().regex(/^[A-Z0-9]{6,16}$/);

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Calculate rewards balance: $5 base + $0.2 per successful referral */
export function calculateBalance(referralCount: number): number {
  const BASE_REWARD = 5;
  const REWARD_PER_REFERRAL = 0.2;
  return BASE_REWARD + referralCount * REWARD_PER_REFERRAL;
}

/** Ensure a participant row exists for this visitor code. Optionally set referred_by. */
export async function ensureParticipant(opts: {
  code?: string;
  ref?: string;
}) {
  let code = opts.code;

  if (!code) {
    for (let i = 0; i < 5; i++) {
      const candidate = makeCode();
      const { data: existing } = await supabase
        .from("participants")
        .select("code")
        .eq("code", candidate)
        .maybeSingle();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not allocate referral code");
  }

  // Validate ref exists and isn't self
  let referredBy: string | null = null;
  if (opts.ref && opts.ref !== code) {
    const refParsed = codeSchema.safeParse(opts.ref);
    if (refParsed.success) {
      const { data: refRow } = await supabase
        .from("participants")
        .select("code")
        .eq("code", opts.ref)
        .maybeSingle();
      if (refRow) referredBy = refRow.code;
    }
  }

  const { data: existing } = await supabase
    .from("participants")
    .select("code, wallet, substack_opened, minted, referred_by")
    .eq("code", code)
    .maybeSingle();

  if (!existing) {
    const { data: inserted, error } = await supabase
      .from("participants")
      .insert({ code, referred_by: referredBy })
      .select("code, wallet, substack_opened, minted, referred_by")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  }

  // Backfill referred_by if missing
  if (!existing.referred_by && referredBy) {
    const { data: updated, error } = await supabase
      .from("participants")
      .update({ referred_by: referredBy })
      .eq("code", code)
      .select("code, wallet, substack_opened, minted, referred_by")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  }

  return existing;
}

/** Attach a wallet to a participant code. */
export async function linkWallet(opts: { code: string; wallet: string }) {
  const { error } = await supabase
    .from("participants")
    .update({ wallet: opts.wallet.toLowerCase() })
    .eq("code", opts.code);
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
  return { ok: true };
}

/** Mark Substack as opened for a participant. */
export async function markSubstackOpened(opts: { code: string }) {
  const { error } = await supabase
    .from("participants")
    .update({ substack_opened: true })
    .eq("code", opts.code);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Get current stats for a code: referral count + self state. */
export async function getStats(opts: { code: string }) {
  const [{ data: me }, { count }] = await Promise.all([
    supabase
      .from("participants")
      .select("code, wallet, substack_opened, minted, referred_by")
      .eq("code", opts.code)
      .maybeSingle(),
    supabase
      .from("participants")
      .select("code", { count: "exact", head: true })
      .eq("referred_by", opts.code)
      .eq("substack_opened", true),
  ]);
  return { me, referrals: count ?? 0 };
}

/** Mint Phase 1 — records the reservation. Swap in on-chain call later. */
export async function mintPhase1(opts: { code: string; wallet: string }) {
  const wallet = opts.wallet.toLowerCase();

  const { data: me } = await supabase
    .from("participants")
    .select("code, substack_opened, minted")
    .eq("code", opts.code)
    .maybeSingle();
  if (!me) throw new Error("Participant not found");
  if (me.minted) return { ok: true, alreadyMinted: true };
  if (!me.substack_opened) throw new Error("Read the Substack first");

  const { count } = await supabase
    .from("participants")
    .select("code", { count: "exact", head: true })
    .eq("referred_by", opts.code)
    .eq("substack_opened", true);
  if ((count ?? 0) < 2) throw new Error("Need 2 referrals to mint");

  const { error } = await supabase
    .from("participants")
    .update({ minted: true, minted_at: new Date().toISOString(), wallet })
    .eq("code", opts.code);
  if (error) throw new Error(error.message);

  return { ok: true, alreadyMinted: false };
}

export type DashboardRow = {
  code: string;
  wallet: string | null;
  substack_opened: boolean;
  minted: boolean;
  minted_at: string | null;
  referred_by: string | null;
  created_at: string;
  referrals: number;
};

/** Dashboard read — list of all participants with their referral counts. */
export async function listDashboard(): Promise<DashboardRow[]> {
  const { data: rows, error } = await supabase
    .from("participants")
    .select(
      "code, wallet, substack_opened, minted, minted_at, referred_by, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const credits = new Map<string, number>();
  for (const r of rows ?? []) {
    if (r.referred_by && r.substack_opened) {
      credits.set(r.referred_by, (credits.get(r.referred_by) ?? 0) + 1);
    }
  }
  return (rows ?? []).map((r) => ({
    ...r,
    referrals: credits.get(r.code) ?? 0,
  }));
}
