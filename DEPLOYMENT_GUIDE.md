# ETI Educom - Complete Deployment Guide

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Database Backup](#database-backup)
3. [Server Requirements](#server-requirements)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Domain & SSL Setup](#domain--ssl-setup)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Rollback Procedure](#rollback-procedure)

---

## 1. Pre-Deployment Checklist

Before starting deployment, ensure you have:

- [ ] Access to production server (VPS/Cloud instance)
- [ ] Domain name configured
- [ ] SSL certificate (Let's Encrypt recommended)
- [ ] MongoDB Atlas account OR self-hosted MongoDB
- [ ] Emergent LLM API key (for AI features)
- [ ] Server with minimum 2GB RAM, 2 vCPU

---

## 2. Database Backup

### Option A: MongoDB Atlas (Recommended for Production)

**Step 1: Create MongoDB Atlas Account**
1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account
3. Create a new cluster (M0 Free tier for small scale, M10+ for production)

**Step 2: Export Current Data**
```bash
# On your current server, export all collections
mongodump --uri="mongodb://localhost:27017/crm_db" --out=/backup/$(date +%Y%m%d)

# This creates a backup folder with all your data
```

**Step 3: Import to Atlas**
```bash
# Get your Atlas connection string from the Atlas dashboard
# It looks like: mongodb+srv://username:password@cluster.xxxxx.mongodb.net/

mongorestore --uri="mongodb+srv://USERNAME:PASSWORD@cluster.xxxxx.mongodb.net/crm_db" /backup/YYYYMMDD/crm_db
```

### Option B: Self-Hosted MongoDB Backup

```bash
# Create backup directory
mkdir -p /var/backups/mongodb

# Full database backup
mongodump --db crm_db --out /var/backups/mongodb/$(date +%Y%m%d_%H%M%S)

# Compress backup
cd /var/backups/mongodb
tar -czvf backup_$(date +%Y%m%d).tar.gz $(date +%Y%m%d_%H%M%S)

# Copy to safe location (S3, Google Drive, etc.)
```

### Automated Backup Script (Save as /usr/local/bin/backup_mongodb.sh)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup
mongodump --db crm_db --out $BACKUP_DIR/$DATE

# Compress
tar -czvf $BACKUP_DIR/backup_$DATE.tar.gz -C $BACKUP_DIR $DATE

# Remove uncompressed folder
rm -rf $BACKUP_DIR/$DATE

# Remove backups older than retention period
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

```bash
# Make executable and add to cron
chmod +x /usr/local/bin/backup_mongodb.sh

# Add to crontab (daily backup at 2 AM)
crontab -e
# Add line: 0 2 * * * /usr/local/bin/backup_mongodb.sh >> /var/log/mongodb_backup.log 2>&1
```

---

## 3. Server Requirements

### Recommended Server Specs
- **Small (< 100 users):** 2GB RAM, 2 vCPU, 40GB SSD
- **Medium (100-500 users):** 4GB RAM, 2 vCPU, 80GB SSD
- **Large (500+ users):** 8GB RAM, 4 vCPU, 160GB SSD

### Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+
sudo apt install python3.11 python3.11-venv python3-pip -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Install Nginx
sudo apt install nginx -y

# Install MongoDB (if self-hosting)
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install mongodb-org -y
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Install PM2 for process management
sudo npm install -g pm2

# Install Yarn
npm install -g yarn
```

---

## 4. Backend Deployment

### Step 1: Create Application Directory
```bash
# Create app directory
sudo mkdir -p /var/www/etieducom
sudo chown $USER:$USER /var/www/etieducom
cd /var/www/etieducom
```

### Step 2: Upload Backend Code
```bash
# Option A: Using Git
git clone YOUR_REPOSITORY_URL .

# Option B: Using SCP from local machine
scp -r /path/to/backend user@server:/var/www/etieducom/
```

### Step 3: Setup Python Virtual Environment
```bash
cd /var/www/etieducom/backend

# Create virtual environment
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install additional required packages
pip install openpyxl gunicorn
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

### Step 4: Create Environment File
```bash
nano /var/www/etieducom/backend/.env
```

Add the following content:
```env
# Database
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@cluster.xxxxx.mongodb.net/crm_db
DB_NAME=crm_db

# Security
SECRET_KEY=your-super-secret-key-change-this-to-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com

# Emergent LLM Key (for AI features)
EMERGENT_API_KEY=your-emergent-llm-key

# Optional: Meta/Facebook Integration
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
```

### Step 5: Create Systemd Service
```bash
sudo nano /etc/systemd/system/etieducom-backend.service
```

Add content:
```ini
[Unit]
Description=ETI Educom Backend API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/etieducom/backend
Environment="PATH=/var/www/etieducom/backend/venv/bin"
ExecStart=/var/www/etieducom/backend/venv/bin/gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable etieducom-backend
sudo systemctl start etieducom-backend

# Check status
sudo systemctl status etieducom-backend
```

---

## 5. Frontend Deployment

### Step 1: Build Frontend
```bash
cd /var/www/etieducom/frontend

# Install dependencies
yarn install

# Create production .env file
nano .env.production
```

Add content:
```env
REACT_APP_BACKEND_URL=https://yourdomain.com
```

```bash
# Build production bundle
yarn build
```

### Step 2: Copy Build to Nginx Directory
```bash
sudo mkdir -p /var/www/html/etieducom
sudo cp -r build/* /var/www/html/etieducom/
sudo chown -R www-data:www-data /var/www/html/etieducom
```

---

## 6. Domain & SSL Setup

### Step 1: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/etieducom
```

Add content:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend static files
    root /var/www/html/etieducom;
    index index.html;

    # Frontend routes (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # File upload size limit (for CSV/Excel import)
        client_max_body_size 50M;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;
}
```

### Step 2: Enable Site and Get SSL
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/etieducom /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Restart nginx
sudo systemctl restart nginx
```

### Step 3: Setup Auto-Renewal for SSL
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically adds a cron job, but verify:
sudo systemctl status certbot.timer
```

---

## 7. Post-Deployment Verification

### Step 1: Check Services
```bash
# Check backend status
sudo systemctl status etieducom-backend

# Check nginx status
sudo systemctl status nginx

# Check MongoDB status (if self-hosted)
sudo systemctl status mongod

# View backend logs
sudo journalctl -u etieducom-backend -f
```

### Step 2: Test Endpoints
```bash
# Test backend health
curl https://yourdomain.com/api/health

# Test login
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@etieducom.com&password=admin@123"
```

### Step 3: Test Application Features
1. ✅ Login with all user roles (Admin, Branch Admin, Counsellor, FDE, etc.)
2. ✅ Navigate to Dashboard - verify data loads
3. ✅ Navigate to Insights - verify all tabs work
4. ✅ Navigate to Reports - verify Deleted Leads section
5. ✅ Navigate to Quiz Exams - verify QR code and links work
6. ✅ Test My Responsibilities feature
7. ✅ Test CSV import for Quiz

### Step 4: Setup Monitoring (Optional but Recommended)
```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# Or use systemd journal
sudo journalctl -u etieducom-backend --since "1 hour ago"
```

---

## 8. Rollback Procedure

If something goes wrong, follow these steps:

### Rollback Database
```bash
# Stop backend
sudo systemctl stop etieducom-backend

# Restore from backup
mongorestore --uri="YOUR_MONGO_URI" --drop /var/backups/mongodb/BACKUP_DATE/crm_db

# Start backend
sudo systemctl start etieducom-backend
```

### Rollback Code
```bash
# If using Git
cd /var/www/etieducom
git log --oneline -10  # Find previous commit
git checkout PREVIOUS_COMMIT_HASH

# Rebuild frontend
cd frontend
yarn build
sudo cp -r build/* /var/www/html/etieducom/

# Restart backend
sudo systemctl restart etieducom-backend
```

---

## Quick Reference Commands

```bash
# Start all services
sudo systemctl start etieducom-backend nginx mongod

# Stop all services
sudo systemctl stop etieducom-backend nginx mongod

# Restart backend
sudo systemctl restart etieducom-backend

# View backend logs
sudo journalctl -u etieducom-backend -f

# View nginx access logs
sudo tail -f /var/log/nginx/access.log

# View nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check disk usage
df -h

# Check memory usage
free -m

# Check running processes
htop
```

---

## Support Contacts

- **MongoDB Atlas Support:** https://www.mongodb.com/support
- **Nginx Documentation:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/docs/

---

**Document Version:** 1.0
**Last Updated:** March 7, 2026
