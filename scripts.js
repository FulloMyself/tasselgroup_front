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

    // Add body to config if it exists and method is not GET/HEAD
    if (options.body && !['GET', 'HEAD'].includes(options.method?.toUpperCase() || 'GET')) {
        config.body = options.body;
    }

    try {
        console.log(`📡 Making API call to: ${API_BASE}${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`, config);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error(`❌ API call failed: ${error.message}`);
        throw error;
    }
}

// ===== AUTHENTICATION FUNCTIONS =====
async function fetchCurrentUser() {
    try {
        const data = await apiCall('/auth/me');
        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();
        return currentUser;
    } catch (error) {
        console.error('Failed to fetch current user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        currentUser = null;
        updateUIForUser();
        throw error;
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
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();
        showSection('home');

        document.getElementById('loginFormElement').reset();
        alert('Login successful!');
    } catch (error) {
        alert('Login failed: ' + error.message);
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
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();
        showSection('home');

        document.getElementById('registerFormElement').reset();
        alert('Registration successful!');
    } catch (error) {
        alert('Registration failed: ' + error.message);
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
        } else {
            document.getElementById('dashboardLink').style.display = 'none';
        }

        // Update profile section
        document.getElementById('profileName').textContent = currentUser.name;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
        document.getElementById('profileAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

        document.getElementById('profileFullName').value = currentUser.name;
        document.getElementById('profileEmailInput').value = currentUser.email;
        document.getElementById('profilePhone').value = currentUser.phone;
        document.getElementById('profileAddress').value = currentUser.address || '';
    } else {
        document.getElementById('userDropdown').style.display = 'none';
        document.getElementById('loginLink').style.display = 'block';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    cart = [];
    updateUIForUser();
    showSection('home');
    alert('You have been logged out.');
}

// ===== SECTION MANAGEMENT =====
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    if (sectionId === 'dashboard' && currentUser) {
        loadDashboard();
    }

    if (sectionId === 'shop') {
        updateCartDisplay();
    }

    window.scrollTo(0, 0);
}

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

    // Check if product already in cart
    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ productId, name: productName, price, quantity: 1 });
    }

    updateCartDisplay();
    document.getElementById('cartSection').style.display = 'block';
    alert(`${productName} added to cart!`);
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartSection = document.getElementById('cartSection');

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
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        cartItems.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <span>${item.name}</span>
                    <div class="btn-group btn-group-sm ms-2">
                        <button class="btn btn-outline-secondary" onclick="updateCartQuantity(${index}, -1)">-</button>
                        <span class="btn btn-outline-secondary disabled">${item.quantity}</span>
                        <button class="btn btn-outline-secondary" onclick="updateCartQuantity(${index}, 1)">+</button>
                    </div>
                </div>
                <div>
                    <span>R ${itemTotal}</span>
                    <button class="btn btn-sm btn-outline-danger ms-2" onclick="removeFromCart(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
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

function updateCartQuantity(index, change) {
    const item = cart[index];
    item.quantity += change;

    if (item.quantity <= 0) {
        cart.splice(index, 1);
    }

    updateCartDisplay();
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
            totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            shippingAddress: currentUser.address
        };

        const result = await apiCall('/orders', {
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

        if (!container) {
            console.warn('⚠️ servicesContainer not found in DOM');
            return;
        }

        container.innerHTML = '';

        if (!services || services.length === 0) {
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
                                    onclick="bookService('${service._id}', '${service.name.replace(/'/g, "\\'")}', ${service.price}, '${service.duration || ''}')">
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

function bookService(serviceId, serviceName, price, duration) {
    if (!currentUser) {
        alert('Please log in to book services');
        showSection('login');
        return;
    }

    currentBooking = { serviceId, name: serviceName, price, duration };

    const serviceNameInput = document.getElementById('serviceName');
    const bookingForm = document.getElementById('bookingForm');

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

    if (!date || !time) {
        alert('Please select both date and time for your booking');
        return;
    }

    try {
        const bookingData = {
            service: currentBooking.serviceId,
            date,
            time,
            specialRequests: specialRequests || '',
            status: 'confirmed'
        };

        const result = await apiCall('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });

        document.getElementById('bookingDetailsForm').reset();
        document.getElementById('bookingForm').style.display = 'none';
        currentBooking = null;

        alert('Booking confirmed! We look forward to seeing you.');

    } catch (error) {
        console.error('Booking error details:', error);
        alert('Failed to create booking: ' + error.message);
    }
}

// ===== GIFT PACKAGES =====
async function loadGiftPackages() {
    try {
        const giftPackages = await apiCall('/gift-packages');
        const container = document.getElementById('giftPackagesContainer');

        if (!container) {
            console.warn('⚠️ giftPackagesContainer not found in DOM');
            return;
        }

        container.innerHTML = '';

        if (!giftPackages || giftPackages.length === 0) {
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
                                    onclick="customizeGift('${gift._id}', '${gift.name.replace(/'/g, "\\'")}')">
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

function customizeGift(giftId, giftName) {
    if (!currentUser) {
        alert('Please log in to create gift packages');
        showSection('login');
        return;
    }

    currentGift = { giftId, name: giftName };

    const giftPackageInput = document.getElementById('giftPackage');
    const giftCustomization = document.getElementById('giftCustomization');

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

    try {
        const giftOrderData = {
            giftPackage: currentGift.giftId,
            recipientName,
            recipientEmail,
            message: giftMessage,
            deliveryDate,
            status: 'pending'
        };

        await apiCall('/gift-orders', {
            method: 'POST',
            body: JSON.stringify(giftOrderData)
        });

        alert(`Gift package created for ${recipientName}! An email will be sent to ${recipientEmail} with the gift details.`);

        document.getElementById('giftCustomizationForm').reset();
        document.getElementById('giftCustomization').style.display = 'none';
        currentGift = null;
    } catch (error) {
        alert('Failed to create gift order: ' + error.message);
    }
}

// ===== PROFILE MANAGEMENT =====
async function updateProfile(e) {
    e.preventDefault();

    const name = document.getElementById('profileFullName').value;
    const email = document.getElementById('profileEmailInput').value;
    const phone = document.getElementById('profilePhone').value;
    const address = document.getElementById('profileAddress').value;

    try {
        const updatedUser = await apiCall('/users/profile', {
            method: 'PUT',
            body: JSON.stringify({ name, email, phone, address })
        });

        currentUser = { ...currentUser, ...updatedUser };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();

        alert('Profile updated successfully!');
    } catch (error) {
        alert('Failed to update profile: ' + error.message);
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
        alert('Failed to change password: ' + error.message);
    }
}

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboard() {
    if (!currentUser) return;

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

        document.getElementById('staffSales').textContent = data.stats?.totalSales || 0;
        document.getElementById('staffClients').textContent = data.stats?.totalClients || 0;
        document.getElementById('staffHours').textContent = data.stats?.totalHours || 0;
        document.getElementById('staffCommission').textContent = 'R ' + (data.stats?.totalCommission || 0);

        // Load appointments
        const appointmentsList = document.getElementById('staffAppointments');
        if (appointmentsList && data.appointments) {
            appointmentsList.innerHTML = data.appointments.map(apt => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    ${apt.serviceName} - ${apt.clientName}
                    <span class="badge bg-primary rounded-pill">${new Date(apt.date).toLocaleDateString()}, ${apt.time}</span>
                </li>
            `).join('') || '<li class="list-group-item">No upcoming appointments</li>';
        }

        // Load recent sales
        const recentSalesList = document.getElementById('staffRecentSales');
        if (recentSalesList && data.recentSales) {
            recentSalesList.innerHTML = data.recentSales.map(sale => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    ${sale.productName}
                    <span class="badge bg-success rounded-pill">R ${sale.amount}</span>
                </li>
            `).join('') || '<li class="list-group-item">No recent sales</li>';
        }

        // Load vouchers
        const vouchersContainer = document.getElementById('staffVouchers');
        if (vouchersContainer && data.vouchers) {
            vouchersContainer.innerHTML = data.vouchers.map(voucher => `
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">${voucher.code}</h6>
                            <p class="card-text">Discount: ${voucher.discount}%</p>
                            <p class="card-text">Expires: ${new Date(voucher.expiryDate).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
            `).join('') || '<div class="col-12"><p>No vouchers assigned to you</p></div>';
        }

    } catch (error) {
        console.error('Failed to load staff dashboard:', error);
    }
}

async function loadAdminDashboard() {
    try {
        const data = await apiCall('/dashboard/admin');

        document.getElementById('totalUsers').textContent = data.stats?.totalUsers || 0;
        document.getElementById('totalBookings').textContent = data.stats?.totalBookings || 0;
        document.getElementById('totalProducts').textContent = data.stats?.totalProducts || 0;
        document.getElementById('totalRevenue').textContent = 'R ' + (data.stats?.totalRevenue || 0);

        // Load charts
        if (data.charts) {
            createRevenueChart(data.charts.revenue);
            createStaffPerformanceChart(data.charts.staffPerformance);
            createServicesChart(data.charts.popularServices);
        }

        // Load recent activity
        const recentActivityList = document.getElementById('recentActivity');
        if (recentActivityList && data.recentActivity) {
            recentActivityList.innerHTML = data.recentActivity.map(activity => `
                <li class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${activity.title}</h6>
                        <small>${new Date(activity.timestamp).toLocaleDateString()}</small>
                    </div>
                    <p class="mb-1">${activity.description}</p>
                </li>
            `).join('') || '<li class="list-group-item">No recent activity</li>';
        }

    } catch (error) {
        console.error('Failed to load admin dashboard:', error);
    }
}

// ===== CHART FUNCTIONS =====
function createRevenueChart(data) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    cleanupCharts();

    chartInstances.revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data?.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Monthly Revenue (R)',
                data: data?.values || [6500, 7200, 8100, 7800, 9200, 10500],
                borderColor: '#8a6d3b',
                backgroundColor: 'rgba(138, 109, 59, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Revenue Trend'
                }
            }
        }
    });
}

function createStaffPerformanceChart(data) {
    const ctx = document.getElementById('staffPerformanceChart');
    if (!ctx) return;

    chartInstances.staffPerformanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data?.labels || ['Jane', 'John', 'Mike', 'Sarah'],
            datasets: [{
                label: 'Sales Performance',
                data: data?.values || [12000, 9000, 7500, 11000],
                backgroundColor: 'rgba(138, 109, 59, 0.8)',
                borderColor: '#8a6d3b',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Staff Performance'
                }
            }
        }
    });
}

function createServicesChart(data) {
    const ctx = document.getElementById('servicesChart');
    if (!ctx) return;

    chartInstances.servicesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data?.labels || ['Massage', 'Facial', 'Manicure', 'Pedicure'],
            datasets: [{
                data: data?.values || [35, 25, 20, 20],
                backgroundColor: [
                    '#8a6d3b',
                    '#d4af37',
                    '#f5f5f5',
                    '#333333'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: 'Popular Services'
                }
            }
        }
    });
}

// ===== ADMIN FUNCTIONS =====
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

            document.getElementById('addServiceForm').addEventListener('submit', async function (e) {
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

            document.getElementById('addProductForm').addEventListener('submit', async function (e) {
                e.preventDefault();
                await addNewProduct();
                modal.hide();
            });

        } else if (action === 'addVoucher') {
            modalTitle.textContent = 'Create Voucher Code';
            modalBody.innerHTML = `
                <form id="addVoucherForm">
                    <div class="mb-3">
                        <label for="voucherCode" class="form-label">Voucher Code</label>
                        <input type="text" class="form-control" id="voucherCode" required>
                    </div>
                    <div class="mb-3">
                        <label for="voucherDiscount" class="form-label">Discount (%)</label>
                        <input type="number" class="form-control" id="voucherDiscount" min="1" max="100" required>
                    </div>
                    <div class="mb-3">
                        <label for="voucherExpiry" class="form-label">Expiry Date</label>
                        <input type="date" class="form-control" id="voucherExpiry" required>
                    </div>
                    <div class="mb-3">
                        <label for="voucherStaff" class="form-label">Assign to Staff (Optional)</label>
                        <select class="form-control" id="voucherStaff">
                            <option value="">No specific staff</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Create Voucher</button>
                </form>
            `;

            document.getElementById('addVoucherForm').addEventListener('submit', async function (e) {
                e.preventDefault();
                await addNewVoucher();
                modal.hide();
            });
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

        loadProducts();
        alert('Product added successfully!');

    } catch (error) {
        alert('Failed to add product: ' + error.message);
    }
}

async function addNewVoucher() {
    try {
        const code = document.getElementById('voucherCode').value;
        const discount = parseInt(document.getElementById('voucherDiscount').value);
        const expiryDate = document.getElementById('voucherExpiry').value;
        const assignedStaff = document.getElementById('voucherStaff').value;

        const voucherData = {
            code,
            discount,
            expiryDate,
            ...(assignedStaff && { assignedStaff })
        };

        await apiCall('/vouchers', {
            method: 'POST',
            body: JSON.stringify(voucherData)
        });

        alert('Voucher created successfully!');

    } catch (error) {
        alert('Failed to create voucher: ' + error.message);
    }
}

// ===== UTILITY FUNCTIONS =====
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

function setMinimumDates() {
    const today = new Date().toISOString().split('T')[0];
    const bookingDate = document.getElementById('bookingDate');
    const deliveryDate = document.getElementById('deliveryDate');

    if (bookingDate) bookingDate.min = today;
    if (deliveryDate) deliveryDate.min = today;
}

function safeFormSetup() {
    const forms = {
        'loginFormElement': handleLogin,
        'registerFormElement': handleRegister,
        'profileForm': updateProfile,
        'passwordForm': changePassword,
        'bookingDetailsForm': confirmBooking,
        'giftCustomizationForm': createGift
    };

    Object.entries(forms).forEach(([formId, handler]) => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                handler(e);
            });
        }
    });

    console.log('Form setup completed');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Initializing Tassel Group Application');

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('currentUser');

    if (token && savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUIForUser();
        } catch (error) {
            console.error('Error parsing saved user:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
        }
    }

    // Safe form setup
    safeFormSetup();

    // Set minimum dates
    setMinimumDates();

    // Load initial data
    loadProducts();
    loadServices();
    loadGiftPackages();

    console.log('✅ Application initialized successfully');
});