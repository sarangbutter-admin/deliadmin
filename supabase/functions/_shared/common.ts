// Shared helpers for the Biteship Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2";

export const BITESHIP = "https://api.biteship.com";
// couriers that quote by coordinates (instant / same-day); the others quote by postal code
export const INSTANT = ["gojek", "grab", "lalamove", "borzo", "deliveree"];

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

export async function kv(db: ReturnType<typeof admin>, key: string): Promise<any> {
  const { data } = await db.from("private_kv").select("data").eq("key", key).maybeSingle();
  return data ? data.data : null;
}

export async function settings(db: ReturnType<typeof admin>): Promise<any> {
  const { data } = await db.from("docs").select("data").eq("key", "settings").maybeSingle();
  return data ? data.data : {};
}

// calls Biteship; returns {ok, status, body}
export async function bs(key: string, method: string, path: string, body?: unknown) {
  const r = await fetch(BITESHIP + path, {
    method,
    headers: { "authorization": key, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  let j: any = null;
  try { j = txt ? JSON.parse(txt) : null; } catch { j = { raw: txt.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, body: j };
}
export const bsErr = (r: { status: number; body: any }) =>
  String((r.body && (r.body.error || r.body.message)) || ("Biteship error " + r.status)).slice(0, 200);

export async function hmacHex(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// is the caller a signed-in team member (owner or staff)?
export async function teamRole(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") || "";
  const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data, error } = await c.rpc("biteship_who");
  if (error || !data) return null;
  return String(data);
}

// tiny per-instance rate limit (best effort)
const hits = new Map<string, number[]>();
export function limited(ip: string, max: number, ms: number): boolean {
  const now = Date.now(), a = (hits.get(ip) || []).filter((t) => now - t < ms);
  a.push(now); hits.set(ip, a);
  if (hits.size > 5000) hits.clear();
  return a.length > max;
}
export const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "x";

// map Biteship status codes to words the owner and customer understand
export const STATUS_TXT: Record<string, string> = {
  confirmed: "Courier booked", scheduled: "Pickup scheduled", allocated: "Courier assigned", picking_up: "Courier on the way to pick up",
  picked: "Picked up", dropping_off: "On the way to you", return_in_transit: "Returning", on_hold: "On hold", delivered: "Delivered",
  rejected: "Rejected", disposed: "Disposed", courier_not_found: "No courier found", returned: "Returned", cancelled: "Booking cancelled",
};
