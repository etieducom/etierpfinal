# ETI Educom - Complete Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Server Setup](#step-1-server-setup)
3. [Get Your Code](#step-2-get-your-code)
4. [Backend Deployment](#step-3-backend-deployment)
5. [Frontend Deployment](#step-4-frontend-deployment)
6. [Nginx & SSL Setup](#step-5-nginx--ssl-setup)
7. [Database Setup](#step-6-database-setup)
8. [Verification](#step-7-verification)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

---

## Prerequisites

### What You Need Before Starting

| Item | Description | Where to Get |
|------|-------------|--------------|
| VPS Server | Minimum 2GB RAM, 2 vCPU, 40GB SSD | Hostinger, DigitalOcean, AWS, Linode |
| Domain Name | Your custom domain (e.g., crm.yourcompany.com) | GoDaddy, Namecheap, Cloudflare |
| MongoDB Atlas Account | Free cloud database | https://mongodb.com/atlas |
| SSH Access | Terminal access to your server | Your VPS provider |

### Recommended Server Specs
- **OS**: Ubuntu 22.04 LTS
- **RAM**: 2GB minimum (4GB recommended for production)
- **CPU**: 2 vCPU minimum
- **Storage**: 40GB SSD
- **Bandwidth**: Unlimited preferred

---

## Step 1: Server Setup

### 1.1 Connect to Your Server
```bash
ssh root@YOUR_SERVER_IP
```

### 1.2 Update System
```bash
apt update && apt upgrade -y
```

### 1.3 Install Required Software
```bash
# Install Python 3.11
apt install -y software-properties-common
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install -y python3.11 python3.11-venv python3.11-dev

# Install other dependencies
apt install -y nginx certbot python3-certbot-nginx git curl unzip

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Yarn and PM2 globally
npm install -g yarn pm2
```

### 1.4 Create Application Directory
```bash
mkdir -p /var/www/etieducom
```

---

## Step 2: Get Your Code

### Option A: Download from Emergent (Recommended)
1. In the Emergent chat, click the **"Download Code"** button
2. This downloads a ZIP file of your entire project
3. Upload to your server:
```bash
# From your local machine
scp ~/Downloads/code.zip root@YOUR_SERVER_IP:/var/www/

# On your server
cd /var/www
unzip code.zip -d etieducom
```

### Option B: Clone from GitHub
1. In Emergent chat, click **"Save to GitHub"**
2. Follow the prompts to push your code
3. Clone on your server:
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git etieducom
```

---

## Step 3: Backend Deployment

### 3.1 Setup Python Environment
```bash
cd /var/www/etieducom/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip
```

### 3.2 Install Dependencies
```bash
# Install from requirements.txt
pip install -r requirements.txt

# Install additional production packages
pip install gunicorn uvicorn[standard]

# Install Emergent integrations (for AI features)
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

### 3.3 Configure Environment Variables
```bash
nano .env
```

**Paste and edit this configuration:**
```env
# Database Configuration
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/etieducom_db?retryWrites=true&w=majority
DB_NAME=etieducom_db

# Security
SECRET_KEY=your-super-secret-key-change-this-to-64-random-characters

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# AI Features (copy from your current backend/.env)
EMERGENT_LLM_KEY=sk-emergent-your-key-here

# Optional: MSG91 for WhatsApp (if using)
MSG91_AUTH_KEY=your-msg91-key
```

**Generate a secure SECRET_KEY:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 3.4 Create Systemd Service
```bash
cat > /etc/systemd/system/etieducom.service << 'EOF'
[Unit]
Description=ETI Educom Backend API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/etieducom/backend
Environment="PATH=/var/www/etieducom/backend/venv/bin"
ExecStart=/var/www/etieducom/backend/venv/bin/gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8001 --timeout 120
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### 3.5 Set Permissions and Start Service
```bash
# Set ownership
chown -R www-data:www-data /var/www/etieducom

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable etieducom
systemctl start etieducom

# Check status
systemctl status etieducom
```

---

## Step 4: Frontend Deployment

### 4.1 Configure Frontend
```bash
cd /var/www/etieducom/frontend

# Create production environment file
cat > .env.production << 'EOF'
REACT_APP_BACKEND_URL=https://yourdomain.com
EOF
```

### 4.2 Build Frontend
```bash
# Install dependencies
yarn install

# Build for production
yarn build
```

### 4.3 Deploy to Nginx Directory
```bash
# Create nginx web directory
mkdir -p /var/www/html/etieducom

# Copy build files
cp -r build/* /var/www/html/etieducom/

# Set permissions
chown -R www-data:www-data /var/www/html/etieducom
```

---

## Step 5: Nginx & SSL Setup

### 5.1 Create Nginx Configuration
```bash
cat > /etc/nginx/sites-available/etieducom << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend files
    root /var/www/html/etieducom;
    index index.html;

    # SSL will be configured by certbot
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 50M;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF
```

### 5.2 Enable Site
```bash
# Create symlink
ln -sf /etc/nginx/sites-available/etieducom /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart nginx
systemctl restart nginx
```

### 5.3 Install SSL Certificate
```bash
# Get SSL certificate (replace with your domain)
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### 5.4 Auto-Renew SSL
```bash
# Test renewal
certbot renew --dry-run

# Certbot automatically sets up a cron job for renewal
```

---

## Step 6: Database Setup

### 6.1 Create MongoDB Atlas Cluster

1. Go to https://mongodb.com/atlas
2. Sign up or log in
3. Create a **FREE** cluster (M0 Sandbox)
4. Wait for cluster to deploy (~3 minutes)

### 6.2 Configure Database Access

1. In Atlas sidebar, click **Database Access**
2. Click **Add New Database User**
3. Choose **Password** authentication
4. Enter username and generate a secure password
5. Set privileges to **Read and write to any database**
6. Click **Add User**

### 6.3 Configure Network Access

1. In Atlas sidebar, click **Network Access**
2. Click **Add IP Address**
3. Either:
   - Click **Add Current IP Address** (for testing)
   - Or click **Allow Access from Anywhere** (0.0.0.0/0) for production
4. Click **Confirm**

### 6.4 Get Connection String

1. In Atlas sidebar, click **Database**
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Copy the connection string
5. Replace `<password>` with your database user password

### 6.5 Update Backend Environment
```bash
nano /var/www/etieducom/backend/.env

# Update MONGO_URL with your Atlas connection string:
MONGO_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/etieducom_db?retryWrites=true&w=majority
```

### 6.6 Restart Backend
```bash
systemctl restart etieducom
```

### 6.7 Seed Initial Data (Optional)

If you want to migrate data from the preview environment:

```bash
# Export from Emergent preview (contact support for data export)
# Or create fresh admin user:

cd /var/www/etieducom/backend
source venv/bin/activate
python3 -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

async def create_admin():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client['etieducom_db']
    
    admin = {
        'id': 'admin-001',
        'email': 'admin@yourcompany.com',
        'name': 'Super Admin',
        'role': 'Admin',
        'hashed_password': pwd_context.hash('YourSecurePassword123'),
        'is_active': True,
        'branch_id': None
    }
    
    await db.users.update_one({'email': admin['email']}, {'\$set': admin}, upsert=True)
    print('Admin user created!')

asyncio.run(create_admin())
"
```

---

## Step 7: Verification

### 7.1 Test Backend API
```bash
# Health check
curl https://yourdomain.com/api/health

# Expected response: {"status":"healthy","database":"connected"}
```

### 7.2 Test Login
```bash
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@yourcompany.com&password=YourSecurePassword123&session=2025-26"
```

### 7.3 Manual Testing Checklist

Open https://yourdomain.com in your browser and verify:

- [ ] Login page loads correctly
- [ ] Can log in as Super Admin
- [ ] Dashboard loads with data
- [ ] Can navigate to all menu items
- [ ] Insights page shows AI analysis
- [ ] Can create/edit leads
- [ ] Can create enrollments
- [ ] Can record payments
- [ ] Reports generate correctly

---

## Troubleshooting

### Backend Won't Start
```bash
# Check logs
journalctl -u etieducom -f --no-pager -n 100

# Common fixes:
# 1. Missing dependencies
cd /var/www/etieducom/backend
source venv/bin/activate
pip install -r requirements.txt

# 2. Permission issues
chown -R www-data:www-data /var/www/etieducom
```

### 502 Bad Gateway
```bash
# Backend not running
systemctl restart etieducom

# Check if port 8001 is listening
ss -tlnp | grep 8001
```

### Database Connection Failed
1. Check MONGO_URL in .env is correct
2. Verify MongoDB Atlas IP whitelist includes your server IP
3. Test connection:
```bash
cd /var/www/etieducom/backend
source venv/bin/activate
python3 -c "
from motor.motor_asyncio import AsyncIOMotorClient
import os, asyncio
async def test():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    await client.admin.command('ping')
    print('MongoDB connected successfully!')
asyncio.run(test())
"
```

### Frontend Shows Blank Page
```bash
# Rebuild
cd /var/www/etieducom/frontend
yarn build
cp -r build/* /var/www/html/etieducom/

# Check browser console for errors
```

### SSL Certificate Issues
```bash
# Renew manually
certbot renew

# Check certificate status
certbot certificates
```

---

## Maintenance

### Daily Commands
```bash
# Check service status
systemctl status etieducom nginx

# View recent logs
journalctl -u etieducom --since "1 hour ago"
```

### Update Code
```bash
# If using Git
cd /var/www/etieducom
git pull

# Rebuild frontend
cd frontend
yarn install
yarn build
cp -r build/* /var/www/html/etieducom/

# Restart backend
systemctl restart etieducom
```

### Backup Database
```bash
# MongoDB Atlas handles backups automatically
# For manual backup:
mongodump --uri="YOUR_MONGO_URL" --out=/backup/$(date +%Y%m%d)
```

### Monitor Resources
```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
top
```

---

## Default Login Credentials

After deployment, use these default accounts:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@etieducom.com | admin@123 |
| Branch Admin | branchadmin@etieducom.com | admin@123 |
| FDE | fde@etieducom.com | password |
| Counsellor | counsellor@etieducom.com | password |

**IMPORTANT**: Change all passwords after first login!

---

## Support

If you encounter issues:
1. Check the logs: `journalctl -u etieducom -f`
2. Verify all environment variables are set correctly
3. Ensure MongoDB Atlas IP whitelist is configured
4. Check Nginx error logs: `tail -f /var/log/nginx/error.log`

---

*Last Updated: March 2026*
