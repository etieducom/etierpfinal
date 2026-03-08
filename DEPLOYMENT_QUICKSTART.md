# ETI Educom - Quick Deployment Checklist

## Before You Start

### Required Credentials
| Item | Where to Get |
|------|-------------|
| VPS Server | Hostinger, DigitalOcean, AWS, etc. |
| Domain Name | Your domain registrar |
| MongoDB Atlas (Recommended) | https://mongodb.com/atlas |
| Emergent LLM Key | Already in backend/.env |

### Server Requirements
- **Minimum**: 2GB RAM, 2 vCPU, 40GB SSD
- **OS**: Ubuntu 22.04 LTS (recommended)

---

## Step-by-Step Deployment

### Phase 1: Server Setup (10 mins)

```bash
# 1. SSH into your server
ssh root@your-server-ip

# 2. Update system
apt update && apt upgrade -y

# 3. Install all requirements in one command
apt install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx git

# 4. Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 5. Install Yarn and PM2
npm install -g yarn pm2
```

### Phase 2: Get Your Code (5 mins)

**Option A: Download from Emergent**
1. In Emergent chat, click "Download Code" button
2. Upload the ZIP to your server
3. Extract: `unzip code.zip -d /var/www/etieducom`

**Option B: Push to GitHub First**
1. In Emergent chat, click "Save to GitHub"
2. On server: `git clone YOUR_REPO_URL /var/www/etieducom`

### Phase 3: Backend Setup (10 mins)

```bash
# 1. Navigate to backend
cd /var/www/etieducom/backend

# 2. Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn openpyxl
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

# 4. Create production .env file
nano .env
```

**Paste this into .env (edit values):**
```env
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/crm_db
DB_NAME=crm_db
SECRET_KEY=GENERATE-A-RANDOM-64-CHAR-STRING-HERE
FRONTEND_URL=https://yourdomain.com
EMERGENT_LLM_KEY=sk-emergent-your-key-here
```

```bash
# 5. Create systemd service
cat > /etc/systemd/system/etieducom.service << 'EOF'
[Unit]
Description=ETI Educom Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/etieducom/backend
Environment="PATH=/var/www/etieducom/backend/venv/bin"
ExecStart=/var/www/etieducom/backend/venv/bin/gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 6. Set permissions and start
chown -R www-data:www-data /var/www/etieducom
systemctl daemon-reload
systemctl enable etieducom
systemctl start etieducom

# 7. Verify it's running
systemctl status etieducom
```

### Phase 4: Frontend Setup (5 mins)

```bash
# 1. Navigate to frontend
cd /var/www/etieducom/frontend

# 2. Create production env
echo "REACT_APP_BACKEND_URL=https://yourdomain.com" > .env.production

# 3. Install and build
yarn install
yarn build

# 4. Copy to nginx directory
mkdir -p /var/www/html/etieducom
cp -r build/* /var/www/html/etieducom/
chown -R www-data:www-data /var/www/html/etieducom
```

### Phase 5: Nginx & SSL (5 mins)

```bash
# 1. Create nginx config
cat > /etc/nginx/sites-available/etieducom << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/html/etieducom;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
EOF

# 2. Enable site
ln -sf /etc/nginx/sites-available/etieducom /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 3. Test and restart nginx
nginx -t
systemctl restart nginx

# 4. Get SSL certificate (replace with your domain)
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Phase 6: Database Migration (5 mins)

**Option A: MongoDB Atlas (Recommended)**
1. Go to https://mongodb.com/atlas
2. Create free cluster
3. Get connection string
4. Update `/var/www/etieducom/backend/.env` with new MONGO_URL
5. Import your data using mongorestore

**Option B: Export from Emergent Preview**
```bash
# On your local machine, export from preview
mongodump --uri="mongodb://localhost:27017" --db=test_database --out=./backup

# Upload backup folder to server
scp -r ./backup user@yourserver:/tmp/

# On server, restore to new database
mongorestore --uri="YOUR_ATLAS_URI" --db=crm_db /tmp/backup/test_database
```

---

## Verification Checklist

After deployment, test these:

```bash
# Test backend health
curl https://yourdomain.com/api/health

# Test login
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@etieducom.com&password=admin@123"
```

### Manual Testing
- [ ] Login as Super Admin
- [ ] Login as Branch Admin
- [ ] Check Dashboard loads
- [ ] Check Insights page (all tabs)
- [ ] Check Reports page
- [ ] Check Quiz Exams page
- [ ] Test My Responsibilities

---

## Common Issues & Fixes

### Backend not starting
```bash
# Check logs
journalctl -u etieducom -f

# Common fix: permissions
chown -R www-data:www-data /var/www/etieducom
```

### 502 Bad Gateway
```bash
# Backend probably not running
systemctl restart etieducom
```

### Database connection failed
- Check MONGO_URL in .env
- Ensure MongoDB Atlas IP whitelist includes your server

### Frontend shows blank page
```bash
# Rebuild frontend
cd /var/www/etieducom/frontend
yarn build
cp -r build/* /var/www/html/etieducom/
```

---

## Daily Maintenance Commands

```bash
# Check status
systemctl status etieducom nginx

# View logs
journalctl -u etieducom --since "1 hour ago"

# Restart backend after code changes
systemctl restart etieducom

# Restart nginx after config changes
nginx -t && systemctl restart nginx
```

---

## Need Help?

See the full guide: `DEPLOYMENT_GUIDE.md`
