const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { validateUser } = require('../middleware/validation');

const router = express.Router();

if (!global.users) {
  global.users = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      role: 'user',
      passwordHash: '$2a$10$.91iziEVWTK2toYSAX0rJ.gEzvFlJGfY/d0cL84W8pDbXT3vQYQAK',
      teams: ['t1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      age: 25,
      role: 'admin',
      passwordHash: '$2a$10$.91iziEVWTK2toYSAX0rJ.gEzvFlJGfY/d0cL84W8pDbXT3vQYQAK',
      teams: ['t1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

const privateKey = fs.readFileSync(path.join(__dirname, '../private.key'), 'utf8');

router.post('/register', validateUser, async (req, res) => {
  const { name, email, age, password } = req.body; 

  if (global.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const hasAdmin = global.users.some(u => u.role === 'admin');
  const role = hasAdmin ? 'user' : 'admin'; 

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = {
    id: uuidv4(),
    name,
    email,
    age,
    passwordHash, 
    role,
    teams: ['t1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  global.users.push(newUser);

  res.status(201).json({
    message: `User created successfully${role === 'admin' ? ' as ADMIN' : ''}`,
    user: { id: newUser.id, name: newUser.name, email: newUser.email }
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = global.users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials (user not found)' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials (password mismatch)' });
  }

  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    teams: user.teams 
  };

  const token = jwt.sign(
    payload,
    privateKey,
    { algorithm: 'RS256', expiresIn: '1h' }
  );

  res.json({
    message: 'Login successful',
    token: token
  });
});

router.get('/public-key', (req, res) => {
  try {
    const publicKey = fs.readFileSync(path.join(__dirname, '../public.key'), 'utf8');
    res.type('text/plain').send(publicKey);
  } catch (err) {
    console.error("Could not read public key", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
