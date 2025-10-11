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

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Tassel Group Application');
    
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
async function loadProducts() {
    try {
        const products = await apiCall('/products');
        const container = document.getElementById('productsContainer');

        container.innerHTML = '';

        products.forEach(product => {
            const productCard = `
                <div class="col-md-4">
                    <div class="card">
                        <img src="${product.image}" class="product-image card-img-top" alt="${product.name}">
                        <div class="card-body">
                            <h5 class="card-title">${product.name}</h5>
                            <p class="card-text">${product.description}</p>
                            <p class="card-text"><strong>R ${product.price}</strong></p>
                            <button class="btn btn-primary" onclick="addToCart('${product._id}', '${product.name}', ${product.price})">Add to Cart</button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += productCard;
        });
    } catch (error) {
        console.error('Failed to load products:', error);
        const container = document.getElementById('productsContainer');
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-warning">
                    Unable to load products: ${error.message}
                </div>
            </div>
        `;
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

function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    cartItems.innerHTML = '';

    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Your cart is empty</p>';
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
        const services = await apiCall('/services');
        const container = document.getElementById('servicesContainer');

        container.innerHTML = '';

        services.forEach(service => {
            const serviceCard = `
                <div class="col-md-6">
                    <div class="card service-card">
                        <div class="card-body">
                            <h5 class="card-title">${service.name}</h5>
                            <p class="card-text">${service.description}</p>
                            <p class="card-text"><strong>Duration:</strong> ${service.duration}</p>
                            <p class="card-text"><strong>Price:</strong> R ${service.price}</p>
                            <button class="btn btn-primary" onclick="bookService('${service._id}', '${service.name}', ${service.price}, '${service.duration}')">Book Now</button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += serviceCard;
        });
    } catch (error) {
        console.error('Failed to load services:', error);
        const container = document.getElementById('servicesContainer');
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-warning">
                    Unable to load services: ${error.message}
                </div>
            </div>
        `;
    }
}

function bookService(serviceId, serviceName, price, duration) {
    if (!currentUser) {
        alert('Please log in to book services');
        showSection('login');
        return;
    }

    currentBooking = { serviceId, name: serviceName, price, duration };
    document.getElementById('serviceName').value = serviceName;
    document.getElementById('bookingForm').style.display = 'block';

    document.getElementById('bookingForm').scrollIntoView({ behavior: 'smooth' });
}

async function confirmBooking(e) {
    e.preventDefault();

    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const specialRequests = document.getElementById('specialRequests').value;

    try {
        const bookingData = {
            service: currentBooking.serviceId,
            date,
            time,
            specialRequests
        };

        await apiCall('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });

        document.getElementById('bookingDetailsForm').reset();
        document.getElementById('bookingForm').style.display = 'none';
        currentBooking = null;

        alert('Booking confirmed! We look forward to seeing you.');
    } catch (error) {
        alert('Failed to create booking: ' + error.message);
    }
}

// ===== GIFT PACKAGES =====
async function loadGiftPackages() {
    try {
        const giftPackages = await apiCall('/gift-packages');
        const container = document.getElementById('giftPackagesContainer');

        container.innerHTML = '';

        giftPackages.forEach(gift => {
            const giftCard = `
                <div class="col-md-4">
                    <div class="card">
                        <img src="${gift.image}" class="product-image card-img-top" alt="${gift.name}">
                        <div class="card-body">
                            <h5 class="card-title">${gift.name}</h5>
                            <p class="card-text">${gift.description}</p>
                            <p class="card-text"><strong>Includes:</strong></p>
                            <ul>
                                ${gift.includes.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                            <p class="card-text"><strong>From R ${gift.basePrice}</strong></p>
                            <button class="btn btn-primary" onclick="customizeGift('${gift._id}', '${gift.name}')">Customize Gift</button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += giftCard;
        });
    } catch (error) {
        console.error('Failed to load gift packages:', error);
        const container = document.getElementById('giftPackagesContainer');
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-warning">
                    Unable to load gift packages: ${error.message}
                </div>
            </div>
        `;
    }
}

function customizeGift(giftId, giftName) {
    if (!currentUser) {
        alert('Please log in to create gift packages');
        showSection('login');
        return;
    }

    currentGift = { giftId, name: giftName };
    document.getElementById('giftPackage').value = giftName;
    document.getElementById('giftCustomization').style.display = 'block';

    document.getElementById('giftCustomization').scrollIntoView({ behavior: 'smooth' });
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