const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
    } else {
        // Replace with your actual Render URL
        return 'https://tasselgroup-back.onrender.com';
        
    }
};

const CONFIG = {
    API_BASE: getApiBaseUrl()
};