// services/rest-api/middleware/authMiddleware.js

// Middleware untuk memeriksa apakah user adalah admin
const isAdmin = (req, res, next) => {
  // 'x-user-role' disuntikkan oleh API Gateway setelah memverifikasi JWT
  const role = req.headers['x-user-role']; 

  if (role === 'admin') {
    next(); // Lanjutkan
  } else {
    // Ditolak!
    res.status(403).json({ error: 'Forbidden: Access is denied. Admin role required.' });
  }
};

module.exports = { isAdmin };