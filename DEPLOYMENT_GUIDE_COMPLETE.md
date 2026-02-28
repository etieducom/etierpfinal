# ETI Educom Branch Management System - Complete Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Option 1: Deploy on Hostinger VPS](#option-1-deploy-on-hostinger-vps)
3. [Option 2: Deploy on DigitalOcean](#option-2-deploy-on-digitalocean)
4. [Option 3: Deploy on AWS EC2](#option-3-deploy-on-aws-ec2)
5. [Database Setup](#database-setup)
6. [SSL Certificate Setup](#ssl-certificate-setup)
7. [Future Updates & Data Safety](#future-updates--data-safety)
8. [Backup & Restore](#backup--restore)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Minimum Server Requirements:
- **RAM**: 2GB (4GB recommended)
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04/22.04 LTS
- **CPU**: 1 vCPU (2 recommended)

### Software Requirements:
- Python 3.10+
- Node.js 18+
- MongoDB 6.0+
- Nginx
- PM2 (Process Manager)
- Git

---

## Option 1: Deploy on Hostinger VPS

### Step 1: Purchase and Access VPS
1. Go to [Hostinger VPS](https://www.hostinger.com/vps-hosting)
2. Choose a plan (VPS 2 or higher recommended)
3. Select Ubuntu 22.04 as OS
4. Note your VPS IP address and root password

### Step 2: Initial Server Setup
```bash
# SSH into your server
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y python3 python3-pip python3-venv nodejs npm nginx git curl

# Install MongoDB
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Install PM2
npm install -g pm2

# Install Yarn
npm install -g yarn
```

### Step 3: Clone Your Application
```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone from GitHub (after saving to GitHub from Emergent)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git eti-educom
cd eti-educom
```

### Step 4: Setup Backend
```bash
cd /var/www/eti-educom/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=eti_educom_prod
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
MSG91_AUTH_KEY=your-msg91-key
MSG91_TEMPLATE_ID=your-template-id
EMERGENT_LLM_KEY=your-emergent-key
EOF

# Test backend
python server.py
# Press Ctrl+C after confirming it starts
```

### Step 5: Setup Frontend
```bash
cd /var/www/eti-educom/frontend

# Install dependencies
yarn install

# Create .env file
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://yourdomain.com
EOF

# Build for production
yarn build
```

### Step 6: Configure PM2
```bash
# Create PM2 ecosystem file
cat > /var/www/eti-educom/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'eti-backend',
      cwd: '/var/www/eti-educom/backend',
      script: 'venv/bin/python',
      args: 'server.py',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Start backend with PM2
cd /var/www/eti-educom
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 7: Configure Nginx
```bash
cat > /etc/nginx/sites-available/eti-educom << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend (React build)
    location / {
        root /var/www/eti-educom/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8001;
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
    }

    # Increase upload size limit
    client_max_body_size 50M;
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/eti-educom /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
```

### Step 8: Setup SSL (Free with Let's Encrypt)
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is automatic, but you can test with:
certbot renew --dry-run
```

---

## Option 2: Deploy on DigitalOcean

### Step 1: Create Droplet
1. Create account at [DigitalOcean](https://www.digitalocean.com)
2. Create Droplet → Ubuntu 22.04 → Basic → $12/month (2GB RAM)
3. Add SSH key or use password

### Step 2: Follow Same Steps
Follow Steps 2-8 from Hostinger VPS guide above.

---

## Option 3: Deploy on AWS EC2

### Step 1: Launch EC2 Instance
1. Go to AWS Console → EC2 → Launch Instance
2. Choose Ubuntu 22.04 LTS AMI
3. Select t2.small or t2.medium
4. Configure Security Group:
   - SSH (22) - Your IP
   - HTTP (80) - Anywhere
   - HTTPS (443) - Anywhere
5. Launch and download key pair

### Step 2: Connect and Setup
```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Follow Steps 2-8 from Hostinger guide
# Replace 'root' with 'ubuntu' and use 'sudo' prefix
```

---

## Database Setup

### MongoDB Configuration for Production
```bash
# Enable authentication
mongosh

use admin
db.createUser({
  user: "eti_admin",
  pwd: "strong_password_here",
  roles: ["root"]
})

use eti_educom_prod
db.createUser({
  user: "eti_app",
  pwd: "another_strong_password",
  roles: [{role: "readWrite", db: "eti_educom_prod"}]
})

exit

# Update /etc/mongod.conf
# Add under security:
#   authorization: enabled

# Restart MongoDB
sudo systemctl restart mongod

# Update backend .env with authenticated URL
# MONGO_URL=mongodb://eti_app:another_strong_password@localhost:27017/eti_educom_prod
```

---

## Future Updates & Data Safety

### Will Updates Affect My Data?

**SHORT ANSWER: NO - Your data is safe!**

Here's why:

1. **Database is Separate**: Your data lives in MongoDB, completely separate from the application code. Updating the code DOES NOT touch the database.

2. **Safe Update Process**:
```bash
# SSH into server
ssh root@YOUR_VPS_IP

# Navigate to app
cd /var/www/eti-educom

# Pull latest changes
git pull origin main

# Update backend dependencies (if any new ones)
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Update frontend dependencies and rebuild
cd ../frontend
yarn install
yarn build

# Restart backend
pm2 restart eti-backend

# Done! Your data remains intact
```

3. **What Gets Updated**:
   - Application code (Python/React files)
   - UI changes
   - New features
   - Bug fixes

4. **What NEVER Gets Touched**:
   - MongoDB database
   - User data
   - Enrollments
   - Payments
   - Leads
   - All your records

### Best Practices for Updates

1. **Always Backup Before Major Updates**:
```bash
# Create backup before updating
mongodump --db eti_educom_prod --out /backup/$(date +%Y%m%d)
```

2. **Test in Staging First** (Optional but recommended):
   - Create a test subdomain
   - Clone database
   - Test updates there first

3. **Version Control**: Keep track of versions
```bash
git log --oneline -5  # See recent changes
git checkout <commit> # Rollback if needed
```

---

## Backup & Restore

### Automated Daily Backups
```bash
# Create backup script
cat > /root/backup-mongodb.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

mongodump --db eti_educom_prod --out $BACKUP_DIR/$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR/$DATE"
EOF

chmod +x /root/backup-mongodb.sh

# Schedule daily backup at 2 AM
crontab -e
# Add: 0 2 * * * /root/backup-mongodb.sh >> /var/log/backup.log 2>&1
```

### Manual Backup
```bash
# Full database backup
mongodump --db eti_educom_prod --out /backup/manual_$(date +%Y%m%d)

# Specific collection backup
mongodump --db eti_educom_prod --collection enrollments --out /backup/enrollments_$(date +%Y%m%d)
```

### Restore from Backup
```bash
# Restore full database
mongorestore --db eti_educom_prod /backup/20260228/eti_educom_prod

# Restore specific collection
mongorestore --db eti_educom_prod --collection enrollments /backup/enrollments_20260228/eti_educom_prod/enrollments.bson
```

---

## Troubleshooting

### Common Issues

**1. Backend not starting**
```bash
# Check logs
pm2 logs eti-backend

# Common fixes:
source /var/www/eti-educom/backend/venv/bin/activate
pip install -r requirements.txt
pm2 restart eti-backend
```

**2. Frontend showing blank page**
```bash
# Rebuild frontend
cd /var/www/eti-educom/frontend
yarn build

# Check Nginx config
nginx -t
systemctl restart nginx
```

**3. MongoDB connection issues**
```bash
# Check if MongoDB is running
systemctl status mongod

# Start if stopped
systemctl start mongod

# Check connection
mongosh
```

**4. SSL certificate issues**
```bash
# Renew certificate
certbot renew --force-renewal
systemctl restart nginx
```

**5. API returning 502 errors**
```bash
# Check if backend is running
pm2 status

# Restart backend
pm2 restart eti-backend

# Check backend logs
pm2 logs eti-backend --lines 50
```

---

## Quick Commands Reference

```bash
# Server Management
pm2 status              # Check app status
pm2 restart eti-backend # Restart backend
pm2 logs eti-backend    # View logs
systemctl restart nginx # Restart Nginx

# Database
mongosh                 # MongoDB shell
mongodump --db eti_educom_prod --out /backup/  # Backup
mongorestore --db eti_educom_prod /backup/path # Restore

# Updates
cd /var/www/eti-educom && git pull  # Pull updates
cd frontend && yarn build           # Rebuild frontend
pm2 restart eti-backend             # Apply changes

# SSL
certbot renew           # Renew SSL
```

---

## Support

For any issues or questions:
1. Check logs first: `pm2 logs eti-backend`
2. Review Nginx logs: `tail -f /var/log/nginx/error.log`
3. MongoDB logs: `tail -f /var/log/mongodb/mongod.log`

---

**Document Version**: 1.0  
**Last Updated**: February 28, 2026
