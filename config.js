// Enhanced configuration with fallback
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
    } else {
        // Try the correct URL with /api
        return 'https://tasselgroup-back.onrender.com/api';
    }
};

const API_BASE = getApiBaseUrl();

// Test connection on startup
async function testBackendConnection() {
    try {
        const response = await fetch(`${API_BASE.replace('/api', '')}/api/health`);
        if (response.ok) {
            console.log('✅ Backend connection successful');
            return true;
        }
    } catch (error) {
        console.warn('❌ Backend connection failed:', error.message);
    }
    return false;
}

// Call this in your DOMContentLoaded
testBackendConnection();