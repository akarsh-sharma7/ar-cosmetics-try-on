import mongoose from 'mongoose';

const skinAnalysisSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    skinTone: {
        type: String,
        required: true
    },
    undertone: {
        type: String,
        required: true
    },
    texture: {
        type: String,
        required: true
    },
    pores: {
        type: String,
        required: true
    },
    blemishes: {
        type: String,
        required: true
    },
    recommendations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }]
}, {
    timestamps: true
});

const SkinAnalysis = mongoose.model('SkinAnalysis', skinAnalysisSchema);

export default SkinAnalysis;
