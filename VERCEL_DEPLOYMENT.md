# Deploying OptiCore Web App to Vercel 🚀

The OptiCore Vision Studio web application is built with **Next.js 16** and is optimized for zero-configuration, global CDN deployment on **Vercel**.

Follow these simple steps to deploy it in under 2 minutes.

---

## Method 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Import Your Repository
1. Go to [Vercel](https://vercel.com) and sign in with your GitHub account.
2. Click **"Add New..."** > **"Project"**.
3. Find your **`OptiCore`** repository (`https://github.com/Dharshankumar8197/OptiCore`) and click **"Import"**.

---

### Step 2: Configure Root Directory (CRITICAL ⚠️)
Because OptiCore is a monorepo containing both the web frontend and AI backend, you must tell Vercel where the web application lives:

1. In the **Configure Project** screen, find **"Root Directory"**.
2. Click **"Edit"**.
3. Select or type: **`web`**
4. Click **"Continue"**.
*(Vercel will automatically detect Next.js and configure all build settings).*

---

### Step 3: Add Environment Variables
Expand the **"Environment Variables"** section and add:

| Name | Value | Description |
| :--- | :--- | :--- |
| **`NEXT_PUBLIC_API_URL`** | `https://sterling-denim-renewable.ngrok-free.dev` | Your live backend public URL (Ngrok or Cloud VPS) |
| **`NEXT_PUBLIC_WS_URL`** *(optional)* | `wss://sterling-denim-renewable.ngrok-free.dev` | Automatically inferred if omitted |

> 💡 **Tip:** Whenever you restart your Ngrok tunnel or deploy the backend to a dedicated VPS, simply update `NEXT_PUBLIC_API_URL` in **Vercel Project Settings > Environment Variables** and click **Redeploy**.

---

### Step 4: Click Deploy!
Click **"Deploy"**. Vercel will build and deploy your app in ~30 seconds, giving you a custom production domain like:
```
https://opticore-web.vercel.app
```

---

## Method 2: Deploy from Terminal via Vercel CLI

If you prefer deploying directly from your PowerShell terminal:

1. Open PowerShell and navigate to the `web` directory:
   ```powershell
   cd "c:\IMP PROJECTS\opticore\web"
   ```

2. Run the Vercel deployment command:
   ```powershell
   npx vercel
   ```

3. Follow the interactive prompts:
   - **Set up and deploy?** `Y`
   - **Which scope?** (Select your account)
   - **Link to existing project?** `N`
   - **Project name?** `opticore-web`
   - **Directory located?** `./` (press Enter)
   - **Want to modify settings?** `N`

4. Deploy to production:
   ```powershell
   npx vercel --prod
   ```

---

## Features Available on Your Vercel Web App:
- 📱 **Mobile Camera Streaming**: Open the Vercel HTTPS URL on your phone to immediately test live camera streaming to the YOLO backend.
- ⚡ **1-Click AI Presets**: Evaluate the model on pre-rendered test scenes without needing a webcam.
- 📁 **Instant File Upload**: Drag and drop images/frames for real-time inference telemetry.
- 🌐 **OptiCore Device Mesh**: Discovers and connects peer devices across your network.
