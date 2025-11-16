const express = require('express');
const { v4: uuidv4 } = require('uuid'); 
const { validateUser, validateUserUpdate } = require('../middleware/validation');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', (req, res) => {
  let filteredUsers = global.users ? [...global.users] : [];
  
  const stripPassword = (user) => {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  };
  filteredUsers = filteredUsers.map(stripPassword);
  res.json(filteredUsers);
});

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


router.put('/:id', isAdmin, validateUserUpdate, (req, res) => {
  if (!global.users) { return res.status(500).json({ error: 'User data not initialized' }); }
  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) { return res.status(404).json({ error: 'User not found' }); }
  const { name, email, age, role } = req.body;
  
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

router.delete('/:id', isAdmin, (req, res) => {
  if (!global.users) { return res.status(500).json({ error: 'User data not initialized' }); }
  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) { return res.status(404).json({ error: 'User not found' }); }
  
  const deletedUser = global.users.splice(userIndex, 1)[0];
  const { passwordHash, ...userWithoutPassword } = deletedUser;
  res.json({ message: 'User deleted successfully', user: userWithoutPassword });
});

router.put('/:id/role', isAdmin, (req, res) => {
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
