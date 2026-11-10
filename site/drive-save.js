/* =====================================================================
   UNTSF-COMM — the Google Drive save window.
   bridge.js opens this page from an export and sends it the file. Here the player names the file, chooses
   Google Doc / Sheet or the original file, picks a folder in their own Drive, and signs in to their own Google
   account. Nothing is stored on the site: the Google access goes back to the main page's memory so the next
   save doesn't ask again, and the chosen folder is remembered in this browser only.
   ===================================================================== */
(function () {
  'use strict';
  var cfg = window.UNTSF_CONFIG || {};
  var CLIENT = String(cfg.googleClientId || '').trim();
  var API_KEY = String(cfg.googleApiKey || '').trim(), APP_ID = String(cfg.googleAppId || '').trim();
  var DEFAULT_FOLDER = String(cfg.googleDriveFolder || 'UNTSF-COMM').trim() || 'UNTSF-COMM';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var API = 'https://www.googleapis.com/drive/v3/files', UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  var FOLDER_TYPE = 'application/vnd.google-apps.folder', GDOC = 'application/vnd.google-apps.document', GSHEET = 'application/vnd.google-apps.spreadsheet';
  var CONVERTS = {
    docx: { to: GDOC, as: 'Google Doc', asNote: 'Opens and edits straight away in Google Docs. Layout can shift a little in conversion.', orig: 'Word file (.docx)', origNote: 'Kept exactly as exported. Drive previews it, and Docs can open it.' },
    html: { to: GDOC, as: 'Google Doc', asNote: 'Opens and edits in Google Docs.', orig: 'Web page (.html)', origNote: 'Kept exactly as exported.' },
    txt: { to: GDOC, as: 'Google Doc', asNote: 'Opens and edits in Google Docs.', orig: 'Text file (.txt)', origNote: 'Kept exactly as exported.' },
    csv: { to: GSHEET, as: 'Google Sheet', asNote: 'Opens and edits straight away in Google Sheets.', orig: 'CSV file (.csv)', origNote: 'Kept exactly as exported.' }
  };
  var KIND = { docx: 'Word document', html: 'Document', csv: 'Spreadsheet (CSV)', json: 'Data file (JSON)', png: 'Image (PNG)', pdf: 'PDF', txt: 'Text', md: 'Markdown', svg: 'Image (SVG)', zip: 'Zip archive' };
  var MIME = { csv: 'text/csv', json: 'application/json', html: 'text/html', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf', png: 'image/png', svg: 'image/svg+xml', zip: 'application/zip' };
  var FOLDER_KEY = 'untsf.drive.folder';
  var SID = (location.search.match(/[?&]s=([a-z0-9]+)/) || [])[1] || '';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var st = { file: null, token: null, expires: 0, defaultFolderId: null, folder: readFolder(), busy: false, finished: false, client: null, pending: null, pickerReady: null };

  function readFolder() { try { var f = JSON.parse(localStorage.getItem(FOLDER_KEY) || 'null'); return f && f.id ? f : null; } catch (e) { return null; } }
  function keepFolder() { try { if (st.folder) localStorage.setItem(FOLDER_KEY, JSON.stringify(st.folder)); else localStorage.removeItem(FOLDER_KEY); } catch (e) { /* ignore */ } }
  function tell(msg) { msg.sid = SID; try { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, location.origin); } catch (e) { /* ignore */ } }
  function show(id) { ['wait', 'form', 'done', 'alone'].forEach(function (x) { $(x).hidden = x !== id; }); }
  function sizeText(n) { return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  function load(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = ok; s.onerror = function () { no(new Error('Couldn’t reach Google. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
  }

  /* ------------------------------------------------------------ the file arrives from the main page */
  if (!window.opener || !CLIENT || !SID) {
    show('alone');
    if (!CLIENT) $('alone').querySelector('p').textContent = 'Google Drive isn’t set up on this site yet: the Google Client ID is missing from config.js.';
    $('close-alone').onclick = function () { window.close(); };
    return;
  }
  var gsi = load('https://accounts.google.com/gsi/client');
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || e.source !== window.opener) return;
    var m = e.data || {};
    if (m.type !== 'untsf-drive-file' || m.sid !== SID || !m.blob) return;
    if (m.theme) document.documentElement.setAttribute('data-theme', m.theme);
    if (m.token && Number(m.expires) > Date.now()) { st.token = m.token; st.expires = Number(m.expires); }
    st.file = { blob: m.blob, filename: String(m.filename || 'export'), ext: String(m.ext || '').toLowerCase() };
    st.finished = false; st.busy = false;
    fill();
  });
  tell({ type: 'untsf-drive-ready' });
  /* Leaving without saving tells the main page it was cancelled. */
  window.addEventListener('pagehide', function () { if (!st.finished) tell({ type: 'untsf-drive-cancel' }); });
  setTimeout(function () { if (!st.file) $('wait-text').textContent = 'Still waiting for the file. If nothing happens, close this window and try the export again.'; }, 45000);

  /* ------------------------------------------------------------ the form */
  function conv() { return CONVERTS[st.file.ext] || null; }
  function converting() { var c = conv(); return !!(c && document.querySelector('input[name=fmt]:checked').value === 'convert'); }
  function baseName(n) { return n.replace(/\.[a-z0-9]{1,5}$/i, ''); }
  function fill() {
    var f = st.file, c = conv();
    document.title = 'Save ' + f.filename + ' · UNTSF-COMM';
    $('kind').textContent = KIND[f.ext] || (f.ext ? f.ext.toUpperCase() + ' file' : 'File');
    $('size').textContent = sizeText(f.blob.size || 0);
    $('name').value = baseName(f.filename);
    $('formats').hidden = !c;
    if (c) {
      $('fmt-convert').textContent = c.as; $('fmt-convert-note').textContent = c.asNote;
      $('fmt-original').textContent = c.orig; $('fmt-original-note').textContent = c.origNote;
      document.querySelector('input[name=fmt][value=convert]').checked = true;
    }
    $('error').hidden = true;
    paint();
    show('form');
    $('name').focus(); $('name').select();
  }
  function paint() {
    var c = conv();
    $('ext').textContent = converting() ? c.as : (st.file.ext ? '.' + st.file.ext : '');
    $('folder').innerHTML = st.folder ? esc(st.folder.name) + '<small>Your choice, remembered on this device</small>'
      : 'My Drive › ' + esc(DEFAULT_FOLDER) + '<small>Default folder, made the first time you save</small>';
    var canPick = !!(API_KEY && APP_ID);
    $('pick').hidden = !canPick; $('unpick').hidden = !(canPick && st.folder);
    var live = st.token && Date.now() < st.expires;
    $('account').innerHTML = live ? 'Connected to Google Drive' : 'Not connected yet<small>Google asks you to sign in and allow access when you save</small>';
    $('switch').hidden = !live;
    ['save', 'local', 'cancel', 'pick', 'unpick', 'switch', 'name'].forEach(function (id) { $(id).disabled = st.busy; });
    document.querySelectorAll('input[name=fmt]').forEach(function (x) { x.disabled = st.busy; });
    $('save').textContent = st.busy ? st.busy : 'Save to Google Drive';
  }
  function fail(msg) { st.busy = false; paint(); var e = $('error'); e.textContent = msg; e.hidden = false; }
  function busy(text) { st.busy = text; $('error').hidden = true; paint(); }

  /* ------------------------------------------------------------ Google sign-in (runs straight from a click) */
  function withToken(done, opts) {
    opts = opts || {};
    if (!opts.prompt && st.token && Date.now() < st.expires) { done(st.token); return; }
    var oauth = window.google && window.google.accounts && window.google.accounts.oauth2;
    if (!oauth) { fail('Google sign-in is still loading. Wait a moment, then try again.'); gsi.then(paint, function (e) { fail(e.message); }); return; }
    if (!st.client) {
      st.client = oauth.initTokenClient({
        client_id: CLIENT, scope: SCOPE,
        callback: function (r) {
          var p = st.pending; st.pending = null; if (!p) return;
          if (!r || r.error) { fail((r && r.error_description) || 'Google didn’t give access to Drive.'); return; }
          if (!oauth.hasGrantedAllScopes(r, SCOPE)) { fail('Google Drive access wasn’t allowed. Try again, and tick Google Drive when Google asks.'); return; }
          st.token = r.access_token; st.expires = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
          tell({ type: 'untsf-drive-token', token: st.token, expires: st.expires });
          paint(); p(st.token);
        },
        error_callback: function (e) {
          var p = st.pending; st.pending = null; if (!p) return;
          var t = e && e.type;
          fail(t === 'popup_closed' ? 'The Google sign-in window was closed before access was given.'
            : t === 'popup_failed_to_open' ? 'The browser blocked Google’s sign-in window. Allow pop-ups for this site, then try again.'
            : 'Google sign-in didn’t finish. Try again.');
        }
      });
    }
    st.pending = done;
    st.client.requestAccessToken(opts.prompt ? { prompt: opts.prompt } : {});
  }

  /* ------------------------------------------------------------ Drive */
  async function api(url, opts, tok) {
    opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + tok }, opts.headers || {});
    var r;
    try { r = await fetch(url, opts); } catch (e) { throw new Error('Couldn’t reach Google Drive. Check your connection.'); }
    if (r.ok) return r;
    var msg = ''; try { var j = await r.json(); msg = (j && j.error && j.error.message) || ''; } catch (e) { /* ignore */ }
    var err;
    if (r.status === 401) { st.token = null; st.expires = 0; err = new Error('Your Google sign-in has expired. Save again to reconnect.'); }
    else if (r.status === 403 && /has not been used|is disabled/i.test(msg)) err = new Error('The Google Drive API isn’t switched on for this site yet. Ask Command Authority to enable it (SETUP.md, Google Drive).');
    else if (r.status === 403 && /storage quota|quota has been exceeded/i.test(msg)) err = new Error('Your Google Drive is full.');
    else err = new Error(msg || 'Google Drive said no (' + r.status + ').');
    err.status = r.status; throw err;
  }
  async function json(url, opts, tok) { return (await api(url, opts, tok)).json(); }
  async function defaultFolder(tok) {
    if (st.defaultFolderId) return st.defaultFolderId;
    var q = "mimeType='" + FOLDER_TYPE + "' and name='" + DEFAULT_FOLDER.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "' and trashed=false";
    var found = await json(API + '?spaces=drive&pageSize=1&fields=files(id)&q=' + encodeURIComponent(q), {}, tok);
    if (found.files && found.files.length) return (st.defaultFolderId = found.files[0].id);
    var made = await json(API + '?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ name: DEFAULT_FOLDER, mimeType: FOLDER_TYPE }) }, tok);
    return (st.defaultFolderId = made.id);
  }
  async function upload(tok, meta, blob, ext) {
    var type = (blob.type || MIME[ext] || 'application/octet-stream').split(';')[0];
    if (/^text\//.test(type) || type === 'application/json') type += '; charset=UTF-8';
    var q = '&supportsAllDrives=true&fields=' + encodeURIComponent('id,name,webViewLink');
    if (blob.size < 4500000) {
      var b = 'untsf' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      var body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: ' + type + '\r\n\r\n', blob, '\r\n--' + b + '--\r\n']);
      return json(UPLOAD + '?uploadType=multipart' + q, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: body }, tok);
    }
    /* Bigger files (large backups, dossiers with big portraits) go up in a resumable session. */
    var start = await api(UPLOAD + '?uploadType=resumable' + q, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type }, body: JSON.stringify(meta) }, tok);
    var session = start.headers.get('Location');
    if (!session) throw new Error('Google Drive didn’t start the upload. Try again, or download it instead.');
    return json(session, { method: 'PUT', headers: { 'Content-Type': type }, body: blob }, tok);
  }

  /* ------------------------------------------------------------ choosing a folder with Google's own picker */
  function pickerLib() {
    if (!st.pickerReady) {
      st.pickerReady = load('https://apis.google.com/js/api.js').then(function () {
        return new Promise(function (ok, no) { window.gapi.load('picker', { callback: ok, onerror: function () { no(new Error('Google’s folder picker didn’t load. Try again.')); } }); });
      });
      st.pickerReady.catch(function () { st.pickerReady = null; });
    }
    return st.pickerReady;
  }
  function choose(tok) {
    busy('Opening your Drive…');
    pickerLib().then(function () {
      st.busy = false; paint();
      var P = window.google.picker;
      var mine = new P.DocsView(P.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER_TYPE).setParent('root');
      var shared = new P.DocsView(P.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER_TYPE).setEnableDrives(true);
      new P.PickerBuilder()
        .setTitle('Choose where to save ' + ($('name').value.trim() || st.file.filename))
        .addView(mine).addView(shared).enableFeature(P.Feature.SUPPORT_DRIVES)
        .setOAuthToken(tok).setDeveloperKey(API_KEY).setAppId(APP_ID).setOrigin(location.origin)
        .setSize(Math.max(566, Math.min(1051, window.innerWidth - 24)), Math.max(350, Math.min(650, window.innerHeight - 24)))
        .setCallback(function (data) {
          if (data[P.Response.ACTION] !== P.Action.PICKED) return;
          var d = (data[P.Response.DOCUMENTS] || [])[0]; if (!d) return;
          st.folder = { id: d[P.Document.ID], name: d[P.Document.NAME] || 'Chosen folder' }; keepFolder(); paint();
        })
        .build().setVisible(true);
    }, function (e) { fail(e.message); });
  }

  /* ------------------------------------------------------------ buttons */
  document.querySelectorAll('input[name=fmt]').forEach(function (x) { x.addEventListener('change', paint); });
  $('name').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('save').click(); } });
  $('pick').onclick = function () { if (!st.busy) withToken(choose); };
  $('unpick').onclick = function () { st.folder = null; keepFolder(); paint(); };
  $('switch').onclick = function () {
    if (st.busy) return;
    st.defaultFolderId = null;
    withToken(function () { paint(); }, { prompt: 'select_account' });
  };
  $('save').onclick = function () {
    if (st.busy || !st.file) return;
    var name = $('name').value.replace(/[\u0000-\u001f]/g, '').trim();
    if (!name) { fail('Give the file a name.'); $('name').focus(); return; }
    withToken(async function (tok) {
      busy('Saving…');
      var c = conv(), toDoc = converting(), f = st.file;
      try {
        var parent = st.folder ? st.folder.id : await defaultFolder(tok);
        var meta = { name: toDoc ? name : name + (f.ext ? '.' + f.ext : ''), parents: [parent] };
        if (toDoc) meta.mimeType = c.to;
        var saved = await upload(tok, meta, f.blob, f.ext);
        st.busy = false; st.finished = true;
        tell({ type: 'untsf-drive-done', id: saved.id, url: saved.webViewLink, name: saved.name });
        $('done-where').innerHTML = '<b>' + esc(saved.name || meta.name) + '</b>' + (toDoc ? ' (' + esc(c.as) + ')' : '') + ' is in <b>' + esc(st.folder ? st.folder.name : 'My Drive › ' + DEFAULT_FOLDER) + '</b>.';
        if (saved.webViewLink) { $('open').href = saved.webViewLink; $('open').hidden = false; } else $('open').hidden = true;
        show('done'); ($('open').hidden ? $('close') : $('open')).focus();
      } catch (e) {
        if (st.folder && (e.status === 404 || e.status === 403) && !/full|switched on/.test(e.message)) {
          st.folder = null; keepFolder();
          fail('The chosen folder isn’t available on this Google account. Choose it again, or save to the default folder.');
        } else fail(e.message);
      }
    });
  };
  $('local').onclick = function () { if (st.busy) return; st.finished = true; tell({ type: 'untsf-drive-local' }); window.close(); };
  $('cancel').onclick = function () { if (st.busy) return; st.finished = true; tell({ type: 'untsf-drive-cancel' }); window.close(); };
  $('close').onclick = function () { window.close(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !st.busy && !$('form').hidden && !document.querySelector('.picker-dialog')) $('cancel').click(); });
})();
