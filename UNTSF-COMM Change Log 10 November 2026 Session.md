# UNTSF-COMM Change Log: 10 November 2026 Session

Nov 10, 2026 · @Lewis Hendry

## Overview

This session added 21 lasting changes to UNTSF-COMM, plus a Google Drive feature that was built and then removed. The latest MUV-LUV-char-builder.zip holds all of them, starting from the version uploaded at the start of the session. The build number is now `9dbf80134e`.

The main additions are:

- **Command Authority tools:** issuing TSFs from the TSF Database, NPC characters, and an Applications page showing drafts and statuses.
- **Discord:** posting mission plans, map images and eishi posters, and announcing accepted personnel with a ping.
- **Players and applicants:** an eishi poster maker, a read-only TSF Directory, and fixes to the application rules (ages from 2012, minimum age 16, optional face claims, Discord username).
- **Insignia:** uploaded unit patches, used across the app and on posters.

The site now runs as a Cloudflare Worker on www.muvluv.org.uk, with a small relay at `/api/discord` for Discord posts.

**To deploy everything:**

1. Copy the zip's contents over your repository, keeping your own `site/config.js`.
2. Delete `site/drive-save.html` and `site/drive-save.js` if they exist.
3. Commit and push. Cloudflare rebuilds the site, and GitHub Actions applies the new database migration.
4. Hard-refresh the site with Ctrl + Shift + R.

## Change log

Every lasting change, numbered in the order it was made. Changes later reversed are listed under Reverted or superseded work.

| # | Change | What it does | Files |
| --- | --- | --- | --- |
| 1 | Google Docs tip | SETUP.md explains how players turn a Word export into a Google Doc (Drive's "Convert uploads" setting). | SETUP.md |
| 2 | Issue to pilots | A new tab on each TSF Database model registers a machine straight into a pilot's hangar, or issues depot stock. Works for restricted and GM-only frames; only the holder can see them. Drafts are blocked until published. | app.js |
| 3 | NPCs and player characters | Any personnel record can be an NPC, Closed or Open for takeover. A player claiming it, or being given the record's account, makes it a player character. NPC chips on profiles, the order of battle and Personnel Administration, plus a Played by filter. | app.js |
| 4 | Mission plan images | Mission plan · Discord on a saved mission draws a styled plan: zone map, objective, briefing, assigned element. Download as PNG. | app.js |
| 5 | Operations map export | Map image on the map toolbar exports the current view as a 2400 px poster with legend and zones in view. Players can download it too. | app.js |
| 6 | Discord relay | Posts to Discord through `/api/discord`, which keeps webhooks as Cloudflare secrets and only accepts Command Authority (checked with Supabase). Every post is audited. | functions/api/discord.js, bridge.js |
| 7 | Relay hardening | The service worker never caches `/api/`; error messages say whether the relay is missing or failing. | sw.js, bridge.js |
| 8 | Cloudflare Workers support | The site can run as a Worker (`*.workers.dev`): serves `site/` and runs the relay. | wrangler.jsonc, worker/index.js, .gitignore |
| 9 | Ages counted from 2012 | Age checks, "Age in 2012", service years and personnel numbers use the campaign date, but never earlier than 14 March 2012. New campaigns start on 1 January 2012. | app.js, starter.json |
| 10 | Face claims optional | IRL and anime face claims are never required; the Word template marks them optional. | app.js |
| 11 | Command Post Controller | Six "CP officer" labels renamed. | app.js |
| 12 | Minimum age 16 | Eishi can be 16 in every year (the 18-from-2005 rule is gone). | app.js |
| 13 | Eishi poster | Poster button on the Eishi File: a 1080 × 1350 poster from the record, with accent, picture, tagline, background text and a TSF picker; artwork backgrounds cut out automatically. Download, or post to Discord. | app.js |
| 14 | Webhook diagnostics | The relay accepts webhook URLs pasted with quotes, spaces or an API version, and reports which DISCORD settings it can see. | functions/api/discord.js, bridge.js |
| 15 | Acceptance announcements | Approving an enlistment opens (or, once ticked, sends) a Discord post in your acceptance format with the new eishi's poster. Approved enlistments get an Announce on Discord button. | app.js, functions/api/discord.js |
| 16 | Discord username on applications | The application asks for a Discord username (required, format-checked; can be made optional). Pings use a Discord user ID, pasted in the announcement window or set in Personnel Administration. | app.js |
| 17 | Battalion insignia on posters | Acceptance posters show the battalion insignia behind the eishi instead of a TSF; any poster can choose it. | app.js |
| 18 | Uploaded unit insignia | Units can upload an image as their insignia (transparency kept, including on Safari). Posters use the battalion patch large and the eishi's flight or squadron patch small. | app.js |
| 19 | Insignia shown everywhere | Uploaded patches appear in Command Structure, Units and Squadrons, eishi profiles and Personnel Administration. | app.js |
| 20 | Applications page | Command Authority sees drafts being written (progress, current step, last saved, next fix, read-only view) and submitted, sent-back and decided applications. Players are told drafts are visible. | app.js, bridge.js, new migration |
| 21 | TSF Directory | Applicants can browse every visible TSF and its specification, read only, from the Apply screen, the application and the waiting screen. | app.js |

Every change also bumps the build number in `site/index.html` and `site/sw.js`, so browsers and phones load the new version.

## Set-up and configuration

These are one-off settings outside the code. The ones already done this session are ticked.

**Cloudflare (the Worker named muv-luv-char-builder)**

- [x] Secret `DISCORD_WEBHOOK` added under Settings → Variables and Secrets. Not under Build, which the running site can't read.
- [ ] Secret `DISCORD_WEBHOOK_ACCEPTED` for the acceptance channel. Acceptance posts pick a channel named accepted, personnel or enlist automatically.
- [ ] Settings → Build: deploy command `npx wrangler deploy`. The `name` in `wrangler.jsonc` must match the Worker's name.
- [x] Custom domain `www.muvluv.org.uk` under Settings → Domains & Routes.
- [ ] Fix or remove `muvluv.org.uk` (without www): it showed error 525. Either add it as a second custom domain or delete its old DNS record.
- [ ] Turn off the `workers.dev` address under Domains & Routes; it contains your name.

**Discord**

- [ ] Set each webhook's avatar to the UNTSF shield (`untsf-comm-discord-avatar.png`) and name it UNTSF-COMM.
- [ ] For pings, add each player's Discord user ID in Personnel Administration, or paste it in the announcement window. Copy it with Developer Mode on: right-click their name → Copy User ID.

**Database**

- [ ] After pushing, check the GitHub Actions database workflow ran green. It applies `20261110000007_gm_reads_application_drafts.sql`, which lets the Applications page read drafts.

**In the app**

- [ ] Upload unit insignia: Unit Management → \[unit\] → Upload an insignia image → Save unit. Lantern Battalion, Kagaribi Squadron, and Flare, Ember, Wick and Spark Flights.
- [ ] Set the campaign date to your 2012 start date in Global Situation, so missions and briefing images show 2012.
- [ ] Optional: in Applications settings, untick Discord username to make it optional.
- [ ] Optional: upload TSF artwork on each model in the TSF Database, so posters can show the frame.

## Files changed

Compared with the version uploaded at the start of the session, 12 files are new or changed. Two files from the removed Google Drive feature should be deleted.

| File | Status | Holds |
| --- | --- | --- |
| `site/app.js` | Changed | Almost every feature in the change log |
| `site/bridge.js` | Changed | Discord relay access and application drafts access |
| `site/index.html` | Changed | Build number only |
| `site/sw.js` | Changed | Build number; skips `/api/` |
| `site/starter.json` | Changed | New campaigns start 1 January 2012 |
| `functions/api/discord.js` | New | The Discord relay |
| `worker/index.js` | New | Runs the site and relay as a Cloudflare Worker |
| `wrangler.jsonc` | New | Worker settings (name, assets folder, keep secrets) |
| `supabase/migrations/20261110000007_gm_reads_application_drafts.sql` | New | Lets Command Authority read application drafts only |
| `.gitignore` | Changed | Ignores Wrangler's local `.wrangler/` folder |
| `SETUP.md` | Changed | Discord set-up, Workers note, Google Docs tip, troubleshooting |
| `README.md` | Changed | Lists the relay and Worker files |
| `site/drive-save.html`, `site/drive-save.js` | Delete | Left over from the Google Drive feature |

Keep your own `site/config.js`. If it still has `googleClientId`, `googleApiKey` or `googleAppId` lines, they can be deleted; nothing reads them.

## Reverted or superseded work

These were built during the session and later removed or replaced; none of them is in the current zip.

| Work | What it was | Outcome |
| --- | --- | --- |
| Google Drive saving | Exports offered Save to Google Drive, as a Google Doc, Sheet or the original file, via Google sign-in. Then a Save to Google Drive button on character sheets, then a separate pop-up save window with rename and folder picker. Needed a Google Client ID, API key and project number. | Removed at your request. Exports download again; players convert Word files in Drive instead (change 1). |
| Discord user ID on applications | The application asked for a numeric Discord user ID, first optional, then required and checked. | Replaced by the Discord username (change 16). IDs are now added by Command Authority, only for pings. |
| Age rules: 1 January 2012 | Ages were first reckoned from 1 January 2012 when the campaign date was earlier. | Moved to 14 March 2012 to match the dossier, so ages agree everywhere (change 9). |
| Age rules: 18 from 2005 | The minimum service age was 16 before 2005 and 18 after. | Now 16 in every year (change 12). |
| Poster insignia drawn from settings | Acceptance posters first used the battalion's designed insignia (shape, colour, emblem). | Uploaded patch images now take priority (change 18). |

The relay was first written only for Cloudflare Pages (the `functions` folder). It wasn't running because the site is a Worker, so change 8 added the Worker entry point; both forms are kept.

## Outputs made this session

Besides the code, these files were made for you to keep or upload.

| File | What it is | Where it goes |
| --- | --- | --- |
| MUV-LUV-char-builder.zip | The full project with every change above | Your repository |
| untsf-comm-discord-avatar.png | UNTSF shield, 512 × 512, safe for Discord's circle crop | Each Discord webhook's avatar |
| 1-lantern-battalion.png | 77th Tactical Evaluation Battalion "Lantern" patch, cut out | Unit Management: Lantern Battalion |
| 1-kagaribi-squadron.png | New Kagaribi Squadron roundel: watch-fire brazier, 篝火, four embers, motto VIGILAMUS | Unit Management: Kagaribi Squadron |
| 2-flare-flight.png to 5-spark-flight.png | The four Kagaribi flight tabs, cut out | Unit Management: each flight |
| 1-yokohama-base.png | New Yokohama Base emblem (UN 11th Force, hive monument, cherry branch, H22 · 1999). No official one was found. | Discord, briefings, lore; the app has no zone emblems yet |
| yokohama-training-flights.json | Two training missions at Yokohama Base, in Planning, dated 9 and 12 January 2012 | System Administration → Restore from backup |
| sample-mission-plan.png, sample-operations-map.png, poster test images | Test renders made with placeholder data | Reference only |

Possible next steps raised but not built: emblems for map zones (so Yokohama Base's shows on the map and mission plans), a "make this a full NPC record" button for name-only posts, and a database-level lock on closed NPCs.
