# Deployment Guide

## Deploy to Vercel (Recommended - Free & Easy)

### Option 1: Deploy via Vercel Website (Easiest)

1. **Go to [vercel.com](https://vercel.com)** and sign up/login with GitHub
2. **Click "Add New Project"**
3. **Import your GitHub repository**: `1err/-`
4. **Vercel will auto-detect Vite settings** - just click "Deploy"
5. **Wait 1-2 minutes** - your app will be live!
6. **You'll get a free URL** like: `https://our-love-story-xxxxx.vercel.app`
7. **Share this link** with your girlfriend! 📱

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts
```

### Custom Domain (Optional - Costs ~$10-15/year)

If you want a custom domain like `ourlovestory.com`:

1. **Buy a domain** from:
   - [Namecheap](https://www.namecheap.com) (~$10/year)
   - [Google Domains](https://domains.google) (~$12/year)
   - [Cloudflare](https://www.cloudflare.com/products/registrar) (~$8/year - cheapest!)

2. **In Vercel dashboard**:
   - Go to your project → Settings → Domains
   - Add your domain
   - Follow DNS setup instructions

## Alternative: Netlify (Also Free)

1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Click "Add new site" → "Import an existing project"
4. Select your GitHub repo
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click "Deploy"

## Alternative: GitHub Pages (Free but more setup)

Requires more configuration. Vercel is recommended for simplicity.

---

## Important Notes

- ✅ **Free hosting** - No credit card needed
- ✅ **HTTPS automatically** - Secure connection
- ✅ **Mobile-friendly** - Works on phones
- ✅ **Fast global CDN** - Loads quickly worldwide
- ⚠️ **Data is still local** - Each device has its own data (IndexedDB)
- 💡 **Use backup feature** - Share backups between devices if needed

## After Deployment

Once deployed, you can:
- Share the link with your girlfriend
- Bookmark it on phones
- Add to home screen (mobile browsers support this)
- Optionally add a custom domain later

