# ETI Educom BMS - Hostinger VPS Deployment Guide

## Prerequisites
- Hostinger VPS with Ubuntu 22.04 or later
- Domain name pointed to your VPS IP
- SSH access to your VPS
- At least 2GB RAM, 2 vCPU, 40GB storage

---

## Step 1: Initial Server Setup

### 1.1 Connect to your VPS
```bash
ssh root@your-vps-ip
```

### 1.2 Update system packages
```bash
apt update && apt upgrade -y
```

### 1.3 Create a non-root user (optional but recommended)
```bash
adduser etieducom
usermod -aG sudo etieducom
su - etieducom
```

### 1.4 Install required packages
```bash
sudo apt install -y python3 python3-pip python3-venv nodejs npm git nginx certbot python3-certbot-nginx
```

### 1.5 Install MongoDB
```bash
# Import MongoDB GPG key
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

---

## Step 2: Clone and Setup Application

### 2.1 Clone the repository
```bash
cd /home/etieducom
git clone https://github.com/YOUR_REPO/eti-educom-bms.git
cd eti-educom-bms
```

### 2.2 Setup Backend
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

# Create .env file
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=etieducom_production
SECRET_KEY=your-super-secret-key-change-this-to-random-string-min-32-chars
EMERGENT_LLM_KEY=sk-emergent-YOUR_KEY_HERE
EOF

# Deactivate venv
deactivate
```

### 2.3 Setup Frontend
```bash
cd ../frontend

# Install Node.js dependencies
npm install

# Create production .env
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://yourdomain.com
EOF

# Build production bundle
npm run build
```

---

## Step 3: Configure PM2 Process Manager

### 3.1 Install PM2 globally
```bash
sudo npm install -g pm2
```

### 3.2 Create PM2 ecosystem file
```bash
cd /home/etieducom/eti-educom-bms

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/home/etieducom/eti-educom-bms/backend',
      script: 'venv/bin/uvicorn',
      args: 'server:app --host 0.0.0.0 --port 8001',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '500M',
      error_file: '/var/log/pm2/backend-error.log',
      out_file: '/var/log/pm2/backend-out.log'
    }
  ]
};
EOF
```

### 3.3 Create log directory
```bash
sudo mkdir -p /var/log/pm2
sudo chown -R etieducom:etieducom /var/log/pm2
```

### 3.4 Start the backend with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the command that PM2 outputs
```

---

## Step 4: Configure Nginx

### 4.1 Create Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/etieducom
```

Add the following content:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend - React static files
    location / {
        root /home/etieducom/eti-educom-bms/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
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
        client_max_body_size 50M;
    }

    # File uploads
    location /uploads/ {
        alias /home/etieducom/eti-educom-bms/backend/uploads/;
    }
}
```

### 4.2 Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/etieducom /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

---

## Step 5: Setup SSL with Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts to complete SSL setup. Certbot will automatically renew certificates.

---

## Step 6: Create Initial Admin User

```bash
cd /home/etieducom/eti-educom-bms/backend
source venv/bin/activate

python3 << 'EOF'
import pymongo
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
client = pymongo.MongoClient("mongodb://localhost:27017")
db = client["etieducom_production"]

# Create default branch
branch = {
    "id": str(uuid.uuid4()),
    "name": "Main Branch",
    "address": "Your Address",
    "city": "Your City",
    "phone": "Your Phone",
    "email": "branch@etieducom.com",
    "created_at": datetime.now(timezone.utc)
}
db.branches.insert_one(branch)
print(f"Branch created: {branch['name']}")

# Create Super Admin user
admin = {
    "id": str(uuid.uuid4()),
    "email": "admin@etieducom.com",
    "hashed_password": pwd_context.hash("admin@123"),
    "name": "Super Admin",
    "role": "Admin",
    "branch_id": branch['id'],
    "is_active": True,
    "created_at": datetime.now(timezone.utc)
}
db.users.insert_one(admin)
print(f"Admin user created: {admin['email']}")
print("Password: admin@123")
print("\n⚠️  IMPORTANT: Change this password immediately after first login!")
EOF

deactivate
```

---

## Step 7: Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Verify firewall status
sudo ufw status
```

---

## Step 8: Setup MongoDB Security (Optional but Recommended)

```bash
# Connect to MongoDB shell
mongosh

# Create admin user
use admin
db.createUser({
  user: "etiadmin",
  pwd: "your-secure-password",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})

# Create application user
use etieducom_production
db.createUser({
  user: "etiapp",
  pwd: "your-app-password",
  roles: [{ role: "readWrite", db: "etieducom_production" }]
})

exit
```

Update `/etc/mongod.conf`:
```yaml
security:
  authorization: enabled
```

Restart MongoDB:
```bash
sudo systemctl restart mongod
```

Update backend `.env`:
```bash
MONGO_URL=mongodb://etiapp:your-app-password@localhost:27017/etieducom_production?authSource=etieducom_production
```

Restart backend:
```bash
pm2 restart backend
```

---

## Step 9: Setup Automatic Backups

Create backup script:
```bash
sudo nano /home/etieducom/backup.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/etieducom/backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --db etieducom_production --out $BACKUP_DIR/mongo_$DATE

# Compress backup
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/mongo_$DATE
rm -rf $BACKUP_DIR/mongo_$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

Make executable and schedule:
```bash
chmod +x /home/etieducom/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * /home/etieducom/backup.sh >> /var/log/backup.log 2>&1
```

---

## Step 10: Monitoring and Maintenance

### Check PM2 status
```bash
pm2 status
pm2 logs backend
```

### Check Nginx logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart services
```bash
pm2 restart backend
sudo systemctl restart nginx
sudo systemctl restart mongod
```

### Update application
```bash
cd /home/etieducom/eti-educom-bms
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
pm2 restart backend

# Update frontend
cd ../frontend
npm install
npm run build
```

---

## Troubleshooting

### Port already in use
```bash
# Find and kill process on port 8001
sudo lsof -i :8001
sudo kill -9 <PID>
pm2 restart backend
```

### MongoDB connection issues
```bash
sudo systemctl status mongod
sudo systemctl restart mongod
```

### Permission issues
```bash
sudo chown -R etieducom:etieducom /home/etieducom/eti-educom-bms
```

### Check backend logs
```bash
pm2 logs backend --lines 100
```

---

## Important URLs After Deployment

- **Application**: https://yourdomain.com
- **Login**: https://yourdomain.com/login
- **Admin Panel**: https://yourdomain.com/admin
- **Certificate Request (Public)**: https://yourdomain.com/certificate-request
- **Certificate Verify (Public)**: https://yourdomain.com/verify-certificate

---

## Default Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@etieducom.com | admin@123 |

⚠️ **CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

---

## WhatsApp Automations

The system includes automated WhatsApp notifications:
- **Fee Reminders**: Sent daily at 9:00 AM for installments due in 7, 5, 3, 1, 0 days
- **Birthday Wishes**: Sent daily at 8:00 AM to students on their birthday

To enable WhatsApp notifications:
1. Login as Admin
2. Go to Admin Panel → Settings → WhatsApp Settings
3. Enter your MSG91 Auth Key and Integrated Number
4. Configure templates for each event type
5. Enable the events you want to use

---

## Support

For deployment issues or questions:
- Check PM2 logs: `pm2 logs backend`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- MongoDB status: `sudo systemctl status mongod`

Good luck with your deployment! 🚀
