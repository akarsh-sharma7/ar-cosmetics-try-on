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

// Helper: verify token or return null
const verifyToken = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch {
        return null;
    }
};

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        // Validation
        if (!email || !password || !displayName) {
            return res.status(400).json({ error: 'All fields are required (email, password, displayName)' });
        }

        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Invalid field types' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        const user = await User.create({
            email: email.toLowerCase().trim(),
            password,
            displayName: displayName.trim(),
            sessions: [{
                loginAt: new Date(),
                userAgent: req.headers['user-agent'] || 'Unknown'
            }]
        });

        const token = generateToken(user._id);

        return res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL || null
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        return res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user with password field
        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.password) {
            return res.status(401).json({ error: 'Please register again with a password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Add session (cap at 50 to avoid unbounded growth)
        user.sessions.push({
            loginAt: new Date(),
            userAgent: req.headers['user-agent'] || 'Unknown'
        });
        if (user.sessions.length > 50) {
            user.sessions = user.sessions.slice(-50);
        }
        await user.save();

        const token = generateToken(user._id);

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL || null
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Failed to login' });
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
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired, please login again' });
            }
            return res.status(401).json({ error: 'Invalid token' });
        }

        const user = await User.findById(decoded.userId)
            .select('-password')
            .lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Populate wishlist only if Product model is registered
        try {
            const populated = await User.findById(decoded.userId)
                .populate('wishlist')
                .select('-password')
                .lean();
            return res.status(200).json({ user: populated });
        } catch {
            // Product model not available — return user without populated wishlist
            return res.status(200).json({ user });
        }
    } catch (error) {
        console.error('Auth check error:', error);
        return res.status(500).json({ error: 'Failed to verify token' });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    try {
        const decoded = verifyToken(req.headers.authorization);
        if (decoded) {
            const user = await User.findById(decoded.userId);
            if (user && user.sessions.length > 0) {
                const lastSession = user.sessions[user.sessions.length - 1];
                if (!lastSession.logoutAt) {
                    lastSession.logoutAt = new Date();
                    await user.save();
                }
            }
        }
    } catch (error) {
        console.error('Logout error (non-fatal):', error);
    }
    // Always return success — client clears token regardless
    return res.status(200).json({ message: 'Logged out successfully' });
});

// Update wishlist
router.post('/wishlist', async (req, res) => {
    try {
        const decoded = verifyToken(req.headers.authorization);
        if (!decoded) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { productId, action } = req.body;
        if (!productId || !['add', 'remove'].includes(action)) {
            return res.status(400).json({ error: 'productId and action (add/remove) are required' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (action === 'add') {
            if (!user.wishlist.some(id => id.toString() === productId)) {
                user.wishlist.push(productId);
            }
        } else {
            user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        }

        await user.save();
        return res.status(200).json({ wishlist: user.wishlist });
    } catch (error) {
        console.error('Wishlist error:', error);
        return res.status(500).json({ error: 'Failed to update wishlist' });
    }
});

export default router;