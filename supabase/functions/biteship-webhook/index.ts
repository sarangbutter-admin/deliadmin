// Biteship -> shop: courier status updates.
// Deploy without JWT:  supabase functions deploy biteship-webhook --no-verify-jwt
// In the Biteship dashboard set the webhook URL to
//   https://<project>.supabase.co/functions/v1/biteship-webhook?k=<webhook secret shown in Shop settings>
import { admin, json, kv } from "../_shared/common.ts";

const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = admin();
  const secret = (await kv(db, "webhook_secret"))?.v as string;
  if (!secret || url.searchParams.get("k") !== secret) return json({ error: "Not allowed" }, 401);
  if (req.method !== "POST") return json({ ok: true });
  let b: any = {};
  try { b = await req.json(); } catch { return json({ ok: true }); }   // Biteship's "test" ping can be empty
  const bid = clean(b.order_id, 60);
  if (!bid) return json({ ok: true });
  const { data: row } = await db.from("orders").select("id,data").eq("data->bship->>biteshipId", bid).maybeSingle();
  if (!row) return json({ ok: true });
  const o: any = row.data, sh = o.bship || {};
  const patch: any = {};
  if (b.status) { patch.status = clean(b.status, 30); patch.statusAt = Date.now(); patch.history = [...(sh.history || []), { s: patch.status, at: Date.now() }].slice(-20); }
  if (b.courier_waybill_id) patch.waybill = clean(b.courier_waybill_id, 60);
  if (b.courier_link) patch.link = clean(b.courier_link, 300);
  if (b.courier_tracking_id) patch.trackingId = clean(b.courier_tracking_id, 60);
  if (b.price !== undefined && Number.isFinite(+b.price)) patch.bookedPrice = +b.price;
  const next: any = { ...o, bship: { ...sh, ...patch } };
  if (patch.waybill) next.awb = patch.waybill.slice(0, 40);
  await db.from("orders").update({ data: next, updated_at: Date.now() }).eq("id", row.id);
  return json({ ok: true });
});
