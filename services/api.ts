const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';
// Get stored token
const getToken = (): string | null => {
    return localStorage.getItem('authToken');
};

// Set token
const setToken = (token: string): void => {
    localStorage.setItem('authToken', token);
};

// Remove token
const removeToken = (): void => {
    localStorage.removeItem('authToken');
};

// Get auth headers
const getAuthHeaders = (): HeadersInit => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export interface User {
    id: string;
    email: string;
    displayName: string;
    photoURL?: string;
}

export interface AuthResponse {
    message: string;
    token: string;
    user: User;
}

// Register new user
export async function register(email: string, password: string, displayName: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
    }

    setToken(data.token);
    return data;
}

// Login user
export async function login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const text = await response.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }

    if (!response.ok) {
        throw new Error(data.error || `Login failed (${response.status})`);
    }

    setToken(data.token);
    return data;
}

// Logout user
export async function logout(): Promise<void> {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
    } finally {
        removeToken();
    }
}

// Sign in with Google credential token (from Google Identity Services)
export async function loginWithGoogle(credential: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
    });

    const text = await response.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }

    if (!response.ok) {
        throw new Error(data.error || `Google sign-in failed (${response.status})`);
    }

    setToken(data.token);
    return data;
}

// Get current user
export async function getCurrentUser(): Promise<User | null> {
    const token = getToken();
    if (!token) return null;

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                removeToken();
                return null;
            }
            throw new Error('Failed to get user');
        }

        const data = await response.json();
        return data.user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// Check if logged in
export function isAuthenticated(): boolean {
    return !!getToken();
}

// Fetch all products from MongoDB
export async function fetchProducts(filters?: {
    category?: string;
    type?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
}) {
    try {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined) params.append(key, String(value));
            });
        }

        const url = `${API_URL}/products${params.toString() ? `?${params}` : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
}

// Get products by IDs (for recommendations)
export async function fetchProductsByIds(productIds: number[]) {
    try {
        const response = await fetch(`${API_URL}/products/by-ids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching products by IDs:', error);
        throw error;
    }
}

// Save skin analysis to MongoDB
export async function saveSkinAnalysis(data: {
    skinTone: string;
    undertone: string;
    texture: string;
    pores: string;
    blemishes: string;
    recommendations?: string[];
}) {
    const response = await fetch(`${API_URL}/skin-analysis`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save skin analysis');
    }

    return await response.json();
}

// Get user's skin analysis history
export async function getSkinAnalysisHistory() {
    const response = await fetch(`${API_URL}/skin-analysis/history`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch skin analysis history');
    }

    return await response.json();
}

// Update wishlist
export async function updateWishlist(productId: string, action: 'add' | 'remove') {
    const response = await fetch(`${API_URL}/auth/wishlist`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ productId, action })
    });

    if (!response.ok) {
        throw new Error('Failed to update wishlist');
    }

    return await response.json();
}

// Health check
export async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_URL}/health`);
        return response.ok;
    } catch {
        return false;
    }
}
