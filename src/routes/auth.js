const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { optionalAuth } = require('../middleware/auth');

// Login page
router.get('/login', optionalAuth, AuthController.showLoginPage);
router.get('/', optionalAuth, AuthController.showLoginPage);

// Login submit
router.post('/login', AuthController.login);

// Logout
router.get('/logout', AuthController.logout);
router.post('/logout', AuthController.logout);

// API login
router.post('/api/auth/login', AuthController.apiLogin);

module.exports = router;
