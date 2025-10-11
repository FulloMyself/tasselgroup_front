// scripts.js
// API Base URL
const API_BASE = CONFIG.API_BASE;

// Chart instances management
let chartInstances = {
    revenueChart: null,
    staffPerformanceChart: null,
    servicesChart: null
};

// Application State
let currentUser = null;
let cart = [];
let currentBooking = null;
let currentGift = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        fetchCurrentUser();
    }

    // Set up form submissions
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    document.getElementById('passwordForm').addEventListener('submit', changePassword);
    document.getElementById('bookingDetailsForm').addEventListener('submit', confirmBooking);
    document.getElementById('giftCustomizationForm').addEventListener('submit', createGift);

    // Set minimum date for booking to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bookingDate').min = today;
    document.getElementById('deliveryDate').min = today;

    // Load initial data
    loadProducts();
    loadServices();
    loadGiftPackages();
});

// API Helper Functions
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

        // Show user-friendly error messages
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Unable to connect to server. Please check your internet connection.');
        }

        throw error;
    }
}

// Fetch current user
async function fetchCurrentUser() {
    try {
        const data = await apiCall('/auth/me');
        currentUser = data.user;
        updateUIForUser();
    } catch (error) {
        // Token might be invalid, clear it
        localStorage.removeItem('token');
        currentUser = null;
    }
}

// Show a specific section and hide others
function showSection(sectionId) {
    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show the requested section
    document.getElementById(sectionId).style.display = 'block';

    // If showing dashboard, load appropriate dashboard
    if (sectionId === 'dashboard' && currentUser) {
        loadDashboard();
    }
}

// Handle user login
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

        // Reset form
        document.getElementById('loginFormElement').reset();

        alert('Login successful!');
    } catch (error) {
        alert(error.message);
    }
}

// Handle user registration
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

        // Reset form
        document.getElementById('registerFormElement').reset();

        alert('Registration successful!');
    } catch (error) {
        alert(error.message);
    }
}

// Update UI based on user login status
function updateUIForUser() {
    if (currentUser) {
        // Show user dropdown
        document.getElementById('userDropdown').style.display = 'block';
        document.getElementById('loginLink').style.display = 'none';

        // Update user info
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

        // Show dashboard link for staff and admin
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
        // Show login link
        document.getElementById('userDropdown').style.display = 'none';
        document.getElementById('loginLink').style.display = 'block';
    }
}

// Logout user
function logout() {
    currentUser = null;
    localStorage.removeItem('token');
    updateUIForUser();
    showSection('home');
    alert('You have been logged out.');
}

// Update user profile
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

        // Update current user
        currentUser = { ...currentUser, name, email, phone, address };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();

        alert('Profile updated successfully!');
    } catch (error) {
        alert(error.message);
    }
}

// Change user password
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

// Load products for shop section
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
            console.warn('Unexpected API response format:', response);
            products = [];
        }

        const container = document.getElementById('productsContainer');

        if (!container) {
            console.error('Products container not found');
            return;
        }

        container.innerHTML = '';

        if (products.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
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
                            <p class="card-text flex-grow-1">${product.description}</p>
                            <p class="card-text"><strong>R ${product.price}</strong></p>
                            <button class="btn btn-primary mt-auto" onclick="addToCart('${product._id || product.id}', '${product.name.replace(/'/g, "\\'")}', ${product.price})">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += productCard;
        });

        console.log(`✅ Loaded ${products.length} products successfully`);

    } catch (error) {
        console.error('Failed to load products:', error);

        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Unable to load products: ${error.message}
                    </div>
                </div>
            `;
        }
    }
}

// Add product to cart
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

// Update cart display
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

// Remove item from cart
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();

    if (cart.length === 0) {
        document.getElementById('cartSection').style.display = 'none';
    }
}

// Checkout process
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

        const order = await apiCall('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });

        // Clear cart
        cart = [];
        updateCartDisplay();
        document.getElementById('cartSection').style.display = 'none';

        alert('Order placed successfully! Thank you for your purchase.');
    } catch (error) {
        alert('Failed to place order: ' + error.message);
    }
}

// Load services for bookings section
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

        if (!container) {
            console.error('Services container not found');
            return;
        }

        container.innerHTML = '';

        if (services.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
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
                            <p class="card-text">${service.description}</p>
                            <p class="card-text"><strong>Duration:</strong> ${service.duration}</p>
                            <p class="card-text"><strong>Price:</strong> R ${service.price}</p>
                            <button class="btn btn-primary" 
                                    onclick="bookService('${service._id || service.id}', '${service.name.replace(/'/g, "\\'")}', ${service.price}, '${service.duration}')">
                                Book Now
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += serviceCard;
        });

        console.log(`✅ Loaded ${services.length} services successfully`);

    } catch (error) {
        console.error('Failed to load services:', error);

        const container = document.getElementById('servicesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Unable to load services: ${error.message}
                    </div>
                </div>
            `;
        }
    }
}



// Book a service
function bookService(serviceId, serviceName, price, duration) {
    if (!currentUser) {
        alert('Please log in to book services');
        showSection('login');
        return;
    }

    currentBooking = { serviceId, name: serviceName, price, duration };
    document.getElementById('serviceName').value = serviceName;
    document.getElementById('bookingForm').style.display = 'block';

    // Scroll to booking form
    document.getElementById('bookingForm').scrollIntoView({ behavior: 'smooth' });
}

// Confirm booking
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

        // Reset form
        document.getElementById('bookingDetailsForm').reset();
        document.getElementById('bookingForm').style.display = 'none';
        currentBooking = null;

        alert('Booking confirmed! We look forward to seeing you.');
    } catch (error) {
        alert('Failed to create booking: ' + error.message);
    }
}

// Load gift packages
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

        if (!container) {
            console.error('Gift packages container not found');
            return;
        }

        container.innerHTML = '';

        if (giftPackages.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
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
                            <p class="card-text flex-grow-1">${gift.description}</p>
                            <p class="card-text"><strong>Includes:</strong></p>
                            <ul class="flex-grow-1">
                                ${includesList}
                            </ul>
                            <p class="card-text"><strong>From R ${gift.basePrice || gift.price}</strong></p>
                            <button class="btn btn-primary mt-auto" 
                                    onclick="customizeGift('${gift._id || gift.id}', '${gift.name.replace(/'/g, "\\'")}')">
                                Customize Gift
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += giftCard;
        });

        console.log(`✅ Loaded ${giftPackages.length} gift packages successfully`);

    } catch (error) {
        console.error('Failed to load gift packages:', error);

        const container = document.getElementById('giftPackagesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Unable to load gift packages: ${error.message}
                    </div>
                </div>
            `;
        }
    }
}

// Customize a gift package
function customizeGift(giftId, giftName) {
    if (!currentUser) {
        alert('Please log in to create gift packages');
        showSection('login');
        return;
    }

    currentGift = { giftId, name: giftName };
    document.getElementById('giftPackage').value = giftName;
    document.getElementById('giftCustomization').style.display = 'block';

    // Scroll to customization form
    document.getElementById('giftCustomization').scrollIntoView({ behavior: 'smooth' });
}

// Create a gift
async function createGift(e) {
    e.preventDefault();

    const recipientName = document.getElementById('recipientName').value;
    const recipientEmail = document.getElementById('recipientEmail').value;
    const giftMessage = document.getElementById('giftMessage').value;
    const deliveryDate = document.getElementById('deliveryDate').value;

    // In a real application, this would create a gift order and send notifications
    alert(`Gift package created for ${recipientName}! An email will be sent to ${recipientEmail} with the gift details.`);

    // Reset form
    document.getElementById('giftCustomizationForm').reset();
    document.getElementById('giftCustomization').style.display = 'none';
    currentGift = null;
}

// Load appropriate dashboard based on user role
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

// Load staff dashboard data
async function loadStaffDashboard() {
    try {
        const data = await apiCall('/dashboard/staff');

        console.log('Staff dashboard data:', data);

        // Update stats
        if (data.stats) {
            document.getElementById('staffSales').textContent = data.stats.totalSales || 0;
            document.getElementById('staffClients').textContent = data.stats.totalClients || 0;
            document.getElementById('staffHours').textContent = data.stats.totalHours || 0;
            document.getElementById('staffCommission').textContent = 'R ' + (data.stats.totalCommission || 0);
        }

        // Load appointments
        const staffAppointments = document.getElementById('staffAppointments');
        staffAppointments.innerHTML = '';

        if (!data.upcomingAppointments || data.upcomingAppointments.length === 0) {
            staffAppointments.innerHTML = '<li class="list-group-item">No upcoming appointments</li>';
        } else {
            data.upcomingAppointments.forEach(booking => {
                const bookingDate = new Date(booking.date).toLocaleDateString();
                staffAppointments.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${booking.service?.name || 'Unknown Service'}</strong><br>
                            <small>${booking.user?.name || 'Unknown Client'} - ${bookingDate} at ${booking.time}</small>
                        </div>
                        <span class="badge bg-primary rounded-pill">${booking.status}</span>
                    </li>
                `;
            });
        }

        // Load recent sales
        const staffRecentSales = document.getElementById('staffRecentSales');
        staffRecentSales.innerHTML = '';

        if (!data.recentSales || data.recentSales.length === 0) {
            staffRecentSales.innerHTML = '<li class="list-group-item">No recent sales</li>';
        } else {
            data.recentSales.forEach(order => {
                const orderId = order._id ? order._id.slice(-6) : 'N/A';
                staffRecentSales.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>Order #${orderId}</strong><br>
                            <small>${order.items?.length || 0} items - R ${order.finalTotal || order.total || 0}</small>
                        </div>
                        <span class="badge bg-success rounded-pill">${order.status}</span>
                    </li>
                `;
            });
        }

        // Load vouchers
        const staffVouchers = document.getElementById('staffVouchers');
        staffVouchers.innerHTML = '';

        if (!data.myVouchers || data.myVouchers.length === 0) {
            staffVouchers.innerHTML = '<div class="col-12"><p>No vouchers assigned to you</p></div>';
        } else {
            data.myVouchers.forEach(voucher => {
                const validUntil = new Date(voucher.validUntil).toLocaleDateString();
                staffVouchers.innerHTML += `
                    <div class="col-md-6 mb-3">
                        <div class="card voucher-card">
                            <div class="card-body">
                                <h5 class="card-title">${voucher.code}</h5>
                                <p class="card-text">
                                    <strong>Discount:</strong> ${voucher.discount}${voucher.type === 'percentage' ? '%' : ' R'}<br>
                                    <strong>Used:</strong> ${voucher.used}/${voucher.maxUses}<br>
                                    <strong>Valid until:</strong> ${validUntil}
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

    } catch (error) {
        console.error('Failed to load staff dashboard:', error);

        // Show user-friendly error
        const staffDashboard = document.getElementById('staffDashboard');
        if (staffDashboard) {
            staffDashboard.innerHTML = `
                <div class="alert alert-warning">
                    <h4>Dashboard Temporarily Unavailable</h4>
                    <p>We're experiencing technical difficulties loading your dashboard data.</p>
                    <p><small>Error: ${error.message}</small></p>
                    <button class="btn btn-primary btn-sm" onclick="loadStaffDashboard()">Try Again</button>
                </div>
            `;
        }
    }
}
// Load admin dashboard data
async function loadAdminDashboard() {
    try {
        const data = await apiCall('/dashboard/admin');

        console.log('Admin dashboard data:', data);

        // Update stats
        if (data.stats) {
            document.getElementById('totalUsers').textContent = data.stats.totalUsers || 0;
            document.getElementById('totalBookings').textContent = data.stats.totalBookings || 0;
            document.getElementById('totalProducts').textContent = data.stats.totalProducts || 0;
            document.getElementById('totalRevenue').textContent = 'R ' + (data.stats.totalRevenue || 0);
        }

        // Create charts with error handling
        createRevenueChart(data.monthlyRevenue || []);
        createStaffPerformanceChart(data.staffPerformance || []);
        createServicesChart(data.popularServices || []);

        // Load recent activity
        const recentActivity = document.getElementById('recentActivity');
        recentActivity.innerHTML = '';

        const allActivity = [
            ...(data.recentOrders || []).map(order => ({
                type: 'order',
                description: `New order from ${order.user?.name || 'Unknown Customer'}`,
                date: order.createdAt,
                amount: order.finalTotal || order.total
            })),
            ...(data.recentBookings || []).map(booking => ({
                type: 'booking',
                description: `New booking for ${booking.service?.name || 'Unknown Service'}`,
                date: booking.createdAt,
                amount: null
            }))
        ]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (allActivity.length === 0) {
            recentActivity.innerHTML = '<li class="list-group-item">No recent activity</li>';
        } else {
            allActivity.forEach(activity => {
                const date = new Date(activity.date).toLocaleDateString();
                recentActivity.innerHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${activity.description}</strong><br>
                            <small>${date}</small>
                        </div>
                        ${activity.amount ? `<span class="badge bg-success rounded-pill">R ${activity.amount}</span>` : ''}
                    </li>
                `;
            });
        }

    } catch (error) {
        console.error('Failed to load admin dashboard:', error);

        // Show user-friendly error
        const adminDashboard = document.getElementById('adminDashboard');
        if (adminDashboard) {
            adminDashboard.innerHTML = `
                <div class="alert alert-warning">
                    <h4>Dashboard Temporarily Unavailable</h4>
                    <p>We're experiencing technical difficulties loading the admin dashboard data.</p>
                    <p><small>Error: ${error.message}</small></p>
                    <button class="btn btn-primary btn-sm" onclick="loadAdminDashboard()">Try Again</button>
                </div>
            `;
        }
    }
}

// Create revenue chart for admin dashboard
function createRevenueChart(monthlyRevenue) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    try {
        // Destroy previous chart instance if it exists
        if (chartInstances.revenueChart) {
            chartInstances.revenueChart.destroy();
        }

        const months = monthlyRevenue.map(item => item.monthName || `Month ${item._id}`);
        const revenueData = monthlyRevenue.map(item => item.revenue || 0);

        chartInstances.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Revenue (R)',
                    data: revenueData,
                    borderColor: '#8a6d3b',
                    backgroundColor: 'rgba(138, 109, 59, 0.1)',
                    tension: 0.3,
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `Revenue: R ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return 'R ' + value;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating revenue chart:', error);
        ctx.parentElement.innerHTML = '<p class="text-muted">Chart data unavailable</p>';
    }
}

// Create staff performance chart for admin dashboard
function createStaffPerformanceChart(staffPerformance) {
    const ctx = document.getElementById('staffPerformanceChart');
    if (!ctx) return;

    try {
        // Destroy previous chart instance if it exists
        if (chartInstances.staffPerformanceChart) {
            chartInstances.staffPerformanceChart.destroy();
        }

        // Filter out staff with no revenue
        const validStaff = staffPerformance.filter(staff => staff.totalRevenue > 0);

        if (validStaff.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-muted">No performance data available</p>';
            return;
        }

        chartInstances.staffPerformanceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: validStaff.map(staff => staff.name || 'Unknown Staff'),
                datasets: [{
                    data: validStaff.map(staff => staff.totalRevenue || 0),
                    backgroundColor: [
                        '#8a6d3b',
                        '#d4af37',
                        '#a1885b',
                        '#c9b18a',
                        '#7a5d2b',
                        '#e5c158'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: R ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating staff performance chart:', error);
        ctx.parentElement.innerHTML = '<p class="text-muted">Chart data unavailable</p>';
    }
}

// Create services chart for admin dashboard
function createServicesChart(popularServices) {
    const ctx = document.getElementById('servicesChart');
    if (!ctx) return;

    try {
        // Destroy previous chart instance if it exists
        if (chartInstances.servicesChart) {
            chartInstances.servicesChart.destroy();
        }

        // Filter out services with no bookings
        const validServices = popularServices.filter(service => service.count > 0);

        if (validServices.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-muted">No service data available</p>';
            return;
        }

        chartInstances.servicesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: validServices.map(service => service.name || 'Unknown Service'),
                datasets: [{
                    label: 'Bookings',
                    data: validServices.map(service => service.count || 0),
                    backgroundColor: '#8a6d3b',
                    borderColor: '#7a5d2b',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `Bookings: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating services chart:', error);
        ctx.parentElement.innerHTML = '<p class="text-muted">Chart data unavailable</p>';
    }
}

// Admin modal functions
async function showAdminModal(action) {
    const modal = new bootstrap.Modal(document.getElementById('adminModal'));
    const modalTitle = document.getElementById('adminModalTitle');
    const modalBody = document.getElementById('adminModalBody');

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
        // Fetch staff members for assignment
        const staff = await getStaffMembers();

        modalTitle.textContent = 'Create Voucher Code';
        modalBody.innerHTML = `
            <form id="addVoucherForm">
                <div class="mb-3">
                    <label for="voucherCode" class="form-label">Voucher Code</label>
                    <input type="text" class="form-control" id="voucherCode" required>
                </div>
                <div class="mb-3">
                    <label for="voucherDiscount" class="form-label">Discount</label>
                    <input type="number" class="form-control" id="voucherDiscount" required>
                </div>
                <div class="mb-3">
                    <label for="voucherType" class="form-label">Discount Type</label>
                    <select class="form-control" id="voucherType" required>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (R)</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label for="voucherStaff" class="form-label">Assign to Staff</label>
                    <select class="form-control" id="voucherStaff" required>
                        <option value="">Select staff member</option>
                        ${staff.map(s => `<option value="${s._id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="mb-3">
                    <label for="voucherMaxUses" class="form-label">Maximum Uses</label>
                    <input type="number" class="form-control" id="voucherMaxUses" required>
                </div>
                <div class="mb-3">
                    <label for="voucherValidUntil" class="form-label">Valid Until</label>
                    <input type="date" class="form-control" id="voucherValidUntil" required>
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
}

// Get staff members for voucher assignment
async function getStaffMembers() {
    try {
        const users = await apiCall('/users');
        return users.filter(user => user.role === 'staff');
    } catch (error) {
        console.error('Failed to fetch staff members:', error);
        return [];
    }
}

// Add new service
async function addNewService() {
    const name = document.getElementById('serviceName').value;
    const description = document.getElementById('serviceDescription').value;
    const price = parseInt(document.getElementById('servicePrice').value);
    const duration = document.getElementById('serviceDuration').value;
    const category = document.getElementById('serviceCategory').value;

    try {
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

// Add new product
async function addNewProduct() {
    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const price = parseInt(document.getElementById('productPrice').value);
    const category = document.getElementById('productCategory').value;
    const image = document.getElementById('productImage').value;

    try {
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

// Add new voucher
async function addNewVoucher() {
    const code = document.getElementById('voucherCode').value;
    const discount = parseInt(document.getElementById('voucherDiscount').value);
    const type = document.getElementById('voucherType').value;
    const assignedTo = document.getElementById('voucherStaff').value;
    const maxUses = parseInt(document.getElementById('voucherMaxUses').value);
    const validUntil = document.getElementById('voucherValidUntil').value;

    try {
        await apiCall('/vouchers', {
            method: 'POST',
            body: JSON.stringify({ code, discount, type, assignedTo, maxUses, validUntil })
        });

        alert('Voucher created successfully!');
    } catch (error) {
        alert('Failed to create voucher: ' + error.message);
    }
}