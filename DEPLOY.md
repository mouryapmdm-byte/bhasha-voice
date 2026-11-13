# Deploying to Railway

Your app is fully configured for easy deployment on **Railway** (`railway.app`).

## Step-by-Step Deployment Guide:

1. **Push your code to GitHub**:
   - Create a new repository on GitHub (or use your existing repository).
   - Push your project files (`src`, `server.ts`, `package.json`, `railway.json`, etc.) to your GitHub repository.

2. **Create a Project on Railway**:
   - Go to [Railway](https://railway.app) and sign in (you can use your GitHub account).
   - Click **New Project** -> **Deploy from GitHub repo**.
   - Select your repository.

3. **Automatic Build & Start**:
   - Railway will automatically detect the Node.js project using Nixpacks and our `railway.json` configuration.
   - It will run `npm run build` (which builds both the Vite frontend and bundles the Express backend into `dist/server.cjs`) and start the app using `npm start`.

4. **Environment Variables (Optional)**:
   - If your app requires any environment variables (like custom API keys), go to your Railway service **Settings** -> **Variables** and add them.

5. **Generate Domain**:
   - Go to the **Settings** tab of your service in Railway, scroll down to **Networking**, and click **Generate Domain** to get your public live URL.
