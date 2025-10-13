# Deployment Guide

This document contains all the information needed to deploy the SoluPresenter application to AWS.

## Deployment Architecture

- **Frontend**: AWS Amplify (https://main.d390gabr466gfy.amplifyapp.com/)
- **Backend**: AWS Elastic Beanstalk via CloudFront (https://d125ckyjvo1azi.cloudfront.net)
- **Database**: MongoDB Atlas
- **Repository**: GitHub (https://github.com/shilo-maker/solupresenter.git)

## URLs

- **Production Frontend**: https://main.d390gabr466gfy.amplifyapp.com/
- **Production Backend (HTTPS)**: https://d125ckyjvo1azi.cloudfront.net
- **Backend (Direct HTTP)**: http://solupresenter-env.eba-53inmwqz.us-east-1.elasticbeanstalk.com
- **CloudFront Distribution ID**: E337AVR9HSZFTC

## Environment Variables

### Frontend (AWS Amplify)
- `REACT_APP_API_URL`: `https://d125ckyjvo1azi.cloudfront.net`

### Backend (Elastic Beanstalk)
Located in `backend/.ebextensions/environment.config`:
- `NODE_ENV`: `production`
- `PORT`: `8080`
- `MONGODB_URI`: `mongodb+srv://solupresenter:Sud5a62oLS9SBtCu@cluster0.8flpy2z.mongodb.net/solupresenter?retryWrites=true&w=majority&appName=Cluster0`
- `JWT_SECRET`: `786b1bb5c151da6b9f986dd3dff1822c04270e0a4e2d122475d639f893438c73`
- `SESSION_SECRET`: `8cd0c0d523a8e0aac8d05ebee2277b99ff0921005dd5026ffe1cb90f06df77f7`
- `FRONTEND_URL`: `https://main.d390gabr466gfy.amplifyapp.com`

## Deployment Commands

### Quick Deploy (Everything)
```bash
# From project root
git add .
git commit -m "Your commit message"
git push
cd backend
eb deploy
cd ..
```

### Deploy Frontend Only
```bash
git add .
git commit -m "Frontend changes"
git push
```
Note: Amplify automatically redeploys when you push to GitHub

### Deploy Backend Only
```bash
cd backend
eb deploy
```

## Deployment Steps (Detailed)

### 1. Test Locally First
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### 2. Commit Changes
```bash
git add .
git commit -m "Description of changes"
```

### 3. Push to GitHub
```bash
git push
```
This will automatically trigger Amplify to rebuild the frontend (takes ~5-10 minutes)

### 4. Deploy Backend
```bash
cd backend
eb deploy
```
This deploys the backend to Elastic Beanstalk (takes ~3-5 minutes)

### 5. Verify Deployment

**Check Frontend:**
- Go to: https://console.aws.amazon.com/amplify/
- Verify build status shows "Deployed" with green checkmark

**Check Backend:**
```bash
cd backend
eb status
```
Should show: `Status: Ready` and `Health: Green`

**Test Backend Endpoint:**
```bash
curl https://d125ckyjvo1azi.cloudfront.net/health
```
Should return: `{"status":"ok","message":"Server is running"}`

## Troubleshooting

### Frontend Issues

**Build fails in Amplify:**
1. Go to AWS Amplify Console
2. Click on the failed build
3. Check the build logs for errors
4. Common issues:
   - Missing dependencies (check package.json)
   - Environment variable not set
   - Build script errors

**Can't connect to backend:**
1. Check environment variable in Amplify
2. Verify `REACT_APP_API_URL` is set to `https://d125ckyjvo1azi.cloudfront.net`
3. Redeploy after changing environment variables

### Backend Issues

**Deployment fails:**
```bash
cd backend
eb logs
```
Check logs for errors

**Backend health is Red:**
```bash
eb health
eb logs
```
Common issues:
- MongoDB connection failed (check connection string)
- Missing environment variables
- Application crash on startup

**CORS errors:**
- Check `backend/server.js` allowedOrigins array
- Ensure frontend URL is included
- Redeploy backend after changes

### Database Issues

**Can't connect to MongoDB:**
1. Check MongoDB Atlas IP whitelist (should include `0.0.0.0/0`)
2. Verify connection string in environment.config
3. Check MongoDB Atlas cluster is running

## AWS Account Info

- **Account ID**: 066606188183
- **Region**: us-east-1 (US East - N. Virginia)
- **Email**: shilo@soluisrael.org

## Important Notes

### CloudFront Distribution
- CloudFront provides HTTPS for the backend
- Direct Elastic Beanstalk URL only supports HTTP
- Always use CloudFront URL in production frontend

### CORS Configuration
Current allowed origins in `backend/server.js`:
- `http://localhost:3456` (local development)
- `http://10.100.102.27:3456` (local network)
- `https://main.d390gabr466gfy.amplifyapp.com` (production frontend)
- `https://d125ckyjvo1azi.cloudfront.net` (CloudFront)

### Costs
Approximate monthly costs:
- MongoDB Atlas: **$0** (free tier)
- AWS Amplify: **~$5-10**
- Elastic Beanstalk: **~$15-30**
- CloudFront: **~$1-5**
- **Total: ~$20-45/month**

### Security Notes
- Never commit `.env` files
- Secrets are stored in AWS (not in git)
- MongoDB credentials are in environment.config (not public)
- JWT secrets are rotated via environment.config

## Common Commands

### View Backend Logs
```bash
cd backend
eb logs
```

### View Backend Status
```bash
cd backend
eb status
```

### View Backend Health
```bash
cd backend
eb health
```

### SSH into Backend Instance
```bash
cd backend
eb ssh
```

### View CloudFront Distribution Status
```bash
aws cloudfront get-distribution --id E337AVR9HSZFTC --query "Distribution.Status"
```

### Invalidate CloudFront Cache
```bash
aws cloudfront create-invalidation --distribution-id E337AVR9HSZFTC --paths "/*"
```

## Rollback Procedure

### Rollback Frontend (Amplify)
1. Go to AWS Amplify Console
2. Click on your app
3. Go to previous successful build
4. Click "Redeploy this version"

### Rollback Backend
```bash
cd backend
eb deploy --version <previous-version-name>
```

To see available versions:
```bash
eb appversion
```

## Deployment Checklist

Before deploying to production:

- [ ] All tests pass locally
- [ ] Code reviewed and committed to git
- [ ] Environment variables are correct
- [ ] Database migrations completed (if any)
- [ ] No console errors in browser
- [ ] Backend health check returns OK
- [ ] CORS settings include all necessary origins
- [ ] Sensitive data is not in git
- [ ] Build succeeds locally
- [ ] Dependencies are up to date in package.json

After deployment:

- [ ] Frontend build completed successfully in Amplify
- [ ] Backend status is "Ready" with "Green" health
- [ ] Can register/login on production site
- [ ] Real-time features work (WebSocket connections)
- [ ] Images/media load correctly
- [ ] No errors in browser console
- [ ] No errors in backend logs
- [ ] Database operations work correctly

## Support

If deployment fails or you encounter issues:

1. Check the logs (Amplify console, `eb logs`)
2. Verify all environment variables are set
3. Ensure MongoDB Atlas is accessible
4. Check AWS service status: https://status.aws.amazon.com/
5. Review this deployment guide

## Next Steps After Deployment

1. Set up billing alerts in AWS Console
2. Create admin account: `cd backend && npm run create-admin`
3. Import song library: `cd backend && npm run import-songs`
4. Test all features thoroughly
5. Monitor costs in AWS Billing dashboard
