import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const sessionSchema = new mongoose.Schema({
    loginAt: { type: Date, default: Date.now },
    logoutAt: { type: Date },
    userAgent: { type: String }
});

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    // Optional — Google OAuth users don't have a local password
    password: {
        type: String,
        minlength: 6,
        select: false         // never returned by default
    },
    // Google OAuth user ID (sub claim)
    googleId: {
        type: String,
        sparse: true,
        index: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    photoURL: {
        type: String,
        default: ''
    },
    sessions: [sessionSchema],
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    skinAnalyses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SkinAnalysis'
    }]
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
