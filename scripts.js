// ===== CONFIGURATION =====
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
    } else {
        return 'https://tasselgroup-back.onrender.com/api';
    }
};

const API_BASE = getApiBaseUrl();

console.log('🚀 Tassel Group App Starting...', {
    environment: window.location.hostname === 'localhost' ? 'development' : 'production',
    apiBase: API_BASE
});

// ===== APPLICATION STATE =====
let currentUser = null;
let cart = [];
let currentBooking = null;
let currentGift = null;

// Chart instances management
let chartInstances = {
    revenueChart: null,
    staffPerformanceChart: null,
    servicesChart: null
};

// ===== API HELPER FUNCTIONS =====
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        },
        ...options
    };

    try {
        console.log(`📡 Making API call to: ${API_BASE}${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`, config);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error(`❌ API call failed: ${error.message}`);
        throw error;
    }
}

// Debug function to test authentication with unique email
async function debugAuth() {
    try {
        console.log('🔍 Testing authentication...');
        
        // Use unique email with timestamp
        const timestamp = new Date().getTime();
        const uniqueEmail = `test${timestamp}@example.com`;
        
        // Test register with unique email
        const registerData = {
            name: "Test User",
            email: uniqueEmail,
            password: "password123",
            phone: "1234567890",
            address: "123 Test Street"
        };
        
        console.log('Registering with email:', uniqueEmail);
        
        const registerResponse = await fetch('https://tasselgroup-back.onrender.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registerData)
        });
        
        console.log('Register response status:', registerResponse.status);
        const registerResult = await registerResponse.json();
        console.log('Register result:', registerResult);
        
        // If registration successful, test login
        if (registerResponse.ok) {
            console.log('✅ Registration successful, testing login...');
            
            const loginData = {
                email: uniqueEmail,
                password: "password123"
            };
            
            const loginResponse = await fetch('https://tasselgroup-back.onrender.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });
            
            console.log('Login response status:', loginResponse.status);
            const loginResult = await loginResponse.json();
            console.log('Login result:', loginResult);
        }
        
    } catch (error) {
        console.error('Auth debug error:', error);
    }
}

// Check authentication status
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const currentUser = localStorage.getItem('currentUser');
    
    console.log('🔐 Authentication Status:');
    console.log('Token exists:', !!token);
    console.log('Token value:', token ? `${token.substring(0, 20)}...` : 'None');
    console.log('Current user:', currentUser ? JSON.parse(currentUser) : 'None');
    console.log('API Base:', API_BASE);
    
    return !!token;
}


// Debug function to check all required elements
function debugElements() {
    const requiredElements = [
        'productsContainer',
        'servicesContainer', 
        'giftPackagesContainer',
        'home',
        'shop',
        'bookings',
        'gifts',
        'login',
        'profile',
        'dashboard'
    ];
    
    console.log('🔍 Checking required elements:');
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`${id}:`, element ? '✅ Found' : '❌ Missing');
    });
}

// Debug function to check API responses
async function debugAPIResponses() {
    try {
        console.log('🔍 Debugging API responses...');
        
        const productsResponse = await fetch('https://tasselgroup-back.onrender.com/api/products');
        const productsData = await productsResponse.json();
        console.log('Products API response:', productsData);
        console.log('Products type:', typeof productsData);
        console.log('Is array:', Array.isArray(productsData));
        
        const servicesResponse = await fetch('https://tasselgroup-back.onrender.com/api/services');
        const servicesData = await servicesResponse.json();
        console.log('Services API response:', servicesData);
        console.log('Services type:', typeof servicesData);
        console.log('Is array:', Array.isArray(servicesData));
        
    } catch (error) {
        console.error('Debug error:', error);
    }
}

// Debug booking creation WITH authentication
async function debugBooking() {
    try {
        console.log('🔍 Debugging booking creation...');
        
        // Check if we're logged in
        if (!checkAuthStatus()) {
            console.log('❌ Not logged in. Please login first.');
            return;
        }
        
        // First, get available services to use a real service ID
        const services = await apiCall('/services');
        console.log('Available services:', services);
        
        if (services.length === 0) {
            console.log('❌ No services available to book');
            return;
        }
        
        // Use the first available service
        const service = services[0];
        
        // Test booking data
        const testBooking = {
            service: service._id,
            date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
            time: "14:00",
            specialRequests: "Test booking from debug"
        };
        
        console.log('Test booking data:', testBooking);
        
        // Use apiCall to ensure authentication header is sent
        const result = await apiCall('/bookings', {
            method: 'POST',
            body: JSON.stringify(testBooking)
        });
        
        console.log('✅ Booking created successfully:', result);
        
    } catch (error) {
        console.error('❌ Booking debug error:', error);
        
        if (error.message.includes('401')) {
            console.log('💡 Tip: You need to be logged in to create bookings.');
            console.log('💡 Try logging in with: testExistingUsers()');
        }
    }
}


// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Tassel Group Application');
    debugElements(); // Add this line
    debugAPIResponses();
    debugAuth();
    debugBooking();
    checkAuthStatus();
    
    // Debug: Check what forms exist
    console.log('Forms check:');
    console.log('Login form:', document.getElementById('loginFormElement'));
    console.log('Register form:', document.getElementById('registerFormElement'));
    console.log('Profile form:', document.getElementById('profileForm'));
    console.log('Password form:', document.getElementById('passwordForm'));
    console.log('Booking form:', document.getElementById('bookingDetailsForm'));
    console.log('Gift form:', document.getElementById('giftCustomizationForm'));
    
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        fetchCurrentUser();
    }
    
    // Safe form setup
    safeFormSetup();
    
    // Set minimum dates
    setMinimumDates();
    
    // Load initial data
    loadProducts();
    loadServices();
    loadGiftPackages();
});

function safeFormSetup() {
    // Only add listeners if forms exist
    const loginForm = document.getElementById('loginFormElement');
    const registerForm = document.getElementById('registerFormElement');
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordForm');
    const bookingForm = document.getElementById('bookingDetailsForm');
    const giftForm = document.getElementById('giftCustomizationForm');
    
    if (loginForm) loginForm.addEventListener('submit', (e) => { e.preventDefault(); handleLogin(e); });
    if (registerForm) registerForm.addEventListener('submit', (e) => { e.preventDefault(); handleRegister(e); });
    if (profileForm) profileForm.addEventListener('submit', (e) => { e.preventDefault(); updateProfile(e); });
    if (passwordForm) passwordForm.addEventListener('submit', (e) => { e.preventDefault(); changePassword(e); });
    if (bookingForm) bookingForm.addEventListener('submit', (e) => { e.preventDefault(); confirmBooking(e); });
    if (giftForm) giftForm.addEventListener('submit', (e) => { e.preventDefault(); createGift(e); });
    
    console.log('Form setup completed');
}

function setMinimumDates() {
    const today = new Date().toISOString().split('T')[0];
    const bookingDate = document.getElementById('bookingDate');
    const deliveryDate = document.getElementById('deliveryDate');
    
    if (bookingDate) bookingDate.min = today;
    if (deliveryDate) deliveryDate.min = today;
}

// ===== AUTHENTICATION FUNCTIONS =====
async function fetchCurrentUser() {
    try {
        const data = await apiCall('/auth/me');
        currentUser = data.user;
        updateUIForUser();
    } catch (error) {
        localStorage.removeItem('token');
        currentUser = null;
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        localStorage.setItem('token', data.token);
        currentUser = data.user;
        updateUIForUser();
        showSection('home');

        document.getElementById('loginFormElement').reset();
        alert('Login successful!');
    } catch (error) {
        alert(error.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const phone = document.getElementById('registerPhone').value;
    const address = document.getElementById('registerAddress').value;

    try {
        const data = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, phone, address })
        });

        localStorage.setItem('token', data.token);
        currentUser = data.user;
        updateUIForUser();
        showSection('home');

        document.getElementById('registerFormElement').reset();
        alert('Registration successful!');
    } catch (error) {
        alert(error.message);
    }
}

function updateUIForUser() {
    if (currentUser) {
        document.getElementById('userDropdown').style.display = 'block';
        document.getElementById('loginLink').style.display = 'none';

        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

        if (currentUser.role === 'staff' || currentUser.role === 'admin') {
            document.getElementById('dashboardLink').style.display = 'block';
        }

        // Update profile section
        document.getElementById('profileName').textContent = currentUser.name;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
        document.getElementById('profileAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

        document.getElementById('profileFullName').value = currentUser.name;
        document.getElementById('profileEmailInput').value = currentUser.email;
        document.getElementById('profilePhone').value = currentUser.phone;
        document.getElementById('profileAddress').value = currentUser.address;
    } else {
        document.getElementById('userDropdown').style.display = 'none';
        document.getElementById('loginLink').style.display = 'block';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('token');
    updateUIForUser();
    showSection('home');
    alert('You have been logged out.');
}

// ===== SECTION MANAGEMENT =====
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });

    document.getElementById(sectionId).style.display = 'block';

    if (sectionId === 'dashboard' && currentUser) {
        loadDashboard();
    }

    window.scrollTo(0, 0);
}

// ===== PRODUCTS & SHOPPING =====
// ===== PRODUCTS & SHOPPING =====
async function loadProducts() {
    try {
        const response = await apiCall('/products');
        
        // Handle different response formats
        let products = [];
        
        if (Array.isArray(response)) {
            // Response is directly an array
            products = response;
        } else if (response.products && Array.isArray(response.products)) {
            // Response is { products: [...] }
            products = response.products;
        } else if (response.data && Array.isArray(response.data)) {
            // Response is { data: [...] }
            products = response.data;
        } else {
            console.warn('Unexpected API response format for products:', response);
            products = [];
        }
        
        const container = document.getElementById('productsContainer');
        
        // Safe check for container
        if (!container) {
            console.warn('⚠️ productsContainer not found in DOM');
            return;
        }
        
        container.innerHTML = '';
        
        if (products.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        No products available at the moment.
                    </div>
                </div>
            `;
            return;
        }
        
        products.forEach(product => {
            const productCard = `
                <div class="col-md-4 mb-4">
                    <div class="card h-100">
                        <img src="${product.image || 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'}" 
                             class="product-image card-img-top" 
                             alt="${product.name}"
                             onerror="this.src='https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${product.name}</h5>
                            <p class="card-text flex-grow-1">${product.description || 'No description available'}</p>
                            <p class="card-text"><strong>R ${product.price || 0}</strong></p>
                            <button class="btn btn-primary mt-auto" onclick="addToCart('${product._id || product.id}', '${(product.name || '').replace(/'/g, "\\'")}', ${product.price || 0})">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += productCard;
        });
        
        console.log(`✅ Loaded ${products.length} products`);
        
    } catch (error) {
        console.error('Failed to load products:', error);
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-warning">
                        Unable to load products: ${error.message}
                    </div>
                </div>
            `;
        }
    }
}


function addToCart(productId, productName, price) {
    if (!currentUser) {
        alert('Please log in to add items to your cart');
        showSection('login');
        return;
    }

    cart.push({ productId, name: productName, price, quantity: 1 });
    updateCartDisplay();
    document.getElementById('cartSection').style.display = 'block';
    alert(`${productName} added to cart!`);
}

// Update the updateCartDisplay function with safe checks
function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartSection = document.getElementById('cartSection');
    
    // Safe check for elements
    if (!cartItems || !cartSection) {
        console.warn('Cart elements not found in DOM');
        return;
    }
    
    cartItems.innerHTML = '';
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Your cart is empty</p>';
        cartSection.style.display = 'none';
        return;
    }
    
    let total = 0;
    cart.forEach((item, index) => {
        total += item.price * item.quantity;
        cartItems.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span>${item.name} (x${item.quantity})</span>
                <span>R ${item.price * item.quantity} 
                    <button class="btn btn-sm btn-outline-danger ms-2" onclick="removeFromCart(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </span>
            </div>
        `;
    });
    
    cartItems.innerHTML += `
        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
            <strong>Total</strong>
            <strong>R ${total}</strong>
        </div>
    `;
    
    cartSection.style.display = 'block';
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();

    if (cart.length === 0) {
        document.getElementById('cartSection').style.display = 'none';
    }
}

async function checkout() {
    if (cart.length === 0) {
        alert('Your cart is empty');
        return;
    }

    if (!currentUser) {
        alert('Please log in to checkout');
        showSection('login');
        return;
    }

    try {
        const orderData = {
            items: cart.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.price
            })),
            shippingAddress: currentUser.address,
            paymentMethod: 'card'
        };

        await apiCall('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });

        cart = [];
        updateCartDisplay();
        document.getElementById('cartSection').style.display = 'none';

        alert('Order placed successfully! Thank you for your purchase.');
    } catch (error) {
        alert('Failed to place order: ' + error.message);
    }
}

// ===== SERVICES & BOOKINGS =====
async function loadServices() {
    try {
        const response = await apiCall('/services');
        
        // Handle different response formats
        let services = [];
        
        if (Array.isArray(response)) {
            services = response;
        } else if (response.services && Array.isArray(response.services)) {
            services = response.services;
        } else if (response.data && Array.isArray(response.data)) {
            services = response.data;
        } else {
            console.warn('Unexpected API response format for services:', response);
            services = [];
        }
        
        const container = document.getElementById('servicesContainer');
        
        // Safe check for container
        if (!container) {
            console.warn('⚠️ servicesContainer not found in DOM');
            return;
        }
        
        container.innerHTML = '';
        
        if (services.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        No services available at the moment.
                    </div>
                </div>
            `;
            return;
        }
        
        services.forEach(service => {
            const serviceCard = `
                <div class="col-md-6 mb-4">
                    <div class="card service-card h-100">
                        <div class="card-body">
                            <h5 class="card-title">${service.name}</h5>
                            <p class="card-text">${service.description || 'No description available'}</p>
                            <p class="card-text"><strong>Duration:</strong> ${service.duration || 'Not specified'}</p>
                            <p class="card-text"><strong>Price:</strong> R ${service.price || 0}</p>
                            <button class="btn btn-primary" 
                                    onclick="bookService('${service._id || service.id}', '${(service.name || '').replace(/'/g, "\\'")}', ${service.price || 0}, '${service.duration || ''}')">
                                Book Now
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += serviceCard;
        });
        
        console.log(`✅ Loaded ${services.length} services`);
        
    } catch (error) {
        console.error('Failed to load services:', error);
        const container = document.getElementById('servicesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-warning">
                        Unable to load services: ${error.message}
                    </div>
                </div>
            `;
        }
    }
}

// Update bookService function with safe checks
function bookService(serviceId, serviceName, price, duration) {
    if (!currentUser) {
        alert('Please log in to book services');
        showSection('login');
        return;
    }
    
    currentBooking = { serviceId, name: serviceName, price, duration };
    
    const serviceNameInput = document.getElementById('serviceName');
    const bookingForm = document.getElementById('bookingForm');
    
    // Safe check for elements
    if (serviceNameInput && bookingForm) {
        serviceNameInput.value = serviceName;
        bookingForm.style.display = 'block';
        bookingForm.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn('Booking form elements not found');
    }
}

async function confirmBooking(e) {
    e.preventDefault();
    
    if (!currentBooking) {
        alert('No service selected for booking');
        return;
    }
    
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const specialRequests = document.getElementById('specialRequests').value;
    
    // Validate required fields
    if (!date || !time) {
        alert('Please select both date and time for your booking');
        return;
    }
    
    try {
        const bookingData = {
            service: currentBooking.serviceId,
            date,
            time,
            specialRequests: specialRequests || ''
        };
        
        console.log('Sending booking data:', bookingData);
        
        await apiCall('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
        
        // Reset form
        document.getElementById('bookingDetailsForm').reset();
        document.getElementById('bookingForm').style.display = 'none';
        currentBooking = null;
        
        alert('Booking confirmed! We look forward to seeing you.');
        
    } catch (error) {
        console.error('Booking error details:', error);
        
        if (error.message.includes('500')) {
            alert('Server error while creating booking. Please try again later.');
        } else if (error.message.includes('400')) {
            alert('Invalid booking data. Please check your information.');
        } else {
            alert('Failed to create booking: ' + error.message);
        }
    }
}

// ===== GIFT PACKAGES =====
async function loadGiftPackages() {
    try {
        const response = await apiCall('/gift-packages');
        
        // Handle different response formats
        let giftPackages = [];
        
        if (Array.isArray(response)) {
            giftPackages = response;
        } else if (response.giftPackages && Array.isArray(response.giftPackages)) {
            giftPackages = response.giftPackages;
        } else if (response.data && Array.isArray(response.data)) {
            giftPackages = response.data;
        } else {
            console.warn('Unexpected API response format for gift packages:', response);
            giftPackages = [];
        }
        
        const container = document.getElementById('giftPackagesContainer');
        
        // Safe check for container
        if (!container) {
            console.warn('⚠️ giftPackagesContainer not found in DOM');
            return;
        }
        
        container.innerHTML = '';
        
        if (giftPackages.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        No gift packages available at the moment.
                    </div>
                </div>
            `;
            return;
        }
        
        giftPackages.forEach(gift => {
            const includesList = Array.isArray(gift.includes) 
                ? gift.includes.map(item => `<li>${item}</li>`).join('')
                : '<li>No details available</li>';
                
            const giftCard = `
                <div class="col-md-4 mb-4">
                    <div class="card h-100">
                        <img src="${gift.image || 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'}" 
                             class="product-image card-img-top" 
                             alt="${gift.name}"
                             onerror="this.src='https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${gift.name}</h5>
                            <p class="card-text flex-grow-1">${gift.description || 'No description available'}</p>
                            <p class="card-text"><strong>Includes:</strong></p>
                            <ul class="flex-grow-1">
                                ${includesList}
                            </ul>
                            <p class="card-text"><strong>From R ${gift.basePrice || gift.price || 0}</strong></p>
                            <button class="btn btn-primary mt-auto" 
                                    onclick="customizeGift('${gift._id || gift.id}', '${(gift.name || '').replace(/'/g, "\\'")}')">
                                Customize Gift
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += giftCard;
        });
        
        console.log(`✅ Loaded ${giftPackages.length} gift packages`);
        
    } catch (error) {
        console.error('Failed to load gift packages:', error);
        const container = document.getElementById('giftPackagesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-warning">
                        Unable to load gift packages: ${error.message}
                    </div>
                </div>
            `;
        }
    }
}

// Update customizeGift function with safe checks
function customizeGift(giftId, giftName) {
    if (!currentUser) {
        alert('Please log in to create gift packages');
        showSection('login');
        return;
    }
    
    currentGift = { giftId, name: giftName };
    
    const giftPackageInput = document.getElementById('giftPackage');
    const giftCustomization = document.getElementById('giftCustomization');
    
    // Safe check for elements
    if (giftPackageInput && giftCustomization) {
        giftPackageInput.value = giftName;
        giftCustomization.style.display = 'block';
        giftCustomization.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn('Gift customization elements not found');
    }
}

async function createGift(e) {
    e.preventDefault();

    const recipientName = document.getElementById('recipientName').value;
    const recipientEmail = document.getElementById('recipientEmail').value;
    const giftMessage = document.getElementById('giftMessage').value;
    const deliveryDate = document.getElementById('deliveryDate').value;

    alert(`Gift package created for ${recipientName}! An email will be sent to ${recipientEmail} with the gift details.`);

    document.getElementById('giftCustomizationForm').reset();
    document.getElementById('giftCustomization').style.display = 'none';
    currentGift = null;
}

// ===== PROFILE MANAGEMENT =====
async function updateProfile(e) {
    e.preventDefault();

    const name = document.getElementById('profileFullName').value;
    const email = document.getElementById('profileEmailInput').value;
    const phone = document.getElementById('profilePhone').value;
    const address = document.getElementById('profileAddress').value;

    try {
        await apiCall('/users/profile', {
            method: 'PUT',
            body: JSON.stringify({ name, email, phone, address })
        });

        currentUser = { ...currentUser, name, email, phone, address };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();

        alert('Profile updated successfully!');
    } catch (error) {
        alert(error.message);
    }
}

async function changePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    try {
        await apiCall('/users/change-password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        document.getElementById('passwordForm').reset();
        alert('Password changed successfully!');
    } catch (error) {
        alert(error.message);
    }
}

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboard() {
    if (currentUser.role === 'staff') {
        document.getElementById('staffDashboard').style.display = 'block';
        document.getElementById('adminDashboard').style.display = 'none';
        await loadStaffDashboard();
    } else if (currentUser.role === 'admin') {
        document.getElementById('staffDashboard').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        await loadAdminDashboard();
    }
}

async function loadStaffDashboard() {
    try {
        const data = await apiCall('/dashboard/staff');

        document.getElementById('staffSales').textContent = data.stats.totalSales;
        document.getElementById('staffClients').textContent = data.stats.totalClients;
        document.getElementById('staffHours').textContent = data.stats.totalHours;
        document.getElementById('staffCommission').textContent = 'R ' + data.stats.totalCommission;

        // Load appointments, sales, vouchers... (add your existing dashboard code here)

    } catch (error) {
        console.error('Failed to load staff dashboard:', error);
    }
}

async function loadAdminDashboard() {
    try {
        const data = await apiCall('/dashboard/admin');

        document.getElementById('totalUsers').textContent = data.stats.totalUsers;
        document.getElementById('totalBookings').textContent = data.stats.totalBookings;
        document.getElementById('totalProducts').textContent = data.stats.totalProducts;
        document.getElementById('totalRevenue').textContent = 'R ' + data.stats.totalRevenue;

        // Load charts and recent activity... (add your existing dashboard code here)

    } catch (error) {
        console.error('Failed to load admin dashboard:', error);
    }
}

// ===== ADMIN MODAL FUNCTIONS =====
async function showAdminModal(action) {
    try {
        const modal = new bootstrap.Modal(document.getElementById('adminModal'));
        const modalTitle = document.getElementById('adminModalTitle');
        const modalBody = document.getElementById('adminModalBody');
        
        if (!modal || !modalTitle || !modalBody) {
            console.warn('Admin modal elements not found');
            return;
        }

        if (action === 'addService') {
            modalTitle.textContent = 'Add New Service';
            modalBody.innerHTML = `
                <form id="addServiceForm">
                    <div class="mb-3">
                        <label for="serviceName" class="form-label">Service Name</label>
                        <input type="text" class="form-control" id="serviceName" required>
                    </div>
                    <div class="mb-3">
                        <label for="serviceDescription" class="form-label">Description</label>
                        <textarea class="form-control" id="serviceDescription" rows="3" required></textarea>
                    </div>
                    <div class="mb-3">
                        <label for="servicePrice" class="form-label">Price (R)</label>
                        <input type="number" class="form-control" id="servicePrice" required>
                    </div>
                    <div class="mb-3">
                        <label for="serviceDuration" class="form-label">Duration</label>
                        <input type="text" class="form-control" id="serviceDuration" placeholder="e.g., 60 min" required>
                    </div>
                    <div class="mb-3">
                        <label for="serviceCategory" class="form-label">Category</label>
                        <select class="form-control" id="serviceCategory" required>
                            <option value="">Select a category</option>
                            <option value="massage">Massage</option>
                            <option value="skincare">Skincare</option>
                            <option value="nails">Nails</option>
                            <option value="wellness">Wellness</option>
                            <option value="haircare">Hair Care</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Add Service</button>
                </form>
            `;
            
            document.getElementById('addServiceForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                await addNewService();
                modal.hide();
            });
            
        } else if (action === 'addProduct') {
            modalTitle.textContent = 'Add New Product';
            modalBody.innerHTML = `
                <form id="addProductForm">
                    <div class="mb-3">
                        <label for="productName" class="form-label">Product Name</label>
                        <input type="text" class="form-control" id="productName" required>
                    </div>
                    <div class="mb-3">
                        <label for="productDescription" class="form-label">Description</label>
                        <textarea class="form-control" id="productDescription" rows="3" required></textarea>
                    </div>
                    <div class="mb-3">
                        <label for="productPrice" class="form-label">Price (R)</label>
                        <input type="number" class="form-control" id="productPrice" required>
                    </div>
                    <div class="mb-3">
                        <label for="productCategory" class="form-label">Category</label>
                        <select class="form-control" id="productCategory" required>
                            <option value="">Select a category</option>
                            <option value="skincare">Skincare</option>
                            <option value="haircare">Hair Care</option>
                            <option value="wellness">Wellness</option>
                            <option value="makeup">Makeup</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="productImage" class="form-label">Image URL</label>
                        <input type="url" class="form-control" id="productImage" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Add Product</button>
                </form>
            `;
            
            document.getElementById('addProductForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                await addNewProduct();
                modal.hide();
            });
            
        } else if (action === 'addVoucher') {
            // For now, just show a message since we need staff data
            modalTitle.textContent = 'Create Voucher Code';
            modalBody.innerHTML = `
                <div class="alert alert-info">
                    <p>Voucher creation requires staff data from the backend.</p>
                    <p>This feature will be available once the backend is fully configured.</p>
                </div>
            `;
        }
        
        modal.show();
        
    } catch (error) {
        console.error('Error showing admin modal:', error);
        alert('Unable to load admin controls: ' + error.message);
    }
}

async function addNewService() {
    try {
        const name = document.getElementById('serviceName').value;
        const description = document.getElementById('serviceDescription').value;
        const price = parseInt(document.getElementById('servicePrice').value);
        const duration = document.getElementById('serviceDuration').value;
        const category = document.getElementById('serviceCategory').value;
        
        await apiCall('/services', {
            method: 'POST',
            body: JSON.stringify({ name, description, price, duration, category })
        });
        
        // Reload services
        loadServices();
        alert('Service added successfully!');
        
    } catch (error) {
        alert('Failed to add service: ' + error.message);
    }
}

async function addNewProduct() {
    try {
        const name = document.getElementById('productName').value;
        const description = document.getElementById('productDescription').value;
        const price = parseInt(document.getElementById('productPrice').value);
        const category = document.getElementById('productCategory').value;
        const image = document.getElementById('productImage').value;
        
        await apiCall('/products', {
            method: 'POST',
            body: JSON.stringify({ name, description, price, category, image })
        });
        
        // Reload products
        loadProducts();
        alert('Product added successfully!');
        
    } catch (error) {
        alert('Failed to add product: ' + error.message);
    }
}

// Clean up all chart instances
function cleanupCharts() {
    Object.keys(chartInstances).forEach(chartName => {
        if (chartInstances[chartName]) {
            try {
                chartInstances[chartName].destroy();
                chartInstances[chartName] = null;
            } catch (error) {
                console.warn(`Error destroying chart ${chartName}:`, error);
            }
        }
    });
}