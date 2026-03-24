# MCQLALA Deployment Guide

## Folder Structure

```
├── backend/          # Backend API (Node.js + Express + MongoDB)
│   ├── server.js
│   ├── package.json
│   └── .env          # Add MONGODB_URI here
│
├── frontend/         # Frontend (HTML + CSS + JS)
│   ├── index.html
│   ├── admin.html
│   ├── app.js
│   └── vercel.json   # API proxy config
│
└── README.md
```

---

## Deployment

### 1. Backend → Render
- Upload: `backend/` folder contents
- Start Command: `node server.js`
- Env Variable: `MONGODB_URI=mongodb+srv://mcqlala:mcqlala123@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`
- URL Example: `https://mcqlala-backend.onrender.com`

### 2. Frontend → Vercel
- Upload: `frontend/` folder contents
- After deploying, update `vercel.json` with your backend URL:
  ```json
  { "rewrites": [{ "source": "/api/(.*)", "destination": "https://YOUR-BACKEND.onrender.com/api/$1" }] }
  ```

### 3. Domain
- Add `mcqlala.in` in Vercel Settings → Domains
- Update DNS at your domain registrar
