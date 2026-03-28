const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const router = express.Router();
const { pool, isConnected } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const TOKEN_EXPIRY = '7d';

// GET /api/auth/google - Start Google OAuth flow
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback - Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login-failed' }),
  async (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email, name: req.user.name },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // If no database, just use the token with embedded user info
    if (!pool || !isConnected) {
      console.log('No database - using token-based auth only');
    } else {
      // Try to save/update user in database
      try {
        let user = await pool.query('SELECT id FROM users WHERE google_id = $1', [req.user.id]);
        if (user.rows.length === 0) {
          user = await pool.query(
            'INSERT INTO users (name, email, google_id, avatar) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
            [req.user.name, req.user.email, req.user.id, req.user.picture]
          );
        }
      } catch (dbError) {
        console.error('Database error during Google auth:', dbError.message);
      }
    }

    res.redirect(`/?google_auth=true&token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    }))}`);
  }
);

// POST /api/signup - Register a new user
router.post('/signup', async (req, res) => {
  if (!pool || !isConnected) {
    // No database - create a demo token with user info embedded
    const { name, email } = req.body;
    const token = jwt.sign({ userId: 'demo', email, name }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    console.log('No database - created demo user:', email);
    res.status(201).json({
      message: 'Demo account created (no database)',
      user: { id: 'demo', name, email },
      token,
    });
    return;
  }

  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email.toLowerCase(), passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.status(201).json({ message: 'Account created successfully', user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/login - Authenticate user
router.post('/login', async (req, res) => {
  if (!pool || !isConnected) {
    // No database - allow any login for demo
    const { email, password, name } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const token = jwt.sign({ userId: 'demo', email, name: name || email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    console.log('No database - demo login:', email);
    res.json({ message: 'Demo login', user: { id: 'demo', name: name || email, email }, token });
    return;
  }

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    // If no database, return the decoded token info
    if (!pool || !isConnected) {
      res.json({ user: { id: decoded.userId, email: decoded.email, name: decoded.name || decoded.email } });
      return;
    }

    const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
    } else {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Failed to authenticate' });
    }
  }
});

module.exports = router;
