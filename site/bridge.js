/* =====================================================================
   UNTSF-COMM — Supabase bridge (self-hosted edition).
   Signs the player in with Supabase Auth, then gives the app the same
   services it uses on claude.ai, backed by Supabase:
     db        records in the `docs` table, live through Realtime
     user      account id and role (owner / gm / player)
     assets    image uploads to the public `assets` Storage bucket
     downloads ordinary browser downloads
   The app itself is loaded only after sign-in.
   ===================================================================== */
(function () {
  'use strict';
  var cfg = window.UNTSF_CONFIG || {};
  var url = String(cfg.supabaseUrl || '').replace(/\/+$/, ''), key = String(cfg.publishableKey || '');
  var gate = function () { return document.getElementById('auth-root'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };

  function card(inner) { var g = gate(); if (g) g.innerHTML = '<div class="boot"><div class="plate boot-card auth-card">' + inner + '</div></div>'; }
  var configured = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url) && (/^sb_publishable_/.test(key) || /^eyJ/.test(key));
  if (!configured) {
    card('<p class="kicker">UNTSF-COMM · SET-UP</p><h1>Almost there</h1><p>This site isn’t connected to a database yet. Open <code>site/config.js</code> in the repository, put in your Supabase <b>Project URL</b> and <b>publishable key</b>, then commit and push.</p>');
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') { card('<h1>Can’t reach Supabase</h1><p>The Supabase library didn’t load. Check your connection and refresh.</p>'); return; }
  var sb = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.UNTSF_ASSET_BASE = url + '/storage/v1/object/public/assets/';
  var here = location.origin + location.pathname;

  /* ------------------------------------------------------------ sign-in screen */
  /* A password-reset link carries type=recovery: ask for the new password before opening the app. */
  var recovering = /type=recovery/.test(location.hash + location.search), mode = recovering ? 'newpass' : 'signin', note = null, started = false;
  function field(id, label, type, extra) { return '<label class="field">' + label + '<input id="' + id + '" type="' + type + '" ' + (extra || '') + '></label>'; }
  function showGate() {
    var title = { signin: 'Sign in', signup: 'Create an account', reset: 'Reset your password', newpass: 'Choose a new password' }[mode];
    var body = mode === 'signin' ? field('au-email', 'Email', 'email', 'autocomplete="email" required') + field('au-pass', 'Password', 'password', 'autocomplete="current-password" required')
      : mode === 'signup' ? field('au-name', 'Your name (shown to Command Authority)', 'text', 'autocomplete="nickname"') + field('au-email', 'Email', 'email', 'autocomplete="email" required') + field('au-pass', 'Password (at least 8 characters)', 'password', 'autocomplete="new-password" minlength="8" required')
      : mode === 'reset' ? field('au-email', 'Email', 'email', 'autocomplete="email" required')
      : field('au-pass', 'New password (at least 8 characters)', 'password', 'autocomplete="new-password" minlength="8" required');
    var go = { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', newpass: 'Save password' }[mode];
    card('<p class="kicker">UNITED NATIONS · UNTSF-COMM</p><h1>' + title + '</h1>' + (note ? '<p class="notice ' + (note.bad ? 'warn' : '') + '" role="status">' + esc(note.text) + '</p>' : '')
      + '<form id="au-form" class="auth-form" novalidate>' + body + '<button class="btn primary" type="submit" id="au-go">' + go + '</button></form>'
      + '<div class="auth-links">' + (mode === 'signin' ? '<button class="link-row" data-au="signup">New here? Create an account</button><button class="link-row" data-au="reset">Forgotten your password?</button>'
        : mode === 'newpass' ? '' : '<button class="link-row" data-au="signin">Back to sign in</button>') + '</div>');
    var f = document.getElementById('au-form'); if (f) f.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-au]'), function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-au'); note = null; showGate(); }); });
    var first = document.querySelector('#au-form input'); if (first) first.focus();
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function busy(on) { var b = document.getElementById('au-go'); if (b) { b.disabled = on; if (on) b.textContent = 'Working…'; } }
  async function submit() {
    var email = val('au-email'), pass = (document.getElementById('au-pass') || {}).value || '';
    if (mode !== 'newpass' && !/^\S+@\S+\.\S+$/.test(email)) { note = { bad: true, text: 'Enter your email address.' }; return showGate(); }
    if ((mode === 'signup' || mode === 'newpass') && pass.length < 8) { note = { bad: true, text: 'Use a password of at least 8 characters.' }; return showGate(); }
    busy(true);
    try {
      if (mode === 'signin') { var r = await sb.auth.signInWithPassword({ email: email, password: pass }); if (r.error) throw r.error; return start(r.data.session); }
      if (mode === 'signup') {
        var s = await sb.auth.signUp({ email: email, password: pass, options: { data: { display_name: val('au-name') || email.split('@')[0] }, emailRedirectTo: here } });
        if (s.error) throw s.error;
        if (s.data.session) return start(s.data.session);
        mode = 'signin'; note = { text: 'Account created. Check your email for the confirmation link, then sign in.' }; return showGate();
      }
      if (mode === 'reset') { var x = await sb.auth.resetPasswordForEmail(email, { redirectTo: here }); if (x.error) throw x.error; mode = 'signin'; note = { text: 'If that address has an account, a reset link is on its way.' }; return showGate(); }
      if (mode === 'newpass') { var u = await sb.auth.updateUser({ password: pass }); if (u.error) throw u.error; recovering = false; try { history.replaceState(null, '', here); } catch (e) { /* ignore */ } var g = await sb.auth.getSession(); return start(g.data.session); }
    } catch (e) {
      var m = (e && e.message) || 'Something went wrong.';
      if (/invalid login/i.test(m)) m = 'That email and password don’t match an account.';
      else if (/already registered/i.test(m)) m = 'That email already has an account. Sign in instead.';
      else if (/rate limit/i.test(m)) m = 'Too many emails sent recently. Wait a while and try again, or ask Command Authority.';
      else if (/not confirmed/i.test(m)) m = 'Confirm your email address first: check your inbox for the link.';
      note = { bad: true, text: m }; showGate();
    }
  }

  /* ------------------------------------------------------------ services for the app */
  function mapError(e) {
    var m = (e && e.message) || 'unknown error', c = e && (e.code || e.status);
    if (c === '42501' || c === 401 || c === 403 || /row-level security|permission denied/i.test(m)) return { code: 'not_granted', message: 'Not permitted for your account.' };
    if (/payload too large|too large/i.test(m)) return { code: 'quota_exceeded', message: m };
    return { code: 'unavailable', message: m };
  }
  var PRIVATE = /^data\/users\//, cache = {}, listeners = {}, pending = {}, loadPromise = null;
  function snapOf(col) { var m = cache[col] || {}; return { docs: Object.keys(m).map(function (id) { return { id: id, exists: true, data: function () { return clone(m[id]); } }; }), metadata: { fromCache: false, hasPendingWrites: false } }; }
  function notify(col) { if (pending[col]) return; pending[col] = setTimeout(function () { pending[col] = null; (listeners[col] || []).forEach(function (l) { try { l.cb(snapOf(col)); } catch (e) { console.error(e); } }); }, 0); }
  async function loadAll() {
    var next = {}, from = 0, page = 1000;
    for (;;) {
      var r = await sb.from('docs').select('collection,id,data').not('collection', 'like', 'data/users/%').order('collection').order('id').range(from, from + page - 1);
      if (r.error) throw r.error;
      r.data.forEach(function (row) { (next[row.collection] = next[row.collection] || {})[row.id] = row.data; });
      if (r.data.length < page) break; from += page;
    }
    Object.keys(cache).forEach(function (c) { if (!next[c]) next[c] = {}; });
    cache = next;
  }
  function ensureLoaded() {
    if (!loadPromise) loadPromise = loadAll().then(function () { Object.keys(listeners).forEach(notify); }, function (e) { Object.keys(listeners).forEach(function (c) { listeners[c].forEach(function (l) { if (l.err) l.err(mapError(e)); }); }); });
    return loadPromise;
  }
  var subscribedOnce = false;
  function liveUpdates() {
    sb.channel('untsf-docs').on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, function (p) {
      var row = (p.new && p.new.collection) ? p.new : p.old; if (!row || !row.collection || PRIVATE.test(row.collection)) return;
      var b = cache[row.collection] = cache[row.collection] || {};
      if (p.eventType === 'DELETE') delete b[row.id]; else b[row.id] = p.new.data;
      notify(row.collection);
    }).subscribe(function (status) {
      /* After a dropped connection, reload everything so nothing missed is lost. */
      if (status === 'SUBSCRIBED') { if (subscribedOnce) loadAll().then(function () { Object.keys(listeners).forEach(notify); }).catch(function () {}); subscribedOnce = true; }
    });
  }
  var db = {
    collection: function (col) {
      return {
        onSnapshot: function (cb, err) {
          (listeners[col] = listeners[col] || []).push({ cb: cb, err: err });
          ensureLoaded().then(function () { notify(col); });
          return function () { listeners[col] = (listeners[col] || []).filter(function (l) { return l.cb !== cb; }); };
        },
        doc: function (id) {
          return {
            set: async function (data) {
              var r = await sb.from('docs').upsert({ collection: col, id: id, data: data }, { onConflict: 'collection,id' });
              if (r.error) throw mapError(r.error);
              if (!PRIVATE.test(col)) { (cache[col] = cache[col] || {})[id] = clone(data); notify(col); }
            },
            delete: async function () {
              var r = await sb.from('docs').delete().match({ collection: col, id: id });
              if (r.error) throw mapError(r.error);
              if (cache[col]) { delete cache[col][id]; notify(col); }
            },
            get: async function () {
              var r = await sb.from('docs').select('data').eq('collection', col).eq('id', id).maybeSingle();
              if (r.error) throw mapError(r.error);
              var d = r.data ? r.data.data : undefined;
              return { exists: d !== undefined, data: function () { return clone(d); } };
            }
          };
        }
      };
    }
  };
  var TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  var assets = {
    upload: async function (blob, o) {
      var type = (o && o.type) || blob.type || 'application/octet-stream';
      if (!TYPES[type]) throw { code: 'unsupported_type', message: 'Use a PNG, JPEG, WebP or GIF image.' };
      var id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/[^a-f0-9]/gi, '').slice(0, 32).toLowerCase();
      var r = await sb.storage.from('assets').upload(id, blob, { contentType: type, cacheControl: '31536000', upsert: false });
      if (r.error) throw mapError(r.error);
      return { id: id, url: window.UNTSF_ASSET_BASE + id, sizeBytes: blob.size, contentType: type };
    },
    list: async function () {
      var r = await sb.storage.from('assets').list('', { limit: 1000 });
      if (r.error) throw mapError(r.error);
      var items = (r.data || []).filter(function (o) { return o.id; }), total = items.reduce(function (s, o) { return s + ((o.metadata && o.metadata.size) || 0); }, 0);
      return { assets: items.map(function (o) { return { id: o.name, sizeBytes: (o.metadata && o.metadata.size) || 0, contentType: o.metadata && o.metadata.mimetype }; }), usage: { totalBytes: total } };
    }
  };
  var MIME = { csv: 'text/csv', json: 'application/json', html: 'text/html', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf', png: 'image/png', svg: 'image/svg+xml', zip: 'application/zip' };
  var downloads = {
    save: async function (req) {
      var ext = String(req.filename || '').split('.').pop().toLowerCase(), data = req.data;
      var blob = data instanceof Blob ? data : new Blob([data], { type: MIME[ext] || 'application/octet-stream' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = req.filename || 'download'; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return { status: 'saved' };
    }
  };

  /* ------------------------------------------------------------ start the app once signed in */
  async function memberRow(uid) {
    for (var i = 0; i < 6; i++) {
      var r = await sb.from('members').select('role,email,display_name').eq('user_id', uid).maybeSingle();
      if (r.data) return r.data;
      await new Promise(function (ok) { setTimeout(ok, 500); });
    }
    return null;
  }
  async function start(session) {
    if (started || !session || recovering) return;
    started = true;
    card('<h1>Connecting…</h1><p>Opening the campaign.</p>');
    var user = session.user, member = await memberRow(user.id);
    if (!member) { started = false; note = { bad: true, text: 'Your account isn’t set up in the database yet. Ask Command Authority to check the database set-up has run.' }; mode = 'signin'; await sb.auth.signOut(); return showGate(); }
    window.UNTSF_ACCOUNT = {
      email: user.email, role: member.role, name: member.display_name,
      signOut: async function () { try { sessionStorage.clear(); } catch (e) { /* ignore */ } await sb.auth.signOut(); location.reload(); },
      /* Command Authority set-up: write many records at once. */
      bulkPut: async function (rows, progress) {
        for (var i = 0; i < rows.length; i += 400) {
          var chunk = rows.slice(i, i + 400).map(function (r) { return { collection: r.collection, id: r.id, data: r.data }; });
          var res = await sb.from('docs').upsert(chunk, { onConflict: 'collection,id' });
          if (res.error) throw mapError(res.error);
          if (progress) progress(Math.min(rows.length, i + 400));
        }
      }
    };
    var gm = member.role === 'owner' || member.role === 'gm';
    window.claude = { use: async function (name) {
      if (name === 'db') return db;
      if (name === 'user') return { id: async function () { return user.id; }, canEdit: async function () { return gm; }, isOwner: async function () { return member.role === 'owner'; }, can: async function () { return true; } };
      if (name === 'assets') return assets;
      if (name === 'downloads') return downloads;
      throw { code: 'unavailable', message: 'Not available in the self-hosted edition.' };
    } };
    liveUpdates();
    var g = gate(); if (g) g.innerHTML = '';
    var s = document.createElement('script'); s.src = 'app.js?v=' + (window.UNTSF_BUILD || '1'); document.body.appendChild(s);
  }

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; mode = 'newpass'; note = null; return showGate(); }
    if (event === 'SIGNED_IN' && session && !started && !recovering) start(session);
  });
  sb.auth.getSession().then(function (r) { if (recovering) return showGate(); if (r.data && r.data.session) start(r.data.session); else if (!started) showGate(); }, function () { showGate(); });
})();
