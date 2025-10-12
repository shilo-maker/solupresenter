# Quick Start - Deploy SoluPresenter

Follow these steps IN ORDER. Don't skip any!

## 🚨 STEP 0: SECURE YOUR ACCOUNT (5 minutes)

**DO THIS IMMEDIATELY:**
1. Go to https://aws.amazon.com/
2. Sign in with: shilo@soluisrael.org
3. Click your name (top right) → Security Credentials
4. Click "Change Password"
5. Create a NEW password (use a password manager!)
6. ✅ Check this box when done: [ ]

---

## 📝 STEP 1: Set Up MongoDB Database (15 minutes)

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up (use same email or different, doesn't matter)
3. Choose **FREE** tier (M0 Sandbox - $0/month)
4. Click "Create"
5. Wait for cluster to be ready (3-5 min)

**Get your connection string:**
1. Click "Connect" button
2. Click "Add a Different IP Address"
3. Enter: `0.0.0.0/0` (allows access from anywhere)
4. Click "Add IP Address"
5. Create database user:
   - Username: `solupresenter`
   - Password: Generate a strong password (SAVE THIS!)
6. Click "Choose a connection method"
7. Click "Connect your application"
8. Copy the connection string (looks like: `mongodb+srv://solupresenter:<password>@...`)
9. Replace `<password>` with your actual password
10. ✅ Save connection string here:
    ```
    mongodb+srv://solupresenter:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/solupresenter?retryWrites=true&w=majority
    ```

---

## 💻 STEP 2: Install Required Tools (10 minutes)

Open PowerShell as Administrator and run:

```powershell
# Install AWS CLI
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# Install EB CLI
pip install awsebcli --upgrade --user
```

Close and reopen PowerShell after installation.

Test installations:
```powershell
aws --version
eb --version
```

✅ Check when both commands work: [ ]

---

## 🔑 STEP 3: Configure AWS (10 minutes)

### Get AWS Access Keys:
1. Go to AWS Console: https://console.aws.amazon.com/
2. Sign in
3. Click your name → Security Credentials
4. Scroll to "Access keys"
5. Click "Create access key"
6. Choose "Command Line Interface (CLI)"
7. Check the box "I understand..."
8. Click "Create access key"
9. **IMPORTANT**: Download CSV file (you can't see these again!)

### Configure AWS CLI:
Open PowerShell:
```powershell
aws configure
```

Enter:
- AWS Access Key ID: (from CSV)
- AWS Secret Access Key: (from CSV)
- Default region: `us-east-1`
- Default output format: `json`

✅ Check when done: [ ]

---

## 🎨 STEP 4: Prepare Backend (10 minutes)

### Generate Secrets:
Open PowerShell in your project folder:
```powershell
cd C:\Users\shilo\Documents\solupresenter
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this command TWICE and save both outputs:
- Secret 1: `________________________________`
- Secret 2: `________________________________`

### Edit Configuration:
1. Open: `backend\.ebextensions\environment.config`
2. Replace:
   - `MONGODB_URI`: Paste your MongoDB connection string from Step 1
   - `JWT_SECRET`: Paste Secret 1
   - `SESSION_SECRET`: Paste Secret 2
   - Leave `FRONTEND_URL` for now (we'll update it later)
3. Save file

✅ Check when done: [ ]

---

## 🚀 STEP 5: Deploy Backend (20 minutes)

Open PowerShell:
```powershell
cd C:\Users\shilo\Documents\solupresenter\backend

# Initialize Elastic Beanstalk
eb init
```

Answer prompts:
- Region: `us-east-1`
- Application name: `solupresenter-backend`
- Platform: Node.js
- Platform version: (choose latest)
- SSH: `y` (yes)
- Keypair: Create new (enter name: `solupresenter-key`)

**Deploy:**
```powershell
eb create solupresenter-env
```

This takes 5-10 minutes. Watch for "Successfully launched environment"

**Get backend URL:**
```powershell
eb status
```

Look for "CNAME:" - this is your backend URL!
Example: `solupresenter-env.us-east-1.elasticbeanstalk.com`

✅ Save your backend URL:
```
http://________________________________________
```

---

## 🌐 STEP 6: Set Up GitHub (10 minutes)

1. Go to https://github.com/new
2. Repository name: `solupresenter`
3. Make it **Private**
4. Click "Create repository"

**Push your code:**
```powershell
cd C:\Users\shilo\Documents\solupresenter

# If not already initialized:
git init
git add .
git commit -m "Ready for deployment"

# Add GitHub remote (replace YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/solupresenter.git
git branch -M main
git push -u origin main
```

✅ Check when code is on GitHub: [ ]

---

## 🎯 STEP 7: Deploy Frontend with Amplify (15 minutes)

1. Go to: https://console.aws.amazon.com/amplify/
2. Click "Get Started" under "Amplify Hosting"
3. Choose "GitHub"
4. Click "Continue"
5. Authorize AWS Amplify (if asked)
6. Select repository: `solupresenter`
7. Select branch: `main`
8. Click "Next"

**Configure build settings:**
1. App name: `solupresenter`
2. Edit build settings:
   - Click "Edit" under "Build and test settings"
   - Change to:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - cd frontend
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: frontend/build
       files:
         - '**/*'
     cache:
       paths:
         - frontend/node_modules/**/*
   ```
3. Click "Save"
4. Click "Next"
5. Click "Save and deploy"

**Add environment variable:**
1. Wait for build to complete
2. Click "Environment variables" (left menu)
3. Click "Add environment variable"
   - Key: `REACT_APP_API_URL`
   - Value: Your backend URL from Step 5 (WITHOUT http://, just the domain)
   - Example: `solupresenter-env.us-east-1.elasticbeanstalk.com`
4. Click "Save"
5. Click "Redeploy this version"

Wait 5-10 minutes for deployment.

✅ Save your frontend URL (shown after deployment):
```
https://________________________________________
```

---

## 🔗 STEP 8: Connect Frontend and Backend (10 minutes)

### Update Backend CORS:
1. Open: `backend\.ebextensions\environment.config`
2. Update `FRONTEND_URL` with your Amplify URL (from Step 7)
3. Save file

2. Open: `backend\server.js`
3. Find `allowedOrigins` array (around line 24)
4. Add your Amplify URL:
```javascript
const allowedOrigins = [
  'http://localhost:3456',
  'http://10.100.102.27:3456',
  'https://main.d1234567890ab.amplifyapp.com', // ADD YOUR URL HERE
  process.env.FRONTEND_URL
].filter(Boolean);
```
5. Save file

**Redeploy backend:**
```powershell
cd C:\Users\shilo\Documents\solupresenter\backend
eb deploy
```

Wait 3-5 minutes.

✅ Check when done: [ ]

---

## ✅ STEP 9: Test Your Deployment! (5 minutes)

1. Open your Amplify URL in a browser
2. Try to register a new account
3. Log in
4. Create a presentation
5. Open viewer page on another device/browser
6. Test if it works!

**Common issues:**
- Can't login? Check MongoDB connection string
- CORS error? Check allowedOrigins in backend
- Can't connect? Check REACT_APP_API_URL in Amplify

---

## 📊 STEP 10: Monitor and Maintain

### View Backend Logs:
```powershell
cd C:\Users\shilo\Documents\solupresenter\backend
eb logs
```

### View Frontend Logs:
Go to Amplify Console → Your app → Click on build

### Update Frontend (automatic):
```powershell
cd C:\Users\shilo\Documents\solupresenter
git add .
git commit -m "Update message"
git push
```
Amplify auto-deploys!

### Update Backend:
```powershell
cd C:\Users\shilo\Documents\solupresenter\backend
eb deploy
```

---

## 💰 Monthly Costs

- MongoDB Atlas: **$0** (free tier)
- AWS Amplify: **~$5-10** (depending on traffic)
- Elastic Beanstalk: **~$15-30** (t2.micro or t3.micro)
- **Total: ~$20-40/month**

---

## 🆘 Need Help?

### Backend not working?
```powershell
cd backend
eb logs
```

### Frontend not building?
Check Amplify Console → Build logs

### Database connection issues?
- Verify MongoDB connection string
- Check IP whitelist (0.0.0.0/0 allows all)
- Verify username/password

### Still stuck?
1. Check AWS CloudWatch logs
2. Search error on Google
3. Check AWS documentation

---

## ✨ You're Done!

Your application is now live on AWS!

- Frontend: Your Amplify URL
- Backend: Your Elastic Beanstalk URL
- Database: MongoDB Atlas

Remember to:
- ✅ Monitor costs in AWS Billing dashboard
- ✅ Set up billing alerts
- ✅ Keep your code updated
- ✅ Regular backups of MongoDB

Congratulations! 🎉
