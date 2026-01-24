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
   - **Build Command**: `npm run build:vercel` (you need to add this script)
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

4. Add Environment Variables:
   - `DATABASE_URL`: Your PostgreSQL connection string from Step 2
   - `RESEND_API_KEY`: Your Resend API key for order confirmation emails

5. Click "Deploy"

## Step 4: Add Build Script

Before deploying, you need to add the `build:vercel` script to package.json:

```json
{
  "scripts": {
    "build:vercel": "vite build"
  }
}
```

## Step 5: Run Database Migrations

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

### Database Connection Issues
- Ensure your DATABASE_URL includes `?sslmode=require` for production databases
- Check that your database allows connections from Vercel's IP ranges

### API Routes Not Working
- Check the Vercel function logs in the dashboard
- Ensure the `vercel.json` rewrites are correct

### Build Failures
- Check that all dependencies are listed in package.json
- Ensure TypeScript types are correct
