# 🚀 PRODUCTION DEPLOYMENT GUIDE

Now that critical security issues are fixed, here's how to deploy safely.

---

## **Pre-Deployment Checklist** ✅

- [x] Plaintext passwords removed
- [x] Environment variables configured
- [x] Rate limiting enabled
- [x] Security headers enhanced
- [ ] SSL/HTTPS certificate obtained
- [ ] Domain name purchased (if not already)
- [ ] Hosting provider selected

---

## **Step 1: Choose a Hosting Provider**

### Option A: **Free/Cheap** (Good for Learning)
- **Heroku** (Free tier deprecated, now $7/month)
- **Railway.app** ($5/month)
- **Render** (Free tier available)

### Option B: **Recommended** (Best for Production)
- **DigitalOcean** ($5/month VPS)
- **AWS** (Pay-as-you-go)
- **Vercel** (Next.js & Node.js friendly)
- **Fly.io** (Modern cloud platform)

### Option C: **Self-Hosted** (Maximum Control)
- Your own server/VPS
- Need to handle SSL, backups, security

---

## **Step 2: Update .env for Production**

```bash
# Before deploying, update your .env file:

NODE_ENV=production
PORT=3004
CORS_ORIGIN=https://your-domain.com  # ← Change this!
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_SECRET=use-a-real-secure-random-string-here
```

**Generate secure SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## **Step 3: Get SSL Certificate**

### Option A: **Let's Encrypt** (FREE - Recommended)
```bash
# Using Certbot
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d your-domain.com
```

### Option B: **Hosting Provider Certificate**
- Most providers (Heroku, Railway, Render) provide free SSL
- Just point your domain to them

### Option C: **Self-Signed** (Testing only, NOT for production)
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

---

## **Step 4: Update Server for HTTPS**

If hosting your own server, update `server.js`:

```javascript
const https = require('https');
const fs = require('fs');

// Load SSL certificate (if using Let's Encrypt or self-signed)
const options = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
};

// Start HTTPS server
https.createServer(options, app).listen(PORT, () => {
    console.log(`Secure server running at https://localhost:${PORT}`);
});
```

---

## **Step 5: Deploy Code**

### Using Heroku:
```bash
heroku create your-app-name
heroku config:set CORS_ORIGIN=https://your-domain.com
git push heroku main
```

### Using Railway/Render:
1. Connect GitHub repo
2. Add environment variables in dashboard
3. Click "Deploy"

### Self-Hosted:
```bash
# On your server
git clone your-repo-url
cd your-project
npm install
npm start
```

---

## **Step 6: Point Domain to Your Server**

### For Heroku/Railway/Render:
1. Go to DNS settings of your domain registrar
2. Add CNAME record pointing to their server

### For Self-Hosted:
1. Add A record pointing to your server's IP
2. Wait for DNS propagation (5-30 minutes)

---

## **Step 7: Test Everything**

```bash
# Test login endpoint
curl -X POST https://your-domain.com/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tawseef2414@gmail.com","password":"tawseef@1237006"}'

# Should return user data with 200 status

# Test CORS
curl -i https://your-domain.com/api/subjects

# Test rate limiting
for i in {1..10}; do
  curl -X POST https://your-domain.com/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Should get blocked after 5 attempts
```

---

## **Step 8: Monitor & Maintain**

### Daily:
- Check error logs
- Monitor uptime

### Weekly:
- Review rate limit data
- Check user feedback

### Monthly:
- Backup database
- Review security logs
- Update dependencies: `npm update`

---

## **Troubleshooting**

### Issue: "CORS error after deployment"
**Solution**: Check .env file has correct `CORS_ORIGIN` and restart server

### Issue: "Too many requests error"
**Solution**: This is rate limiting working! It's good. Wait 15 minutes or change `RATE_LIMIT_MAX_REQUESTS` in .env

### Issue: "SSL certificate error"
**Solution**: 
- Check certificate is valid: `openssl x509 -in cert.pem -text -noout`
- Restart server: `npm start`

### Issue: "Database errors after deployment"
**Solution**: Check `.env` has correct `MONGODB_URI` (when migrating to MongoDB)

---

## **Security Reminders**

⚠️ **NEVER commit these to git**:
- `.env` file with real secrets
- Database files with sensitive data
- SSL private keys

✅ **DO**:
- Use `.gitignore` to exclude sensitive files
- Rotate secrets regularly
- Monitor logs for suspicious activity
- Keep Node.js updated

---

## **Post-Deployment** 

### Implement these Advanced Features:

1. **Email Notifications** (for password resets)
   ```bash
   npm install nodemailer
   ```

2. **Database Backup** (automatic)
   ```bash
   # Setup cron job for daily backups
   0 2 * * * mongodump --out /backups/$(date +\%Y\%m\%d)
   ```

3. **Error Tracking** (Sentry)
   ```bash
   npm install @sentry/node
   ```

4. **Logging** (Winston)
   ```bash
   npm install winston
   ```

---

## **Production Checklist Before Going LIVE**

- [ ] SSL/HTTPS working
- [ ] Domain pointing to server
- [ ] .env configured for production
- [ ] Rate limiting tested
- [ ] CORS allows your domain
- [ ] Admin login works
- [ ] Database backups configured
- [ ] Error logging setup
- [ ] Monitoring enabled
- [ ] Security headers verified

---

## **Get Help**

If deployment fails:
1. Check console logs: `npm run dev`
2. Check env variables: `echo $CORS_ORIGIN`
3. Check firewall: `sudo ufw status`
4. Check port: `sudo netstat -tulpn | grep 3004`

---

**Your website is ready for production! Good luck! 🚀**
