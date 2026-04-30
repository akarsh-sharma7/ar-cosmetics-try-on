import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'ar-cosmetics-secret-key-2024';
const JWT_EXPIRES_IN = '7d';

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        // Validation
        if (!email || !password || !displayName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        const user = await User.create({
            email: email.toLowerCase(),
            password,
            displayName,
            sessions: [{
                loginAt: new Date(),
                userAgent: req.headers['user-agent'] || 'Unknown'
            }]
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user (include password field explicitly for comparison)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if user has a password (might be migrated from external auth)
        if (!user.password) {
            return res.status(401).json({ error: 'Please register again with a password' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Add session
        user.sessions.push({
            loginAt: new Date(),
            userAgent: req.headers['user-agent'] || 'Unknown'
        });
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Get current user (verify token)
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId)
            .populate('wishlist')
            .select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ user });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('Auth check error:', error);
        res.status(500).json({ error: 'Failed to verify token' });
    }
});

// Logout (end session)
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(200).json({ message: 'Logged out' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId);
        if (user && user.sessions.length > 0) {
            const lastSession = user.sessions[user.sessions.length - 1];
            if (!lastSession.logoutAt) {
                lastSession.logoutAt = new Date();
                await user.save();
            }
        }

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(200).json({ message: 'Logged out' });
    }
});

// Update wishlist
router.post('/wishlist', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const { productId, action } = req.body;
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (action === 'add') {
            if (!user.wishlist.includes(productId)) {
                user.wishlist.push(productId);
            }
        } else if (action === 'remove') {
            user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        }

        await user.save();
        res.status(200).json({ wishlist: user.wishlist });
    } catch (error) {
        console.error('Wishlist error:', error);
        res.status(500).json({ error: 'Failed to update wishlist' });
    }
});

export default router;
