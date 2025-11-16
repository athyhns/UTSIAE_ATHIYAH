// services/rest-api/routes/users.js (Kode Lengkap)

const express = require('express');
const { v4: uuidv4 } = require('uuid'); 
const { validateUser, validateUserUpdate } = require('../middleware/validation');
const { isAdmin } = require('../middleware/authMiddleware'); // <-- IMPOR BARU

const router = express.Router();

// ... (logika GET /api/users dan GET /api/users/:id tetap sama) ...
// Logika yang lebih bersih di bawah:

// GET /api/users - Get all users
router.get('/', (req, res) => {
  // ... (Logika GET di sini) ...
  let filteredUsers = global.users ? [...global.users] : [];
  
  const stripPassword = (user) => {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  };
  filteredUsers = filteredUsers.map(stripPassword);
  res.json(filteredUsers);
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  if (!global.users) {
    return res.status(500).json({ error: 'User data not initialized' });
  }
  const user = global.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { passwordHash, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});


// PUT /api/users/:id - Update user (HANYA ADMIN)
router.put('/:id', isAdmin, validateUserUpdate, (req, res) => { // <-- ADMIN PROTECTION
  // ... (Logika PUT di sini)
  if (!global.users) { return res.status(500).json({ error: 'User data not initialized' }); }
  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) { return res.status(404).json({ error: 'User not found' }); }
  const { name, email, age, role } = req.body;
  
  // (Logika cek email duplikat)
  if (email) {
    const existingUser = global.users.find(u => u.email === email && u.id !== req.params.id);
    if (existingUser) { return res.status(409).json({ error: 'Email already exists' }); }
  }
  
  const updatedUser = {
    ...global.users[userIndex],
    ...(name && { name }),
    ...(email && { email }),
    ...(age && { age }),
    ...(role && { role }),
    updatedAt: new Date().toISOString()
  };
  global.users[userIndex] = updatedUser;
  const { passwordHash, ...userWithoutPassword } = updatedUser;
  res.json({ message: 'User updated successfully', user: userWithoutPassword });
});

// DELETE /api/users/:id - Delete user (HANYA ADMIN)
router.delete('/:id', isAdmin, (req, res) => { // <-- ADMIN PROTECTION
  if (!global.users) { return res.status(500).json({ error: 'User data not initialized' }); }
  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) { return res.status(404).json({ error: 'User not found' }); }
  
  const deletedUser = global.users.splice(userIndex, 1)[0];
  const { passwordHash, ...userWithoutPassword } = deletedUser;
  res.json({ message: 'User deleted successfully', user: userWithoutPassword });
});

// ENDPOINT BARU: PUT /api/users/:id/role - Ubah role user (HANYA ADMIN)
router.put('/:id/role', isAdmin, (req, res) => { // <-- ADMIN PROTECTION
  const { role } = req.body;
  if (!role || (role !== 'admin' && role !== 'user')) {
    return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'user'." });
  }
  
  if (!global.users) { return res.status(500).json({ error: 'User data not initialized' }); }
  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) { return res.status(404).json({ error: 'User not found' }); }

  global.users[userIndex].role = role;
  
  const { passwordHash, ...userWithoutPassword } = global.users[userIndex];
  res.json({ message: 'User role updated successfully', user: userWithoutPassword });
});

module.exports = router;