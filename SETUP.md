# Setting up UNTSF-COMM on GitHub and Supabase

About an hour, start to finish. Nothing here costs money. You'll end up with:

- **The site** on GitHub Pages: `https://YOUR-USERNAME.github.io/untsf-comm/`
- **The database, accounts and images** on Supabase
- **Automation** that publishes the site, sets up the database and keeps it awake

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
5. Open **Authentication → Sign In / Providers → Email** and switch **Confirm email** off, then save.
   Supabase's built-in email sending is heavily rate-limited, so confirmation emails get stuck when several people sign up at once. You can switch it back on after adding your own email service (Authentication → Emails → SMTP).
6. Create a **personal access token**: click your avatar → **Account preferences → Access Tokens → Generate new token**. Name it `github-untsf`, and save the value. It's shown once.

## Part 2: The repository (about 15 minutes)

1. Create a **GitHub** account if you don't have one, and install **GitHub Desktop** (desktop.github.com). Sign in to GitHub inside it.
2. In GitHub Desktop: **File → New repository**
   - **Name:** `untsf-comm`
   - **Local path:** anywhere you like, e.g. Documents
   - Click **Create repository**.
3. Unzip this package and copy **everything inside it** into that new folder: `site`, `supabase`, `.github`, `README.md`, `SETUP.md` and `.gitignore`.
   Folders starting with a dot are hidden by default. On Windows, tick *View → Hidden items* in Explorer; on a Mac, press **Cmd + Shift + .** in Finder. Make sure `.github` is copied.
4. Open **`site/config.js`** in any text editor (Notepad is fine) and put in your two values from Part 1, step 4:

   ```js
   window.UNTSF_CONFIG = {
     supabaseUrl: 'https://abcdefghijkl.supabase.co',
     publishableKey: 'sb_publishable_…'
   };
   ```

   Save the file.
5. In GitHub Desktop, type a summary such as `First version` and click **Commit to main**.
6. Click **Publish repository**. **Untick "Keep this code private"**: free GitHub Pages needs a public repository. Your campaign data never goes into the repository; it lives in Supabase behind sign-in.

## Part 3: Connect GitHub to Supabase (about 5 minutes)

On **github.com**, open your `untsf-comm` repository.

1. **Settings → Secrets and variables → Actions → New repository secret.** Add three:

   | Name | Value |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | the personal access token (Part 1, step 6) |
   | `SUPABASE_DB_PASSWORD` | the database password (Part 1, step 2) |
   | `SUPABASE_PROJECT_ID` | the project reference (Part 1, step 4) |

2. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.

## Part 4: Go live (about 5 minutes)

1. Open the **Actions** tab. The first push ran before the secrets existed, so start both workflows by hand:
   - **Set up database** → **Run workflow** → **Run workflow**
   - **Publish site** → **Run workflow** → **Run workflow**
2. Wait for **two green ticks** (a minute or two each). If one goes red, open it, click the red step, and copy the error text. The troubleshooting section below covers the usual causes.
3. Your site's address is shown on the **Publish site** run, and under **Settings → Pages**: `https://YOUR-USERNAME.github.io/untsf-comm/`.
4. Back in Supabase, go to **Authentication → URL Configuration**:
   - **Site URL:** your site's address
   - **Redirect URLs:** add the same address
   - Save. Password-reset links now come back to your site.

## Part 5: Your campaign (about 10 minutes)

1. **Before anyone else:** open your site, choose **Create an account**, and sign up. **The first account becomes Administrator and Command Authority.**
2. You'll see **Set up your campaign**. Choose one:
   - **Bring your campaign across.** In the claude.ai version, open **System Administration → Download backup**, then come back here and choose **Import a backup (.json)**. Everything comes across except uploaded images (portraits, TSF artwork), which you or your players upload again.
   - **Start fresh** loads the TSF and equipment catalogue, rules, nations and the 2012 situation map, with no characters or units.
3. The campaign opens. Set the campaign date (Global Situation), build your Command Structure, and check Access Control and Applications settings.

## Part 6: Test before inviting anyone (about 15 minutes)

Use a **private/incognito window** for the second account.

- [ ] Create a second account. It lands on **Apply for service** and sees only its application and notifications.
- [ ] Fill in a few sections, click **Save and exit**, sign out, sign back in. The draft is still there.
- [ ] Upload a portrait on the Insignia & portrait step. It shows on the review.
- [ ] Roll attributes, choose a posting if you've opened slots, and submit.
- [ ] As yourself: the application appears in the **Approval Centre** without refreshing. Approve it.
- [ ] As the player: the new eishi appears on the sign-in screen; their dashboard shows their story, TSF and flight.
- [ ] As the player: open the Eishi File and export the **Personnel record**. A Word file downloads with their portrait.
- [ ] As yourself: change something small (e.g. a situation report). It appears on the player's screen within a few seconds.
- [ ] Open the campaign map, zoom into Japan and the Channel, and check it reads cleanly.

## Part 7: Invite players

Send them the site address. They create an account, apply, and you approve them in the Approval Centre.

**Want sign-ups closed to strangers?** Supabase → **Authentication → Sign In / Providers** → switch off **Allow new users to sign up**. Then create each player's account yourself under **Authentication → Users → Add user → Create new user** (tick *Auto confirm*), and send them their email and a temporary password.

**Making another GM:** Supabase → **SQL Editor** → run, with their email:

```sql
update public.members set role = 'gm' where email = 'their@email.com';
```

They see Command Authority after their next sign-in.

---

## Updating later

When you get new files: copy them into the folder, then in GitHub Desktop click **Commit to main** and **Push origin**. The site updates within a couple of minutes; database changes apply automatically.

Keep your `site/config.js`. It's the only file with your own values in it.

## Backups

The free plan has no automatic backups. Every few sessions, download one from **System Administration → Download backup** and keep it somewhere safe (not in the repository). Supabase Pro ($25/month) adds daily backups and removes the inactivity pause.

## Troubleshooting

| You see | Do this |
|---|---|
| **"Almost there"** on the site | `site/config.js` still has the placeholder values. Fill it in, commit and push. |
| **Set up database** is red: *Secrets missing* | Add the three secrets (Part 3), then *Run workflow* again. |
| **Set up database** is red: *password authentication failed* | `SUPABASE_DB_PASSWORD` is wrong. Reset it in Supabase (*Settings → Database → Reset database password*), update the secret, run again. |
| **Publish site** is red: *Get Pages site failed* | Settings → Pages → Source isn't set to **GitHub Actions** yet. |
| **"Your account isn't set up in the database yet"** at sign-in | The database workflow hasn't run successfully. Run **Set up database**. |
| Sign-up says it sent a confirmation email that never arrives | Switch **Confirm email** off (Part 1, step 5), or add your own SMTP. |
| **"Project paused"** in Supabase | The keep-awake job was switched off (GitHub does this after 60 days without commits). Resume the project in Supabase, then *Actions → Keep database awake → Enable workflow*. |
| The site shows an old version | Hard-refresh: **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac). |

## What the database enforces

- Only signed-in members can read anything; logged-out visitors see nothing.
- Only Command Authority can change the catalogue, rules, settings, map, units and command structure.
- **GM notes** are visible to Command Authority only.
- Each person's **draft application** and private settings are theirs alone.
- Only the Administrator changes roles, and nobody can promote themselves.
- Images: members upload; only the uploader or Command Authority can delete.

**What it doesn't yet enforce:** any signed-in member can technically read the rest of the campaign records through their browser's developer tools, including intel above their clearance, and could edit other players' records. The app hides and blocks these normally; a determined, technically minded player could get round it. If your group needs that sealed tight, the full Supabase edition (server-enforced clearance, private journals, server-side dice) is the next step.
