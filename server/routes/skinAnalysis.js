import express from 'express';
import jwt from 'jsonwebtoken';
import SkinAnalysis from '../models/SkinAnalysis.js';
import User from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ar-cosmetics-secret-key-2024';

// Middleware to verify token
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Save skin analysis result
router.post('/', authenticate, async (req, res) => {
    try {
        const { skinTone, undertone, texture, pores, blemishes, recommendations } = req.body;

        // Find the user
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create skin analysis
        const analysis = await SkinAnalysis.create({
            userId: user._id,
            skinTone,
            undertone,
            texture,
            pores,
            blemishes,
            recommendations: recommendations || []
        });

        // Add reference to user
        user.skinAnalyses.push(analysis._id);
        await user.save();

        res.status(201).json({
            message: 'Skin analysis saved successfully',
            analysis
        });
    } catch (error) {
        console.error('Error saving skin analysis:', error);
        res.status(500).json({ error: 'Failed to save skin analysis' });
    }
});

// Get user's skin analysis history
router.get('/history', authenticate, async (req, res) => {
    try {
        const analyses = await SkinAnalysis.find({ userId: req.userId })
            .populate('recommendations')
            .sort({ createdAt: -1 });

        res.status(200).json(analyses);
    } catch (error) {
        console.error('Error fetching skin analyses:', error);
        res.status(500).json({ error: 'Failed to fetch skin analyses' });
    }
});

// Get latest skin analysis
router.get('/latest', authenticate, async (req, res) => {
    try {
        const analysis = await SkinAnalysis.findOne({ userId: req.userId })
            .populate('recommendations')
            .sort({ createdAt: -1 });

        if (!analysis) {
            return res.status(404).json({ error: 'No skin analysis found' });
        }

        res.status(200).json(analysis);
    } catch (error) {
        console.error('Error fetching latest skin analysis:', error);
        res.status(500).json({ error: 'Failed to fetch skin analysis' });
    }
});

export default router;
