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

    // Add body to config if it exists
    if (options.body && !['GET', 'HEAD'].includes(options.method?.toUpperCase() || 'GET')) {
        config.body = JSON.stringify(options.body);
    }

    try {
        console.log(`📡 Making API call to: ${API_BASE}${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`, config);

        // Handle non-JSON responses
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Server returned non-JSON response: ${text}`);
        }

        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        return data;

    } catch (error) {
        console.error(`❌ API call failed: ${error.message}`);

        // Show user-friendly error messages
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Please check your internet connection and try again.');
        }

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
            body: { email, password }
        });

        if (!data.token || !data.user) {
            throw new Error('Invalid response from server');
        }

        localStorage.setItem('token', data.token);
        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();
        showSection('home');

        document.getElementById('loginFormElement').reset();
        showNotification('Login successful!', 'success');
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
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
            body: { name, email, password, phone, address }
        });

        if (!data.token || !data.user) {
            throw new Error('Invalid response from server');
        }

        localStorage.setItem('token', data.token);
        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();
        showSection('home');

        document.getElementById('registerFormElement').reset();
        showNotification('Registration successful!', 'success');
    } catch (error) {
        showNotification('Registration failed: ' + error.message, 'error');
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
        document.getElementById('profilePhone').value = currentUser.phone || '';
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
    showNotification('You have been logged out.', 'info');
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
        const data = await apiCall('/products');
        const products = data.products || data.data || data || [];
        const container = document.getElementById('productsContainer');

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
                            <button class="btn btn-primary mt-auto" onclick="addToCart('${product._id}', '${(product.name || '').replace(/'/g, "\\'")}', ${product.price || 0})">
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

// ===== CART & CHECKOUT FUNCTIONS =====
function addToCart(productId, productName, price) {
    if (!currentUser) {
        showNotification('Please log in to add items to your cart', 'warning');
        showSection('login');
        return;
    }

    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ productId, name: productName, price, quantity: 1 });
    }

    updateCartDisplay();
    document.getElementById('cartSection').style.display = 'block';

    showNotification(`${productName} added to cart!`, 'success');
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartSection = document.getElementById('cartSection');
    const cartStaffSection = document.getElementById('cartStaffSection');

    if (!cartItems || !cartSection) {
        console.warn('Cart elements not found in DOM');
        return;
    }

    cartItems.innerHTML = '';

    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Your cart is empty</p>';
        cartSection.style.display = 'none';
        if (cartStaffSection) cartStaffSection.style.display = 'none';
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
    if (cartStaffSection) cartStaffSection.style.display = 'block';
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
        const cartStaffSection = document.getElementById('cartStaffSection');
        if (cartStaffSection) cartStaffSection.style.display = 'none';
    }
}

async function checkout() {
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'warning');
        return;
    }

    if (!currentUser) {
        showNotification('Please log in to checkout', 'warning');
        showSection('login');
        return;
    }

    try {
        const cartStaffDropdown = document.getElementById('cartStaff');
        const staffId = cartStaffDropdown ? cartStaffDropdown.value : null;

        const orderData = {
            items: cart.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.price
            })),
            totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            shippingAddress: currentUser.address,
            paymentMethod: 'card',
            status: 'paid',
            processedBy: staffId || null
        };

        console.log('🛒 Processing order with data:', orderData);

        const result = await apiCall('/orders', {
            method: 'POST',
            body: orderData
        });

        // Clear cart and reset UI
        cart = [];
        updateCartDisplay();
        document.getElementById('cartSection').style.display = 'none';

        if (cartStaffDropdown) {
            cartStaffDropdown.value = '';
        }

        showNotification('Order placed successfully! Thank you for your purchase.', 'success');

        // Refresh dashboard if admin/staff is viewing it
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
            loadDashboard();
        }

    } catch (error) {
        showNotification('Failed to place order: ' + error.message, 'error');
    }
}

// ===== SERVICES & BOOKINGS =====
async function loadServices() {
    try {
        const data = await apiCall('/services');
        const services = data.services || data.data || data || [];
        const container = document.getElementById('servicesContainer');

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

async function bookService(serviceId, serviceName, price, duration) {
    if (!currentUser) {
        showNotification('Please log in to book services', 'warning');
        showSection('login');
        return;
    }

    currentBooking = { serviceId, name: serviceName, price, duration };

    const serviceNameInput = document.getElementById('serviceName');
    const bookingForm = document.getElementById('bookingForm');
    const staffSection = document.getElementById('staffSelectionSection');

    if (serviceNameInput && bookingForm) {
        serviceNameInput.value = serviceName;

        // Load staff dropdown
        await populateStaffDropdowns();

        if (staffSection) {
            staffSection.style.display = 'block';
        }

        bookingForm.style.display = 'block';
        bookingForm.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn('Booking form elements not found');
    }
}

async function confirmBooking(e) {
    e.preventDefault();

    if (!currentBooking) {
        showNotification('No service selected for booking', 'error');
        return;
    }

    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const assignedStaff = document.getElementById('assignedStaff').value;
    const specialRequests = document.getElementById('specialRequests').value;

    if (!date || !time || !assignedStaff) {
        showNotification('Please select date, time, and staff member for your booking', 'warning');
        return;
    }

    try {
        const bookingData = {
            service: currentBooking.serviceId,
            date,
            time,
            assignedStaff,
            specialRequests: specialRequests || '',
            status: 'confirmed'
        };

        const result = await apiCall('/bookings', {
            method: 'POST',
            body: bookingData
        });

        document.getElementById('bookingDetailsForm').reset();
        document.getElementById('bookingForm').style.display = 'none';
        document.getElementById('staffSelectionSection').style.display = 'none';
        currentBooking = null;

        showNotification('Booking confirmed! We look forward to seeing you.', 'success');

    } catch (error) {
        console.error('Booking error details:', error);
        showNotification('Failed to create booking: ' + error.message, 'error');
    }
}

// ===== GIFT PACKAGES =====
async function loadGiftPackages() {
    try {
        const data = await apiCall('/gift-packages');
        const giftPackages = data.giftPackages || data.data || data || [];
        const container = document.getElementById('giftPackagesContainer');

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
        showNotification('Please log in to create gift packages', 'warning');
        showSection('login');
        return;
    }

    currentGift = { giftId, name: giftName };

    const giftPackageInput = document.getElementById('giftPackage');
    const giftCustomization = document.getElementById('giftCustomization');
    const giftStaffSection = document.getElementById('giftStaffSection');

    if (giftPackageInput && giftCustomization) {
        giftPackageInput.value = giftName;

        // Load staff dropdown for gift assignment
        populateGiftStaffDropdown();

        if (giftStaffSection) {
            giftStaffSection.style.display = 'block';
        }

        giftCustomization.style.display = 'block';
        giftCustomization.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn('Gift customization elements not found');
    }
}

async function populateGiftStaffDropdown() {
    try {
        const staffMembers = await loadStaffMembers();
        const giftStaffDropdown = document.getElementById('giftStaff');

        if (giftStaffDropdown && staffMembers.length > 0) {
            while (giftStaffDropdown.options.length > 1) {
                giftStaffDropdown.remove(1);
            }

            staffMembers.forEach(staff => {
                const option = document.createElement('option');
                option.value = staff._id;
                option.textContent = `${staff.name} (${staff.role})`;
                giftStaffDropdown.appendChild(option);
            });

            console.log(`✅ Loaded ${staffMembers.length} staff members for gift assignment`);
        }
    } catch (error) {
        console.error('Failed to populate gift staff dropdown:', error);
    }
}

async function createGift(e) {
    e.preventDefault();

    const recipientName = document.getElementById('recipientName').value;
    const recipientEmail = document.getElementById('recipientEmail').value;
    const giftMessage = document.getElementById('giftMessage').value;
    const deliveryDate = document.getElementById('deliveryDate').value;
    const assignedStaff = document.getElementById('giftStaff').value;

    if (!recipientName || !recipientEmail || !deliveryDate) {
        showNotification('Please fill in all required fields: Recipient Name, Recipient Email, and Delivery Date', 'warning');
        return;
    }

    try {
        const giftOrderData = {
            giftPackage: currentGift.giftId,
            recipientName,
            recipientEmail,
            message: giftMessage || '',
            deliveryDate,
            assignedStaff: assignedStaff || null
        };

        const result = await apiCall('/gift-orders', {
            method: 'POST',
            body: giftOrderData
        });

        showNotification(`Gift package created for ${recipientName}! An email will be sent to ${recipientEmail} with the gift details.`, 'success');

        // Reset form and hide customization
        document.getElementById('giftCustomizationForm').reset();
        document.getElementById('giftCustomization').style.display = 'none';
        document.getElementById('giftStaffSection').style.display = 'none';
        currentGift = null;

    } catch (error) {
        showNotification('Failed to create gift order: ' + error.message, 'error');
    }
}

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboard() {
    if (!currentUser) return;

    console.log('🚀 Loading dashboard for:', currentUser.role);

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

async function loadAdminDashboard() {
    try {
        const data = await apiCall('/dashboard/admin');

        console.log('📊 Admin dashboard data received:', data);

        // Update stats with actual data
        document.getElementById('totalUsers').textContent = data.stats?.totalUsers || 0;
        document.getElementById('totalBookings').textContent = data.stats?.totalBookings || 0;
        document.getElementById('totalProducts').textContent = data.stats?.totalOrders || data.stats?.totalProductsSold || 0;

        // Use the totalRevenue from dashboard API
        const totalRevenue = data.stats?.totalRevenue || 0;
        document.getElementById('totalRevenue').textContent = 'R ' + totalRevenue;


        console.log('💰 Total Revenue Updated:', totalRevenue);

        // Add this after receiving the data but before creating charts
        if (data.monthlyRevenue && data.monthlyRevenue.labels) {
            // Reverse to show chronological order (oldest to newest)
            data.monthlyRevenue.labels = data.monthlyRevenue.labels.reverse();
            data.monthlyRevenue.data = data.monthlyRevenue.data.reverse();
            console.log('🔄 Monthly revenue data reversed for proper chronological display');
        }

        // Load revenue chart
        if (data.monthlyRevenue) {
            createRevenueChart(data.monthlyRevenue);
        }

        // Load staff performance chart
        if (data.staffPerformance) {
            createStaffPerformanceChart(data.staffPerformance);
        }

        // Load popular services chart
        if (data.popularServices) {
            createServicesChart(data.popularServices);
        }

        // Load recent activity
        updateRecentActivity(data.recentActivity || []);

    } catch (error) {
        console.error('Failed to load admin dashboard:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

async function loadStaffDashboard() {
    try {
        const data = await apiCall('/dashboard/staff');

        document.getElementById('staffSales').textContent = data.stats?.totalSales || 0;
        document.getElementById('staffClients').textContent = data.stats?.totalClients || 0;
        document.getElementById('staffHours').textContent = data.stats?.totalHours || 0;
        document.getElementById('staffCommission').textContent = 'R ' + (data.stats?.totalCommission || 0);

        // Update appointments
        const appointmentsList = document.getElementById('staffAppointments');
        if (appointmentsList) {
            if (data.upcomingAppointments && data.upcomingAppointments.length > 0) {
                appointmentsList.innerHTML = data.upcomingAppointments.map(apt => `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${apt.service?.name || 'Service'} - ${apt.user?.name || 'Customer'}
                        <span class="badge bg-primary rounded-pill">${new Date(apt.date).toLocaleDateString()}, ${apt.time}</span>
                    </li>
                `).join('');
            } else {
                appointmentsList.innerHTML = '<li class="list-group-item">No upcoming appointments</li>';
            }
        }

        // Update recent sales
        const recentSalesList = document.getElementById('staffRecentSales');
        if (recentSalesList) {
            if (data.recentSales && data.recentSales.length > 0) {
                recentSalesList.innerHTML = data.recentSales.map(sale => `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${sale.description || 'Sale'}
                        <span class="badge bg-success rounded-pill">R ${sale.amount || 0}</span>
                    </li>
                `).join('');
            } else {
                recentSalesList.innerHTML = '<li class="list-group-item">No recent sales</li>';
            }
        }

    } catch (error) {
        console.error('Failed to load staff dashboard:', error);
        showNotification('Failed to load staff dashboard', 'error');
    }
}

// ===== CHART FUNCTIONS =====
function createRevenueChart(monthlyRevenueData) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) {
        console.warn('Revenue chart canvas not found');
        return;
    }

    // Clean up existing chart
    if (chartInstances.revenueChart) {
        chartInstances.revenueChart.destroy();
    }

    // Process data for chart
    let labels, data;

    if (Array.isArray(monthlyRevenueData)) {
        labels = monthlyRevenueData.map(item => item.monthName || `Month ${item._id}`);
        data = monthlyRevenueData.map(item => item.revenue || 0);
    } else {
        // Object format
        labels = Object.keys(monthlyRevenueData);
        data = Object.values(monthlyRevenueData);
    }

    chartInstances.revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Revenue (R)',
                data: data,
                borderColor: '#4e73df',
                backgroundColor: 'rgba(78, 115, 223, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Revenue Trend'
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
}

// Function to sort monthly revenue data chronologically
function sortMonthlyRevenueData(monthlyRevenue) {
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Combine labels and data into sortable objects
    const combined = monthlyRevenue.labels.map((label, index) => ({
        label,
        data: monthlyRevenue.data[index],
        // Extract year and month for sorting
        year: parseInt(label.split(' ')[1]),
        month: months.indexOf(label.split(' ')[0])
    }));

    // Sort by year and month
    combined.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });

    // Return separated arrays
    return {
        labels: combined.map(item => item.label),
        data: combined.map(item => item.data)
    };
}

function createStaffPerformanceChart(staffPerformance) {
    const ctx = document.getElementById('staffPerformanceChart');
    if (!ctx) {
        console.warn('Staff performance chart canvas not found');
        return;
    }

    if (chartInstances.staffPerformanceChart) {
        chartInstances.staffPerformanceChart.destroy();
    }

    const labels = staffPerformance.map(staff => staff.name);
    const data = staffPerformance.map(staff => staff.totalRevenue);

    chartInstances.staffPerformanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue Generated (R)',
                data: data,
                backgroundColor: 'rgba(78, 115, 223, 0.8)',
                borderColor: '#4e73df',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Staff Performance'
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
}

function createServicesChart(popularServices) {
    const ctx = document.getElementById('servicesChart');
    if (!ctx) {
        console.warn('Services chart canvas not found');
        return;
    }

    if (chartInstances.servicesChart) {
        chartInstances.servicesChart.destroy();
    }

    const labels = popularServices.map(service => service.name);
    const data = popularServices.map(service => service.count);

    chartInstances.servicesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#4e73df',
                    '#1cc88a',
                    '#36b9cc',
                    '#f6c23e',
                    '#e74a3b'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Popular Services'
                }
            }
        }
    });
}

function updateRecentActivity(activities) {
    const recentActivityList = document.getElementById('recentActivity');
    if (!recentActivityList) return;

    if (activities.length > 0) {
        recentActivityList.innerHTML = activities.map(activity => `
            <li class="list-group-item">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${activity.title || activity.description}</h6>
                    <small>${new Date(activity.timestamp || activity.date).toLocaleDateString()}</small>
                </div>
                <p class="mb-1">${activity.description || activity.type}</p>
            </li>
        `).join('');
    } else {
        recentActivityList.innerHTML = '<li class="list-group-item">No recent activity</li>';
    }
}

// ===== STAFF MANAGEMENT =====
async function loadStaffMembers() {
    try {
        const data = await apiCall('/users/staff');
        return data.staff || data.data || data || [];
    } catch (error) {
        console.log('Staff endpoint not available, falling back to all users filter');
        try {
            const allUsers = await apiCall('/users');
            const staffMembers = allUsers.filter(user =>
                user.role === 'staff' || user.role === 'admin'
            );
            console.log(`✅ Found ${staffMembers.length} staff members from all users`);
            return staffMembers;
        } catch (fallbackError) {
            console.error('Failed to load staff members:', fallbackError);
            return [];
        }
    }
}

async function populateStaffDropdowns() {
    try {
        const staffMembers = await loadStaffMembers();
        const staffDropdowns = [
            document.getElementById('assignedStaff'),
            document.getElementById('cartStaff'),
            document.getElementById('giftStaff')
        ].filter(dropdown => dropdown !== null);

        staffDropdowns.forEach(dropdown => {
            if (dropdown) {
                while (dropdown.options.length > 1) {
                    dropdown.remove(1);
                }

                if (staffMembers.length > 0) {
                    staffMembers.forEach(staff => {
                        const option = document.createElement('option');
                        option.value = staff._id;
                        option.textContent = `${staff.name} (${staff.role})`;
                        dropdown.appendChild(option);
                    });
                }
            }
        });

        console.log(`✅ Populated ${staffDropdowns.length} dropdowns with ${staffMembers.length} staff members`);
        return staffMembers;
    } catch (error) {
        console.error('Failed to populate staff dropdowns:', error);
        return [];
    }
}

// ===== UTILITY FUNCTIONS =====
function showNotification(message, type = 'info') {
    // Create a simple notification system
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
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
        'bookingDetailsForm': confirmBooking,
        'giftCustomizationForm': createGift
    };

    Object.entries(forms).forEach(([formId, handler]) => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', handler);
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

            if (currentUser.role === 'staff' || currentUser.role === 'admin') {
                populateStaffDropdowns();
            }

        } catch (error) {
            console.error('Error parsing saved user:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            currentUser = null;
        }
    } else {
        currentUser = null;
        updateUIForUser();
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