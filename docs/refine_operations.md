# Refine — Operations Guide

How to run the deployed app day to day: invite people, control admin access, and
check things are working. Written to be followed without help.

**Live app:** https://refine-eta-rose.vercel.app

---

## Before anything: where to run commands

Every command in this guide runs in a terminal, from the project folder:

```
c:\Users\james\OneDrive\Desktop\Refine_MentalHealthApp
```

Open a terminal there (in VS Code: Terminal → New Terminal, it opens in the right
place). Everything below assumes you're in that folder.

These commands talk to the **live Supabase database** — the same one the deployed
app uses. There is no separate test database. Changes take effect immediately.

They work because `.env.local` holds the database connection details. If that
file is missing or damaged, nothing in this guide will work. Don't delete it.

---

## Inviting someone new

Nobody can create an account without an invite code. You generate the code, then
give it to the person.

### 1. Create a code

```
npm run invites -- generate 1
```

The `--` is required. Without it npm eats the arguments.

Output looks like:

```
Created 1 invite code:

  4YYF-SYCQ-BQSM

  expires: never
```

Copy the code. **It works exactly once.**

### 2. Give them the code and the link

Send them:
- The link: https://refine-eta-rose.vercel.app/signup
- Their invite code

They enter the code, their name, their email, and a password of **at least 12
characters**. That's it — they're in.

### Options when creating codes

Create several at once:

```
npm run invites -- generate 5
```

Make a code expire after a set number of days:

```
npm run invites -- generate 1 --expires 14
```

Add a note so you remember who it was for (notes are private, only you see them):

```
npm run invites -- generate 1 --note "Sarah - book club"
```

Combine them:

```
npm run invites -- generate 1 --expires 30 --note "Sarah - book club"
```

---

## Seeing who has what

```
npm run invites -- list
```

Shows every code, whether it's been used, and who used it:

```
CODE            STATUS      USED BY                        EXPIRES     NOTE
4YYF-SYCQ-BQSM  used        James  [ADMIN]                 —           admin account
P8CD-FKQW-QF9J  available   —                              —           tester account
KR46-KMNR-37AW  expired     —                              2026-08-01  old invite
```

**Status meanings:**

| Status | What it means |
|---|---|
| `available` | Unused and valid. Someone can sign up with it right now |
| `used` | Someone already made an account with it. Cannot be reused |
| `expired` | Passed its expiry date. Nobody can use it |
| `revoked` | You cancelled it |

`[ADMIN]` marks the account that has admin access.

---

## Cancelling a code

If you gave out a code and changed your mind — only works on codes nobody has
used yet:

```
npm run invites -- revoke 4YYF-SYCQ-BQSM
```

If someone already signed up with it, revoking does nothing; their account
already exists. To remove that person, see **Removing someone** below.

---

## Admin access

Admin access lets an account view `/admin/safety-log`, which shows the safety
tier the system assigned to messages. Everyone else gets a "page not found" on
that address.

Admin access is controlled **only** by a setting in Vercel called
`ADMIN_USER_IDS`. There's no button in the app. This is deliberate.

### Granting admin access

**1. The person must already have an account.** Their ID doesn't exist until
they've signed up.

**2. Look up their ID:**

```
npm run invites -- whoami their@email.com
```

Output:

```
  name:     James
  user id:  3f2504e0-4f89-41d3-9a0c-0305e82c3301
  created:  2026-07-29
  admin:    no (not in ADMIN_USER_IDS)

  To grant admin, set this in Vercel and redeploy:
    ADMIN_USER_IDS=3f2504e0-4f89-41d3-9a0c-0305e82c3301
```

**3. Put that value in Vercel:**

- Go to https://vercel.com → your Refine project
- Settings → Environment Variables
- Add (or edit) `ADMIN_USER_IDS` and paste the ID
- Save

**4. Redeploy — this step is not optional:**

- Deployments tab → click the most recent deployment → Redeploy

Vercel locks environment variables in when it builds. Until you redeploy, the
new value does nothing at all. If admin access "isn't working", this is almost
always why.

### More than one admin

Separate IDs with commas, no spaces:

```
ADMIN_USER_IDS=3f2504e0-4f89-41d3-9a0c-0305e82c3301,7a1b2c3d-4e5f-6789-abcd-ef0123456789
```

### Removing admin access

Delete that person's ID from `ADMIN_USER_IDS` in Vercel, then redeploy. To remove
all admins, delete the variable entirely or set it to empty — nobody is admin by
default.

---

## Removing someone

There's no button for this yet. Ask and it can be done directly against the
database — deleting the account also deletes all of their reflections, entries,
memory, and profile.

---

## Checking the app is healthy

Open https://refine-eta-rose.vercel.app/api/health in a browser.

You'll see `Unauthorized`. **That is correct** — the address is protected so only
the automatic daily check can use it.

To actually check health, use the app: sign in and start a reflection. If that
works, everything works.

### The daily automatic check

Vercel calls that health address once a day at 7am UTC. This exists because free
Supabase projects **pause themselves after about 7 days of no activity**, and
un-pausing is a manual click in the Supabase dashboard.

If nobody uses the app for a week and the daily check is broken, the app goes
down until you notice. If the app is ever unexpectedly down, check
https://supabase.com/dashboard first — if it says paused, click restore.

---

## Backing up

Your writing lives in one database, protected by a key that lives in one other
place. Neither has a safety net unless you make one. Supabase's free plan does
not include automated backups — check your project's Database → Backups page to
confirm what yours has, but assume nothing.

### Taking a backup

```
npm run backup
```

Writes a timestamped file into `backups/`. It prints a row count per table.
That folder is ignored by git and must never be committed.

Do this before anything that changes the database structure, and on whatever
regular rhythm you'll actually keep to. Monthly beats "when I remember".

### The part people get wrong

**The backup file is encrypted, and the key is not in it.**

Everything you have written is stored scrambled. The two values that unscramble
it live in `.env.local` and in Vercel:

- `ENCRYPTION_KEY` — unlocks entries, titles, profiles, questionnaire answers
- `EMAIL_HMAC_KEY` — lets you log in at all

Lose either and the backup is permanently unreadable. There is no recovery, no
support ticket, no reset. **Copy both into a password manager now**, in a
separate entry from the database file. Keeping the file and the keys together
would defeat the point of encrypting anything.

Neither value may ever be changed once you have written anything. See
`CLAUDE.md`, "Silent data-loss footguns".

### Checking a backup is good

```
npm run backup -- verify backups/refine-2026-07-31T06-16-29-548Z.json
```

Reads the file and reports what is in it. Touches nothing. A backup you have
never opened is a guess, not a backup — do this occasionally.

### Restoring

Restoring is deliberately awkward, because it is not something to do by
accident. It refuses to run against a database that already has rows.

1. Create a new, empty Supabase project.
2. Put its **session pooler** connection string (port 5432) in `.env.local` as
   `DATABASE_URL_DIRECT`.
3. Rebuild the structure:
   ```
   npm run db:migrate
   ```
4. Load the data:
   ```
   npm run backup -- restore backups/refine-<timestamp>.json
   ```
5. Put `ENCRYPTION_KEY` and `EMAIL_HMAC_KEY` back exactly as they were, along
   with the other environment variables.
6. Log in. If entries appear but are unreadable, the keys do not match — fix the
   keys, not the data.

Everything loads in a single transaction: either all of it lands or none does.
There is no half-restored state to untangle.

### What is and isn't in the file

Everything: your account, invite codes, profile, every journal entry, every
summary, every questionnaire response, memory, and both audit logs. Nine tables.
The script refuses to run if it finds a table it doesn't know about, so it
cannot quietly leave one out after a future change.

Not included: the database structure itself. That comes from `npm run db:migrate`,
which rebuilds it from what is in version control — a more reliable source than
a copy of whatever the server happened to look like.

This round trip has been tested end-to-end, not just assumed: schema rebuilt from
the migrations, data loaded, and encrypted entries confirmed to still decrypt
afterwards.

---

## If the app stops working

**"Something went wrong" on every page**
Usually the database. Check https://supabase.com/dashboard — if the project is
paused, restore it.

**A code won't work**
Run `npm run invites -- list` and check its status. Used and expired codes cannot
be reused; generate a new one.

**Admin page shows "page not found" for an admin**
The redeploy step was skipped. Redeploy in Vercel.

**A command says `DATABASE_URL_DIRECT is not set`**
You're not in the project folder, or `.env.local` is missing.

**Someone can't log in and swears the password is right**
Ask before changing anything. Do **not** change `ENCRYPTION_KEY` or
`EMAIL_HMAC_KEY` in Vercel — if those change, existing accounts stop working and
existing journal entries can't be read. They should never be edited.

---

## Things not to do

- **Don't change `ENCRYPTION_KEY` or `EMAIL_HMAC_KEY`** in Vercel or `.env.local`.
  All journal content is encrypted with them. Change them and existing data
  becomes permanently unreadable. There is no recovery.
- **Don't run `npm run db:reset`** unless you intend to destroy everything. It
  refuses to run against the live database, but don't rely on that.
- **Don't run `supabase init`** or install Supabase's CLI in this project. The
  database structure is managed by one tool only.
- **Don't commit `.env.local`** to GitHub. It's already excluded — leave it that
  way.

---

## Quick reference

| Task | Command |
|---|---|
| Back up | `npm run backup` |
| Check a backup | `npm run backup -- verify <file>` |
| Restore into an empty database | `npm run backup -- restore <file>` |


| What | Command |
|---|---|
| New invite code | `npm run invites -- generate 1` |
| Five codes | `npm run invites -- generate 5` |
| Code expiring in 14 days | `npm run invites -- generate 1 --expires 14` |
| Code with a note | `npm run invites -- generate 1 --note "who it's for"` |
| See all codes | `npm run invites -- list` |
| Cancel an unused code | `npm run invites -- revoke CODE-HERE` |
| Find someone's user ID | `npm run invites -- whoami their@email.com` |

Signup link to share: **https://refine-eta-rose.vercel.app/signup**
Password minimum: **12 characters**
