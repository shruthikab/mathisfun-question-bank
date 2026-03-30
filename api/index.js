// Vercel Serverless Function - Google OAuth Handler
// Uses Express-style req/res (not AWS Lambda event/context)

let HTML = null;
const users = new Map();

// Simple JWT implementation
const simpleJWT = {
  sign(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    payload.iat = now;
    const base64UrlEncode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signature = Buffer.from(base64UrlEncode(header) + '.' + base64UrlEncode(payload) + '.' + secret).toString('base64');
    return base64UrlEncode(header) + '.' + base64UrlEncode(payload) + '.' + signature;
  },
  verify(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) throw new Error('Token expired');
    return payload;
  }
};

// HTTP request helper using built-in http/https modules
function makeRequest(url, options) {
  return new Promise(function(resolve, reject) {
    var urlObj = new URL(url);
    var isHttps = urlObj.protocol === 'https:';
    var httpModule = isHttps ? require('https') : require('http');
    var requestData = options.body;
    var headers = options.headers || {};
    var reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: headers
    };
    var req = httpModule.request(reqOptions, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: function() { return Promise.resolve(data); },
          json: function() { return Promise.resolve(JSON.parse(data)); }
        });
      });
    });
    req.on('error', reject);
    if (requestData) req.write(requestData);
    req.end();
  });
}

// Vercel expects (req, res) signature
module.exports = async (req, res) => {
  const urlPath = req.url;
  const method = req.method;
  const headers = req.headers;
  const secret = process.env.JWT_SECRET || 'demo-secret-key-for-vercel';

  // Parse query string
  const queryString = urlPath.split('?')[1] || '';
  const query = {};
  queryString.split('&').forEach(function(pair) {
    var parts = pair.split('=');
    if (parts[0]) query[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
  });

  // Parse body for POST requests
  let body = {};
  if (method === 'POST' || method === 'PUT') {
    body = JSON.parse(req.body || '{}');
  }

  try {
    // Health check
    if (urlPath === '/api/health' || urlPath.startsWith('/api/health?')) {
      res.status(200).json({
        status: 'ok',
        env: {
          googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
          callbackUrl: process.env.GOOGLE_CALLBACK_URL
        }
      });
      return;
    }

    // Google OAuth start
    if (urlPath === '/api/auth/google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

      if (!clientId || !clientSecret) {
        res.redirect(302, '/?error=Google+not+configured');
        return;
      }

      const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(callbackUrl) + '&response_type=code&scope=openid%20email%20profile';
      res.redirect(302, googleAuthUrl);
      return;
    }

    // Google OAuth callback
    if (urlPath === '/api/auth/google/callback') {
      const code = query.code;
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

      if (!code) {
        res.redirect(302, '/?error=No+auth+code');
        return;
      }

      if (!clientId || !clientSecret) {
        res.redirect(302, '/?error=Google+not+configured');
        return;
      }

      const tokenResponse = await makeRequest('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'code=' + encodeURIComponent(code) + '&client_id=' + encodeURIComponent(clientId) + '&client_secret=' + encodeURIComponent(clientSecret) + '&redirect_uri=' + encodeURIComponent(callbackUrl) + '&grant_type=authorization_code'
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        res.redirect(302, '/?error=Token+exchange+failed');
        return;
      }

      const tokens = await tokenResponse.json();
      const userInfoResponse = await makeRequest('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': 'Bearer ' + tokens.access_token }
      });

      if (!userInfoResponse.ok) {
        res.redirect(302, '/?error=Failed+to+get+user+info');
        return;
      }

      const googleUser = await userInfoResponse.json();
      let user = users.get(googleUser.id);
      if (!user) {
        user = { id: googleUser.id, name: googleUser.name, email: googleUser.email };
        users.set(googleUser.id, user);
      }

      const jwtToken = simpleJWT.sign({ userId: user.id, email: user.email, name: user.name }, secret);
      const redirectUrl = '/?google_auth=true&token=' + encodeURIComponent(jwtToken) + '&user=' + encodeURIComponent(JSON.stringify(user));

      res.redirect(302, redirectUrl);
      return;
    }

    // Demo login
    if (urlPath === '/api/auth/login' && method === 'POST') {
      const token = simpleJWT.sign({ userId: 'demo', email: body.email || 'user@example.com', name: body.name || body.email }, secret);
      res.status(200).json({ user: { id: 'demo', name: body.name || body.email, email: body.email || 'user@example.com' }, token });
      return;
    }

    // Demo signup
    if (urlPath === '/api/auth/signup' && method === 'POST') {
      const token = simpleJWT.sign({ userId: 'demo', email: body.email, name: body.name }, secret);
      res.status(201).json({ user: { id: 'demo', name: body.name, email: body.email }, token });
      return;
    }

    // Get current user
    if (urlPath === '/api/auth/me' && method === 'GET') {
      const authHeader = headers.authorization || headers.Authorization;
      if (!authHeader || authHeader.indexOf('Bearer ') !== 0) {
        res.status(401).json({ error: 'No token' });
        return;
      }
      const decoded = simpleJWT.verify(authHeader.substring(7), secret);
      res.status(200).json({ user: { id: decoded.userId, email: decoded.email, name: decoded.name || decoded.email } });
      return;
    }

    // Import questions
    if (urlPath === '/api/import-questions' && method === 'POST') {
      res.status(200).json({ questions: [] });
      return;
    }

    // Serve HTML for all other requests
    if (!HTML) {
      var fs = require('fs');
      var path = require('path');
      HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(HTML);

  } catch (e) {
    console.error('Handler error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
};
