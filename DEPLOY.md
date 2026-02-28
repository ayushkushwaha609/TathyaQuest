# SACH — Free Deployment Guide

This guide helps you deploy SACH for **$0/month** using:
- **Cloudflare Pages** (frontend)
- **Render** (backend)
- **MongoDB Atlas** (database)

---

## Step 1: MongoDB Atlas (Free Database)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a free account
2. Create a **Free Shared Cluster** (M0 — 512MB)
   - Choose the region closest to you
3. Under **Database Access**, create a user with read/write access
4. Under **Network Access**, click **Allow Access from Anywhere** (0.0.0.0/0)
5. Click **Connect** → **Drivers** → Copy the connection string
   - It looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sach_db`
   - Replace `<password>` with your actual password

**Save this connection string — you'll need it for the backend.**

---

## Step 2: Deploy Backend on Render (Free)

### Option A: From GitHub (Recommended)

1. Push your code to GitHub using the **"Save to GitHub"** button in Emergent
2. Go to [render.com](https://render.com) and sign up (free)
3. Click **New** → **Web Service**
4. Connect your GitHub repo
5. Configure:
   - **Name**: `sach-api`
   - **Region**: Singapore (or closest to you)
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Instance Type**: Free
6. Add **Environment Variables**:
   ```
   GROQ_API_KEY      = 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
   SARVAM_API_KEY    = sk_zluof264_YjnN1nb17u6CWfx9gzCcFIil
   RAPIDAPI_KEY      = 3039a462c5msh848800efd267facp13167ejsn8fc0d6459227
   MONGO_URL         = <your MongoDB Atlas connection string from Step 1>
   DB_NAME           = sach_db
   ```
7. Click **Create Web Service**
8. Wait for the build to complete (~3-5 min)
9. Your backend URL will be: `https://sach-api.onrender.com`
10. Test it: visit `https://sach-api.onrender.com/api/health`

> **Note**: Render free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s.

---

## Step 3: Deploy Frontend on Cloudflare Pages (Free)

### Option A: From GitHub (Recommended)

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) and sign up (free)
2. Click **Create a project** → **Connect to Git**
3. Select your GitHub repo
4. Configure build settings:
   - **Project name**: `sach`
   - **Production branch**: `main`
   - **Root directory**: `frontend`
   - **Build command**: `npx expo export --platform web`
   - **Build output directory**: `dist`
   - **Node version**: `20` (set in Environment Variables: `NODE_VERSION` = `20`)
5. Add **Environment Variables**:
   ```
   EXPO_PUBLIC_BACKEND_URL = https://sach-api.onrender.com
   NODE_VERSION = 20
   ```
6. Click **Save and Deploy**
7. Your app will be live at: `https://sach.pages.dev`

---

## Step 4: Build Android APK (Free)

To create a shareable Android APK:

1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. In the `frontend/` directory, run:
   ```bash
   eas build --platform android --profile preview
   ```
4. EAS free tier gives you 30 builds/month
5. Download the APK and share it directly

---

## Cost Summary

| Service | Plan | Cost |
|---------|------|------|
| MongoDB Atlas | M0 Free | $0 |
| Render | Free | $0 |
| Cloudflare Pages | Free | $0 |
| EAS Build | Free (30/mo) | $0 |
| **Total** | | **$0/month** |

### API Costs (separate from hosting)
| API | Free Tier |
|-----|-----------|
| Groq | Free tier with rate limits |
| Sarvam AI | 1000 credits free |
| RapidAPI (youtube-mp36) | 500 req/month free |
| RapidAPI (instagram-reels) | 100 req/month free |

---

## Architecture Diagram

```
 User (Mobile/Web)
       |
       v
 Cloudflare Pages (sach.pages.dev)
   [Expo Web App - Static Files]
       |
       v  (API calls to /api/*)
 Render (sach-api.onrender.com)
   [FastAPI Backend]
       |
       +---> MongoDB Atlas (cache)
       +---> Groq API (transcription + fact-check)
       +---> Sarvam AI (TTS)
       +---> RapidAPI (audio extraction)
```

---

## Troubleshooting

- **Backend cold start**: First request after 15 min inactivity takes ~30s on Render free tier. This is normal.
- **CORS errors**: The backend already allows all origins (`allow_origins=["*"]`).
- **Build fails on Cloudflare**: Make sure `NODE_VERSION=20` is set in environment variables.
- **MongoDB connection fails**: Ensure you've whitelisted `0.0.0.0/0` in Atlas Network Access.
