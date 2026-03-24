# MCQLala Backend Setup Guide

## Installation Steps

### 1. Install MongoDB
- Download from: https://www.mongodb.com/try/download/community
- Or use MongoDB Atlas (Cloud): https://www.mongodb.com/cloud/atlas

### 2. Install Node.js Dependencies
Run this command in your project folder:
```
npm install
```

This will install:
- **express** - Web server framework
- **mongoose** - MongoDB object modeling
- **cors** - Cross-Origin Resource Sharing
- **dotenv** - Environment variables
- **nodemon** - Auto-reload during development

### 3. Start MongoDB
If using local MongoDB:
```
mongod
```

### 4. Run the Server
Development mode (with auto-reload):
```
npm run dev
```

Production mode:
```
npm start
```

Server will run on: `http://localhost:3000`

---

## API Endpoints

### MCQ Routes

**Get MCQs by Topic**
```
GET /api/mcqs/:topic
Example: /api/mcqs/Internet%20&%20Web
```

**Get MCQs by Category**
```
GET /api/mcqs-category/:category
Example: /api/mcqs-category/Computer%20Awareness
```

**Get Single MCQ**
```
GET /api/mcqs/detail/:id
```

**Add New MCQ (Admin)**
```
POST /api/mcqs
Body: {
  "category": "Computer Awareness",
  "topic": "Internet & Web",
  "question": "What does HTTP stand for?",
  "options": ["Hyper Text Transfer Protocol", "High Tech Transfer", "etc"],
  "correctAnswer": 0,
  "explanation": "HTTP stands for Hyper Text Transfer Protocol",
  "difficulty": "easy"
}
```

**Update MCQ**
```
PUT /api/mcqs/:id
```

**Delete MCQ**
```
DELETE /api/mcqs/:id
```

---

### Score Routes

**Save Quiz Score**
```
POST /api/scores
Body: {
  "userId": "user123",
  "topic": "Internet & Web",
  "category": "Computer Awareness",
  "score": 8,
  "totalQuestions": 10,
  "answers": [0, 1, 2, 0, 1, 2, 0, 1, 2, 0]
}
```

**Get User Scores**
```
GET /api/scores/:userId
```

**Get Scores by Topic**
```
GET /api/scores-topic/:topic
```

**Get Leaderboard**
```
GET /api/leaderboard/:topic
Returns top 10 scores for a topic
```

---

### User Routes

**Register User**
```
POST /api/users/register
Body: {
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Login User**
```
POST /api/users/login
Body: {
  "email": "john@example.com",
  "password": "password123"
}
```

---

### Statistics Routes

**Get Topic Statistics**
```
GET /api/stats/:topic
Returns average score, highest score, total attempts
```

---

## Environment Variables (.env)

```
MONGODB_URI=mongodb://localhost:27017/mcqlala
PORT=3000
NODE_ENV=development
```

For MongoDB Atlas:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mcqlala
```

---

## How to Connect Frontend to Backend

Add this to your HTML JavaScript:

```javascript
const API_URL = 'http://localhost:3000/api';

// Load MCQs
async function loadMCQs(topic) {
  const response = await fetch(`${API_URL}/mcqs/${topic}`);
  const mcqs = await response.json();
  return mcqs;
}

// Save score
async function saveScore(userId, topic, score, totalQuestions, answers) {
  const response = await fetch(`${API_URL}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      topic,
      category: 'Computer Awareness',
      score,
      totalQuestions,
      answers
    })
  });
  return await response.json();
}
```

---

## Project Structure

```
mcqlala/
├── server.js          # Main backend server
├── package.json       # Dependencies
├── .env              # Environment variables
├── mcq.html          # Frontend
├── style.css         # Styles
└── README.md         # Documentation
```

---

## Troubleshooting

**MongoDB Connection Failed:**
- Make sure MongoDB is running
- Check MONGODB_URI in .env

**CORS Error:**
- Backend is already configured with CORS
- Make sure frontend API calls use correct URL

**Port Already in Use:**
- Change PORT in .env to another port (3001, 3002, etc)

---

## Next Steps

1. Add sample MCQ data to MongoDB
2. Connect frontend to backend APIs
3. Implement user authentication
4. Add admin panel for MCQ management
5. Deploy to production (Heroku, AWS, etc)
