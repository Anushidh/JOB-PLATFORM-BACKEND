# Backend Deployment Guide — Render

## Step 1: MongoDB Atlas — allow all IPs

Render uses dynamic IPs so Atlas needs to allow connections from anywhere:
1. Atlas → **Network Access** → **Add IP Address**
2. Click **Allow Access from Anywhere** (`0.0.0.0/0`) → Save

---

## Step 2: Deploy to Render

1. Push backend code to GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo, set root directory to `job-platform-backend`
4. Configure the service:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
5. Deploy — your URL will be `https://job-platform-backend.onrender.com`

---

## Step 3: Set Environment Variables

Go to your service → **Environment** tab and add all variables from `.env.example`.

Key values to update for production:
- `NODE_ENV` → `production`
- `CORS_ORIGIN` → your Vercel frontend URL
- `GOOGLE_CALLBACK_URL` → `https://your-backend.onrender.com/api/v1/auth/oauth/google/callback`
- `LINKEDIN_CALLBACK_URL` → `https://your-backend.onrender.com/api/v1/auth/oauth/linkedin/callback`

---

## Step 4: Update OAuth Redirect URIs

**Google Cloud Console:**
- APIs & Services → Credentials → your OAuth Client → Authorized redirect URIs
- Add: `https://your-backend.onrender.com/api/v1/auth/oauth/google/callback`

**LinkedIn Developer Portal:**
- Your app → Auth tab → Authorized redirect URLs
- Add: `https://your-backend.onrender.com/api/v1/auth/oauth/linkedin/callback`

---

## Step 5: UptimeRobot — prevent free tier spin-down

Free Render services spin down after 15 minutes of inactivity.

1. Go to [uptimerobot.com](https://uptimerobot.com) → **Add New Monitor**
2. Type: `HTTP(s)`, Interval: `5 minutes`
3. URL: `https://your-backend.onrender.com/health`

> Upgrade to Render **Starter ($7/mo)** for always-on — then UptimeRobot isn't needed.

---

## Step 6: Razorpay Webhook

In Razorpay Dashboard → Webhooks:
- URL: `https://your-backend.onrender.com/api/v1/subscriptions/webhook`
- Secret: same value as `RAZORPAY_WEBHOOK_SECRET`

---

## Pre-deploy Checklist

- [ ] MongoDB Atlas IP whitelist set to `0.0.0.0/0`
- [ ] All env vars added in Render dashboard
- [ ] `CORS_ORIGIN` set to Vercel frontend URL
- [ ] OAuth callback URLs updated in Google & LinkedIn consoles
- [ ] UptimeRobot monitor created
- [ ] Razorpay webhook URL updated
