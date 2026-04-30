import mongoose from 'mongoose';

const colorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    hex: { type: String, required: true }
}, { _id: false });

const productSchema = new mongoose.Schema({
    productId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        required: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviews: {
        type: Number,
        default: 0
    },
    image: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['Lipstick', 'Blush', 'Eyeshadow', 'Foundation', 'Eyebrow'],
        required: true
    },
    category: {
        type: String,
        enum: ['Lips', 'Cheeks', 'Eyes', 'Face'],
        required: true
    },
    finish: {
        type: String,
        enum: ['Matte', 'Liquid Matte', 'Glossy', 'Cream/Satin', 'Sheer/Balm', 'Metallic', 'Radiant', 'Pressed Powder', 'Cream-to-Natural', null],
        default: null
    },
    colors: [colorSchema],
    shades: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);

export default Product;
