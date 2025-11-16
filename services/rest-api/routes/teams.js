const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

let teams = [
  { id: 't1', name: 'Alpha Team', members: ['1', '2'] },
];

router.get('/', (req, res) => {
  res.json(teams);
});

router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const newTeam = {
    id: uuidv4(),
    name,
    members: []
  };

  teams.push(newTeam);
  res.status(201).json(newTeam);
});

module.exports = router;
