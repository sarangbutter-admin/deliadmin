// Delidome: optional Biteship courier integration.
// Deploy:  supabase functions deploy biteship
// The API key is saved by the owner in Shop settings -> Courier delivery (stored in a private table, never sent to the website).
import { admin, bs, bsErr, cors, hmacHex, INSTANT, ipOf, json, kv, limited, settings, STATUS_TXT, teamRole } from "../_shared/common.ts";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const num = (v: unknown, d = 0) => (Number.isFinite(+(v as number)) ? +(v as number) : d);
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

async function load(db: ReturnType<typeof admin>) {
  const [set, cfg, keyRow] = await Promise.all([settings(db), kv(db, "biteship_cfg"), kv(db, "biteship_key")]);
  return { set, cfg: cfg || {}, key: keyRow && keyRow.v ? String(keyRow.v) : "" };
}

// weight (grams) and size (cm) of a box
function boxOf(cfg: any, size: number) {
  const w = cfg.weights && num(cfg.weights[String(size)]) > 0 ? num(cfg.weights[String(size)]) : size * num(cfg.gramsPerCookie, 100) + num(cfg.boxGrams, 200);
  const d = cfg.dims || {};
  return { weight: Math.max(100, Math.round(w)), length: num(d.l, 25), width: num(d.w, 25), height: num(d.h, 10) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const action = String(body.action || "");
  const db = admin();

  try {
    /* ---------- public (shop checkout) ---------- */
    if (action === "areas" || action === "geocode" || action === "rates") {
      const { set, cfg, key } = await load(db);
      if (!set?.biteship?.on || !key) return json({ error: "Courier prices are not available right now." }, 503);
      if (limited(ipOf(req), 40, 60_000)) return json({ error: "Too many tries. Please wait a minute." }, 429);

      if (action === "areas") {
        const q = clean(body.q, 80);
        if (q.length < 3) return json({ areas: [] });
        let r = await bs(key, "GET", "/v1/maps/areas?countries=ID&type=single&input=" + encodeURIComponent(q));
        console.log("areas", q, r.status, r.ok ? (r.body?.areas || []).length : bsErr(r));
        if (r.ok && !(r.body?.areas || []).length) {
          // retry with just the most specific part (e.g. "Cisauk" from "Cisauk, Tangerang, Banten 15345")
          const first = q.split(/[,.]/)[0].trim();
          if (first && first !== q) { r = await bs(key, "GET", "/v1/maps/areas?countries=ID&type=single&input=" + encodeURIComponent(first)); console.log("areas retry", first, r.status, (r.body?.areas || []).length); }
        }
        if (!r.ok) return json({ error: bsErr(r) }, 502);
        const areas = ((r.body && r.body.areas) || []).slice(0, 8).map((a: any) => ({
          id: clean(a.id, 60), name: clean(a.name, 160), postal: clean(a.postal_code, 12),
        }));
        return json({ areas });
      }

      if (action === "geocode") {
        // try the full address first, then just the area (less exact: we say so)
        const find = async (q: string) => {
          const r = await fetch(NOMINATIM + "?format=json&limit=1&countrycodes=id&q=" + encodeURIComponent(q), {
            headers: { "User-Agent": "delidome-shop/1.0 (delivery quote)", "Accept-Language": "en" },
          });
          const j: any[] = r.ok ? await r.json().catch(() => []) : [];
          console.log("geocode", r.status, j.length);
          return j[0];
        };
        const addr = clean(body.address, 200), area = clean(body.area, 160).replace(/\b\d{5}\b/g, "").trim();
        let hit = await find([addr, area, "Indonesia"].filter(Boolean).join(", ")), approx = false;
        if (!hit && area) { hit = await find(area + ", Indonesia"); approx = true; }
        if (!hit) return json({ found: false });
        return json({ found: true, approx, lat: (+hit.lat).toFixed(5), lng: (+hit.lon).toFixed(5), label: clean(hit.display_name, 200) });
      }

      // rates
      const size = Math.round(num(body.size));
      const d = body.dest || {};
      const lat = num(d.lat, NaN), lng = num(d.lng, NaN), postal = clean(d.postal, 12);
      const o = cfg.origin || {};
      if (!(Number.isFinite(lat) && Number.isFinite(lng)) && !postal) return json({ error: "Choose your delivery area or location first." }, 400);
      const { data: sz } = await db.from("coll").select("data").eq("coll", "sizes").eq("id", String(size)).maybeSingle();
      const base = sz && sz.data ? num((sz.data as any).price) : 0;
      if (!base) return json({ error: "Unknown box size." }, 400);
      const box = boxOf(cfg, size);
      const items = [{ name: "Cookie box of " + size, description: "Fragile baked goods", value: Math.round(base), length: box.length, width: box.width, height: box.height, weight: box.weight, quantity: 1 }];
      const allowed: string[] = (Array.isArray(cfg.couriers) ? cfg.couriers : ["gojek", "grab", "lalamove"]).map((c: string) => String(c).toLowerCase().trim()).filter(Boolean);
      const inst = allowed.filter((c) => INSTANT.includes(c)), reg = allowed.filter((c) => !INSTANT.includes(c));
      const pricing: any[] = [];
      let lastErr = "";
      if (inst.length && Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(num(o.lat, NaN)) && Number.isFinite(num(o.lng, NaN))) {
        const r = await bs(key, "POST", "/v1/rates/couriers", {
          origin_latitude: num(o.lat), origin_longitude: num(o.lng), destination_latitude: lat, destination_longitude: lng, couriers: inst.join(","), items,
        });
        console.log("rates instant", r.status, r.ok ? (r.body?.pricing || []).length : bsErr(r));
        if (r.ok && r.body && Array.isArray(r.body.pricing)) pricing.push(...r.body.pricing); else lastErr = bsErr(r);
      } else if (inst.length) console.log("rates instant skipped: missing coordinates", Number.isFinite(lat), Number.isFinite(num(o.lat, NaN)));
      if (reg.length && postal && o.postal) {
        const r = await bs(key, "POST", "/v1/rates/couriers", {
          origin_postal_code: Math.round(num(o.postal)), destination_postal_code: Math.round(num(postal)), couriers: reg.join(","), items,
        });
        if (r.ok && r.body && Array.isArray(r.body.pricing)) pricing.push(...r.body.pricing); else lastErr = lastErr || bsErr(r);
      }
      if (!pricing.length && !lastErr && inst.length && !(Number.isFinite(lat) && Number.isFinite(lng)))
        return json({ options: [], error: "Press \"Find my address on the map\" so we can show Gojek and Grab prices." });
      if (!pricing.length && !lastErr && inst.length && !Number.isFinite(num(o.lat, NaN)))
        return json({ options: [], error: "The shop's pickup location isn't set yet." });
      if (!pricing.length) return json({ options: [], error: lastErr || "No courier is available for this address." });

      const markup = Math.max(0, num(cfg.markup, 0)), step = Math.max(1, num(cfg.roundTo, 500));
      const secret = (await kv(db, "quote_secret"))?.v as string;
      const exp = Date.now() + 15 * 60_000;
      const latS = Number.isFinite(lat) ? lat.toFixed(5) : "", lngS = Number.isFinite(lng) ? lng.toFixed(5) : "";
      const options: any[] = [];
      for (const p of pricing) {
        const code = clean(p.courier_code, 30).toLowerCase(), svc = clean(p.courier_service_code, 40);
        if (!code || !svc || !allowed.includes(code) || !(num(p.price) > 0)) continue;
        const price = Math.ceil((num(p.price) + markup) / step) * step;
        const sig = await hmacHex(secret, `${size}|${code}|${svc}|${price}|${exp}|${latS}|${lngS}|${postal}`);
        options.push({
          size, courier: code, service: svc, courierName: clean(p.courier_name, 40), serviceName: clean(p.courier_service_name, 60),
          type: clean(p.service_type || p.type, 20), eta: clean(p.shipment_duration_range ? p.shipment_duration_range + " " + (p.shipment_duration_unit || "") : p.duration, 30),
          price, exp, lat: latS, lng: lngS, postal, areaId: clean(d.areaId, 60), areaName: clean(d.areaName, 160), sig,
        });
      }
      options.sort((a, b) => a.price - b.price);
      return json({ options });
    }

    /* ---------- team only ---------- */
    const role = await teamRole(req);
    if (!role) return json({ error: "Please sign in to the team area." }, 401);
    const { set, cfg, key } = await load(db);

    if (action === "test") {
      if (!key) return json({ error: "Save your Biteship API key first." });
      const r = await bs(key, "GET", "/v1/couriers");
      console.log("test", r.status, r.ok ? "ok" : bsErr(r));
      if (!r.ok) return json({ ok: false, error: bsErr(r) });
      const list = ((r.body && r.body.couriers) || []).map((c: any) => String(c.courier_code || "").toLowerCase());
      return json({ ok: true, mode: key.startsWith("biteship_test") ? "test" : key.startsWith("biteship_live") ? "live" : "unknown", couriers: [...new Set(list)].slice(0, 60) });
    }

    if (action === "book" || action === "cancel" || action === "refresh") {
      if (!key) return json({ error: "Save your Biteship API key first." }, 400);
      const id = clean(body.orderId, 40);
      const { data: row } = await db.from("orders").select("id,data").eq("id", id).maybeSingle();
      if (!row) return json({ error: "Order not found." }, 404);
      const o: any = row.data, sh: any = o.bship;
      const save = async (patch: any, extra: any = {}) => {
        const next = { ...o, ...extra, bship: { ...(o.bship || {}), ...patch } };
        await db.from("orders").update({ data: next, updated_at: Date.now() }).eq("id", id);
        return next.bship;
      };

      if (action === "book") {
        if (!sh || !sh.courier) return json({ error: "This order has no courier chosen." }, 400);
        if (sh.biteshipId) return json({ error: "A courier is already booked for this order." }, 400);
        if (!["new", "baking", "ready"].includes(o.status)) return json({ error: "Confirm the payment first. Couriers are booked for paid orders." }, 400);
        const org = cfg.origin || {};
        if (!org.name || !org.phone || !org.address) return json({ error: "Fill in your pickup details in Shop settings first." }, 400);
        const box = boxOf(cfg, num(o.size));
        const c = o.customer || {};
        const payload: any = {
          shipper_contact_name: clean(org.name, 60), shipper_contact_phone: clean(org.phone, 20), shipper_organization: clean(org.business || org.name, 60),
          origin_contact_name: clean(org.name, 60), origin_contact_phone: clean(org.phone, 20), origin_address: clean(org.address, 250), origin_note: clean(org.note, 200),
          destination_contact_name: clean(c.name, 60), destination_contact_phone: clean(c.phone, 20), destination_contact_email: clean(c.email, 100),
          destination_address: clean(c.address, 250), destination_note: clean((o.note ? o.note + " " : "") + "Order " + o.code, 200),
          courier_company: sh.courier, courier_type: sh.service, delivery_type: "now",
          order_note: "Delidome order " + o.code + " (cookies, handle with care)",
          metadata: { orderCode: o.code },
          items: [{ name: "Cookie box of " + o.size, description: "Fragile baked goods", value: Math.round(num(o.base)), quantity: 1, weight: box.weight, length: box.length, width: box.width, height: box.height }],
        };
        if (Number.isFinite(num(org.lat, NaN)) && Number.isFinite(num(org.lng, NaN)) && org.lat !== "" && org.lng !== "") payload.origin_coordinate = { latitude: num(org.lat), longitude: num(org.lng) };
        else if (org.postal) payload.origin_postal_code = Math.round(num(org.postal));
        if (sh.lat && sh.lng) payload.destination_coordinate = { latitude: num(sh.lat), longitude: num(sh.lng) };
        if (sh.postal) payload.destination_postal_code = Math.round(num(sh.postal));
        const r = await bs(key, "POST", "/v1/orders", payload);
        if (!r.ok || !r.body) return json({ error: bsErr(r) }, 502);
        const b = r.body, cr = b.courier || {};
        const ship = await save({
          biteshipId: clean(b.id, 60), trackingId: clean(cr.tracking_id, 60), waybill: clean(cr.waybill_id, 60), link: clean(cr.link, 300),
          status: clean(b.status, 30) || "confirmed", bookedAt: Date.now(), bookedPrice: num(b.price, num(sh.price)),
        }, { courier: clean((sh.courierName || sh.courier) + " " + (sh.serviceName || sh.service), 40), awb: clean(cr.waybill_id, 40) || o.awb || "" });
        return json({ ok: true, bship: ship });
      }

      if (action === "refresh") {
        if (!sh || !sh.biteshipId) return json({ error: "No courier booked yet." }, 400);
        const r = await bs(key, "GET", "/v1/orders/" + encodeURIComponent(sh.biteshipId));
        if (!r.ok || !r.body) return json({ error: bsErr(r) }, 502);
        const b = r.body, cr = b.courier || {};
        const ship = await save({
          status: clean(b.status, 30) || sh.status, waybill: clean(cr.waybill_id, 60) || sh.waybill, link: clean(cr.link, 300) || sh.link,
          trackingId: clean(cr.tracking_id, 60) || sh.trackingId, bookedPrice: num(b.price, sh.bookedPrice),
        }, cr.waybill_id ? { awb: clean(cr.waybill_id, 40) } : {});
        return json({ ok: true, bship: ship });
      }

      // cancel
      if (!sh || !sh.biteshipId) return json({ error: "No courier booked." }, 400);
      const why = { cancellation_reason_code: "others", cancellation_reason: clean(body.reason || "Cancelled by the shop", 120) };
      let r = await bs(key, "DELETE", "/v1/orders/" + encodeURIComponent(sh.biteshipId), why);
      if (!r.ok && (r.status === 404 || r.status === 405)) r = await bs(key, "POST", "/v1/orders/" + encodeURIComponent(sh.biteshipId) + "/cancel", why);
      if (!r.ok) return json({ error: bsErr(r) }, 502);
      const ship = await save({ status: "cancelled", cancelledAt: Date.now(), biteshipId: "" , prevBiteshipId: sh.biteshipId });
      return json({ ok: true, bship: ship });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
void STATUS_TXT;
