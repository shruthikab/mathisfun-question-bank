const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const serverless = require('serverless-http');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// Static files
app.use(express.static(path.join(__dirname, '..')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes - inline to avoid module loading issues
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// In-memory demo users
const demoUsers = new Map();

app.post('/api/auth/login', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const token = jwt.sign({ userId: 'demo', email, name: name || email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: { id: 'demo', name: name || email, email }, token });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const token = jwt.sign({ userId: 'demo', email, name: name || email }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ user: { id: 'demo', name, email }, token });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ user: { id: decoded.userId, email: decoded.email, name: decoded.name || decoded.email } });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Google auth - only if configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const passport = require('passport');
  const GoogleStrategy = require('passport-google-oauth20').Strategy;

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email'));
    const user = { id: profile.id, name: profile.displayName, email };
    demoUsers.set(profile.id, user);
    done(null, user);
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((id, done) => {
    const user = demoUsers.get(id);
    done(null, user || new Error('Not found'));
  });

  app.use(passport.initialize());

  app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login-failed' }),
    (req, res) => {
      const token = jwt.sign({ userId: req.user.id, email: req.user.email, name: req.user.name }, JWT_SECRET, { expiresIn: '7d' });
      res.redirect(`/?google_auth=true&token=${token}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
    }
  );
}

// Import questions - inline
app.post('/api/import-questions', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }
  try {
    const { fileName, isImage, isPdf, content } = req.body || {};
    if (!fileName || !content) {
      return res.status(400).json({ error: 'Missing payload' });
    }
    // Simplified - just return empty for now
    res.json({ questions: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

module.exports.handler = serverless(app);
