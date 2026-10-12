/* Delidome: tiny Supabase client (no libraries, no build step).
   - rpc(): calls a database function through PostgREST
   When config.js is empty, SBK.on is false and the site runs in demo mode. */
(function () {
  "use strict";
  var C = window.DELIDOME_CONFIG || {};
  var URL_ = String(C.supabaseUrl || "").trim().replace(/\/+$/, "");
  var KEY = String(C.supabaseAnonKey || "").trim();
  var on = !!(URL_ && KEY);
  function nice(msg) {
    msg = String(msg || "");
    if (/Failed to fetch|NetworkError|Load failed|aborted/i.test(msg)) return "Can't reach the shop right now. Check your internet and try again.";
    return msg;
  }
  function headers(token, extra) {
    var h = { "apikey": KEY, "Content-Type": "application/json" };
    // legacy anon keys are JWTs and may be sent as a bearer; new publishable keys must not be
    if (token) h["Authorization"] = "Bearer " + token;
    else if (/^eyJ/.test(KEY)) h["Authorization"] = "Bearer " + KEY;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function timeout(ms) { var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms); return { signal: c.signal, done: function () { clearTimeout(t); } }; }

  async function rpc(name, args) {
    if (!on) throw new Error("Backend is not configured.");
    var tok = null;
    var attempt = async function (tk) {
      var t = timeout(25000), r;
      try {
        r = await fetch(URL_ + "/rest/v1/rpc/" + name, { method: "POST", headers: headers(tk), body: JSON.stringify(args || {}), signal: t.signal });
      } catch (e) { t.done(); throw new Error(nice(e && e.message)); }
      t.done();
      var txt = await r.text(), j = null;
      try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
      if (!r.ok) {
        var err = new Error(nice((j && (j.message || j.error_description || j.hint)) || ("Request failed (" + r.status + ")")));
        err.status = r.status; err.code = j && j.code;
        throw err;
      }
      return j;
    };
    return attempt(tok);
  }

  window.SBK = { on: on, url: URL_, rpc: rpc };
})();
