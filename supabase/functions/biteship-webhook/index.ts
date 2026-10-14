// Biteship -> shop: courier status updates.
// Deploy without JWT:  supabase functions deploy biteship-webhook --no-verify-jwt
// In the Biteship dashboard set the webhook URL to
//   https://<project>.supabase.co/functions/v1/biteship-webhook?k=<webhook secret shown in Shop settings>
// Moves the order on by itself (picked up -> Out for delivery, delivered -> Delivered), saves proof photos,
// tells the customer, and (when switched on) books a new courier once if no driver was found.
import { admin, applyUpdate, bookOrder, bs, driverOf, FAILED, findProofs, hmacHex, json, kv } from "../_shared/common.ts";

const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = admin();

  // the customer's place photo, for the driver (private link from the booking note)
  if (req.method === "GET" && url.searchParams.get("ph")) {
    const id = clean(url.searchParams.get("ph"), 40), sec = (await kv(db, "quote_secret"))?.v as string;
    if (!sec || url.searchParams.get("s") !== (await hmacHex(sec, "place|" + id)).slice(0, 32)) return new Response("Not found", { status: 404 });
    const { data: f } = await db.from("order_files").select("data").eq("order_id", id).eq("kind", "place").maybeSingle();
    const m = f && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(String(f.data));
    if (!m) return new Response("This photo is no longer available.", { status: 404 });
    const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=3600" } });
  }

  const secret = (await kv(db, "webhook_secret"))?.v as string;
  if (!secret || url.searchParams.get("k") !== secret) return json({ error: "Not allowed" }, 401);
  if (req.method !== "POST") return json({ ok: true });
  let b: any = {};
  try { b = await req.json(); } catch { return json({ ok: true }); }   // Biteship's "test" ping can be empty
  const bid = clean(b.order_id, 60), status = clean(b.status, 30).toLowerCase();
  console.log("webhook", b.event || "", bid, status);
  if (!bid) return json({ ok: true });
  const { data: row } = await db.from("orders").select("id,data").eq("data->bship->>biteshipId", bid).maybeSingle();
  if (!row) return json({ ok: true });

  const keyRow = await kv(db, "biteship_key"), key = keyRow && keyRow.v ? String(keyRow.v) : "";
  let proofs = findProofs(b), driver = driverOf(b);
  // at the important steps, read the full booking once for proof photos and driver details
  if (key && ["picked", "dropping_off", "delivered", "allocated"].includes(status)) {
    const r = await bs(key, "GET", "/v1/orders/" + encodeURIComponent(bid));
    if (r.ok && r.body) { proofs = [...new Set([...proofs, ...findProofs(r.body)])]; driver = driver || driverOf(r.body); }
  }
  const next = await applyUpdate(db, row, {
    status: status || undefined, waybill: b.courier_waybill_id, link: b.courier_link, trackingId: b.courier_tracking_id,
    price: b.price ?? b.order_price, driver: driver || undefined, proofs,
  }, true);

  // optional: try once more by itself when no driver took the order
  const cfg = (await kv(db, "biteship_cfg")) || {};
  if (FAILED.includes(status) && status !== "returned" && cfg.autoRetry && key && (next.bship.retries || 0) < 1 && ["new", "baking", "ready"].includes(next.status)) {
    const job = (async () => {
      await sleep(60_000);
      const { data: fresh } = await db.from("orders").select("id,data").eq("id", row.id).maybeSingle();
      if (!fresh || (fresh.data.bship && fresh.data.bship.biteshipId)) return;   // the owner already booked again
      const r = await bookOrder(db, key, cfg, fresh);
      console.log("auto retry", fresh.data.code, (r as any).error || "booked");
    })();
    // @ts-ignore EdgeRuntime is provided by Supabase
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job); else await job;
  }
  if (status === "delivered") await db.rpc("place_cleanup");   // remove place photos of orders delivered 3+ days ago
  return json({ ok: true });
});
