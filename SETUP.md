# Setting up PSX Books

Two free accounts, about ten minutes, no terminal. Do them in this order,
because step 3 needs the URL from step 2.

Everything below is free tier. Neither account asks for a card.

---

## 1. Supabase: make the database

1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. **New project**. Name it `psx-books`. Choose a strong database password and
   a region near you (Singapore is the closest to both Auckland and Karachi).
   It takes a minute or two to build.
3. Open **SQL Editor** in the left sidebar → **New query**.
4. Open `schema.sql` from this repository, copy all of it, paste it in, press
   **Run**. It should say success. That has made the tables, the security rules
   and the holdings view.
5. Open **Project Settings → API**. Leave this tab open: you need two values
   from it in the next step.
   - **Project URL**
   - **anon public** key (the long one under Project API keys)

Do **not** copy the `service_role` key. Nothing here needs it.

---

## 2. Vercel: put the app online

1. Go to **vercel.com** → **Sign up** → **Continue with GitHub**.
2. **Add New → Project**, and import `Psx-books`. If Vercel cannot see it,
   click **Adjust GitHub App Permissions** and grant access to that repository.
3. Before clicking Deploy, open **Environment Variables** and add the two
   values from step 1.5:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon public key |

4. **Deploy**. When it finishes, copy the URL it gives you, something like
   `https://psx-books-xxxx.vercel.app`.

The anon key is meant to be public — it is in the browser on every page. Your
data is protected by the security rules in `schema.sql`, not by hiding it.

---

## 3. Supabase: allow sign-in from that URL

Back in Supabase, **Authentication → URL Configuration**:

- **Site URL**: the Vercel URL from step 2.4.
- **Redirect URLs**: add `https://your-app.vercel.app/**` — with the `/**` on
  the end.

Save. Skipping this is the single most common reason a sign-in link fails.

---

## 4. Sign in and load the book

1. Open your Vercel URL. It sends you to a sign-in page.
2. Enter your email. Open the link it sends you **in the same browser on the
   same device** — the sign-in cannot carry across to another one.
3. You land on a screen that says **Load the book**. Press it. That brings in
   all 61 transactions, the prices and the broker figures.
4. Go to **Reconcile**. You should see:

   - Cash: **Agrees**
   - Quantities: **Agree**
   - 59 rows checked, **0 disagree**
   - Closing balance **4,01,044.16** in both columns

   If those match, the book is in and correct.

---

## 5. Lock it to you

Now that your account exists, stop anyone else making one.

**Authentication → Sign In / Providers** → turn **Allow new users to sign up**
off.

The security rules already stop a stranger reading your rows — they would get
an empty book, not yours — but with signups off they cannot get an account at
all. Do this *after* step 4, or you will lock yourself out before your own
account exists.

---

## Optional: price refresh and alerts

The app works without these. Prices can always be pasted in on **Settings**.

**Automatic refresh.** `vercel.json` asks for two runs a day, at the Pakistan
open and close. Vercel's free tier restricts how often scheduled jobs may run,
and the limit has changed over time — check what your plan allows under
**Settings → Cron Jobs** in Vercel. If only one run a day is permitted, delete
the first entry in `vercel.json` and keep the `30 10 * * 1-5` one, which is the
Pakistan close and the figure you actually want to mark the book at.

There is no price vendor wired up, because none has been chosen. Until one is,
the scheduled job has nothing to fetch and will say so rather than invent a
price. Pasting prices on **Settings** is the working path.

**Email alerts.** Sign up at resend.com, create an API key, and add to Vercel:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | your key |
| `ALERT_EMAIL_TO` | where alerts should go |

Also add `CRON_SECRET` with any long random string, which stops anyone else
triggering the refresh.

Redeploy after adding variables — Vercel only picks them up on a new build.

---

## If something goes wrong

**The sign-in link does not work.** The page now tells you why. Almost always
it is step 3 not done, or the link opened on a different device from the one
that asked for it.

**"Load the book" is not offered.** It only appears when the database is
connected and empty. If you see the orange *running on the seed file* banner
instead, the two environment variables have not reached the app — check them in
Vercel and redeploy.

**The reconciliation does not agree.** Stop and send me what it shows. That
means something went wrong in the import, and no figure in the app should be
trusted until it is sorted.
