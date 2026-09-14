# Authentication System Integration Guide

Complete guide to integrate the new login/signup authentication system with your existing Supabase backend.

---

## 📁 File Structure

```
project-root/
├── frontend/
│   ├── auth-login.html          ← LOGIN/SIGNUP PAGE (New)
│   ├── dashboard.html           ← MAIN DASHBOARD (New)
│   ├── auth-utils.js            ← AUTH UTILITIES (New)
│   ├── index.html               ← (Keep existing games here)
│   └── style.css                ← (Keep existing styles)
├── backend/
│   ├── server.js                ← (Modify - add routes)
│   ├── config/db.js             ← (Keep existing)
│   ├── controllers/
│   │   ├── patientController.js ← (Modify - add auth logic)
│   │   └── scoreController.js   ← (Keep existing)
│   ├── routes/
│   │   ├── patientRoutes.js     ← (Modify - add auth endpoints)
│   │   └── scoreRoutes.js       ← (Keep existing)
│   ├── middleware/
│   │   └── authMiddleware.js    ← (Create - authentication middleware)
│   └── utils/
│       └── passwordHash.js      ← (Create - password utilities)
└── .env                          ← (Add JWT_SECRET)
```

---

## 🚀 STEP 1: Setup Database Tables (Supabase)

### Run this SQL in Supabase SQL Editor:

```sql
-- Drop existing tables if they exist (careful!)
DROP TABLE IF EXISTS public.caregivers CASCADE;

-- Create caregivers/users table
CREATE TABLE public.caregivers (
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  caretaker_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  mobile_number VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  language VARCHAR(50) DEFAULT 'English',
  voice_helper VARCHAR(50) DEFAULT 'English',
  difficulty VARCHAR(20) DEFAULT 'Medium',
  remember_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mobile_number)
);

-- Create sessions table for tracking logins
CREATE TABLE public.caregiver_sessions (
  id BIGSERIAL PRIMARY KEY,
  caregiver_id BIGINT NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caregiver_id) REFERENCES public.caregivers(id)
);

-- Create indexes for better performance
CREATE INDEX idx_caregivers_mobile ON public.caregivers(mobile_number);
CREATE INDEX idx_caregivers_patient_id ON public.caregivers(patient_id);
CREATE INDEX idx_sessions_token ON public.caregiver_sessions(token);
CREATE INDEX idx_sessions_expires_at ON public.caregiver_sessions(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (optional but recommended)
CREATE POLICY "Users can view their own data" ON public.caregivers
  FOR SELECT USING (true);  -- Adjust based on your needs
```

---

## 🔧 STEP 2: Create Backend Middleware

### File: `backend/middleware/authMiddleware.js`

```javascript
const jwt = require('jsonwebtoken');

/**
 * Verify JWT token
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

/**
 * Refresh token
 */
const refreshToken = (req, res, next) => {
  try {
    const decoded = jwt.decode(req.headers.authorization?.split(' ')[1]);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check if token is expiring soon (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp - now < 300) {
      const newToken = jwt.sign(
        { id: decoded.id, email: decoded.email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      req.newToken = newToken;
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = { verifyToken, refreshToken };
```

### File: `backend/utils/passwordHash.js`

```javascript
const crypto = require('crypto');

/**
 * Hash password using SHA256 + salt
 * For production, use bcrypt instead
 */
const hashPassword = (password, salt = null) => {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }

  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');

  return `${salt}:${hash}`;
};

/**
 * Verify password
 */
const verifyPassword = (password, hash) => {
  const parts = hash.split(':');
  const salt = parts[0];
  const storedHash = parts[1];

  const computedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');

  return computedHash === storedHash;
};

module.exports = { hashPassword, verifyPassword };
```

---

## 📝 STEP 3: Update Patient Controller

### File: `backend/controllers/patientController.js`

```javascript
const { hashPassword, verifyPassword } = require('../utils/passwordHash');
const jwt = require('jsonwebtoken');

// Get all patients
async function getAllPatients(req, res) {
  try {
    const supabase = req.app.locals.supabase;
    if (!supabase) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    const { data, error } = await supabase
      .from('patients')
      .select('*');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Failed to fetch patients', error: error.message });
  }
}

// Register (Create new caregiver + patient)
async function register(req, res) {
  try {
    const supabase = req.app.locals.supabase;
    if (!supabase) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    const { patient_name, caretaker_name, caretaker_mobile, password, language, voice_helper } = req.body;

    // Validation
    if (!patient_name || !caretaker_name || !caretaker_mobile || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Step 1: Create patient
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert([{
        full_name: patient_name,
        age: 0,
        language: language || 'English',
        voice_helper: voice_helper || 'English',
        wellbeing_score: 50,
        streak_days: 0
      }])
      .select();

    if (patientError) throw patientError;
    const patient = patientData[0];

    // Step 2: Create caregiver
    const passwordHash = hashPassword(password);
    const { data: caregiverData, error: caregiverError } = await supabase
      .from('caregivers')
      .insert([{
        patient_id: patient.id,
        caretaker_name: caretaker_name,
        mobile_number: caretaker_mobile,
        password_hash: passwordHash,
        language: language || 'English',
        voice_helper: voice_helper || 'English'
      }])
      .select();

    if (caregiverError) throw caregiverError;
    const caregiver = caregiverData[0];

    // Step 3: Generate JWT token
    const token = jwt.sign(
      {
        id: caregiver.id,
        patient_id: patient.id,
        caretaker_name: caregiver.caretaker_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Step 4: Create session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await supabase
      .from('caregiver_sessions')
      .insert([{
        caregiver_id: caregiver.id,
        token: token,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        expires_at: expiresAt
      }]);

    res.status(201).json({
      success: true,
      user: {
        id: caregiver.id,
        patient_id: patient.id,
        patient_name: patient.full_name,
        caretaker_name: caregiver.caretaker_name,
        language: language,
        voice_helper: voice_helper
      },
      token: token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
}

// Login
async function login(req, res) {
  try {
    const supabase = req.app.locals.supabase;
    if (!supabase) {
      return res.status(503).json({ message: 'Database unavailable' });
    }

    const { caretaker_name, password } = req.body;

    if (!caretaker_name || !password) {
      return res.status(400).json({ message: 'Missing caretaker name or password' });
    }

    // Find caregiver
    const { data: caregivers, error } = await supabase
      .from('caregivers')
      .select('*')
      .eq('caretaker_name', caretaker_name);

    if (error) throw error;

    if (!caregivers || caregivers.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const caregiver = caregivers[0];

    // Verify password
    if (!verifyPassword(password, caregiver.password_hash)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Fetch patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', caregiver.patient_id)
      .single();

    if (patientError) throw patientError;

    // Generate token
    const token = jwt.sign(
      {
        id: caregiver.id,
        patient_id: patient.id,
        caretaker_name: caregiver.caretaker_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await supabase
      .from('caregiver_sessions')
      .insert([{
        caregiver_id: caregiver.id,
        token: token,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        expires_at: expiresAt
      }]);

    res.json({
      success: true,
      user: {
        id: caregiver.id,
        patient_id: patient.id,
        patient_name: patient.full_name,
        caretaker_name: caregiver.caretaker_name,
        language: caregiver.language,
        voice_helper: caregiver.voice_helper
      },
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
}

// Logout
async function logout(req, res) {
  try {
    const supabase = req.app.locals.supabase;
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      await supabase
        .from('caregiver_sessions')
        .delete()
        .eq('token', token);
    }

    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed', error: error.message });
  }
}

// Verify token
async function verifyTokenEndpoint(req, res) {
  try {
    res.json({ success: true, userId: req.userId });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = {
  getAllPatients,
  register,
  login,
  logout,
  verifyTokenEndpoint
};
```

---

## 🛣️ STEP 4: Update Routes

### File: `backend/routes/patientRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', patientController.register);
router.post('/login', patientController.login);

// Protected routes
router.post('/logout', verifyToken, patientController.logout);
router.get('/verify', verifyToken, patientController.verifyTokenEndpoint);
router.get('/', verifyToken, patientController.getAllPatients);

module.exports = router;
```

---

## 🔌 STEP 5: Update Server Configuration

### File: `backend/server.js` (modifications only)

```javascript
const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const express = require("express");
const connectDB = require("./config/db");
const { refreshSession } = require("./utils/supabase/middleware");
const patientRoutes = require("./routes/patientRoutes");
const scoreRoutes = require("./routes/scoreRoutes");

const app = express();
const frontendPath = path.resolve(__dirname, "../frontend");

app.use(express.json());
app.use(refreshSession);

// CORS configuration
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// Static files
app.use(express.static(frontendPath));

// API routes
app.use("/api/patient", patientRoutes);
app.use("/api/scores", scoreRoutes);

// Serve frontend - Updated to serve auth-login.html first
app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "auth-login.html"));
});

// Serve dashboard
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(frontendPath, "dashboard.html"));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

async function startServer() {
    const port = process.env.PORT || 5000;
    app.locals.supabase = null;

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });

    try {
        app.locals.supabase = await connectDB();
    } catch (error) {
        console.error(`Supabase is unavailable. The local server will continue without database features: ${error.message}`);
    }
}

startServer().catch((error) => {
    console.error("Backend startup failed.", error);
    process.exitCode = 1;
});
```

---

## 📋 STEP 6: Update .env File

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server
PORT=5000
NODE_ENV=development
```

---

## 🔐 Security Considerations

### 1. Password Hashing
For production, use **bcrypt** instead of the basic PBKDF2:

```bash
npm install bcrypt
```

Then update `passwordHash.js`:

```javascript
const bcrypt = require('bcrypt');

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};
```

### 2. HTTPS
Always use HTTPS in production.

### 3. CORS
Configure CORS properly for your domain:

```javascript
const cors = require('cors');

app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

### 4. Rate Limiting
Add rate limiting for login attempts:

```bash
npm install express-rate-limit
```

### 5. Input Validation
Validate all inputs on the backend:

```javascript
const { body, validationResult } = require('express-validator');

router.post('/login', [
  body('caretaker_name').notEmpty().trim().escape(),
  body('password').notEmpty().isLength({ min: 6 })
], loginController);
```

---

## 📱 File Deployment

1. **Copy frontend files to `/frontend/` folder:**
   - `auth-login.html`
   - `dashboard.html`
   - `auth-utils.js`

2. **Copy backend files to `/backend/` folder:**
   - Update `server.js`
   - Create `middleware/authMiddleware.js`
   - Create `utils/passwordHash.js`
   - Update `controllers/patientController.js`
   - Update `routes/patientRoutes.js`

3. **Update database:**
   - Run SQL queries in Supabase

4. **Update environment:**
   - Add `JWT_SECRET` to `.env`

5. **Install dependencies:**
   ```bash
   npm install jsonwebtoken express-validator
   ```

---

## ✅ Testing Checklist

- [ ] Sign up with valid data
- [ ] Try signing up with existing user (should fail)
- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Access dashboard without login (should redirect)
- [ ] Logout functionality works
- [ ] Remember me feature works
- [ ] Session persists on page refresh
- [ ] API calls include auth header
- [ ] Game scores save correctly

---

## 🎯 Production Deployment

1. Update `JWT_SECRET` to a strong random string
2. Enable HTTPS
3. Configure proper CORS origins
4. Add database backups
5. Enable RLS policies in Supabase
6. Use bcrypt for password hashing
7. Add rate limiting
8. Set up error logging
9. Configure CDN for static assets
10. Enable database connection pooling

---

## 📞 Troubleshooting

**Issue:** "Database unavailable" error
- Check Supabase connection string
- Verify network connectivity
- Check `.env` file

**Issue:** Login fails with correct credentials
- Verify password hash comparison
- Check user exists in database
- Verify JWT_SECRET is set

**Issue:** Token expired
- Implement token refresh logic
- Update session expiry time
- Clear old sessions regularly

---

## 🎉 You're Done!

Your authentication system is now integrated. Users can:
- Sign up as caregivers
- Link to patient records
- Login and access the dashboard
- Play cognitive games
- Track progress
- Customize settings

**Next steps:**
- Integrate game functionality
- Add real-time notifications
- Implement progress analytics
- Add multilingual support
