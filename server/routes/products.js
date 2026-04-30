import express from 'express';
import Product from '../models/Product.js';

const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
    try {
        const { category, type, brand, minPrice, maxPrice } = req.query;

        const filter = {};
        if (category) filter.category = category;
        if (type) filter.type = type;
        if (brand) filter.brand = brand;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        const products = await Product.find(filter).sort({ brand: 1, name: 1 });
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get single product by productId
router.get('/:productId', async (req, res) => {
    try {
        const product = await Product.findOne({ productId: Number(req.params.productId) });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Get products by IDs (for recommendations)
router.post('/by-ids', async (req, res) => {
    try {
        const { productIds } = req.body;
        if (!productIds || !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'productIds array is required' });
        }

        const products = await Product.find({ productId: { $in: productIds } });
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products by IDs:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
    try {
        const products = await Product.find({ category: req.params.category });
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products by category:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get all brands
router.get('/meta/brands', async (req, res) => {
    try {
        const brands = await Product.distinct('brand');
        res.status(200).json(brands);
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});

export default router;
