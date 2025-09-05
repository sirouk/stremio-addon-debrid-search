# Deploying Stremio Addon Debrid Search to Cloudflare Pages

This guide will walk you through deploying your Stremio addon to Cloudflare Pages using Functions.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **pnpm** (v9 or higher) 
3. **Cloudflare account** with Pages enabled
4. **Wrangler CLI** (will be installed as dev dependency)

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Set Up Environment Variables

### Option A: Using Cloudflare Dashboard
1. Go to your Cloudflare dashboard
2. Navigate to Pages → Your project → Settings → Environment variables
3. Add the following variables:

**Required Environment Variables:**
- `SWAGGER_USER` - Username for admin statistics access
- `SWAGGER_PASSWORD` - Password for admin statistics access

**Optional Environment Variables (for specific debrid services):**
- `PORT` - Port number (not needed for Cloudflare Pages)
- Any debrid service-specific API keys your users might use

### Option B: Using Wrangler CLI
```bash
npx wrangler pages secret put SWAGGER_USER
npx wrangler pages secret put SWAGGER_PASSWORD
```

## Step 3: Configure Your Project

The `wrangler.toml` file is already configured. You can update the project name if needed:

```toml
name = "your-addon-name"  # Change this to your preferred name
compatibility_date = "2024-01-15"
```

**Note:** Cloudflare Pages doesn't use build configuration in wrangler.toml - build settings are configured in the dashboard or via CLI flags.

## Step 4: Deploy to Cloudflare Pages

### Option A: Deploy using Wrangler CLI (Recommended)

1. **Login to Cloudflare:**
   ```bash
   npx wrangler login
   ```

2. **Build and deploy your project:**
   ```bash
   pnpm run build
   npx wrangler pages deploy dist --project-name=stremio-addon-debrid-search
   ```

   Or use the npm script:
   ```bash
   pnpm run deploy
   ```

### Option B: Deploy via Git Integration

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Add Cloudflare Pages deployment setup"
   git push origin main
   ```

2. **Connect to Cloudflare Pages:**
   - Go to Cloudflare dashboard → Pages
   - Click "Create a project"
   - Connect your GitHub repository
   - Configure build settings:
     - **Framework preset:** None
     - **Build command:** `pnpm run build`
     - **Build output directory:** `dist`
     - **Node.js version:** 18 or higher

3. **Deploy:**
   - Click "Save and Deploy"
   - Cloudflare will build and deploy your project automatically

## Step 6: Test Your Deployment

1. Once deployed, you'll get a URL like: `https://your-project.pages.dev`
2. Test the following endpoints:
   - `https://your-project.pages.dev/configure` - Configuration page
   - `https://your-project.pages.dev/manifest.json` - Addon manifest
   - `https://your-project.pages.dev/ping` - Health check

## Step 7: Configure Custom Domain (Optional)

1. In Cloudflare Pages dashboard, go to your project
2. Navigate to "Custom domains"
3. Add your custom domain
4. Update DNS records as instructed

## Features Included in Cloudflare Deployment

✅ **Working Features:**
- All addon functionality (stream searching, debrid integration)
- Configuration interface
- Rate limiting (simplified for Workers runtime)
- CORS handling
- Error handling
- Health check endpoint

✅ **Cloudflare-Optimized:**
- Automatic scaling
- Global CDN distribution
- DDoS protection
- SSL/TLS certificates

⚠️ **Limitations:**
- Simplified rate limiting (not using express-rate-limit)
- No Swagger statistics middleware (can be added with KV storage)
- 10ms CPU time limit per request (should be sufficient for this addon)

## Troubleshooting

### Wrangler Configuration Errors
If you see errors like "Configuration file for Pages projects does not support 'build'":
- Make sure your `wrangler.toml` only contains `name` and `compatibility_date`
- Don't include `[build]`, `[env_vars]`, or `[functions]` sections for Pages
- These are configured through the Cloudflare dashboard or CLI flags

### Build Errors
If you encounter build errors:
```bash
# Clean and rebuild
rm -rf dist node_modules
pnpm install
pnpm run build
```

### Runtime Errors
1. Check Cloudflare Pages Functions logs in the dashboard
2. Verify environment variables are set correctly
3. Ensure all debrid service APIs are accessible from Cloudflare's network

### API Key Issues
- Debrid services should work the same way as they do locally
- Users provide their API keys through the configuration interface
- No server-side API keys are stored

## Local Development with Cloudflare

To test your Functions locally:
```bash
pnpm run preview
```

This will start a local development server that simulates the Cloudflare Pages environment.

## Monitoring and Analytics

1. **Cloudflare Analytics:** Built-in analytics in the Pages dashboard
2. **Custom Logging:** Add console.log statements - visible in Functions logs
3. **Error Tracking:** Errors are automatically logged in the Cloudflare dashboard

## Performance Considerations

- Functions have a 10ms CPU time limit per invocation
- Memory limit is 128MB
- Response size limit is 25MB
- Consider enabling Cloudflare caching for static responses

## Security

- All traffic is encrypted with TLS
- DDoS protection is automatic
- Rate limiting is implemented
- User API keys are handled client-side and in transit only

## Support

If you encounter issues:
1. Check Cloudflare Pages documentation
2. Review the Functions logs in your dashboard
3. Test locally first with `pnpm run preview`

Your Stremio addon should now be successfully deployed to Cloudflare Pages!
