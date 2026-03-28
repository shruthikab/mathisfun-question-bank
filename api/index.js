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

// Static files - serve from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes - load passport inside to handle missing env gracefully
app.use('/api/auth', (req, res, next) => {
  try {
    const authRoutes = require('./auth');
    authRoutes(req, res, next);
  } catch (error) {
    console.error('Auth routes error:', error);
    next(error);
  }
});

// Import questions routes
app.use('/api/import-questions', (req, res, next) => {
  try {
    const importRoutes = require('./import-questions');
    importRoutes(req, res, next);
  } catch (error) {
    console.error('Import routes error:', error);
    next(error);
  }
});

// Catch-all - serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

module.exports.handler = serverless(app);
