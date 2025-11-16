const Joi = require('joi');

// User validation schema (schema untuk user BARU)
const userSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(1).max(150).required(),
  password: Joi.string().min(6).required(), // TAMBAHAN BARU
  role: Joi.string().valid('admin', 'user', 'moderator').optional()
});

// User update validation schema (saat update, semua opsional)
const userUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  age: Joi.number().integer().min(1).max(150).optional(),
  role: Joi.string().valid('admin', 'user', 'moderator').optional(),
  password: Joi.string().min(6).optional() // TAMBAHAN BARU
}).min(1); // Minimal harus ada 1 field

// Validation middleware for creating users
const validateUser = (req, res, next) => {
  const { error } = userSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
      details: error.details
    });
  }
  
  next();
};

// Validation middleware for updating users
const validateUserUpdate = (req, res, next) => {
  const { error } = userUpdateSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
      details: error.details
    });
  }
  
  next();
};

module.exports = {
  validateUser,
  validateUserUpdate
};