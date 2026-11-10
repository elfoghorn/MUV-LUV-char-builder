/* =====================================================================
   UNTSF-COMM — Supabase bridge (self-hosted edition).
   Signs the player in with Supabase Auth, then gives the app the same
   services it uses on claude.ai, backed by Supabase:
     db        records in the `docs` table, live through Realtime
     user      account id and role (owner / gm / player)
     assets    image uploads to the public `assets` Storage bucket
     downloads browser downloads, or Google Drive when googleClientId is set in config.js
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
     Supabase signs people in with an address, so a username becomes an internal sign-in name on this project's
     own Supabase domain (e.g. kestrel@abcd.supabase.co). Supabase only accepts domains that really exist, and this
     one always does, belongs to no one else, and never changes. With "Confirm email" off, nothing is ever sent. */
  var ACCOUNT_DOMAIN = url.replace(/^https:\/\//, '');
  var USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/;
  /* Together these say exactly what USERNAME says. */
  var USERNAME_RULES = [
    ['3 to 24 characters long', function (u) { return u.length >= 3 && u.length <= 24; }],
    ['Starts with a letter or a number', function (u) { return /^[a-z0-9]/.test(u); }],
    ['Only letters a to z, numbers, hyphens (-) and underscores (_)', function (u) { return /^[a-z0-9_-]+$/.test(u); }]
  ];
  function usernameProblem(u) {
    if (USERNAME.test(u)) return null;
    if (!u) return 'Enter a username.';
    var odd = u.match(/[^a-z0-9_-]/g);
    if (odd && odd.some(function (c) { return /\s/.test(c); })) return 'Usernames can’t contain spaces. Use a hyphen or an underscore instead, like red-fox.';
    if (odd) return 'Usernames can’t contain ' + odd.filter(function (c, i) { return odd.indexOf(c) === i; }).slice(0, 6).map(function (c) { return '“' + c + '”'; }).join(' ') + '. Use only letters a to z, numbers, hyphens and underscores.';
    if (!/^[a-z0-9]/.test(u)) return 'Usernames must start with a letter or a number, not “' + u.charAt(0) + '”.';
    return u.length < 3 ? 'That username is too short. It needs at least 3 characters.' : 'That username is too long: it has ' + u.length + ' characters and the limit is 24.';
  }
  function usernameRulesHtml() {
    return '<ul class="au-rules" id="au-rules">' + USERNAME_RULES.map(function (r) { return '<li><span class="au-mark" aria-hidden="true">•</span><span>' + r[0] + '</span></li>'; }).join('') + '</ul>'
      + '<p class="small muted au-eg"><b>Fine:</b> red-fox, kestrel_01, Akari88<br><b>Not allowed:</b> Red Fox (space), Tōdō (accents), k.fox (full stop), _fox (starts with a symbol)<br>Capitals are saved as lowercase. You can’t change your username later.</p>';
  }
  function paintUsernameRules() {
    var box = document.getElementById('au-rules'); if (!box) return;
    var u = val('au-user').trim().toLowerCase();
    Array.prototype.forEach.call(box.children, function (li, i) { var ok = USERNAME_RULES[i][1](u); li.className = !u ? '' : ok ? 'ok' : 'bad'; li.firstChild.textContent = !u ? '•' : ok ? '✓' : '✕'; });
  }
  var toLogin = function (u) { return u.toLowerCase() + '@' + ACCOUNT_DOMAIN; };
  var mode = 'signin', note = null, started = false, inviteNeeded = null;
  var INVITE_LABEL = function () { return inviteNeeded === false ? 'Invite code (not needed at the moment)' : 'Invite code (from Command Authority)'; };
  /* The answer can arrive while someone is typing, so only the label changes: never redraw the form here. */
  function checkInvite() { sb.rpc('invite_required').then(function (r) { inviteNeeded = !r.error && r.data === true; var l = document.getElementById('au-invite-label'); if (l) l.textContent = INVITE_LABEL(); }, function () {}); }
  function field(id, label, type, extra) { return '<label class="field">' + label + '<input id="' + id + '" type="' + type + '" ' + (extra || '') + '></label>'; }
  function showGate() {
    /* A redraw keeps what was typed, so a failed attempt can be corrected rather than started again. */
    var typed = {}; ['au-user', 'au-pass', 'au-pass2', 'au-invite'].forEach(function (id) { typed[id] = val(id); });
    var title = { signin: 'Sign in', signup: 'Create an account' }[mode];
    var body = field('au-user', 'Username', 'text', 'autocomplete="username" autocapitalize="none" spellcheck="false" required' + (mode === 'signup' ? ' aria-describedby="au-rules"' : ''))
      + (mode === 'signup' ? usernameRulesHtml() : '')
      + field('au-pass', mode === 'signup' ? 'Password (at least 8 characters)' : 'Password', 'password', 'autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '" required')
      + (mode === 'signup' ? field('au-pass2', 'Password again', 'password', 'autocomplete="new-password" required')
        + field('au-invite', '<span id="au-invite-label">' + INVITE_LABEL() + '</span>', 'text', 'autocomplete="off" autocapitalize="none" spellcheck="false"') : '');
    card('<p class="kicker">UNITED NATIONS · UNTSF-COMM</p><h1>' + title + '</h1>' + (note ? '<p class="notice ' + (note.bad ? 'warn' : '') + '" id="au-note" role="alert">' + esc(note.text) + '</p>' : '')
      + (mode === 'signup' ? '<p class="small muted">No email address is needed or stored.</p>' : '')
      + '<form id="au-form" class="auth-form" novalidate>' + body + '<button class="btn primary" type="submit" id="au-go">' + (mode === 'signup' ? 'Create account' : 'Sign in') + '</button></form>'
      + '<div class="auth-links">' + (mode === 'signin' ? '<button class="link-row" data-au="signup">New here? Create an account</button><p class="small muted" style="margin:6px 0 0">Forgotten your password? Ask the Administrator to reset it.</p>'
        : '<button class="link-row" data-au="signin">Back to sign in</button>') + '</div>');
    var f = document.getElementById('au-form'); if (f) f.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-au]'), function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-au'); note = null; showGate(); if (mode === 'signup') checkInvite(); }); });
    Object.keys(typed).forEach(function (id) { var el = document.getElementById(id); if (el) el.value = typed[id]; });
    var nameBox = document.getElementById('au-user'); if (nameBox) nameBox.addEventListener('input', paintUsernameRules); paintUsernameRules();
    /* Focusing a field on a phone scrolls the message away, so a message takes priority. */
    var shown = document.getElementById('au-note'), first = document.querySelector('#au-form input');
    if (shown) shown.scrollIntoView({ block: 'center' }); else if (first) first.focus();
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function busy(on) { var b = document.getElementById('au-go'); if (b) { b.disabled = on; if (on) b.textContent = 'Working…'; } }
  async function submit() {
    var user = val('au-user').trim().toLowerCase(), pass = val('au-pass');
    var nameIssue = usernameProblem(user); if (nameIssue) { note = { bad: true, text: nameIssue }; return showGate(); }
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
      else if (/invite_code_invalid|database error saving new user/i.test(m)) m = inviteNeeded === false ? 'The database wouldn’t create this account. Tell the Administrator, and quote this message.' : 'That invite code isn’t right. Ask Command Authority for the current one.';
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
  function saveLocal(blob, filename) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'download'; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ------------------------------------------------------------ Google Drive (optional)
     With googleClientId set in config.js, every export asks where it should go: Google Drive (as a Google Doc or
     Sheet where the file converts, or as the original file) or this device. Without it, exports download as before.
     Google sign-in happens in the player's own browser. The access token is kept in memory on this page only, and
     nothing about the Google account is sent to Supabase. The drive.file permission lets the site see only the files
     it saved itself, never the rest of anyone's Drive. */
  var GCLIENT = String(cfg.googleClientId || '').trim();
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER = String(cfg.googleDriveFolder || 'UNTSF-COMM').trim() || 'UNTSF-COMM';
  var DRIVE_API = 'https://www.googleapis.com/drive/v3/files', DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  var GOOGLE_DOC = ['application/vnd.google-apps.document', 'Google Doc'], GOOGLE_SHEET = ['application/vnd.google-apps.spreadsheet', 'Google Sheet'];
  var CONVERTS = { docx: GOOGLE_DOC, html: GOOGLE_DOC, txt: GOOGLE_DOC, csv: GOOGLE_SHEET };
  var drive = { token: null, expires: 0, folder: null, client: null, pending: null };

  if (GCLIENT) {
    var gsi = document.createElement('script'); gsi.src = 'https://accounts.google.com/gsi/client'; gsi.async = true; gsi.defer = true;
    document.head.appendChild(gsi);
    var gstyle = document.createElement('style');
    gstyle.textContent = '.gsave-scrim{position:fixed;inset:0;background:rgba(8,14,22,.55);z-index:60}'
      + '.gsave{position:fixed;z-index:61;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 32px));max-height:calc(100% - 32px);overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.35)}'
      + '.gsave .gsave-name{margin:0 0 6px;font:600 15px/1.35 var(--font-mono);word-break:break-all;text-transform:none;letter-spacing:0;display:block}'
      + '.gsave p{margin:0 0 10px}.gsave .gsave-note{color:var(--muted);font-size:13px}.gsave .gsave-err{color:var(--bad)}'
      + '.gsave-opts{display:grid;gap:8px;margin:14px 0 12px}.gsave-opts .btn{justify-content:center;width:100%;min-height:40px;text-decoration:none}'
      + '.gsave-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}';
    document.head.appendChild(gstyle);
  }
  function googleReady() { return !!(window.google && window.google.accounts && window.google.accounts.oauth2); }

  /* Called straight from a tap, so the Google window opens instead of being blocked as a pop-up. */
  function withToken(done, fail) {
    if (drive.token && Date.now() < drive.expires) { done(drive.token); return; }
    if (!googleReady()) { fail(new Error('Google sign-in is still loading. Wait a moment and try again.')); return; }
    var oauth = window.google.accounts.oauth2;
    if (!drive.client) {
      drive.client = oauth.initTokenClient({
        client_id: GCLIENT, scope: DRIVE_SCOPE,
        callback: function (resp) {
          var p = drive.pending; drive.pending = null; if (!p) return;
          if (!resp || resp.error) { p.fail(new Error((resp && resp.error_description) || 'Google didn’t give access to Drive.')); return; }
          if (!oauth.hasGrantedAllScopes(resp, DRIVE_SCOPE)) { p.fail(new Error('Google Drive access wasn’t ticked. Try again and allow it when Google asks.')); return; }
          drive.token = resp.access_token; drive.expires = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
          p.done(drive.token);
        },
        error_callback: function (e) {
          var p = drive.pending; drive.pending = null; if (!p) return;
          var t = e && e.type;
          p.fail(new Error(t === 'popup_closed' ? 'The Google window was closed before Drive access was given.'
            : t === 'popup_failed_to_open' ? 'The Google window was blocked. Allow pop-ups for this site, then try again.'
            : 'Google sign-in didn’t complete.'));
        }
      });
    }
    drive.pending = { done: done, fail: fail };
    drive.client.requestAccessToken();
  }
  async function driveFetch(u, opts, tok) {
    opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + tok }, opts.headers || {});
    var r;
    try { r = await fetch(u, opts); } catch (e) { throw new Error('Couldn’t reach Google Drive. Check your connection.'); }
    if (r.ok) return r;
    if (r.status === 401) { drive.token = null; drive.folder = null; throw new Error('Your Google sign-in has expired. Try again to reconnect.'); }
    var msg = ''; try { var j = await r.json(); msg = j && j.error && j.error.message; } catch (e) { /* ignore */ }
    if (r.status === 403 && /not been used|disabled/i.test(msg || '')) msg = 'The Google Drive API isn’t switched on for this site yet (see SETUP.md, Google Drive).';
    if (r.status === 403 && /storage quota|quota exceeded/i.test(msg || '')) msg = 'Your Google Drive is full.';
    throw new Error(msg || ('Google Drive said no (' + r.status + ').'));
  }
  async function driveJson(u, opts, tok) { return (await driveFetch(u, opts, tok)).json(); }
  async function driveFolder(tok) {
    if (drive.folder) return drive.folder;
    var q = "mimeType='application/vnd.google-apps.folder' and name='" + DRIVE_FOLDER.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "' and trashed=false";
    var found = await driveJson(DRIVE_API + '?spaces=drive&pageSize=1&fields=files(id)&q=' + encodeURIComponent(q), {}, tok);
    if (found.files && found.files.length) return (drive.folder = found.files[0].id);
    var made = await driveJson(DRIVE_API + '?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }) }, tok);
    return (drive.folder = made.id);
  }
  async function driveUpload(tok, blob, filename, ext, convertTo) {
    var folder = await driveFolder(tok);
    var meta = { name: convertTo ? filename.replace(/\.[^.]+$/, '') : filename, parents: [folder] };
    if (convertTo) meta.mimeType = convertTo;
    var type = (blob.type || MIME[ext] || 'application/octet-stream').split(';')[0];
    if (/^text\//.test(type) || type === 'application/json') type += '; charset=UTF-8';
    var fields = '&fields=' + encodeURIComponent('id,name,webViewLink');
    if (blob.size < 4500000) {
      var b = 'untsf' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      var body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: ' + type + '\r\n\r\n', blob, '\r\n--' + b + '--\r\n']);
      return driveJson(DRIVE_UPLOAD + '?uploadType=multipart' + fields, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: body }, tok);
    }
    /* Larger files (big backups, dossiers with large portraits) go up in a resumable session. */
    var start = await driveFetch(DRIVE_UPLOAD + '?uploadType=resumable' + fields, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type }, body: JSON.stringify(meta) }, tok);
    var session = start.headers.get('Location');
    if (!session) throw new Error('Google Drive didn’t start the upload. Try again, or download it instead.');
    return driveJson(session, { method: 'PUT', headers: { 'Content-Type': type }, body: blob }, tok);
  }

  /* The "where should this go?" window shown for every export while Google Drive is set up. */
  function chooseSave(blob, filename, ext, prefer) {
    return new Promise(function (resolve, reject) {
      var conv = CONVERTS[ext], back = document.activeElement, settled = false, busy = false;
      var scrim = document.createElement('div'); scrim.className = 'gsave-scrim';
      var box = document.createElement('div'); box.className = 'plate gsave';
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'gsave-name');
      document.body.appendChild(scrim); document.body.appendChild(box);
      function close() { document.removeEventListener('keydown', onKey, true); scrim.remove(); box.remove(); if (back && back.focus) { try { back.focus(); } catch (e) { /* ignore */ } } }
      function cancel() { if (busy) return; close(); if (!settled) { settled = true; reject({ code: 'declined', message: 'Save cancelled.' }); } }
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); cancel(); } }
      document.addEventListener('keydown', onKey, true);
      scrim.addEventListener('click', cancel);
      function show(inner) {
        box.innerHTML = '<p class="kicker">' + (prefer === 'drive' ? 'Save to Google Drive' : 'Save export') + '</p><h2 class="gsave-name" id="gsave-name">' + esc(filename) + '</h2>' + inner;
        var first = box.querySelector('.btn'); if (first) first.focus();
      }
      function choose(err) {
        busy = false;
        var opts = conv
          ? '<button class="btn primary" data-g="convert">Save to Google Drive as a ' + conv[1] + '</button>'
            + '<button class="btn" data-g="drive">Save the .' + esc(ext) + ' file to Google Drive</button>'
          : '<button class="btn primary" data-g="drive">Save to Google Drive</button>';
        show((err ? '<p class="gsave-err" role="alert">' + esc(err) + '</p>' : '')
          + '<p class="gsave-note">Google Drive saves go into the <b>' + esc(DRIVE_FOLDER) + '</b> folder in your own Drive. This site can only see the files it saves there.</p>'
          + '<div class="gsave-opts">' + opts + '<button class="btn" data-g="local">Download to this device' + (prefer === 'drive' ? ' instead' : '') + '</button></div>'
          + '<div class="gsave-foot"><button class="btn ghost" data-g="cancel">Cancel</button>'
          + (drive.token ? '<button class="btn ghost" data-g="disconnect">Disconnect Google</button>' : '') + '</div>');
      }
      function toDrive(convertTo) {
        busy = true;
        show('<p aria-live="polite">Connecting to Google…</p>');
        withToken(async function (tok) {
          show('<p aria-live="polite">Saving to Google Drive…</p>');
          try {
            var f = await driveUpload(tok, blob, filename, ext, convertTo);
            busy = false;
            var what = convertTo ? 'as a ' + conv[1] : 'as ' + esc(f.name || filename);
            show('<p aria-live="polite">Saved to Google Drive ' + what + ', in the <b>' + esc(DRIVE_FOLDER) + '</b> folder.</p>'
              + '<div class="gsave-opts">' + (f.webViewLink ? '<a class="btn primary" href="' + esc(f.webViewLink) + '" target="_blank" rel="noopener">Open in Google Drive</a>' : '')
              + '<button class="btn" data-g="close">Close</button></div>');
            if (!settled) { settled = true; resolve({ status: 'saved', driveFileId: f.id, url: f.webViewLink }); }
          } catch (e) { choose(e.message); }
        }, function (e) { choose(e.message); });
      }
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-g]'); if (!b || busy) return;
        var g = b.getAttribute('data-g');
        if (g === 'convert') toDrive(conv[0]);
        else if (g === 'drive') toDrive(null);
        else if (g === 'local') { close(); saveLocal(blob, filename); if (!settled) { settled = true; resolve({ status: 'saved' }); } }
        else if (g === 'close') close();
        else if (g === 'cancel') cancel();
        else if (g === 'disconnect') {
          try { if (googleReady() && drive.token) window.google.accounts.oauth2.revoke(drive.token, function () {}); } catch (err) { /* ignore */ }
          drive.token = null; drive.expires = 0; drive.folder = null; choose();
        }
      });
      choose();
    });
  }

  var downloads = {
    /* Tells the app whether to show its "Save to Google Drive" buttons. */
    drive: !!GCLIENT,
    save: async function (req) {
      var filename = req.filename || 'download', ext = String(filename).split('.').pop().toLowerCase(), data = req.data;
      var blob = data instanceof Blob ? data : new Blob([data], { type: MIME[ext] || 'application/octet-stream' });
      if (!GCLIENT) { saveLocal(blob, filename); return { status: 'saved' }; }
      return chooseSave(blob, filename, ext, req.prefer);
    }
  };

  /* ------------------------------------------------------------ start the app once signed in */
  async function memberRow(uid) {
    for (var i = 0; i < 6; i++) {
      var r = await sb.from('members').select('*').eq('user_id', uid).maybeSingle();
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
    /* Before the Moderators migration runs, Command Authority accounts are still 'gm': treat them as Moderators with every tool. */
    var role = member.role === 'gm' ? 'mod' : member.role;
    var modTools = member.role === 'gm' ? ['sessions', 'personnel', 'catalogue'] : (member.mod_tools || []);
    window.UNTSF_ACCOUNT = {
      username: uname, email: uname, role: role, modTools: modTools, name: uname, id: user.id,
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
      listMembers: async function () { var r = await sb.from('members').select('*').order('created_at'); if (r.error) throw mapError(r.error); return r.data; },
      setRole: async function (uid, role, tools) { var r = await sb.from('members').update({ role: role, mod_tools: tools || [] }).eq('user_id', uid); if (r.error) throw mapError(r.error); },
      setModTools: async function (uid, tools) { var r = await sb.from('members').update({ mod_tools: tools }).eq('user_id', uid); if (r.error) throw mapError(r.error); },
      resetPassword: async function (uid, pass) { var r = await sb.rpc('admin_reset_password', { p_user: uid, p_password: pass }); if (r.error) throw mapError(r.error); },
      inviteRequired: async function () { var r = await sb.rpc('invite_required'); if (r.error) throw mapError(r.error); return r.data === true; },
      setInviteCode: async function (code) { var r = await sb.rpc('admin_set_invite_code', { p_code: code || null }); if (r.error) throw mapError(r.error); },
      deleteAccount: async function (uid) { var r = await sb.rpc('admin_delete_account', { p_user: uid }); if (r.error) throw mapError(r.error); }
    };
    var gm = role === 'owner' || role === 'mod';
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
