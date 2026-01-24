# Deploying INFINITE HOME to Vercel

This guide explains how to deploy this e-commerce application to Vercel.

## Prerequisites

1. A Vercel account (https://vercel.com)
2. A GitHub repository with this code
3. A PostgreSQL database (recommended: Neon, Supabase, or Railway)

## Step 1: Push to GitHub

1. Create a new GitHub repository
2. Push this codebase to the repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

## Step 2: Set Up External PostgreSQL Database

Since Vercel is serverless, you need an external PostgreSQL database. Recommended options:

### Option A: Neon (Recommended - Free tier available)
1. Go to https://neon.tech
2. Create a new project
3. Copy the connection string (DATABASE_URL)

### Option B: Supabase
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings > Database > Connection string
4. Copy the connection string

### Option C: Railway
1. Go to https://railway.app
2. Create a new PostgreSQL database
3. Copy the connection string

## Step 3: Deploy to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure the project:
   - **Framework Preset**: Other
   - **Build Command**: `npx vite build` (already configured in vercel.json)
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

4. Add Environment Variables:
   - `DATABASE_URL`: Your PostgreSQL connection string from Step 2
   - `RESEND_API_KEY`: Your Resend API key for order confirmation emails

5. Click "Deploy"

## Step 4: Run Database Migrations

After deployment, you need to push the database schema:

```bash
npx drizzle-kit push
```

Make sure your local DATABASE_URL points to the production database when running this command.

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| RESEND_API_KEY | Resend API key for emails (optional) |

## Important Notes

### File Uploads / Object Storage
Replit's Object Storage is NOT available on Vercel. You will need to:
1. Set up AWS S3, Cloudinary, or another file storage service
2. Update the file upload code to use your chosen service
3. Update the payment slip upload functionality

### Limitations
- Vercel serverless functions have a 10-second timeout on free tier (30 seconds on Pro)
- Cold starts may cause slight delays on first request
- No persistent file storage (use external services)

## Custom Domain

1. Go to your Vercel project settings
2. Click "Domains"
3. Add your custom domain (e.g., infinitehome.mv)
4. Update your DNS records as instructed

## Troubleshooting

### Cannot Sign In / API Not Working
1. **Check DATABASE_URL is set in Vercel**:
   - Go to your Vercel project → Settings → Environment Variables
   - Ensure `DATABASE_URL` is set and contains your Supabase connection string
   - For Supabase, use the **Transaction Pooler** connection string (port 6543) for serverless compatibility
   
2. **Test the API health endpoint**:
   - Visit `https://your-app.vercel.app/api/health`
   - If it returns `{"status":"ok","database":true}`, the API is working
   - If `database` is `false`, the DATABASE_URL is not set correctly

3. **Check Vercel Function Logs**:
   - Go to your Vercel project → Deployments → Latest deployment → Functions tab
   - Look for any error messages in the `api/index` function logs

### Database Connection Issues
- For Supabase: Use Transaction Pooler (port 6543), NOT Session Pooler (port 5432)
- Ensure your DATABASE_URL includes SSL (the API adds `ssl: { rejectUnauthorized: false }` automatically)
- Example Supabase connection string:
  ```
  postgresql://postgres.[project-ref]:[password]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
  ```

### API Routes Not Working
- Check the Vercel function logs in the dashboard
- Ensure the `vercel.json` rewrites are correct
- Test individual endpoints like `/api/products` to verify database connectivity

### Build Failures
- Check that all dependencies are listed in package.json
- Ensure TypeScript types are correct

### CORS Issues
- The API includes CORS headers for cross-origin requests
- If you're using a custom domain, ensure it's properly configured
