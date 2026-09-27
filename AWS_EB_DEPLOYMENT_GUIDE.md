# Persona - AWS Elastic Beanstalk Deployment Guide

## Deployment Package: `persona-eb-deployment.zip`

### What's Included
- **Frontend**: Built React app (optimized with Vite)
- **Server**: Bundled Node.js/Express server (`dist/index.cjs`)
- **Configuration**: AWS EB settings, environment variables, and Procfile
- **Dependencies**: `package.json` and `package-lock.json` for npm install

### Package Contents
```
persona-eb-deployment.zip (8.6 MB)
├── dist/
│   ├── public/          # Built frontend (React + assets)
│   └── index.cjs        # Bundled server
├── .ebextensions/
│   └── port.config      # AWS EB port configuration (8081)
├── .env                 # Production environment variables
├── Procfile             # Startup command: npm start
├── package.json         # Dependencies
├── package-lock.json    # Dependency lock
├── server/              # Source (for reference)
├── shared/              # Shared types (for reference)
└── .npmrc               # Production npm settings
```

### Deployment Steps

1. **Extract the ZIP**
   ```bash
   unzip persona-eb-deployment.zip
   ```

2. **Add Your Credentials**
   Edit `.env` and add your AWS/LiveKit credentials:
   ```env
   NODE_ENV=production
   PORT=8081
   AWS_REGION=ap-south-1
   DYNAMODB_TABLE_NAME=Users
   AWS_ACCESS_KEY_ID=your_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_here
   LIVEKIT_API_KEY=your_key_here
   LIVEKIT_API_SECRET=your_secret_here
   ```

3. **Deploy to AWS Elastic Beanstalk**
   
   **Option A: Using EB CLI**
   ```bash
   eb init -p node.js-20 persona --region ap-south-1
   eb create persona-env
   eb deploy
   ```

   **Option B: AWS Console**
   - Go to Elastic Beanstalk → Create Environment
   - Upload `persona-eb-deployment.zip`
   - Configure environment variables with your credentials

4. **Verify Deployment**
   - Check EB logs: `eb logs`
   - Your app should be running on the Beanstalk domain

### Configuration Details

**Port Configuration** (`port.config`)
- Runs on port 8081 (internal)
- AWS EB load balancer proxies external traffic to port 8081
- Uses nginx as reverse proxy

**Start Command** (`Procfile`)
- `web: npm start`
- Runs the bundled server from `dist/index.cjs`
- NODE_ENV=production is set in the build

**Database**
- Uses AWS DynamoDB for user data
- Table name: `Users` (configurable via env var)
- Requires AWS IAM credentials for access

### Troubleshooting

**Application won't start?**
- Check logs: `eb logs`
- Verify AWS credentials in `.env`
- Check DynamoDB table exists: `DYNAMODB_TABLE_NAME=Users`

**Port conflicts?**
- Port 8081 is hardcoded in `.ebextensions/port.config`
- EB automatically manages traffic routing

**Missing environment variables?**
- All env vars must be set in EB environment configuration or `.env`
- Critical: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

---
Generated: March 10, 2026
