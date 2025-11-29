const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

// Generate JWT token
const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Authentication middleware
const authMiddleware = (req, res, next) => {
    try {
        // Check for token in cookies or Authorization header
        const token = req.cookies.token ||
                     (req.headers.authorization && req.headers.authorization.split(' ')[1]);

        if (!token) {
            return res.redirect('/login');
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            res.clearCookie('token');
            return res.redirect('/login');
        }

        // Attach user info to request
        req.user = decoded;
        res.locals.user = decoded;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.clearCookie('token');
        return res.redirect('/login');
    }
};

// Optional auth middleware (doesn't redirect if not authenticated)
const optionalAuth = (req, res, next) => {
    try {
        const token = req.cookies.token ||
                     (req.headers.authorization && req.headers.authorization.split(' ')[1]);

        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                req.user = decoded;
                res.locals.user = decoded;
            }
        }
        next();
    } catch (error) {
        next();
    }
};

// API authentication middleware (returns JSON instead of redirect)
const apiAuthMiddleware = (req, res, next) => {
    try {
        const token = req.cookies.token ||
                     (req.headers.authorization && req.headers.authorization.split(' ')[1]);

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

module.exports = {
    generateToken,
    verifyToken,
    authMiddleware,
    optionalAuth,
    apiAuthMiddleware
};
