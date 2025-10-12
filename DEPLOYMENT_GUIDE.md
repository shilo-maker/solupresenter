# SoluPresenter - AWS Deployment Guide

This guide will walk you through deploying your SoluPresenter application to AWS step-by-step.

---

## Prerequisites Checklist

Before starting, make sure you have:
- [ ] AWS Account (you have this)
- [ ] Changed your AWS password (IMPORTANT - do this first!)
- [ ] Git installed on your computer
- [ ] AWS CLI installed
- [ ] MongoDB Atlas account (free tier available)

---

## Deployment Architecture

We'll deploy:
- **Frontend**: AWS Amplify (easiest option - automatic deployment)
- **Backend**: AWS Elastic Beanstalk (Node.js environment)
- **Database**: MongoDB Atlas (free tier)
- **Domain**: Route 53 (optional)

---

## Step-by-Step Deployment

### STEP 1: Secure Your AWS Account (DO THIS FIRST!)

1. Go to https://aws.amazon.com/
2. Click "Sign In to the Console"
3. Sign in with email: shilo@soluisrael.org
4. Click your name (top right) → Security Credentials
5. Click "Change Password"
6. Create a NEW, STRONG password
7. Save it in a password manager

### STEP 2: Set Up MongoDB Atlas (Database)

MongoDB Atlas is a cloud database service with a free tier.

1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free"
3. Sign up with your email
4. Choose FREE tier (M0 Sandbox)
5. Choose AWS as cloud provider
6. Select a region close to you (e.g., "us-east-1")
7. Create cluster (takes 3-5 minutes)

**Once cluster is ready:**
1. Click "Connect"
2. Add your current IP address
3. Create a database user (username/password - save these!)
4. Choose "Connect your application"
5. Copy the connection string (looks like: `mongodb+srv://username:<password>@cluster0.xxxxx.mongodb.net/`)
6. Replace `<password>` with your database password
7. Save this connection string - you'll need it later

### STEP 3: Prepare Your Code for Deployment

#### 3.1 Initialize Git Repository (if not done)

Open terminal in your project folder:
```bash
cd C:\Users\shilo\Documents\solupresenter
git init
git add .
git commit -m "Initial commit - ready for deployment"
```

#### 3.2 Create GitHub Repository

1. Go to https://github.com
2. Click "+" → "New repository"
3. Name: `solupresenter`
4. Make it Private
5. Don't initialize with README
6. Click "Create repository"

**Push your code:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/solupresenter.git
git branch -M main
git push -u origin main
```

### STEP 4: Deploy Backend to AWS Elastic Beanstalk

#### 4.1 Install AWS Elastic Beanstalk CLI

Open PowerShell as Administrator:
```powershell
pip install awsebcli
```

#### 4.2 Configure AWS Credentials

In terminal:
```bash
aws configure
```

You'll need:
- AWS Access Key ID: (We'll get this from AWS Console)
- AWS Secret Access Key: (We'll get this from AWS Console)
- Default region: us-east-1
- Default output format: json

**To get Access Keys:**
1. Go to AWS Console
2. Click your name → Security Credentials
3. Scroll to "Access keys"
4. Click "Create access key"
5. Choose "CLI"
6. Click "Create access key"
7. Download the CSV file (SAVE THIS SECURELY!)
8. Copy Access Key ID and Secret Access Key

#### 4.3 Initialize Elastic Beanstalk

```bash
cd backend
eb init
```

Answer the prompts:
- Select region: Choose your region (e.g., us-east-1)
- Application name: `solupresenter-backend`
- Platform: Node.js
- Platform version: Latest Node.js version
- SSH: Yes (for debugging)

#### 4.4 Create Environment Variables File

Create `backend/.ebextensions/environment.config`:
```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
    MONGODB_URI: "your-mongodb-atlas-connection-string-here"
    JWT_SECRET: "generate-a-random-secret-here"
    SESSION_SECRET: "generate-another-random-secret-here"
    FRONTEND_URL: "https://your-app-name.amplifyapp.com"
```

**Generate secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run this twice to get two different secrets.

#### 4.5 Deploy Backend

```bash
eb create solupresenter-backend-env
```

This takes 5-10 minutes. Once done:
```bash
eb open
```

This opens your backend URL. Copy this URL (e.g., `http://solupresenter-backend-env.us-east-1.elasticbeanstalk.com`)

### STEP 5: Deploy Frontend to AWS Amplify

#### 5.1 Update Frontend Configuration

Edit `frontend/src/services/api.js`:
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://your-eb-backend-url-here:8080';
```

Edit `frontend/src/services/socket.js`:
```javascript
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://your-eb-backend-url-here:8080';
```

Commit changes:
```bash
git add .
git commit -m "Update API URL for production"
git push
```

#### 5.2 Set Up AWS Amplify

1. Go to AWS Console
2. Search for "AWS Amplify"
3. Click "Get Started" under "Amplify Hosting"
4. Choose "GitHub"
5. Authorize AWS Amplify to access GitHub
6. Select repository: `solupresenter`
7. Select branch: `main`
8. For "Build settings":
   - Build command: `npm run build`
   - Base directory: `frontend`
   - Output directory: `build`

#### 5.3 Add Environment Variables in Amplify

1. In Amplify Console, go to your app
2. Click "Environment variables"
3. Add:
   - Key: `REACT_APP_API_URL`
   - Value: `http://your-eb-backend-url-here:8080`

#### 5.4 Deploy

Click "Save and deploy"

Amplify will:
1. Clone your repository
2. Install dependencies
3. Build the frontend
4. Deploy to CloudFront CDN

This takes 5-10 minutes.

### STEP 6: Update Backend CORS

Now that frontend has a URL, update backend CORS:

Edit `backend/server.js`:
```javascript
const allowedOrigins = [
  'http://localhost:3456',
  'http://10.100.102.27:3456',
  'https://main.your-amplify-id.amplifyapp.com', // Add your Amplify URL
  process.env.FRONTEND_URL
].filter(Boolean);
```

Deploy backend again:
```bash
cd backend
git add .
git commit -m "Update CORS for production"
git push
eb deploy
```

### STEP 7: Test Your Deployment

1. Go to your Amplify URL
2. Try logging in
3. Test creating a presentation
4. Test the viewer page

---

## Troubleshooting

### Backend Issues

**View logs:**
```bash
cd backend
eb logs
```

**Check status:**
```bash
eb status
```

**SSH into instance:**
```bash
eb ssh
```

### Frontend Issues

**View build logs:**
1. Go to Amplify Console
2. Click on your app
3. Click on latest build
4. View logs

### Database Connection Issues

1. Check MongoDB Atlas IP Whitelist
2. Allow access from anywhere (0.0.0.0/0) for testing
3. Verify connection string is correct
4. Check username/password

---

## Cost Estimate

- **MongoDB Atlas**: $0/month (free tier)
- **AWS Amplify**: $0.01 per build minute, $0.15/GB served (~$5-10/month)
- **Elastic Beanstalk**: ~$15-30/month (t2.micro instance)
- **Total**: ~$20-40/month

---

## Custom Domain (Optional)

### If you have a domain:

1. Go to Route 53 in AWS
2. Create hosted zone for your domain
3. Update nameservers at your domain registrar
4. In Amplify: Add custom domain
5. Follow SSL certificate setup

---

## Maintenance

### Update Frontend
```bash
git add .
git commit -m "Update frontend"
git push
```
Amplify auto-deploys!

### Update Backend
```bash
cd backend
git add .
git commit -m "Update backend"
git push
eb deploy
```

### View Backend Logs
```bash
eb logs
```

### Scale Backend (if needed)
```bash
eb scale 2  # Run 2 instances
```

---

## Security Checklist

After deployment:
- [ ] Change AWS password
- [ ] Enable MFA on AWS account
- [ ] Rotate AWS access keys regularly
- [ ] Use AWS Secrets Manager for sensitive data
- [ ] Enable CloudWatch monitoring
- [ ] Set up billing alerts
- [ ] Regular database backups
- [ ] Keep dependencies updated

---

## Next Steps After Deployment

1. Test all features thoroughly
2. Set up monitoring (CloudWatch)
3. Configure auto-scaling if needed
4. Set up automated backups
5. Configure SSL certificate
6. Set up custom domain

---

## Need Help?

Common issues and solutions:

### "eb command not found"
- Reinstall EB CLI: `pip install awsebcli --upgrade --user`
- Add to PATH

### "Failed to deploy application"
- Check logs: `eb logs`
- Verify all environment variables are set
- Check if MongoDB is accessible

### "CORS error"
- Verify Amplify URL is in backend's allowedOrigins
- Redeploy backend after updating CORS

### Frontend not connecting to backend
- Check REACT_APP_API_URL is set correctly in Amplify
- Verify backend is running: visit backend URL directly
- Check browser console for errors

---

## Support

If you get stuck:
1. Check the error message carefully
2. Search the error on Google
3. Check AWS documentation
4. Check Elastic Beanstalk logs
5. Check Amplify build logs

Remember: Deployment can take time. Be patient, follow each step carefully, and don't skip any steps!
