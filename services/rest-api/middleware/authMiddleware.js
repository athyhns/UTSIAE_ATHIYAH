const isAdmin = (req, res, next) => {
  const role = req.headers['x-user-role']; 

  if (role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Access is denied. Admin role required.' });
  }
};

module.exports = { isAdmin };
