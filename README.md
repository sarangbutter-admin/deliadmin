# Delidome: cookie box shop

A ready-to-deploy ordering website for a cookie shop.

* **Customers** build a box, order (pickup or delivery), pay by bank transfer / e-wallet and upload proof, track the order, edit or cancel it until it is paid, report a problem, rate the cookies and leave reviews.
* **The owner** (at `/#admin`) accepts payments, moves orders through every status, prints labels and bake sheets, edits flavors, stock, prices, flash sales, coupons, boxes, extras, banners and every page of the site, and gets a sound + popup when a new order, payment proof or complaint arrives.

No build step. No frameworks. The site is plain files in `site/`, the backend is Supabase (Postgres + Auth + Storage), the host is Netlify.

```
site/                 <- what Netlify publishes
  index.html  styles.css  app.js  sb.js  backend.js  config.js  404.html  robots.txt
supabase/migrations/  <- the whole database (run once)
netlify.toml          <- security headers + publish folder
tools/bundle.py       <- optional: builds one single-file preview (dist/)
```

If `site/config.js` is left empty the site runs in **demo mode**: everything is stored in the visitor's own browser and nothing is shared. Handy for trying things out, never use it for real customers.

---

## Set-up (about 20 minutes)

### 1. Supabase (the database)

1. Create a project at <https://supabase.com> (any region close to your customers). Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole file `supabase/migrations/20260101000000_delidome_schema.sql`, press **Run**. It is safe to run again later.
3. Create your owner login: **Authentication → Users → Add user → Create new user**. Enter your email and a long password, and tick **Auto Confirm User**.
4. Tell the database that this email is the owner. In **SQL Editor** run (use your own email):
   ```sql
   insert into public.admins (email) values ('you@example.com');
   ```
   Only emails in this list can open the admin. You can add a second person the same way.
5. **Turn off public sign-ups** so strangers can't create accounts: **Authentication → Sign In / Providers → "Allow new users to sign up" → OFF**. (Even if someone did sign up, they would not be an owner. This is a second lock.)
6. Copy your keys: **Project Settings → API**. You need the **Project URL** and the **anon / publishable key**. Both are safe to publish; the database only lets visitors call the public shop functions.

### 2. Put the keys in the site

Edit `site/config.js`:

```js
window.DELIDOME_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-OR-PUBLISHABLE-KEY"
};
```

Never put the `service_role` / secret key anywhere in this repo.

### 3. GitHub

Create an empty repository on GitHub, then in this folder:

```bash
git init
git add .
git commit -m "Delidome shop"
git branch -M main
git remote add origin https://github.com/YOU/delidome.git
git push -u origin main
```

### 4. Netlify (the host)

1. **Add new site → Import an existing project → GitHub**, pick the repository.
2. Leave the build command empty. Publish directory is already set to `site` by `netlify.toml`. Deploy.
3. In Supabase go to **Authentication → URL Configuration** and set **Site URL** to your Netlify address (or your own domain). 
4. Optional: add your own domain in **Netlify → Domain management** (HTTPS is automatic).

### Previews without spending credits (dev branch)

This repo is set up so Netlify **only builds the `dev` branch**; `main` is never built automatically (see `ignore` in `netlify.toml`).

* Work and test on `dev`. Every push to `dev` gets a preview at `https://dev--YOUR-SITE.netlify.app`.
* In Netlify: **Site configuration → Build & deploy → Branches and deploy contexts**: set *Branch deploys* to **"Let me add individual branches"** and add only `dev`. Leave *Deploy Previews* off.
* To go live, deliberately publish from `main`: merge `dev` into `main`, then in Netlify use **Deploys → Trigger deploy → Clear cache and deploy site** after removing the `ignore` lines (or ask Claude to). Nothing reaches the live address without you doing this.

### 5. First sign-in

Open `https://YOUR-SITE/#admin`, sign in with the owner email and password. The first time, the shop is filled with starter flavors, boxes and extras (no fake orders or reviews). Everything on the left menu is yours to edit. Changes save automatically (look for "All changes saved" in the sidebar) and are live for customers within seconds.

First things to do in the admin:
* **Shop settings**: name, address, opening hours, delivery fee, order cut-off, **time zone**, payment window, closed days.
* **Shop settings → Payment methods**: your bank / e-wallet details and QR pictures (customers see these after they order).
* **Flavors, Boxes & extras**: replace the starter content.

### 6. Optional

* **Cancel unpaid orders on the dot**: unpaid orders are cancelled (and their cookies put back in stock) whenever anyone opens the shop or the admin, which in practice is within seconds. For a guarantee even when nobody is online: **Database → Extensions → enable `pg_cron`**, then run  
  `select cron.schedule('delidome-sweep', '* * * * *', $$select public.sweep_orders()$$);`
* **Backups**: Supabase keeps daily backups on paid plans. On the free plan, export your data now and then (**Database → Backups**, or `pg_dump`).

---

## How the security works

| Risk | What stops it |
| --- | --- |
| A visitor reading other people's orders, phone numbers or addresses | All tables are locked (row level security on, no access granted to the public roles). Visitors can only call specific functions. Each customer only gets their own orders, proven by a secret token that stays in their browser (stored hashed in the database). To open an order on another device they need the order code **and** the WhatsApp number (rate-limited). |
| A visitor changing prices, stock or shop content | Every price, discount, coupon, delivery fee, stock check and delivery date is recomputed **on the server** when an order is placed. The browser's total is only a "did the price change?" check. |
| Someone opening the admin | Needs a Supabase login whose email is in the `admins` table, checked again inside every admin function. Public sign-ups are off. |
| Leaking unpromoted coupon codes | Customers only receive coupons the owner marked "show to customers". Other codes are checked one at a time by the server (rate-limited). |
| Fake payment proofs / photos with scripts | Only real JPG/PNG/WebP data under 1 MB is accepted. Pictures are stored apart from the order and shown only to the order's customer and the owner. |
| Script injection (XSS) | Everything is escaped before display, and the Content-Security-Policy in `netlify.toml` allows scripts from this site only (no inline scripts), so injected code can't run anyway. |
| Spam / bots | Per-minute limits on orders, tracking attempts, reviews, proofs and complaints; max 3 unpaid orders per phone number; a cap on total open unpaid orders so cookies can't be locked up by a bot (`maxOpenOrders` in settings, default 150). |
| Clickjacking, mixed content, sniffing | `X-Frame-Options`, `frame-ancestors`, HSTS, `nosniff`, strict referrer policy (all in `netlify.toml`). |

## Privacy notes

* Customer name, email, phone, address, payment proof and complaint photos are stored in your Supabase project only. Visitors never receive other customers' data.
* The site loads its two fonts from **Google Fonts**, which means Google sees visitors' IP addresses. If you want to avoid that, download the fonts (Unbounded, Instrument Sans), put them in `site/` with `@font-face` rules in `styles.css`, delete the two Google `<link>` tags in `index.html`, and remove the Google entries from the `Content-Security-Policy` in `netlify.toml`.
* Visit counting stores only a random id made by the browser (no IP address, no cookies).
* Owner pictures (flavor photos, banners) are uploaded to a **public** storage bucket named `shop-media`, so customers can see them. Do not upload anything private there.

## Things worth knowing

* **Messages to customers**: the admin logs every status message and gives you one-tap WhatsApp / email buttons (they open your own WhatsApp or mail app). Fully automatic sending needs a messaging service and is not included.
* **Time zone**: the order cut-off and the days customers can choose follow *Shop settings → Shop time zone* (default Asia/Jakarta), whatever the visitor's own time zone is.
* **Free-plan limits**: Supabase pauses free projects after a week without activity and has storage / bandwidth limits. For a real shop the Pro plan is recommended.
* **Updating the site**: change files, `git push`, Netlify redeploys. For database changes, add a new file in `supabase/migrations/` and run it in the SQL editor.
* **Preview without Netlify**: `cd site && python3 -m http.server 8080`, then open <http://localhost:8080>.
* **Single-file preview**: `python3 tools/bundle.py` writes `dist/delidome-single.html`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "We couldn't load the shop" | `config.js` URL / key wrong or the SQL file wasn't run. Open the browser console for details. |
| Admin says "isn't the shop owner" | The email isn't in `public.admins` (step 1.4), or differs in spelling. |
| "Could not find the function … in the schema cache" | Re-run the SQL file, then wait a few seconds (or **Project Settings → API → Reload schema**). |
| Pictures don't upload | Re-run the SQL file (it creates the `shop-media` bucket and its policies). |
| Customers see an empty shop | Sign in to `/#admin` once so the starter content is created. |

## Tests that were run

The database file and the website were tested together against a real PostgreSQL 16 with a Supabase-compatible request layer, driving a real browser: ordering, price/stock/coupon enforcement, editing and cancelling orders, payment proof, tracking from another device, every owner status change with stock effects, complaints and replies, ratings, auto-cancel of unpaid orders, picture uploads, sign-in / sign-out, non-owner accounts, anonymous access to every table and admin function, and script-injection attempts. It has not been run against Supabase's own servers; follow the steps above and test one order end to end before announcing the shop.
