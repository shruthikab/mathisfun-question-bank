const jwt = require('jsonwebtoken');

const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MathQuest Question Bank</title><style>:root{color-scheme:dark;--bg:#1a1b26;--bg-alt:#16161e;--ink:#c0caf5;--muted:#7a88cf;--accent:#7aa2f7;--accent-dark:#7dcfff;--card:#24283b;--card-border:#3b4261;--shadow:rgba(0,0,0,0.45);--chip:#2f3656;--panel:#1f2335;--input:#1f2335}*{box-sizing:border-box}body{margin:0;font-family:"Space Grotesk","IBM Plex Sans",sans-serif;background:radial-gradient(1200px 800px at 15% -10%,rgba(122,162,247,0.26),transparent 55%),radial-gradient(800px 600px at 95% 0%,rgba(187,154,247,0.2),transparent 50%),linear-gradient(150deg,var(--bg-alt),var(--bg));color:var(--ink);overflow-x:hidden}code{font-family:"IBM Plex Mono",Consolas,monospace;font-size:0.9em}.page{min-height:100vh;padding:32px 6vw 64px;display:flex;flex-direction:column;gap:32px;position:relative;z-index:1}.hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;padding:28px;border-radius:24px;background:linear-gradient(135deg,#1f2335 0%,#24283b 45%,#292e42 100%);border:1px solid var(--card-border);box-shadow:0 18px 45px var(--shadow)}.hero__content h1{font-family:"Fraunces","Georgia",serif;font-size:clamp(2.4rem,2vw + 1.6rem,3.3rem);margin:0 0 12px}.eyebrow{margin:0 0 10px;text-transform:uppercase;letter-spacing:0.3em;font-size:0.75rem;color:var(--muted)}.subhead{margin:0 0 20px;color:var(--muted);max-width:40ch}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.card{background:var(--card);border:1px solid var(--card-border);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 14px 30px rgba(8,9,14,0.5)}.card h3{margin:0;font-size:1.05rem}.chip{background:var(--chip);color:#c5d0ff;border-radius:999px;padding:4px 10px;font-size:0.75rem;letter-spacing:0.04em;border:1px solid #3e4668}.hidden{display:none!important}.login-screen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(1200px 800px at 15% -10%,rgba(122,162,247,0.26),transparent 55%),radial-gradient(800px 600px at 95% 0%,rgba(187,154,247,0.2),transparent 50%),linear-gradient(150deg,var(--bg-alt),var(--bg));z-index:1000;padding:20px}.login-card{background:var(--card);border:1px solid var(--card-border);border-radius:24px;padding:40px;width:100%;max-width:420px;box-shadow:0 24px 60px rgba(0,0,0,0.5)}.login-header{text-align:center;margin-bottom:24px}.login-header h1{font-family:"Fraunces","Georgia",serif;font-size:2.5rem;margin:0;color:var(--accent)}.login-subhead{color:var(--muted);margin:8px 0 0;font-size:0.95rem}.login-tabs{display:flex;gap:8px;margin-bottom:24px;border-bottom:1px solid var(--card-border)}.login-tab{flex:1;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);padding:12px 16px;cursor:pointer;font-weight:600}.login-tab.active{color:var(--accent);border-bottom-color:var(--accent)}.login-form{display:flex;flex-direction:column;gap:16px}.form-group{display:flex;flex-direction:column;gap:6px}.form-group label{font-size:0.85rem;color:var(--muted)}.form-group input{border:1px solid var(--card-border);border-radius:12px;padding:12px 14px;font-size:1rem;color:var(--ink);background:var(--input)}.form-group input:focus{outline:none;border-color:var(--accent)}.login-btn{border:none;background:var(--accent);color:#11131d;padding:14px 20px;border-radius:12px;cursor:pointer;font-weight:700}.google-btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;border:1px solid var(--card-border);background:#fff;color:#333;padding:12px 20px;border-radius:12px;cursor:pointer;font-weight:600;text-decoration:none}.divider{display:flex;align-items:center;text-align:center;margin:16px 0;color:var(--muted)}.divider::before,.divider::after{content:'';flex:1;border-bottom:1px solid var(--card-border)}.divider span{padding:0 12px}.user-info{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px}.user-welcome{margin:0;color:var(--muted)}.logout-btn{border:1px solid var(--card-border);background:var(--panel);color:var(--ink);padding:6px 14px;border-radius:8px;cursor:pointer}</style></head><body><div id="loginScreen" class="login-screen"><div class="login-card"><div class="login-header"><h1>MathQuest</h1><p class="login-subhead">Question Bank</p></div><div class="login-tabs"><button class="login-tab active" data-tab="login">Sign In</button><button class="login-tab" data-tab="signup">Sign Up</button></div><form id="loginForm" class="login-form"><div class="form-group"><label for="loginEmail">Email</label><input type="email" id="loginEmail" placeholder="your@email.com" required></div><div class="form-group"><label for="loginPassword">Password</label><input type="password" id="loginPassword" placeholder="Enter your password" required></div><div id="loginError" class="form-error hidden"></div><button type="submit" class="login-btn">Sign In</button><div class="divider"><span>or</span></div><a href="/api/auth/google" class="google-btn">Sign in with Google</a></form><form id="signupForm" class="login-form hidden"><div class="form-group"><label for="signupName">Name</label><input type="text" id="signupName" placeholder="Your name" required></div><div class="form-group"><label for="signupEmail">Email</label><input type="email" id="signupEmail" placeholder="your@email.com" required></div><div class="form-group"><label for="signupPassword">Password</label><input type="password" id="signupPassword" placeholder="At least 6 characters" required minlength="6"></div><div id="signupError" class="form-error hidden"></div><button type="submit" class="login-btn">Create Account</button><div class="divider"><span>or</span></div><a href="/api/auth/google" class="google-btn">Sign up with Google</a></form></div></div><div id="mainApp" class="page hidden"><header class="hero"><div class="hero__content"><div class="user-info"><p class="eyebrow">MathQuest</p><p class="user-welcome">Welcome, <span id="userNameDisplay">User</span></p><button id="logoutBtn" class="logout-btn" type="button">Sign Out</button></div><h1>Question Bank</h1><p class="subhead">MathQuest gives admins hints and answers while students see focused practice questions.</p></div><div class="hero__panel"><div class="stat"><span class="stat__label">Questions</span><span class="stat__value" id="questionCount">0</span></div><div class="stat"><span class="stat__label">Papers</span><span class="stat__value" id="paperCount">0</span></div><div class="stat"><span class="stat__label">Categories</span><span class="stat__value" id="categoryCount">0</span></div></div></header></div><script src="auth.js"></script><script src="config-data.js"></script><script src="solutions.js"></script><script src="app.js"></script></body></html>`;

const users = new Map(); // In-memory user store

// Lazy load passport only when Google auth is requested
function getPassport() {
  const passport = require('passport');
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  return { passport, GoogleStrategy };
}

module.exports.handler = async (event, context) => {
  const { path: urlPath, httpMethod, body, headers, queryStringParameters } = event;
  const secret = process.env.JWT_SECRET || 'demo-secret-key-for-vercel';

  try {
    // Health check
    if (urlPath === '/api/health' && httpMethod === 'GET') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ok' }) };
    }

    // Google OAuth start
    if (urlPath === '/api/auth/google' && httpMethod === 'GET') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

      if (!clientId || !clientSecret) {
        return {
          statusCode: 503,
          headers: { 'Content-Type': 'application/json', 'Location': '/?error=Google+not+configured' },
          body: JSON.stringify({ error: 'Google OAuth not configured' })
        };
      }

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=openid%20email%20profile`;
      return { statusCode: 302, headers: { 'Location': googleAuthUrl }, body: '' };
    }

    // Google OAuth callback
    if (urlPath === '/api/auth/google/callback' && httpMethod === 'GET') {
      const code = queryStringParameters?.code;
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

      if (!code) {
        return { statusCode: 302, headers: { 'Location': '/?error=No+auth+code' }, body: '' };
      }

      if (!clientId || !clientSecret) {
        return { statusCode: 302, headers: { 'Location': '/?error=Google+not+configured' }, body: '' };
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `code=${encodeURIComponent(code)}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&redirect_uri=${encodeURIComponent(callbackUrl)}&grant_type=authorization_code`
      });

      if (!tokenResponse.ok) {
        const err = await tokenResponse.text();
        console.error('Token exchange failed:', err);
        return { statusCode: 302, headers: { 'Location': '/?error=Token+exchange+failed' }, body: '' };
      }

      const tokens = await tokenResponse.json();

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });

      if (!userInfoResponse.ok) {
        return { statusCode: 302, headers: { 'Location': '/?error=Failed+to+get+user+info' }, body: '' };
      }

      const googleUser = await userInfoResponse.json();

      // Create or get user
      let user = users.get(googleUser.id);
      if (!user) {
        user = { id: googleUser.id, name: googleUser.name, email: googleUser.email, googleId: googleUser.id };
        users.set(googleUser.id, user);
      }

      // Generate JWT
      const jwtToken = jwt.sign({ userId: user.id, email: user.email, name: user.name }, secret, { expiresIn: '7d' });

      // Redirect to frontend with token
      const redirectUrl = `/?google_auth=true&token=${encodeURIComponent(jwtToken)}&user=${encodeURIComponent(JSON.stringify({ id: user.id, name: user.name, email: user.email }))}`;
      return { statusCode: 302, headers: { 'Location': redirectUrl }, body: '' };
    }

    // Demo login
    if (urlPath === '/api/auth/login' && httpMethod === 'POST') {
      const data = JSON.parse(body || '{}');
      const token = jwt.sign({ userId: 'demo', email: data.email || 'user@example.com', name: data.name || data.email }, secret, { expiresIn: '7d' });
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ user: { id: 'demo', name: data.name || data.email, email: data.email || 'user@example.com' }, token }) };
    }

    // Demo signup
    if (urlPath === '/api/auth/signup' && httpMethod === 'POST') {
      const data = JSON.parse(body || '{}');
      const token = jwt.sign({ userId: 'demo', email: data.email, name: data.name }, secret, { expiresIn: '7d' });
      return { statusCode: 201, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ user: { id: 'demo', name: data.name, email: data.email }, token }) };
    }

    // Get current user
    if (urlPath === '/api/auth/me' && httpMethod === 'GET') {
      const authHeader = headers.authorization || headers.Authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No token' }) };
      }
      const decoded = jwt.verify(authHeader.substring(7), secret);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: { id: decoded.userId, email: decoded.email, name: decoded.name || decoded.email } }) };
    }

    // Import questions
    if (urlPath === '/api/import-questions' && httpMethod === 'POST') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: [] }) };
    }

    // Default: serve HTML
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: HTML };
  } catch (e) {
    console.error('Handler error:', e);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
