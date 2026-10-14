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

/* ---------------- courier updates (shared by the shop function and the webhook) ---------------- */
const cl = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const nm = (v: unknown, d = 0) => (Number.isFinite(+(v as number)) ? +(v as number) : d);
export const FAILED = ["courier_not_found", "rejected", "cancelled", "returned", "disposed"];

// photo links anywhere in a Biteship answer whose key looks like a proof (pickup / delivery photo, signature); driver photos are not proofs
export function findProofs(x: any, out: string[] = [], depth = 0, keyHit = false): string[] {
  if (!x || depth > 6 || out.length > 8) return out;
  if (typeof x === "string") { if (keyHit && /^https:\/\//i.test(x)) out.push(x.slice(0, 500)); return out; }
  if (Array.isArray(x)) { x.forEach((v) => findProofs(v, out, depth + 1, keyHit)); return out; }
  if (typeof x === "object") for (const [k, v] of Object.entries(x)) {
    if (/driver|avatar|logo/i.test(k)) continue;
    findProofs(v, out, depth + 1, keyHit || /proof|pod|photo|image|signature|evidence/i.test(k));
  }
  return [...new Set(out)];
}
export function driverOf(b: any) {
  const c = (b && b.courier) || {};
  const d = {
    name: cl(b.courier_driver_name || c.driver_name || c.name, 60), phone: cl(b.courier_driver_phone || c.driver_phone || c.phone, 30),
    plate: cl(b.courier_driver_plate_number || c.driver_plate_number, 20), photo: cl(b.courier_driver_photo_url || c.driver_photo_url, 400),
  };
  return d.name || d.phone || d.plate ? d : null;
}
const CUST_TXT: Record<string, (sh: any) => string> = {
  allocated: (sh) => `Driver found${sh.driver && sh.driver.name ? ": " + sh.driver.name : ""} (${sh.courierName || sh.courier}). They're coming to pick up your cookies.`,
  picking_up: () => "Your courier is on the way to pick up your order.",
  picked: () => "Your cookies were picked up by the courier.",
  dropping_off: () => "Your order is on the way to you!",
  delivered: () => "Your order was delivered. Enjoy your cookies!",
  courier_not_found: () => "No courier was free yet. We're arranging another one for you.",
  rejected: () => "The courier couldn't take your order. We're arranging another one for you.",
  cancelled: () => "The courier cancelled. We're arranging another one for you.",
  returned: () => "Your order is being returned to the shop. We'll contact you.",
};

// merges a courier update into the order: courier details, proofs, main order status (forward only), a customer message
export async function applyUpdate(db: any, row: { id: string; data: any }, up: { status?: string; waybill?: string; link?: string; trackingId?: string; price?: number; driver?: any; proofs?: string[] }, fromCourier: boolean) {
  const o: any = row.data, sh: any = { ...(o.bship || {}) }, now = Date.now(), prevSt = sh.status;
  const s = up.status ? cl(up.status, 30).toLowerCase() : "";
  if (s && s !== prevSt) { sh.status = s; sh.statusAt = now; sh.history = [...(sh.history || []), { s, at: now }].slice(-25); }
  if (up.waybill) sh.waybill = cl(up.waybill, 60);
  if (up.link) sh.link = cl(up.link, 300);
  if (up.trackingId) sh.trackingId = cl(up.trackingId, 60);
  if (up.price !== undefined && Number.isFinite(+up.price) && +up.price > 0) sh.bookedPrice = +up.price;
  if (up.driver) sh.driver = up.driver;
  if (up.proofs && up.proofs.length) {
    const kind = s === "delivered" || sh.status === "delivered" ? "delivery" : "pickup";
    sh.proofs = { ...(sh.proofs || {}) };
    sh.proofs[kind] = [...new Set([...(sh.proofs[kind] || []), ...up.proofs])].slice(0, 6);
  }
  const next: any = { ...o, bship: sh };
  if (sh.waybill) next.awb = String(sh.waybill).slice(0, 40);
  // main order status follows the courier, forward only (the owner can still change it by hand)
  if (s === "picked" || s === "dropping_off") { if (["new", "baking"].includes(o.status)) next.status = "ready"; }
  if (s === "delivered") { if (["new", "baking", "ready"].includes(o.status)) { next.status = "completed"; if (!next.completedAt) next.completedAt = now; } }
  // a failed booking can be booked again
  if (fromCourier && FAILED.includes(s) && sh.biteshipId) {
    sh.prevIds = [...(sh.prevIds || []), sh.biteshipId].slice(-10); sh.biteshipId = ""; sh.failed = true; sh.failAt = now;
  }
  // tell the customer (shows in their bell and order page)
  if (s && s !== prevSt && CUST_TXT[s]) {
    const ch = o.notify === "email" ? "email" : "whatsapp";
    next.msgs = [...(o.msgs || []), { at: now, channel: ch, status: next.status, text: CUST_TXT[s](sh), by: "system", courier: true }].slice(-80);
  }
  await db.from("orders").update({ data: next, updated_at: now }).eq("id", row.id);
  return next;
}

// weight (grams) and size (cm) of a box
export function boxOf(cfg: any, size: number) {
  const w = cfg.weights && nm(cfg.weights[String(size)]) > 0 ? nm(cfg.weights[String(size)]) : size * nm(cfg.gramsPerCookie, 100) + nm(cfg.boxGrams, 200);
  const d = cfg.dims || {};
  return { weight: Math.max(100, Math.round(w)), length: nm(d.l, 25), width: nm(d.w, 25), height: nm(d.h, 10) };
}

// private link to the customer's place photo (served by the webhook function, works until the photo is deleted)
export async function placeLink(db: any, id: string) {
  const sec = (await kv(db, "quote_secret"))?.v as string;
  if (!sec) return "";
  return Deno.env.get("SUPABASE_URL") + "/functions/v1/biteship-webhook?ph=" + encodeURIComponent(id) + "&s=" + (await hmacHex(sec, "place|" + id)).slice(0, 32);
}
// what the driver reads: the customer's note for the driver, the order note, the order code and the place photo link
async function driverNote(db: any, o: any, id: string) {
  const pl = o.place || {}, parts: string[] = [];
  if (pl.note) parts.push(cl(pl.note, 200));
  if (o.note) parts.push(cl(o.note, 120));
  parts.push("Order " + o.code);
  if (pl.photo) { const l = await placeLink(db, id); if (l) parts.push("Photo of the place: " + l); }
  return parts.join(". ");
}
// books (or books again) the courier for a paid order; returns {bship} or {error}
export async function bookOrder(db: any, key: string, cfg: any, row: { id: string; data: any }) {
  const o: any = row.data, sh: any = o.bship;
  if (!sh || !sh.courier) return { error: "This order has no courier chosen." };
  if (sh.biteshipId) return { error: "A courier is already booked for this order." };
  if (!["new", "baking", "ready"].includes(o.status)) return { error: "Confirm the payment first. Couriers are booked for paid orders." };
  const org = cfg.origin || {};
  if (!org.name || !org.phone || !org.address) return { error: "Fill in your pickup details in Shop settings first." };
  const box = boxOf(cfg, nm(o.size)), c = o.customer || {};
  const payload: any = {
    shipper_contact_name: cl(org.name, 60), shipper_contact_phone: cl(org.phone, 20), shipper_organization: cl(org.business || org.name, 60),
    origin_contact_name: cl(org.name, 60), origin_contact_phone: cl(org.phone, 20), origin_address: cl(org.address, 250), origin_note: cl(org.note, 200),
    destination_contact_name: cl(c.name, 60), destination_contact_phone: cl(c.phone, 20), destination_contact_email: cl(c.email, 100),
    destination_address: cl(c.address, 250), destination_note: cl(await driverNote(db, o, row.id), 500),
    courier_company: sh.courier, courier_type: sh.service, delivery_type: "now",
    order_note: "Delidome order " + o.code + " (cookies, handle with care)", metadata: { orderCode: o.code },
    items: [{ name: "Cookie box of " + o.size, description: "Fragile baked goods", value: Math.round(nm(o.base)), quantity: 1, weight: box.weight, length: box.length, width: box.width, height: box.height }],
  };
  if (org.lat !== "" && org.lng !== "" && Number.isFinite(nm(org.lat, NaN)) && Number.isFinite(nm(org.lng, NaN))) payload.origin_coordinate = { latitude: nm(org.lat), longitude: nm(org.lng) };
  else if (org.postal) payload.origin_postal_code = Math.round(nm(org.postal));
  if (sh.lat && sh.lng) payload.destination_coordinate = { latitude: nm(sh.lat), longitude: nm(sh.lng) };
  if (sh.postal) payload.destination_postal_code = Math.round(nm(sh.postal));
  const r = await bs(key, "POST", "/v1/orders", payload);
  console.log("book", o.code, r.status, r.ok ? cl(r.body?.status, 30) : bsErr(r));
  if (!r.ok || !r.body) return { error: bsErr(r) };
  const b = r.body, cr = b.courier || {}, now = Date.now();
  const nsh = {
    ...sh, biteshipId: cl(b.id, 60), trackingId: cl(cr.tracking_id, 60), waybill: cl(cr.waybill_id, 60), link: cl(cr.link, 300),
    status: cl(b.status, 30) || "confirmed", statusAt: now, bookedAt: now, bookedPrice: nm(b.price, nm(sh.price)), failed: false,
    retries: sh.failed ? (sh.retries || 0) + 1 : (sh.retries || 0),
    history: [...(sh.history || []), { s: cl(b.status, 30) || "confirmed", at: now }].slice(-25),
  };
  const next: any = { ...o, bship: nsh, courier: cl((sh.courierName || sh.courier) + " " + (sh.serviceName || sh.service), 40), awb: cl(cr.waybill_id, 40) || o.awb || "" };
  await db.from("orders").update({ data: next, updated_at: now }).eq("id", row.id);
  return { bship: nsh, order: next };
}
