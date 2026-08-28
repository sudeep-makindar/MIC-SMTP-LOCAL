# Campaign Manager

A local-first, single-user desktop app for sending controlled bulk emails (event
certificates, reminders, sponsor/volunteer communications) with heavy emphasis on
safety, preview, and recovery before anything actually sends.

All campaign data — recipients, templates, logs — stays on this machine, in the
`data/` folder. Only the email traffic itself leaves, through the SMTP provider
you configure (e.g. Gmail with an App Password).

## Running it

```bash
npm install
npm run dev
```

This starts the Vite dev server and an Electron window pointed at it, with
hot-reload for the UI. On first launch a local SQLite database is created at
`data/database/app.db`.

To build a production bundle:

```bash
npm run build
npm run dist   # packages a Windows installer into release/
```

## Core workflow

Create Campaign → Select Template → Import Recipients (CSV/XLSX) → Map Columns →
Preview → Test Email → Configure SMTP & Sending Mode → Preflight → Confirm → Send

Every step is designed so you can't accidentally send: unmapped placeholders,
missing attachments, invalid emails, and unverified SMTP all block sending until
resolved or explicitly excluded.

## SMTP / Gmail setup

Use a **Gmail App Password**, not your normal password:
Google Account → Security → 2-Step Verification → App Passwords.
Passwords are never written to disk — they live in memory only for the current
session and must be re-entered after restarting the app.

## Data layout

```
data/
  campaigns/<id>/    input file, attachments, exports — one folder per campaign
  templates/<id>/    imported HTML/text templates and their assets
  database/app.db    master log + all campaign/recipient state (SQLite)
  backups/           timestamped folder backups created from Settings
  exports/           shared copy of every campaign result export
```

Use **Settings → Open Data Folder** to browse this directly, and
**Settings → Backup & Restore** for a one-click local backup.

## What this app is not

Not a CRM, not marketing automation, not an event manager. It has no
scheduling, audience segmentation, or approval workflows — the operator
prepares and filters recipient data externally, and stays in control of every
send from start to finish.
