const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken'); 
const axios = require('axios'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const USER_SERVICE_URL = process.env.REST_API_URL || 'http://rest-api:3001';
const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL || 'http://graphql-api:4000';

let PUBLIC_KEY = null;

async function fetchPublicKey() {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/api/auth/public-key`);
    PUBLIC_KEY = response.data;
    console.log('✅ Public Key berhasil diambil dari User Service.');
  } catch (error) {
    console.error('❌ Gagal mengambil Public Key:', error.message);
    console.log('Mencoba lagi dalam 5 detik...');
    setTimeout(fetchPublicKey, 5000); 
  }
}

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3002', 'http://frontend-app:3002'],
  credentials: true
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
}));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use(async (req, res, next) => {
  
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/public-key'
  ];

  if (publicRoutes.includes(req.path)) {
    return next(); 
  }

  if (!PUBLIC_KEY) {
    return res.status(503).json({ error: 'Service unavailable. Auth service is not ready.' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if (token == null) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) {
      console.error('JWT Verify Error:', err.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }

    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-name'] = decoded.name;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-role'] = decoded.role; // <-- ROLE DIKIRIM KE BACKEND
    req.headers['x-user-teams'] = (decoded.teams || []).join(','); 

    next(); 
  });
});

const restApiProxy = createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', 
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] -> REST: ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('REST API Proxy Error:', err.message);
    res.status(502).json({ error: 'REST API service unavailable' });
  }
});

const graphqlApiProxy = createProxyMiddleware({
  target: GRAPHQL_API_URL,
  changeOrigin: true,
  ws: true, 
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] -> GQL: ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('GraphQL API Proxy Error:', err.message);
    res.status(502).json({ error: 'GraphQL API service unavailable' });
  }
});

app.use('/api', restApiProxy); 
app.use('/graphql', graphqlApiProxy); 

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found on Gateway' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  fetchPublicKey();
});
