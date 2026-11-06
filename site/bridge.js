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
  /* Installable on phones: register the offline helper (HTTPS only). */
  if ('serviceWorker' in navigator && location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(function () {}); }
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

  /* ------------------------------------------------------------ sign-in screen: usernames only, no email
     Supabase signs people in with an address, so a username becomes an internal sign-in name on the reserved
     .invalid domain (RFC 2606): it can never receive mail, and Supabase refuses to send to it. */
  var ACCOUNT_DOMAIN = 'players.untsf.invalid';
  var USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/;
  var toLogin = function (u) { return u.toLowerCase() + '@' + ACCOUNT_DOMAIN; };
  var mode = 'signin', note = null, started = false, inviteNeeded = null;
  function checkInvite() { sb.rpc('invite_required').then(function (r) { var v = !r.error && r.data === true; if (v !== inviteNeeded) { inviteNeeded = v; if (mode === 'signup') showGate(); } }, function () {}); }
  function field(id, label, type, extra) { return '<label class="field">' + label + '<input id="' + id + '" type="' + type + '" ' + (extra || '') + '></label>'; }
  function showGate() {
    var title = { signin: 'Sign in', signup: 'Create an account' }[mode];
    var body = field('au-user', 'Username', 'text', 'autocomplete="username" autocapitalize="none" spellcheck="false" required')
      + field('au-pass', mode === 'signup' ? 'Password (at least 8 characters)' : 'Password', 'password', 'autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '" required')
      + (mode === 'signup' ? field('au-pass2', 'Password again', 'password', 'autocomplete="new-password" required')
        + field('au-invite', inviteNeeded === false ? 'Invite code (not needed at the moment)' : 'Invite code (from Command Authority)', 'text', 'autocomplete="off" autocapitalize="none" spellcheck="false"') : '');
    card('<p class="kicker">UNITED NATIONS · UNTSF-COMM</p><h1>' + title + '</h1>' + (note ? '<p class="notice ' + (note.bad ? 'warn' : '') + '" role="status">' + esc(note.text) + '</p>' : '')
      + (mode === 'signup' ? '<p class="small muted">Choose a username: 3 to 24 letters, numbers, hyphens or underscores. No email address is needed or stored.</p>' : '')
      + '<form id="au-form" class="auth-form" novalidate>' + body + '<button class="btn primary" type="submit" id="au-go">' + (mode === 'signup' ? 'Create account' : 'Sign in') + '</button></form>'
      + '<div class="auth-links">' + (mode === 'signin' ? '<button class="link-row" data-au="signup">New here? Create an account</button><p class="small muted" style="margin:6px 0 0">Forgotten your password? Ask the Administrator to reset it.</p>'
        : '<button class="link-row" data-au="signin">Back to sign in</button>') + '</div>');
    var f = document.getElementById('au-form'); if (f) f.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-au]'), function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-au'); note = null; showGate(); if (mode === 'signup') checkInvite(); }); });
    var first = document.querySelector('#au-form input'); if (first) first.focus();
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function busy(on) { var b = document.getElementById('au-go'); if (b) { b.disabled = on; if (on) b.textContent = 'Working…'; } }
  async function submit() {
    var user = val('au-user').trim().toLowerCase(), pass = val('au-pass');
    if (!USERNAME.test(user)) { note = { bad: true, text: 'Usernames are 3 to 24 letters, numbers, hyphens or underscores, starting with a letter or number.' }; return showGate(); }
    if (mode === 'signup' && pass.length < 8) { note = { bad: true, text: 'Use a password of at least 8 characters.' }; return showGate(); }
    if (mode === 'signup' && pass !== val('au-pass2')) { note = { bad: true, text: 'The two passwords don’t match.' }; return showGate(); }
    busy(true);
    try {
      if (mode === 'signin') { var r = await sb.auth.signInWithPassword({ email: toLogin(user), password: pass }); if (r.error) throw r.error; return start(r.data.session); }
      var code = val('au-invite').trim(), meta = { username: user }; if (code) meta.invite = code;
      var s = await sb.auth.signUp({ email: toLogin(user), password: pass, options: { data: meta } });
      if (s.error) throw s.error;
      if (s.data.session) return start(s.data.session);
      mode = 'signin'; note = { bad: true, text: 'The account was created but needs confirming. Ask the Administrator to switch off “Confirm email” in Supabase.' }; return showGate();
    } catch (e) {
      var m = (e && e.message) || 'Something went wrong.';
      if (/invalid login/i.test(m)) m = 'That username and password don’t match an account.';
      else if (/already registered|already exists/i.test(m)) m = 'That username is taken. Choose another.';
      else if (/rate limit/i.test(m)) m = 'Too many attempts. Wait a minute and try again.';
      else if (/not confirmed/i.test(m)) m = 'This account still needs confirming. Ask the Administrator to switch off “Confirm email” in Supabase.';
      else if (/signups? not allowed|disabled/i.test(m)) m = 'New accounts are closed. Ask the Administrator to create one for you.';
      else if (/invite_code_invalid|database error saving new user/i.test(m)) m = 'That invite code isn’t right. Ask Command Authority for the current one.';
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
      var r = await sb.from('members').select('role,username').eq('user_id', uid).maybeSingle();
      if (r.data) return r.data;
      await new Promise(function (ok) { setTimeout(ok, 500); });
    }
    return null;
  }
  async function start(session) {
    if (started || !session) return;
    started = true;
    card('<h1>Connecting…</h1><p>Opening the campaign.</p>');
    var user = session.user, member = await memberRow(user.id);
    if (!member) { started = false; note = { bad: true, text: 'Your account isn’t set up in the database yet. Ask Command Authority to check the database set-up has run.' }; mode = 'signin'; await sb.auth.signOut(); return showGate(); }
    var uname = member.username;
    window.UNTSF_ACCOUNT = {
      username: uname, email: uname, role: member.role, name: uname, id: user.id,
      signOut: async function () { try { sessionStorage.clear(); } catch (e) { /* ignore */ } await sb.auth.signOut(); location.reload(); },
      changePassword: async function (pass) { var r = await sb.auth.updateUser({ password: pass }); if (r.error) throw mapError(r.error); },
      /* Command Authority set-up: write many records at once. */
      bulkPut: async function (rows, progress) {
        for (var i = 0; i < rows.length; i += 400) {
          var chunk = rows.slice(i, i + 400).map(function (r) { return { collection: r.collection, id: r.id, data: r.data }; });
          var res = await sb.from('docs').upsert(chunk, { onConflict: 'collection,id' });
          if (res.error) throw mapError(res.error);
          if (progress) progress(Math.min(rows.length, i + 400));
        }
      },
      /* Administrator: accounts. */
      listMembers: async function () { var r = await sb.from('members').select('user_id,username,role,created_at').order('created_at'); if (r.error) throw mapError(r.error); return r.data; },
      setRole: async function (uid, role) { var r = await sb.from('members').update({ role: role }).eq('user_id', uid); if (r.error) throw mapError(r.error); },
      resetPassword: async function (uid, pass) { var r = await sb.rpc('admin_reset_password', { p_user: uid, p_password: pass }); if (r.error) throw mapError(r.error); },
      inviteRequired: async function () { var r = await sb.rpc('invite_required'); if (r.error) throw mapError(r.error); return r.data === true; },
      setInviteCode: async function (code) { var r = await sb.rpc('admin_set_invite_code', { p_code: code || null }); if (r.error) throw mapError(r.error); },
      deleteAccount: async function (uid) { var r = await sb.rpc('admin_delete_account', { p_user: uid }); if (r.error) throw mapError(r.error); }
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

  sb.auth.onAuthStateChange(function (event, session) { if (event === 'SIGNED_IN' && session && !started) start(session); });
  sb.auth.getSession().then(function (r) { if (r.data && r.data.session) start(r.data.session); else if (!started) showGate(); }, function () { showGate(); });
})();
