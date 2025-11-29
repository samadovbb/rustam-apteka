const Admin = require('../models/Admin');
const { generateToken } = require('../middleware/auth');

class AuthController {
    // Show login page
    static async showLoginPage(req, res) {
        if (req.cookies.token) {
            return res.redirect('/dashboard');
        }
        res.render('login', {
            title: 'Login - MegaDent POS',
            error: null
        });
    }

    // Handle login
    static async login(req, res) {
        try {
            const { login, password } = req.body;

            // Validate input
            if (!login || !password) {
                return res.render('login', {
                    title: 'Login - MegaDent POS',
                    error: 'Login and password are required'
                });
            }

            // Find admin by login
            const admin = await Admin.findByLogin(login);

            if (!admin) {
                return res.render('login', {
                    title: 'Login - MegaDent POS',
                    error: 'Invalid credentials'
                });
            }

            // Verify password
            const isValidPassword = await Admin.verifyPassword(password, admin.password);

            if (!isValidPassword) {
                return res.render('login', {
                    title: 'Login - MegaDent POS',
                    error: 'Invalid credentials'
                });
            }

            // Generate JWT token
            const token = generateToken({
                id: admin.id,
                login: admin.login,
                full_name: admin.full_name
            });

            // Set cookie
            res.cookie('token', token, {
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                secure: process.env.NODE_ENV === 'production'
            });

            res.redirect('/dashboard');
        } catch (error) {
            console.error('Login error:', error);
            res.render('login', {
                title: 'Login - MegaDent POS',
                error: 'An error occurred during login'
            });
        }
    }

    // Handle logout
    static async logout(req, res) {
        res.clearCookie('token');
        res.redirect('/login');
    }

    // API login (returns JSON)
    static async apiLogin(req, res) {
        try {
            const { login, password } = req.body;

            if (!login || !password) {
                return res.status(400).json({ error: 'Login and password are required' });
            }

            const admin = await Admin.findByLogin(login);

            if (!admin || !(await Admin.verifyPassword(password, admin.password))) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = generateToken({
                id: admin.id,
                login: admin.login,
                full_name: admin.full_name
            });

            res.json({
                success: true,
                token,
                user: {
                    id: admin.id,
                    login: admin.login,
                    full_name: admin.full_name
                }
            });
        } catch (error) {
            console.error('API login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AuthController;
