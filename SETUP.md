# Setting up UNTSF-COMM on GitHub and Supabase

About an hour, start to finish. Nothing here costs money. You'll end up with:

- **The site** on Cloudflare Pages, at an address you choose, such as `https://untsf-comm.pages.dev`. Nothing in it points to you or your GitHub account.
- **The code** in a **private** GitHub repository that only you can see.
- **The database, accounts and images** on Supabase.
- **Automation:** Cloudflare publishes the site on every push, and GitHub sets up the database and keeps it awake.

Keep a password manager or a notes app open: you'll collect a few values along the way.

---

## Part 1: Supabase (about 10 minutes)

1. Go to **supabase.com** and sign up (GitHub or email).
2. Click **New project**:
   - **Name:** `untsf-comm`
   - **Database password:** click *Generate*, then **save it**. You need it in Part 3.
   - **Region:** West EU (London)
   - Leave **"Automatically expose new tables"** unticked. The set-up grants exactly what's needed.
3. Wait a couple of minutes while it starts.
4. Open **Settings → API Keys** (or the **Connect** button at the top) and save two values:
   - **Project URL**, like `https://abcdefghijkl.supabase.co`. The part before `.supabase.co` is your **project reference**.
   - **Publishable key**, starting `sb_publishable_`.

   These two are safe to put in a public website. **Never** put the *secret* key (`sb_secret_…`) or the database password anywhere in the repository.
5. Open **Authentication → Sign In / Providers → Email** and switch **Confirm email** off, then click **Save**. **This is required.** If it's left on, sign-up fails with *"Email address … is invalid"*.
   UNTSF-COMM uses **usernames, not email addresses**. No email is ever collected, stored or sent. Leave the Email provider itself switched on: Supabase uses it behind the scenes for username sign-in.
6. Create a **personal access token**: click your avatar → **Account preferences → Access Tokens → Generate new token**. Name it `github-untsf`, and save the value. It's shown once.

## Part 2: The repository (about 10 minutes)

1. Create a **GitHub** account if you don't have one, and install **GitHub Desktop** (desktop.github.com). Sign in to GitHub inside it.
2. In GitHub Desktop: **File → New repository**, name it `untsf-comm`, choose where to keep it, and click **Create repository**.
3. Unzip this package and copy **everything inside it** into that folder, including the hidden `.github` folder. (Windows: *View → Hidden items* in Explorer. Mac: **Cmd + Shift + .** in Finder.)
4. `site/config.js` is already filled in with your Supabase project. Leave it as it is.
5. Type a summary such as `First version`, then click **Commit to main**.
6. Click **Publish repository** and **leave "Keep this code private" ticked.** Nobody else can see the repository.

## Part 3: Connect GitHub to Supabase (about 5 minutes)

On **github.com**, open your `untsf-comm` repository, then **Settings → Secrets and variables → Actions → New repository secret**. Add three:

| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | the personal access token (Part 1, step 6) |
| `SUPABASE_DB_PASSWORD` | the database password (Part 1, step 2) |
| `SUPABASE_PROJECT_ID` | `jymixxlpueosbnccwgci` |

Then open the **Actions** tab, choose **Set up database → Run workflow → Run workflow**, and wait for the green tick. If it goes red, copy the error from the red step; the troubleshooting section covers the usual causes.

## Part 4: Put the site online with Cloudflare Pages (about 10 minutes)

1. Sign up at **cloudflare.com** (free plan).
2. In the dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
3. Connect your GitHub account. When GitHub asks which repositories Cloudflare may see, choose **Only select repositories → untsf-comm**.
4. Select `untsf-comm`, then **Begin setup**:
   - **Project name:** this becomes your address, e.g. `untsf-comm` gives `untsf-comm.pages.dev`. Pick something that isn't your name or GitHub username. If it's taken, Cloudflare adds a few characters.
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** leave empty
   - **Build output directory:** `site`
5. Click **Save and Deploy**. After a minute or so, your address is shown, e.g. `https://untsf-comm.pages.dev`.
6. From now on, **every push from GitHub Desktop publishes automatically.**

The site sends no-index headers, so search engines leave it alone, and it doesn't pass its address on to other sites. Nothing on it mentions GitHub or you.

*If you'd ever used GitHub Pages for this:* repository **Settings → Pages**, and unpublish or set Source to **None**.

## Part 5: Your campaign (about 10 minutes)

1. **Before anyone else:** open your site, choose **Create an account**, and pick a **username** and **password**. **The first account becomes Administrator and Command Authority.**
   *Already made an account with your email before this change?* In Supabase go to **Authentication → Users**, delete it, then sign up again here with a username. You'll be Administrator again.
2. You'll see **Set up your campaign**. Choose one:
   - **Bring your campaign across.** In the claude.ai version, open **System Administration → Download backup**, then come back here and choose **Import a backup (.json)**. Everything comes across except uploaded images (portraits, TSF artwork), which you or your players upload again.
   - **Start fresh** loads the TSF and equipment catalogue, rules, nations and the 2012 situation map, with no characters or units.
3. The campaign opens. Set the campaign date (Global Situation), build your Command Structure, and check Access Control and Applications settings.

## Part 6: Test before inviting anyone (about 15 minutes)

Use a **private/incognito window** for the second account.

- [ ] Create a second account with a username. It lands on **Apply for service** and sees only its application and notifications.
- [ ] Fill in a few sections, click **Save and exit**, sign out, sign back in. The draft is still there.
- [ ] Upload a portrait on the Insignia & portrait step. It shows on the review.
- [ ] Roll attributes, choose a posting if you've opened slots, and submit.
- [ ] As yourself: the application appears in the **Approval Centre** without refreshing. Approve it.
- [ ] As the player: the new eishi appears on the sign-in screen; their dashboard shows their story, TSF and flight.
- [ ] As the player: open the Eishi File and export the **Personnel record**. A Word file downloads with their portrait.
- [ ] As yourself: change something small (e.g. a situation report). It appears on the player's screen within a few seconds.
- [ ] Open the campaign map, zoom into Japan and the Channel, and check it reads cleanly.
- [ ] On your phone: open the site, sign in, and add it to your home screen (see *Phones* below). It opens full-screen with the bottom bar.
- [ ] As yourself: **System Administration → Accounts** lists both usernames. Reset the test account's password, and sign in with the temporary one.

## Part 7: Invite players

**First, turn on the invite code:** System Administration → Accounts → **Turn on with a new code**. Strangers who find the address then can't create accounts. Send each player the **site address** and the **invite code** privately. They create an account with a username and the code, apply, and you approve them in the Approval Centre. Change the code whenever you like; existing accounts aren't affected.

**Your Accounts panel** (System Administration → Accounts, Administrator only):
- **Forgotten passwords:** click **Reset password**. A temporary password is shown once; send it to the player privately. It signs them out everywhere, and they can choose their own from their menu (**Change password**).
- **Making another GM:** change their role to **Command Authority**. It applies at their next sign-in.
- **Removing someone:** **Delete account** removes their sign-in entirely. Their characters stay in the campaign until you archive them.

**Want sign-ups closed to strangers?** Supabase → **Authentication → Sign In / Providers** → switch off **Allow new users to sign up**. Then create each player's account yourself under **Authentication → Users → Add user → Create new user**:
- **Email:** `theirusername@jymixxlpueosbnccwgci.supabase.co`, i.e. their username @ your project's address. This is the internal sign-in name, not a real inbox.
- **Password:** a temporary one.
- Tick **Auto confirm user**.

Tell them their username and temporary password.

---

## Opening exports in Google Docs

**Export as Word** on a character sheet makes a `.docx` file, which Google Docs opens directly. To turn exports into Google Docs automatically, each player does this once in Google Drive: **Settings (the cog) → General → Convert uploads → Convert uploaded files to Google Docs editor format**. After that, dragging an exported `.docx` into Drive makes it an editable Google Doc. Without the setting, open the file in Drive and choose **File → Save as Google Docs**. CSV exports convert to Google Sheets the same way.

## Optional: post mission plans and maps to Discord (about 10 minutes)

Command Authority can post a styled **mission plan** (open a mission from the Command Centre, then **Mission plan · Discord**) or the **operations map** (**Map image** on the map's toolbar) straight to a Discord channel. Anyone can download either image as a PNG without this set-up; players can save the map from the Missions page.

Discord doesn't accept posts straight from a web page, so the site uses a small relay, `functions/api/discord.js`, which Cloudflare runs alongside the site automatically. The relay holds the Discord webhook as an encrypted Cloudflare secret, so it's never in the code, the database or anyone's browser, and it checks with Supabase that whoever is posting is Command Authority.

**Pages or Workers?** If your site's Cloudflare address ends in `.pages.dev`, Cloudflare runs the relay from the `functions` folder. If it ends in `.workers.dev`, it runs it from `worker/index.js`, set up by `wrangler.jsonc` (the `name` there must match your Worker's name in Cloudflare). Both are in the repository; nothing to choose. On Workers, secrets live under **your Worker → Settings → Variables and Secrets**, and custom domains under **Settings → Domains & Routes**.

1. **Make the webhook in Discord.** You need *Manage Webhooks* on the server. Open **Server Settings → Integrations → Webhooks → New Webhook**, choose the channel, name it `UNTSF-COMM` (add an avatar if you like), and click **Copy Webhook URL**.
2. **Give it to Cloudflare.** In the Cloudflare dashboard open **Workers & Pages → your project → Settings → Variables and Secrets → Add**:
   - **Type:** Secret
   - **Variable name:** `DISCORD_WEBHOOK`
   - **Value:** the webhook URL
   - Click **Save**.

   For more channels, add more secrets named `DISCORD_WEBHOOK_` plus a name, e.g. `DISCORD_WEBHOOK_BRIEFINGS`. The site then offers a channel list (*default*, *briefings*, and so on).
3. **Redeploy.** Secrets apply from the next deployment: push any change, or open **Deployments**, then on the latest one **⋯ → Retry deployment**.
4. **Test it:** open a mission in the Command Centre, click **Mission plan · Discord**, check the preview, and click **Post to Discord**.

**Acceptance announcements.** When you approve an enlistment, the app offers to announce it on Discord with the new eishi's poster, pinging them if their record has a **Discord user ID** (players can add it on the application; you can add it in Personnel Administration). Make a webhook for your accepted channel and add it as `DISCORD_WEBHOOK_ACCEPTED`: the announcement picks a channel named *accepted* (or *personnel*/*enlist*) by itself. Tick **Post future acceptances automatically** once, and later approvals go straight out.

**Operation updates.** Make a webhook for your operations channel and add it as `DISCORD_WEBHOOK_OPERATIONS`. When Command Authority posts a situation report (Global Situation → **Situation reports**), the app offers to send it to Discord with the operations map as it's shown, unless **Share on Discord with the map** beside **Post** is unticked. Map posts, including **Map image** on the map's toolbar, go to a channel named *operations* (or *ops*/*sitrep*/*map*) by themselves; pick another once and the app remembers it. Reports above Open clearance carry a warning, because everyone in the Discord channel will see them.

Treat the webhook URL like a password: anyone who has it can post to that channel. If it leaks, delete the webhook in Discord and make a new one. Every post is recorded in Audit Records.

## Phones

UNTSF-COMM works in any phone browser, with a bottom bar for the main screens and **More** for the full menu. To install it like an app:
- **iPhone (Safari):** tap **Share → Add to Home Screen → Add**.
- **Android (Chrome):** tap **⋮ → Add to Home screen** (or **Install app**), then **Install**.

It then opens full-screen from its own icon, and keeps itself up to date.

## Updating later

When you get new files: copy them into the folder, then in GitHub Desktop click **Commit to main** and **Push origin**. Cloudflare publishes the site within a couple of minutes, and database changes apply automatically. Phones pick up the new version the next time it's opened.

Keep your `site/config.js`. It's the only file with your own values in it.

## Backups

The free plan has no automatic backups. Every few sessions, download one from **System Administration → Download backup** and keep it somewhere safe (not in the repository). Supabase Pro ($25/month) adds daily backups and removes the inactivity pause.

## Troubleshooting

| You see | Do this |
|---|---|
| **"Almost there"** on the site | `site/config.js` still has the placeholder values. Fill it in, commit and push. |
| Cloudflare shows a blank page or 404 | **Build output directory** must be `site` (Workers & Pages → your project → Settings → Build). Then **Retry deployment**. |
| Cloudflare can't see the repository | GitHub → **Settings → Applications → Cloudflare Workers and Pages → Configure**, and add `untsf-comm`. |
| **Set up database** is red: *Secrets missing* | Add the three secrets (Part 3), then *Run workflow* again. |
| **Set up database** is red: *password authentication failed* | `SUPABASE_DB_PASSWORD` is wrong. Reset it in Supabase (*Settings → Database → Reset database password*), update the secret, run again. |
| **"Your account isn't set up in the database yet"** at sign-in | The database workflow hasn't run successfully. Run **Set up database**. |
| **"Email address … is invalid"** when creating an account | **Confirm email** is still on: Supabase is trying to send a confirmation. Switch it off (Part 1, step 5), click **Save**, and try again. |
| **"The account was created but needs confirming"** | **Confirm email** is still on. Switch it off (Part 1, step 5). Then in Authentication → Users, delete the stuck account and sign up again. |
| A player forgot their password | System Administration → Accounts → **Reset password**. |
| **"Project paused"** in Supabase | The keep-awake job was switched off (GitHub does this after 60 days without commits). Resume the project in Supabase, then *Actions → Keep database awake → Enable workflow*. |
| The site shows an old version | Hard-refresh: **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac). On a phone, close the app fully and reopen it. |
| A stranger made an account | Delete it in **Accounts**, then turn on (or change) the **invite code**. |
| *"The Discord relay isn't deployed on this site yet"* | The `functions` folder must be at the top of the repository, next to `site`. After pushing, Cloudflare's deployment shows **Functions** with `/api/discord`. |
| *"No Discord webhook is set up yet"* | The secret must be named exactly `DISCORD_WEBHOOK` (or `DISCORD_WEBHOOK_…`), and it applies from the next deployment: **Retry deployment**. |
| *"Discord refused the post (404)"* | The webhook was deleted in Discord. Make a new one and replace the secret. |

## Privacy

UNTSF-COMM collects **no personal data**:
- **Accounts are a username and a password,** stored as a bcrypt hash by Supabase.
- **Each username becomes an internal sign-in name** on your own Supabase project's domain, e.g. `kestrel@jymixxlpueosbnccwgci.supabase.co`. It's not an inbox, it belongs to nobody else, and with Confirm email off nothing is ever sent to it.
- **No real email address, name or contact detail** is asked for or stored anywhere.
- **Characters are fiction,** and portraits are whatever players choose to upload.

**The platforms keep routine logs.** Supabase and GitHub keep short-lived access logs (IP addresses and browser type) for security, as any website host does. The app never reads or stores them.

## What the database enforces

- Only signed-in members can read anything; logged-out visitors see nothing.
- Only Command Authority can change the catalogue, rules, settings, map, units and command structure.
- **GM notes** are visible to Command Authority only.
- Each person's **draft application** and private settings are theirs alone.
- Only the Administrator changes roles, and nobody can promote themselves.
- Images: members upload; only the uploader or Command Authority can delete.
- With the invite code on, new accounts need the current code. It's stored only as a one-way hash, in a part of the database the site can't read.

**What it doesn't yet enforce:** any signed-in member can technically read the rest of the campaign records through their browser's developer tools, including intel above their clearance, and could edit other players' records. The app hides and blocks these normally; a determined, technically minded player could get round it. If your group needs that sealed tight, the full Supabase edition (server-enforced clearance, private journals, server-side dice) is the next step.
