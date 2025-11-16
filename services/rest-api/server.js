const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
require('dotenv').config(); // TAMBAHAN BARU

// Impor rute-rute
const authRoutes = require('./routes/auth'); // BARU
const teamRoutes = require('./routes/teams'); // BARU
const userRoutes = require('./routes/users'); // Rute lama

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'User Service (REST)', // Nama diupdate
    timestamp: new Date().toISOString()
  });
});

// --- Rute ---
// Gunakan rute-rute baru
app.use('/api/auth', authRoutes);  // BARU
app.use('/api/teams', teamRoutes); // BARU

// Gunakan rute user yang lama
app.use('/api/users', userRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 User Service (REST) running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;