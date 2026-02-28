# ETI Educom BMS - Complete Step-by-Step Deployment
## Hostinger VPS | Subdomain: bms.etieducom.com

---

## PART 1: PREPARE YOUR VPS

### Step 1.1: Login to VPS via SSH
```bash
ssh root@YOUR_VPS_IP
```
(Replace YOUR_VPS_IP with your Hostinger VPS IP address)

### Step 1.2: Update System
```bash
apt update && apt upgrade -y
```

### Step 1.3: Install Python & Pip
```bash
apt install -y python3 python3-pip python3-venv
```

### Step 1.4: Install Node.js 18
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

### Step 1.5: Install Yarn
```bash
npm install -g yarn
```

### Step 1.6: Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### Step 1.7: Install Nginx
```bash
apt install -y nginx
```

### Step 1.8: Install Certbot (for SSL)
```bash
apt install -y certbot python3-certbot-nginx
```

### Step 1.9: Install Git & Other Tools
```bash
apt install -y git curl wget unzip
```

---

## PART 2: INSTALL MONGODB

### Step 2.1: Add MongoDB Repository
```bash
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
```

### Step 2.2: Add MongoDB Source List
```bash
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

### Step 2.3: Install MongoDB
```bash
apt update
apt install -y mongodb-org
```

### Step 2.4: Start MongoDB
```bash
systemctl start mongod
systemctl enable mongod
```

### Step 2.5: Verify MongoDB is Running
```bash
systemctl status mongod
```
(You should see "active (running)")

---

## PART 3: SECURE MONGODB

### Step 3.1: Open MongoDB Shell
```bash
mongosh
```

### Step 3.2: Create Admin User (Run these commands inside mongosh)
```javascript
use admin
db.createUser({
  user: "adminUser",
  pwd: "Admin@Secure#2024!",
  roles: ["userAdminAnyDatabase", "readWriteAnyDatabase"]
})
```

### Step 3.3: Create App Database User
```javascript
use eti_educom_prod
db.createUser({
  user: "bmsUser",
  pwd: "BmsApp@Secure#2024!",
  roles: ["readWrite"]
})
exit
```

### Step 3.4: Enable MongoDB Authentication
```bash
nano /etc/mongod.conf
```

Find the `#security:` line and change it to:
```yaml
security:
  authorization: enabled
```

Save: Press `Ctrl+X`, then `Y`, then `Enter`

### Step 3.5: Restart MongoDB
```bash
systemctl restart mongod
```

### Step 3.6: Test MongoDB Connection
```bash
mongosh "mongodb://bmsUser:BmsApp%40Secure%232024!@127.0.0.1:27017/eti_educom_prod?authSource=eti_educom_prod"
```
(Type `exit` to close)

---

## PART 4: SETUP DNS (Do this in Hostinger Panel)

### Step 4.1: Login to Hostinger
1. Go to https://hpanel.hostinger.com
2. Click on your domain (etieducom.com)
3. Go to "DNS / Nameservers" → "DNS Records"

### Step 4.2: Add A Record
- Type: A
- Name: bms
- Points to: YOUR_VPS_IP (your VPS IP address)
- TTL: 3600

Click "Add Record"

### Step 4.3: Wait for DNS Propagation
Wait 5-10 minutes before proceeding to SSL setup.

---

## PART 5: DOWNLOAD & SETUP APPLICATION

### Step 5.1: Create Application Directory
```bash
mkdir -p /var/www/bms
cd /var/www/bms
```

### Step 5.2: Download Application Code
**Option A - If you saved to GitHub:**
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

**Option B - Download from Emergent (use the Download button in chat):**
1. Click "Download" button in Emergent chat
2. Extract the ZIP file on your computer
3. Upload using SCP from your local terminal:
```bash
# Run this from YOUR LOCAL computer (not VPS)
scp -r /path/to/extracted/folder/* root@YOUR_VPS_IP:/var/www/bms/
```

### Step 5.3: Verify Files are Present
```bash
ls -la /var/www/bms/
```
You should see: `backend/` `frontend/` folders

---

## PART 6: SETUP BACKEND

### Step 6.1: Go to Backend Folder
```bash
cd /var/www/bms/backend
```

### Step 6.2: Create Python Virtual Environment
```bash
python3 -m venv venv
```

### Step 6.3: Activate Virtual Environment
```bash
source venv/bin/activate
```

### Step 6.4: Upgrade Pip
```bash
pip install --upgrade pip
```

### Step 6.5: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 6.6: Install Emergent Integrations (for AI features)
```bash
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

### Step 6.7: Generate Secret Key
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```
**COPY THIS OUTPUT - you'll need it in the next step**

### Step 6.8: Create Backend .env File
```bash
nano /var/www/bms/backend/.env
```

Paste this content (EDIT THE VALUES):
```
MONGO_URL=mongodb://bmsUser:BmsApp%40Secure%232024!@127.0.0.1:27017/eti_educom_prod?authSource=eti_educom_prod
DB_NAME=eti_educom_prod
SECRET_KEY=PASTE_YOUR_GENERATED_SECRET_KEY_HERE
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=https://bms.etieducom.com
CORS_ORIGINS=https://bms.etieducom.com
EMERGENT_LLM_KEY=your_emergent_key_here
```

Save: Press `Ctrl+X`, then `Y`, then `Enter`

### Step 6.9: Test Backend Starts
```bash
cd /var/www/bms/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001
```

If you see "Application startup complete", press `Ctrl+C` to stop.

---

## PART 7: SETUP FRONTEND

### Step 7.1: Go to Frontend Folder
```bash
cd /var/www/bms/frontend
```

### Step 7.2: Create Frontend .env File
```bash
nano /var/www/bms/frontend/.env
```

Paste this content:
```
REACT_APP_BACKEND_URL=https://bms.etieducom.com
```

Save: Press `Ctrl+X`, then `Y`, then `Enter`

### Step 7.3: Install Frontend Dependencies
```bash
yarn install
```

### Step 7.4: Build Frontend for Production
```bash
yarn build
```

This will take 2-5 minutes. Wait for "Compiled successfully"

### Step 7.5: Verify Build Folder Exists
```bash
ls -la /var/www/bms/frontend/build/
```
You should see `index.html` and other files.

---

## PART 8: SETUP NGINX

### Step 8.1: Create Nginx Config File
```bash
nano /etc/nginx/sites-available/bms.etieducom.com
```

### Step 8.2: Paste This Configuration
```nginx
server {
    listen 80;
    server_name bms.etieducom.com;
    
    # Frontend files
    root /var/www/bms/frontend/build;
    index index.html;
    
    # API proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
    
    # Frontend SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Save: Press `Ctrl+X`, then `Y`, then `Enter`

### Step 8.3: Enable the Site
```bash
ln -s /etc/nginx/sites-available/bms.etieducom.com /etc/nginx/sites-enabled/
```

### Step 8.4: Remove Default Site
```bash
rm -f /etc/nginx/sites-enabled/default
```

### Step 8.5: Test Nginx Config
```bash
nginx -t
```
You should see "syntax is ok" and "test is successful"

### Step 8.6: Restart Nginx
```bash
systemctl restart nginx
```

---

## PART 9: SETUP SSL CERTIFICATE

### Step 9.1: Get SSL Certificate
```bash
certbot --nginx -d bms.etieducom.com
```

When prompted:
- Enter your email address
- Type `Y` to agree to terms
- Type `N` for newsletter (or Y if you want)
- Select option `2` to redirect HTTP to HTTPS

### Step 9.2: Verify SSL Auto-Renewal
```bash
certbot renew --dry-run
```

---

## PART 10: SETUP PM2 (KEEP BACKEND RUNNING)

### Step 10.1: Create Logs Directory
```bash
mkdir -p /var/www/bms/logs
```

### Step 10.2: Create PM2 Config File
```bash
nano /var/www/bms/ecosystem.config.js
```

Paste this content:
```javascript
module.exports = {
  apps: [
    {
      name: 'bms-backend',
      cwd: '/var/www/bms/backend',
      script: 'venv/bin/uvicorn',
      args: 'server:app --host 0.0.0.0 --port 8001',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/www/bms/logs/error.log',
      out_file: '/var/www/bms/logs/output.log'
    }
  ]
};
```

Save: Press `Ctrl+X`, then `Y`, then `Enter`

### Step 10.3: Start Backend with PM2
```bash
cd /var/www/bms
pm2 start ecosystem.config.js
```

### Step 10.4: Save PM2 Process List
```bash
pm2 save
```

### Step 10.5: Setup PM2 to Start on Boot
```bash
pm2 startup
```
(Copy and run the command it outputs)

### Step 10.6: Verify Backend is Running
```bash
pm2 status
```
You should see `bms-backend` with status `online`

---

## PART 11: SETUP FIREWALL

### Step 11.1: Enable UFW Firewall
```bash
ufw enable
```
Type `y` to confirm

### Step 11.2: Allow SSH
```bash
ufw allow ssh
```

### Step 11.3: Allow HTTP & HTTPS
```bash
ufw allow 80
ufw allow 443
```

### Step 11.4: Check Firewall Status
```bash
ufw status
```

---

## PART 12: CREATE SUPER ADMIN USER

### Step 12.1: Run Admin Creation Script
```bash
cd /var/www/bms/backend
source venv/bin/activate

python3 << 'SCRIPT'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
import uuid
from dotenv import load_dotenv

load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    existing = await db.users.find_one({"email": "admin@etieducom.com"})
    if existing:
        print("Admin already exists!")
        client.close()
        return
    
    admin = {
        "id": str(uuid.uuid4()),
        "email": "admin@etieducom.com",
        "password": pwd_context.hash("Admin@123!"),
        "name": "Super Admin",
        "role": "admin",
        "branch_id": None,
        "is_active": True
    }
    
    await db.users.insert_one(admin)
    print("=" * 50)
    print("ADMIN CREATED SUCCESSFULLY!")
    print("=" * 50)
    print("Email: admin@etieducom.com")
    print("Password: Admin@123!")
    print("=" * 50)
    print("IMPORTANT: Change password after first login!")
    print("=" * 50)
    client.close()

asyncio.run(create_admin())
SCRIPT
```

---

## PART 13: FINAL VERIFICATION

### Step 13.1: Check All Services
```bash
echo "=== PM2 Status ==="
pm2 status

echo "=== Nginx Status ==="
systemctl status nginx --no-pager

echo "=== MongoDB Status ==="
systemctl status mongod --no-pager
```

### Step 13.2: Test API Endpoint
```bash
curl https://bms.etieducom.com/api/health
```

### Step 13.3: Open in Browser
Go to: https://bms.etieducom.com

Login with:
- Email: admin@etieducom.com
- Password: Admin@123!

---

## COMMON COMMANDS (Save These!)

### View Backend Logs
```bash
pm2 logs bms-backend
```

### Restart Backend
```bash
pm2 restart bms-backend
```

### Restart Nginx
```bash
systemctl restart nginx
```

### Restart MongoDB
```bash
systemctl restart mongod
```

### Check Disk Space
```bash
df -h
```

### Update Application
```bash
cd /var/www/bms
git pull  # If using git
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && yarn install && yarn build
pm2 restart bms-backend
```

---

## BACKUP DATABASE (Run Weekly)

```bash
cd /var/www/bms
mkdir -p backups
mongodump --uri="mongodb://bmsUser:BmsApp%40Secure%232024!@127.0.0.1:27017/eti_educom_prod?authSource=eti_educom_prod" --out="backups/backup_$(date +%Y%m%d)"
```

---

## TROUBLESHOOTING

### Problem: 502 Bad Gateway
```bash
pm2 status  # Check if backend is running
pm2 logs bms-backend  # Check for errors
pm2 restart bms-backend  # Try restarting
```

### Problem: Cannot Connect to MongoDB
```bash
systemctl status mongod  # Check if MongoDB is running
systemctl restart mongod  # Try restarting
```

### Problem: SSL Certificate Error
```bash
certbot renew --force-renewal
systemctl restart nginx
```

### Problem: Website Not Loading
```bash
nginx -t  # Test nginx config
systemctl restart nginx
```

---

## SECURITY REMINDERS

1. ✅ Change admin password after first login
2. ✅ Keep VPS updated: `apt update && apt upgrade -y`
3. ✅ Monitor logs regularly: `pm2 logs`
4. ✅ Backup database weekly
5. ✅ SSL certificate auto-renews (verify monthly)

---

**DEPLOYMENT COMPLETE!**

Your application is now live at: https://bms.etieducom.com
