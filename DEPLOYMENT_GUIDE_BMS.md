# ETI Educom BMS - Deployment Guide for Hostinger VPS
## Deploy to `/var/www/bms` with domain `bms.etieducom.com`

---

## QUICK REFERENCE (If Already Setup)

If you've already installed dependencies (Node.js, Python, MongoDB, Nginx), skip to **PART 4**.

---

## PART 1: SERVER PREPARATION (First Time Only)

### 1.1 Connect to VPS via SSH

```bash
ssh root@YOUR_VPS_IP
```

### 1.2 Update System

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip nano ufw software-properties-common
```

### 1.3 Configure Firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

---

## PART 2: INSTALL DEPENDENCIES (First Time Only)

### 2.1 Install Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
node --version
```

### 2.2 Install Python 3.11

```bash
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install -y python3.11 python3.11-venv python3.11-dev python3-pip
python3.11 --version
```

### 2.3 Install MongoDB 7.0

```bash
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list

apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod
systemctl status mongod
```

### 2.4 Install Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 2.5 Install PM2

```bash
npm install -g pm2
```

---

## PART 3: GODADDY DNS SETUP

### 3.1 Add DNS Record in GoDaddy

1. Login to [GoDaddy](https://dcc.godaddy.com/)
2. Go to **My Products → DNS**
3. Add an **A Record**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | bms | YOUR_VPS_IP | 600 |

**Example:**
- Type: A
- Name: bms
- Value: 154.41.xx.xx (your VPS IP)
- TTL: 600 seconds

4. Wait 5-10 minutes for DNS propagation

### 3.2 Verify DNS

```bash
# Run from your local machine or VPS
ping bms.etieducom.com
nslookup bms.etieducom.com
```

---

## PART 4: DEPLOY APPLICATION TO `/var/www/bms`

### 4.1 Create Directory

```bash
mkdir -p /var/www/bms
cd /var/www/bms
```

### 4.2 Upload Code

**Option A: Using Git (if saved to GitHub)**
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

**Option B: Using SFTP (FileZilla/WinSCP)**
- Host: Your VPS IP
- Username: root
- Password: Your password
- Port: 22
- Upload `backend` and `frontend` folders to `/var/www/bms/`

### 4.3 Verify Structure

```bash
ls -la /var/www/bms/
```

Should show:
```
/var/www/bms/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    ├── package.json
    └── .env
```

---

## PART 5: CONFIGURE BACKEND

### 5.1 Setup Python Virtual Environment

```bash
cd /var/www/bms/backend

# Create virtual environment
python3.11 -m venv venv

# Activate it
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip
```

### 5.2 Install Dependencies

```bash
# Install from requirements
pip install -r requirements.txt

# If bcrypt issues, install specific version
pip install bcrypt==4.0.1

# Install emergent integrations (if used)
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

### 5.3 Create Backend .env File

```bash
nano /var/www/bms/backend/.env
```

Add:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=etieducom_bms
SECRET_KEY=REPLACE_WITH_64_CHAR_RANDOM_STRING
MSG91_AUTH_KEY=354230AManBGHBNB694046f8P1
FRONTEND_URL=https://bms.etieducom.com
CORS_ORIGINS=https://bms.etieducom.com,https://etieducom.com
```

**Generate SECRET_KEY:**
```bash
openssl rand -hex 32
```

### 5.4 Test Backend Manually

```bash
cd /var/www/bms/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001
```

Press `Ctrl+C` to stop after verifying it starts.

### 5.5 Create PM2 Configuration

```bash
nano /var/www/bms/ecosystem.config.js
```

Add:
```javascript
module.exports = {
  apps: [{
    name: 'bms-api',
    cwd: '/var/www/bms/backend',
    script: '/var/www/bms/backend/venv/bin/uvicorn',
    args: 'server:app --host 127.0.0.1 --port 8001',
    interpreter: 'none',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 5.6 Start Backend with PM2

```bash
cd /var/www/bms
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the command it outputs
```

### 5.7 Verify Backend

```bash
pm2 status
pm2 logs bms-api
```

---

## PART 6: CONFIGURE FRONTEND

### 6.1 Create Frontend .env

```bash
nano /var/www/bms/frontend/.env
```

Add:
```env
REACT_APP_BACKEND_URL=https://bms.etieducom.com
```

### 6.2 Install Dependencies & Build

```bash
cd /var/www/bms/frontend

# Install packages
npm install

# Build for production
npm run build
```

### 6.3 Verify Build

```bash
ls -la /var/www/bms/frontend/build/
```

---

## PART 7: CONFIGURE NGINX

### 7.1 Create Nginx Configuration

```bash
nano /etc/nginx/sites-available/bms
```

Add:
```nginx
server {
    listen 80;
    server_name bms.etieducom.com;

    # Root directory for React build
    root /var/www/bms/frontend/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Frontend routes - serve React app
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
    }

    # File upload size limit
    client_max_body_size 10M;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 7.2 Enable the Site

```bash
# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Enable bms site
ln -s /etc/nginx/sites-available/bms /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

## PART 8: SSL CERTIFICATE (HTTPS)

### 8.1 Install Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 8.2 Get SSL Certificate

```bash
certbot --nginx -d bms.etieducom.com
```

Follow prompts:
- Enter email
- Agree to terms
- Choose to redirect HTTP to HTTPS (Yes)

### 8.3 Verify Auto-Renewal

```bash
certbot renew --dry-run
```

---

## PART 9: INITIALIZE DATABASE

### 9.1 Create Super Admin User

```bash
cd /var/www/bms/backend
source venv/bin/activate

python3 << 'EOF'
from pymongo import MongoClient
import uuid
from datetime import datetime, timezone
from passlib.context import CryptContext

client = MongoClient("mongodb://localhost:27017")
db = client["etieducom_bms"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed_password = pwd_context.hash("admin@123")

# Create Super Admin
admin = {
    "id": str(uuid.uuid4()),
    "email": "admin@etieducom.com",
    "hashed_password": hashed_password,
    "name": "Super Admin",
    "role": "Admin",
    "branch_id": None,
    "is_active": True,
    "created_at": datetime.now(timezone.utc).isoformat()
}

existing = db.users.find_one({"email": "admin@etieducom.com"})
if not existing:
    db.users.insert_one(admin)
    print("Super Admin created!")
    print("Email: admin@etieducom.com")
    print("Password: admin@123")
else:
    print("Super Admin already exists")
EOF
```

---

## PART 10: VERIFY DEPLOYMENT

### 10.1 Check All Services

```bash
# Check MongoDB
systemctl status mongod

# Check Backend
pm2 status

# Check Nginx
systemctl status nginx
```

### 10.2 Test Application

1. Open browser: `https://bms.etieducom.com`
2. Login with:
   - **Email**: `admin@etieducom.com`
   - **Password**: `admin@123`

---

## USEFUL COMMANDS

### Restart Services

```bash
# Restart Backend
pm2 restart bms-api

# Restart Nginx
systemctl restart nginx

# Restart MongoDB
systemctl restart mongod
```

### View Logs

```bash
# Backend logs
pm2 logs bms-api --lines 100

# Nginx error logs
tail -f /var/log/nginx/error.log

# Nginx access logs
tail -f /var/log/nginx/access.log
```

### Update Application

```bash
cd /var/www/bms

# If using Git
git pull origin main

# Rebuild frontend
cd frontend
npm install
npm run build

# Restart backend
pm2 restart bms-api
```

---

## TROUBLESHOOTING

### 502 Bad Gateway
```bash
pm2 status
pm2 logs bms-api
pm2 restart bms-api
```

### Backend Won't Start
```bash
cd /var/www/bms/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001
# Check error messages
```

### SSL Issues
```bash
certbot renew
certbot certificates
```

### Permission Issues
```bash
chown -R www-data:www-data /var/www/bms/frontend/build
chmod -R 755 /var/www/bms
```

### bcrypt Version Error
```bash
cd /var/www/bms/backend
source venv/bin/activate
pip uninstall bcrypt
pip install bcrypt==4.0.1
pm2 restart bms-api
```

---

## MULTI-SITE SETUP (Optional)

If you want both `etieducom.com` (main site) and `bms.etieducom.com` (BMS app):

### Main Site Nginx Config

```bash
nano /etc/nginx/sites-available/etieducom-main
```

```nginx
server {
    listen 80;
    server_name etieducom.com www.etieducom.com;
    
    root /var/www/etieducom-main;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/etieducom-main /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
certbot --nginx -d etieducom.com -d www.etieducom.com
```

---

## YOUR DEPLOYMENT CHECKLIST

- [ ] DNS: Add A record for `bms` pointing to VPS IP in GoDaddy
- [ ] Upload: Code to `/var/www/bms/`
- [ ] Backend: Create venv, install deps, create .env
- [ ] Frontend: Install deps, create .env, run `npm run build`
- [ ] PM2: Start backend with `pm2 start ecosystem.config.js`
- [ ] Nginx: Create config, enable site, test & reload
- [ ] SSL: Run certbot for HTTPS
- [ ] Database: Create super admin user
- [ ] Test: Login at `https://bms.etieducom.com`

---

**Your BMS is now live at: https://bms.etieducom.com** 

Login: admin@etieducom.com / admin@123
