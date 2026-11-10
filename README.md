# UNTSF-COMM

Command and logistics system for a Muv-Luv military roleplay: applications and character rolls, eishi files and dashboards, TSFs and loadouts, missions and combat, the 2012 campaign map, research, production, and personnel records.

**To set it up, follow [SETUP.md](SETUP.md).**

## What's in this repository

```
site/                       the website (published by Cloudflare Pages: output directory "site")
  index.html                page and styles
  app.js                    the application
  bridge.js                 connects the app to Supabase: sign-in, data, live updates, images, downloads
  config.js                 YOUR Supabase Project URL and publishable key (the only file you edit)
  starter.json              starter catalogue for a fresh campaign
  manifest.webmanifest, sw.js, icon-*.png   installable on phones
  _headers, robots.txt      keep it out of search engines; no referrer leaks
functions/api/discord.js    Discord relay: posts mission plans and maps for Command Authority (optional, see SETUP.md)
supabase/
  config.toml               Supabase CLI settings
  migrations/               database set-up, applied automatically by GitHub Actions
.github/workflows/
  database.yml              applies new migrations to Supabase
  keep-awake.yml            pings the database every three days so the free plan doesn't pause
```

## How it fits together

- **Cloudflare Pages** serves the site from this **private** repository, at an address that doesn't identify you. Free, unlimited bandwidth.
- **Supabase** holds the database, accounts and uploaded images. Free plan: 500 MB database, 1 GB images, 50,000 accounts.
- **GitHub Actions** updates the database and keeps it awake, using three repository secrets. No secret ever appears in the code.
- **Accounts** are usernames only, with an optional sign-up invite code. No email or personal data is collected.

Your campaign data lives only in Supabase, behind sign-in. Backups you download stay off GitHub (see `.gitignore`).

## Updating

Replace the changed files, commit and push. Keep your `site/config.js`.
