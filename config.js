// Environment configuration
const getApiBaseUrl = () => {
    // Use Render backend URL in production, localhost in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
    } else {
        // Replace with your Render backend URL
        return 'https://tassel-group-backend.onrender.com/api';
    }
};

const CONFIG = {
    API_BASE: getApiBaseUrl(),
    APP_NAME: 'Tassel Group',
    VERSION: '1.0.0'
};