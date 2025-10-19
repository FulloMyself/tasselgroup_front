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

    if (options.body && !['GET', 'HEAD'].includes(options.method?.toUpperCase() || 'GET')) {
        config.body = JSON.stringify(options.body);
    }

    try {
        console.log(`📡 Making API call to: ${API_BASE}${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`, config);

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
        
        if (currentUser.role === 'staff' || currentUser.role === 'admin') {
            console.log('👤 Staff/admin user logged in, populating staff dropdowns...');
            populateStaffDropdowns();
        }

        showSection('home');
        document.getElementById('loginFormElement').reset();
        showNotification('Login successful!', 'success');
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const phone = document.getElementById('registerPhone').value.trim();
    const address = document.getElementById('registerAddress').value.trim();

    if (!name || !email || !password || !phone || !address) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

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
        
        if (currentUser.role === 'staff' || currentUser.role === 'admin') {
            console.log('👤 Staff/admin user registered, populating staff dropdowns...');
            populateStaffDropdowns();
        }

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

        // ✅ FIX: Show dashboard for ALL logged-in users (customer, staff, admin)
        document.getElementById('dashboardLink').style.display = 'block';

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
        document.getElementById('dashboardLink').style.display = 'none';
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
        initializeCharts();
        setTimeout(() => loadDashboard(), 100);
        
        // Load admin management tables if admin
        if (currentUser.role === 'admin') {
            setTimeout(() => loadAdminManagementTables(), 200);
        }
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
                    <span>R ${itemTotal.toFixed(2)}</span>
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
            <strong>R ${total.toFixed(2)}</strong>
        </div>
    `;

    cartSection.style.display = 'block';
    
    // ✅ FIX: Always show staff section when cart has items (for all users)
    if (cartStaffSection) {
        cartStaffSection.style.display = 'block';
        
        // Make sure staff dropdown is populated
        if (document.querySelector('#cartStaff').options.length <= 1) {
            console.log('🔄 Repopulating cart staff dropdown...');
            populateStaffDropdowns();
        }
    }
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
        let data;
        try {
            data = await apiCall('/gift-packages');
        } catch (error) {
            console.log('Gift packages endpoint not available, trying services as fallback');
            data = await apiCall('/services');
            if (data.services) {
                data.giftPackages = data.services.map(service => ({
                    ...service,
                    basePrice: service.price,
                    includes: [service.description]
                }));
            }
        }
        
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
                : `<li>${gift.description || 'No details available'}</li>`;

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

async function createGift(e) {
    e.preventDefault();

    const recipientName = document.getElementById('recipientName').value.trim();
    const recipientEmail = document.getElementById('recipientEmail').value.trim();
    const giftMessage = document.getElementById('giftMessage').value.trim();
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

// ===== STAFF MANAGEMENT =====
async function loadStaffMembers() {
    try {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const staffResponse = await fetch(`${API_BASE}/users/staff`, { headers });
        
        if (staffResponse.ok) {
            const staff = await staffResponse.json();
            return staff;
        } else {
            console.log('Staff endpoint returned error, falling back to all users filter');
            throw new Error('Staff endpoint failed');
        }
        
    } catch (error) {
        console.log('Staff endpoint not available, falling back to all users filter');
        
        try {
            const allUsersResponse = await fetch(`${API_BASE}/users`);
            if (allUsersResponse.ok) {
                const allUsers = await allUsersResponse.json();
                return allUsers.filter(user => user.role === 'staff');
            } else {
                throw new Error('All users endpoint failed');
            }
        } catch (secondError) {
            console.log('Failed to load staff members from all users:', secondError.message);
            return [];
        }
    }
}

function populateStaffDropdowns() {
    const dropdownSelectors = [
        '#cartStaff',
        '#assignedStaff', 
        '#giftStaff'
    ];
    
    loadStaffMembers().then(staffMembers => {
        if (!staffMembers || staffMembers.length === 0) {
            console.log('⚠️ No staff members available for dropdowns');
            staffMembers = [];
        }
        
        console.log(`👥 Populating ${dropdownSelectors.length} dropdowns with ${staffMembers.length} staff members`);
        
        dropdownSelectors.forEach(selector => {
            const dropdown = document.querySelector(selector);
            if (dropdown) {
                // Clear existing options
                dropdown.innerHTML = '<option value="">Select staff member</option>' +
                    staffMembers.map(staff => 
                        `<option value="${staff._id}">${staff.name}</option>`
                    ).join('');
                console.log(`✅ Populated dropdown: ${selector}`);
                
                // ✅ FIX: Make sure the staff section is visible for customers
                if (selector === '#cartStaff') {
                    const cartStaffSection = document.getElementById('cartStaffSection');
                    if (cartStaffSection && staffMembers.length > 0) {
                        cartStaffSection.style.display = 'block';
                    }
                }
            }
        });
    }).catch(error => {
        console.error('Error populating staff dropdowns:', error);
    });
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

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboard() {
    if (!currentUser) return;
    
    console.log('🚀 Loading dashboard for:', currentUser.role);
    
    try {
        let dashboardData;
        
        if (currentUser.role === 'admin') {
            dashboardData = await apiCall('/dashboard/admin');
            displayAdminDashboard(dashboardData);
        } else if (currentUser.role === 'staff') {
            dashboardData = await apiCall('/dashboard/staff');
            displayStaffDashboard(dashboardData);
        } else {
            await loadCustomerDashboard();
        }
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// ===== ADMIN DASHBOARD =====
function displayAdminDashboard(data) {
    console.log('📊 Admin dashboard data received:', data);
    
    document.getElementById('adminDashboard').style.display = 'block';
    document.getElementById('staffDashboard').style.display = 'none';
    document.getElementById('customerDashboard').style.display = 'none';
    
    // Update stats
    document.getElementById('totalRevenue').textContent = `R ${(data.stats?.totalRevenue || 0).toLocaleString()}`;
    document.getElementById('totalUsers').textContent = (data.stats?.totalUsers || 0).toLocaleString();
    document.getElementById('totalBookings').textContent = (data.stats?.totalBookings || 0).toLocaleString();
    document.getElementById('totalProducts').textContent = (data.stats?.totalProducts || 0).toLocaleString();
    
    // Update charts
    if (data.monthlyRevenue) {
        updateRevenueChart(data.monthlyRevenue);
    }
    
    if (data.staffPerformance) {
        updateStaffPerformanceChart(data.staffPerformance);
    }
    
    if (data.popularServices) {
        updateServicesChart(data.popularServices);
    }
    
    // Update recent activity
    updateRecentActivity(data.recentActivity || []);
}

// ===== ADMIN MANAGEMENT TABLES =====
async function loadAdminManagementTables() {
    try {
        const [orders, bookings, gifts] = await Promise.all([
            apiCall('/orders?limit=50'),
            apiCall('/bookings?limit=50'),
            apiCall('/gift-orders?limit=50')
        ]);
        
        updateAdminOrdersTable(orders.orders || orders.data || orders);
        updateAdminBookingsTable(bookings.bookings || bookings.data || bookings);
        updateAdminGiftsTable(gifts.giftOrders || gifts.data || gifts);
        
    } catch (error) {
        console.error('Error loading admin management data:', error);
    }
}

function updateAdminOrdersTable(orders) {
    const container = document.getElementById('adminOrdersBody');
    if (!container) return;
    
    if (!orders || orders.length === 0) {
        container.innerHTML = '<tr><td colspan="8" class="text-center">No orders found</td></tr>';
        return;
    }
    
    container.innerHTML = orders.map(order => `
        <tr>
            <td>${new Date(order.createdAt).toLocaleDateString()}</td>
            <td>${order._id.slice(-8)}</td>
            <td>${order.user?.name || 'Customer'}</td>
            <td>${order.items?.length || 0} items</td>
            <td>${order.processedBy?.name || 'Not assigned'}</td>
            <td>R ${(order.finalTotal || order.total || 0).toLocaleString()}</td>
            <td>
                <span class="badge bg-${getStatusBadgeColor(order.status)}">
                    ${order.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" 
                        onclick="generateReceipt('order', '${order._id}')">
                    <i class="fas fa-receipt"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" 
                        onclick="showStatusModal('order', '${order._id}', '${order.status}')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateAdminBookingsTable(bookings) {
    const container = document.getElementById('adminBookingsBody');
    if (!container) return;
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<tr><td colspan="8" class="text-center">No bookings found</td></tr>';
        return;
    }
    
    container.innerHTML = bookings.map(booking => `
        <tr>
            <td>${new Date(booking.createdAt).toLocaleDateString()}</td>
            <td>${booking._id.slice(-8)}</td>
            <td>${booking.user?.name || 'Customer'}</td>
            <td>${booking.service?.name || 'Service'}</td>
            <td>${booking.staff?.name || 'Not assigned'}</td>
            <td>${new Date(booking.date).toLocaleDateString()} at ${booking.time}</td>
            <td>
                <span class="badge bg-${getStatusBadgeColor(booking.status)}">
                    ${booking.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" 
                        onclick="generateReceipt('booking', '${booking._id}')">
                    <i class="fas fa-receipt"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" 
                        onclick="showStatusModal('booking', '${booking._id}', '${booking.status}')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateAdminGiftsTable(gifts) {
    const container = document.getElementById('adminGiftsBody');
    if (!container) return;
    
    if (!gifts || gifts.length === 0) {
        container.innerHTML = '<tr><td colspan="9" class="text-center">No gift orders found</td></tr>';
        return;
    }
    
    container.innerHTML = gifts.map(gift => `
        <tr>
            <td>${new Date(gift.createdAt).toLocaleDateString()}</td>
            <td>${gift._id.slice(-8)}</td>
            <td>${gift.user?.name || 'Customer'}</td>
            <td>${gift.recipientName}</td>
            <td>${gift.giftPackage?.name || 'Gift Package'}</td>
            <td>${gift.assignedStaff?.name || 'Not assigned'}</td>
            <td>${new Date(gift.deliveryDate).toLocaleDateString()}</td>
            <td>
                <span class="badge bg-${getStatusBadgeColor(gift.status)}">
                    ${gift.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" 
                        onclick="generateReceipt('gift', '${gift._id}')">
                    <i class="fas fa-receipt"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" 
                        onclick="showStatusModal('gift', '${gift._id}', '${gift.status}')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ===== ADMIN MODAL FUNCTIONS =====
function showAdminModal(type) {
    const modalTitle = document.getElementById('adminModalTitle');
    const modalBody = document.getElementById('adminModalBody');
    
    if (!modalTitle || !modalBody) {
        console.error('Admin modal elements not found');
        return;
    }

    switch (type) {
        case 'addService':
            modalTitle.textContent = 'Add New Service';
            modalBody.innerHTML = getServiceForm();
            break;
        case 'addProduct':
            modalTitle.textContent = 'Add New Product';
            modalBody.innerHTML = getProductForm();
            break;
        case 'addVoucher':
            modalTitle.textContent = 'Create New Voucher';
            modalBody.innerHTML = getVoucherForm();
            setTimeout(() => populateVoucherStaffDropdown(), 100);
            break;
        default:
            console.error('Unknown modal type:', type);
            return;
    }

    const modal = new bootstrap.Modal(document.getElementById('adminModal'));
    modal.show();
}

function getServiceForm() {
    return `
        <form id="serviceForm" onsubmit="handleServiceSubmit(event)">
            <div class="mb-3">
                <label for="serviceName" class="form-label">Service Name *</label>
                <input type="text" class="form-control" id="serviceName" required>
            </div>
            <div class="mb-3">
                <label for="serviceDescription" class="form-label">Description *</label>
                <textarea class="form-control" id="serviceDescription" rows="3" required></textarea>
            </div>
            <div class="mb-3">
                <label for="servicePrice" class="form-label">Price (R) *</label>
                <input type="number" class="form-control" id="servicePrice" min="0" step="0.01" required>
            </div>
            <div class="mb-3">
                <label for="serviceDuration" class="form-label">Duration (minutes) *</label>
                <input type="number" class="form-control" id="serviceDuration" min="1" required placeholder="e.g., 60">
            </div>
            <div class="mb-3">
                <label for="serviceCategory" class="form-label">Category *</label>
                <select class="form-control" id="serviceCategory" required>
                    <option value="">Select Category</option>
                    <option value="hair">Hair</option>
                    <option value="spa">Spa</option>
                    <option value="skincare">Skincare</option>
                    <option value="nails">Nails</option>
                    <option value="makeup">Makeup</option>
                    <option value="wellness">Wellness</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="serviceImage" class="form-label">Image URL (Optional)</label>
                <input type="url" class="form-control" id="serviceImage" placeholder="https://example.com/image.jpg">
            </div>
            <button type="submit" class="btn btn-primary w-100">Add Service</button>
        </form>
    `;
}

function getProductForm() {
    return `
        <form id="productForm" onsubmit="handleProductSubmit(event)">
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
                <input type="number" class="form-control" id="productPrice" min="0" step="0.01" required>
            </div>
            <div class="mb-3">
                <label for="productCategory" class="form-label">Category</label>
                <select class="form-control" id="productCategory" required>
                    <option value="">Select Category</option>
                    <option value="skincare">Skincare</option>
                    <option value="wellness">Wellness</option>
                    <option value="haircare">Haircare</option>
                    <option value="makeup">Makeup</option>
                    <option value="tools">Tools</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="productStock" class="form-label">Stock Quantity</label>
                <input type="number" class="form-control" id="productStock" min="0" required>
            </div>
            <div class="mb-3">
                <label for="productImage" class="form-label">Image URL (Optional)</label>
                <input type="url" class="form-control" id="productImage" placeholder="https://example.com/image.jpg">
            </div>
            <button type="submit" class="btn btn-primary w-100">Add Product</button>
        </form>
    `;
}

function getVoucherForm() {
    return `
        <form id="voucherForm" onsubmit="handleVoucherSubmit(event)">
            <div class="mb-3">
                <label for="voucherCode" class="form-label">Voucher Code</label>
                <input type="text" class="form-control" id="voucherCode" required>
            </div>
            <div class="mb-3">
                <label for="voucherDescription" class="form-label">Description</label>
                <input type="text" class="form-control" id="voucherDescription" required>
            </div>
            <div class="mb-3">
                <label for="voucherDiscount" class="form-label">Discount</label>
                <input type="number" class="form-control" id="voucherDiscount" min="0" required>
            </div>
            <div class="mb-3">
                <label for="voucherType" class="form-label">Discount Type</label>
                <select class="form-control" id="voucherType" required>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (R)</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="voucherMaxUses" class="form-label">Maximum Uses</label>
                <input type="number" class="form-control" id="voucherMaxUses" min="1" required>
            </div>
            <div class="mb-3">
                <label for="voucherValidUntil" class="form-label">Valid Until</label>
                <input type="date" class="form-control" id="voucherValidUntil" required>
            </div>
            <div class="mb-3">
                <label for="voucherAssignedTo" class="form-label">Assign to Staff (Optional)</label>
                <select class="form-control" id="voucherAssignedTo">
                    <option value="">Not assigned</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary w-100">Create Voucher</button>
        </form>
    `;
}

async function handleServiceSubmit(event) {
    event.preventDefault();
    
    const serviceData = {
        name: document.getElementById('serviceName').value.trim(),
        description: document.getElementById('serviceDescription').value.trim(),
        price: parseFloat(document.getElementById('servicePrice').value),
        duration: parseInt(document.getElementById('serviceDuration').value) + ' min',
        category: document.getElementById('serviceCategory').value,
        image: document.getElementById('serviceImage').value.trim() || '',
        inStock: true
    };

    if (!serviceData.name || !serviceData.description || isNaN(serviceData.price) || !serviceData.duration || !serviceData.category) {
        showNotification('Please fill in all required fields correctly', 'error');
        return;
    }

    if (serviceData.price <= 0) {
        showNotification('Price must be greater than 0', 'error');
        return;
    }

    try {
        const result = await apiCall('/services', {
            method: 'POST',
            body: serviceData
        });

        showNotification('Service added successfully!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
        loadServices();
        loadDashboard();
        
    } catch (error) {
        showNotification('Failed to add service: ' + error.message, 'error');
    }
}

async function handleProductSubmit(event) {
    event.preventDefault();
    
    const productData = {
        name: document.getElementById('productName').value.trim(),
        description: document.getElementById('productDescription').value.trim(),
        price: parseFloat(document.getElementById('productPrice').value),
        category: document.getElementById('productCategory').value,
        stockQuantity: parseInt(document.getElementById('productStock').value),
        image: document.getElementById('productImage').value.trim() || '',
        inStock: true
    };

    if (!productData.name || !productData.description || isNaN(productData.price) || !productData.category || isNaN(productData.stockQuantity)) {
        showNotification('Please fill in all required fields correctly', 'error');
        return;
    }

    if (productData.price <= 0) {
        showNotification('Price must be greater than 0', 'error');
        return;
    }

    if (productData.stockQuantity < 0) {
        showNotification('Stock quantity cannot be negative', 'error');
        return;
    }

    try {
        const result = await apiCall('/products', {
            method: 'POST',
            body: productData
        });

        showNotification('Product added successfully!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
        loadProducts();
        loadDashboard();
        
    } catch (error) {
        showNotification('Failed to add product: ' + error.message, 'error');
    }
}

async function handleVoucherSubmit(event) {
    event.preventDefault();
    
    const voucherData = {
        code: document.getElementById('voucherCode').value.trim(),
        description: document.getElementById('voucherDescription').value.trim(),
        discountValue: parseFloat(document.getElementById('voucherDiscount').value),
        discountType: document.getElementById('voucherType').value,
        expiresAt: document.getElementById('voucherValidUntil').value,
        assignedTo: document.getElementById('voucherAssignedTo').value || undefined,
        isActive: true
    };

    if (!voucherData.code || !voucherData.description || isNaN(voucherData.discountValue) || !voucherData.expiresAt) {
        showNotification('Please fill in all required fields correctly', 'error');
        return;
    }

    if (voucherData.discountValue <= 0) {
        showNotification('Discount value must be greater than 0', 'error');
        return;
    }

    try {
        const result = await apiCall('/vouchers', {
            method: 'POST',
            body: voucherData
        });

        showNotification('Voucher created successfully!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
        
    } catch (error) {
        showNotification('Failed to create voucher: ' + error.message, 'error');
    }
}

function populateVoucherStaffDropdown() {
    const staffDropdown = document.getElementById('voucherAssignedTo');
    if (!staffDropdown) return;

    loadStaffMembers().then(staffMembers => {
        while (staffDropdown.options.length > 1) {
            staffDropdown.remove(1);
        }

        staffMembers.forEach(staff => {
            const option = document.createElement('option');
            option.value = staff._id;
            option.textContent = `${staff.name} (${staff.role})`;
            staffDropdown.appendChild(option);
        });
    }).catch(error => {
        console.error('Failed to populate voucher staff dropdown:', error);
    });
}

// ===== STAFF DASHBOARD =====
function displayStaffDashboard(data) {
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('staffDashboard').style.display = 'block';
    document.getElementById('customerDashboard').style.display = 'none';
    
    document.getElementById('staffSales').textContent = data.stats.totalSales?.toLocaleString() || 0;
    document.getElementById('staffClients').textContent = data.stats.totalClients?.toLocaleString() || 0;
    document.getElementById('staffHours').textContent = data.stats.totalHours?.toLocaleString() || 0;
    document.getElementById('staffCommission').textContent = `R ${data.stats.totalCommission?.toLocaleString() || 0}`;
    
    updateStaffAppointments(data.upcomingAppointments);
    updateRecentSales(data.recentSales);
    updateStaffVouchers(data.myVouchers);
    updateStaffActivities(data.detailedData);
}

// ===== CUSTOMER DASHBOARD =====
async function loadCustomerDashboard() {
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('staffDashboard').style.display = 'none';
    document.getElementById('customerDashboard').style.display = 'block';
    
    try {
        const [orders, bookings, giftOrders] = await Promise.all([
            apiCall('/dashboard/orders/my-orders'),
            apiCall('/dashboard/bookings/my-bookings'),
            apiCall('/dashboard/gift-orders/my-gifts')
        ]);
        
        updateCustomerDashboard(orders, bookings, giftOrders);
    } catch (error) {
        console.error('Failed to load customer dashboard:', error);
    }
}

function updateCustomerDashboard(orders, bookings, gifts) {
    document.getElementById('customerOrders').textContent = orders.length || 0;
    document.getElementById('customerBookings').textContent = bookings.length || 0;
    document.getElementById('customerGifts').textContent = gifts.length || 0;
    
    const totalSpent = calculateTotalSpent(orders, bookings, gifts);
    document.getElementById('customerSpent').textContent = `R ${totalSpent.toLocaleString()}`;
    
    updateCustomerOrders(orders);
    updateCustomerBookings(bookings);
    updateCustomerGifts(gifts);
}

function calculateTotalSpent(orders, bookings, gifts) {
    let total = 0;
    
    orders.forEach(order => {
        total += order.finalTotal || order.total || 0;
    });
    
    bookings.forEach(booking => {
        total += booking.service?.price || booking.price || 0;
    });
    
    gifts.forEach(gift => {
        total += gift.price || gift.total || gift.giftPackage?.basePrice || 0;
    });
    
    return total;
}

// ===== CHART FUNCTIONS =====
function initializeCharts() {
    Object.values(chartInstances).forEach(chart => {
        if (chart) {
            try {
                chart.destroy();
            } catch (e) {
                console.log('Error destroying chart:', e);
            }
        }
    });
    
    chartInstances = {
        revenueChart: null,
        staffPerformanceChart: null,
        servicesChart: null
    };
}

function updateRevenueChart(monthlyRevenue) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    if (chartInstances.revenueChart) {
        chartInstances.revenueChart.destroy();
    }
    
    const labels = Object.keys(monthlyRevenue).reverse();
    const data = Object.values(monthlyRevenue).reverse();
    
    chartInstances.revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Revenue (R)',
                data: data,
                borderColor: '#8a6d3b',
                backgroundColor: 'rgba(138, 109, 59, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R ' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function updateStaffPerformanceChart(staffPerformance) {
    const ctx = document.getElementById('staffPerformanceChart').getContext('2d');
    
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
                backgroundColor: '#d4af37',
                borderColor: '#8a6d3b',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R ' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function updateServicesChart(popularServices) {
    const ctx = document.getElementById('servicesChart').getContext('2d');
    
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
                    '#8a6d3b',
                    '#d4af37',
                    '#a9925d',
                    '#c5b089',
                    '#e6d8b8'
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
                    position: 'bottom'
                }
            }
        }
    });
}

// ===== STAFF DASHBOARD UPDATES =====
function updateStaffAppointments(appointments) {
    const container = document.getElementById('staffAppointments');
    
    if (!appointments || appointments.length === 0) {
        container.innerHTML = '<li class="list-group-item">No upcoming appointments</li>';
        return;
    }
    
    container.innerHTML = appointments.map(apt => `
        <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${apt.service?.name || 'Service'}</strong><br>
                    <small>${apt.user?.name || 'Customer'} - ${new Date(apt.date).toLocaleDateString()} at ${apt.time}</small>
                </div>
                <span class="badge bg-${apt.status === 'confirmed' ? 'success' : 'warning'}">
                    ${apt.status}
                </span>
            </div>
        </li>
    `).join('');
}

function updateRecentSales(sales) {
    const container = document.getElementById('staffRecentSales');
    
    if (!sales || sales.length === 0) {
        container.innerHTML = '<li class="list-group-item">No recent sales</li>';
        return;
    }
    
    container.innerHTML = sales.map(sale => `
        <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${sale.description}</strong><br>
                    <small>${new Date(sale.date).toLocaleDateString()}</small>
                </div>
                <strong>R ${sale.amount?.toLocaleString() || 0}</strong>
            </div>
        </li>
    `).join('');
}

function updateStaffVouchers(vouchers) {
    const container = document.getElementById('staffVouchers');
    
    if (!vouchers || vouchers.length === 0) {
        container.innerHTML = '<div class="col-12"><p>No vouchers assigned to you</p></div>';
        return;
    }
    
    container.innerHTML = vouchers.map(voucher => `
        <div class="col-md-6 mb-3">
            <div class="voucher-card p-3 rounded">
                <h6>${voucher.code}</h6>
                <p class="mb-1"><strong>Discount:</strong> ${voucher.discountValue}${voucher.discountType === 'percentage' ? '%' : ' R'}</p>
                <p class="mb-1"><strong>Valid until:</strong> ${new Date(voucher.expiryDate).toLocaleDateString()}</p>
                <small class="text-muted">${voucher.description || ''}</small>
            </div>
        </div>
    `).join('');
}

function updateStaffActivities(detailedData) {
    const container = document.getElementById('staffActivitiesBody');
    
    if (!detailedData) {
        container.innerHTML = '<tr><td colspan="6" class="text-center">No recent activities</td></tr>';
        return;
    }
    
    const allActivities = [
        ...detailedData.bookings.map(b => ({ ...b, type: 'booking' })),
        ...detailedData.orders.map(o => ({ ...o, type: 'order' })),
        ...detailedData.giftOrders.map(g => ({ ...g, type: 'gift' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
     .slice(0, 10);
    
    if (allActivities.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center">No recent activities</td></tr>';
        return;
    }
    
    container.innerHTML = allActivities.map(activity => `
        <tr>
            <td>${new Date(activity.createdAt).toLocaleDateString()}</td>
            <td>
                <span class="badge bg-${getActivityBadgeColor(activity.type)}">
                    ${activity.type}
                </span>
            </td>
            <td>${activity.user?.name || 'Customer'}</td>
            <td>${getActivityDescription(activity)}</td>
            <td>R ${activity.amount?.toLocaleString() || 0}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" 
                        onclick="generateReceipt('${activity.type}', '${activity._id}')">
                    <i class="fas fa-receipt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function getActivityBadgeColor(type) {
    const colors = {
        'booking': 'success',
        'order': 'primary',
        'gift': 'info'
    };
    return colors[type] || 'secondary';
}

function getActivityDescription(activity) {
    switch (activity.type) {
        case 'booking':
            return `${activity.service?.name || 'Service'} booking`;
        case 'order':
            return `Order with ${activity.items?.length || 0} items`;
        case 'gift':
            return `Gift for ${activity.recipientName || 'recipient'}`;
        default:
            return 'Activity';
    }
}

// ===== CUSTOMER DASHBOARD FUNCTIONS =====
function showCustomerSection(section) {
    document.querySelectorAll('.customer-section').forEach(sec => {
        sec.style.display = 'none';
    });
    
    document.getElementById(`customer${section.charAt(0).toUpperCase() + section.slice(1)}Section`).style.display = 'block';
}

function updateCustomerOrders(orders) {
    const container = document.getElementById('customerOrdersBody');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center">No orders found</td></tr>';
        return;
    }
    
    container.innerHTML = orders.map(order => `
        <tr>
            <td>${new Date(order.createdAt).toLocaleDateString()}</td>
            <td>${order._id.slice(-8)}</td>
            <td>${order.items?.length || 0} items</td>
            <td>${order.processedBy?.name || 'Not assigned'}</td>
            <td>R ${(order.finalTotal || order.total || 0).toLocaleString()}</td>
            <td>
                <span class="badge bg-${getStatusBadgeColor(order.status)}">
                    ${order.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" 
                        onclick="generateReceipt('order', '${order._id}')">
                    <i class="fas fa-receipt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateCustomerBookings(bookings) {
    const container = document.getElementById('customerBookingsBody');
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center">No bookings found</td></tr>';
        return;
    }
    
    container.innerHTML = bookings.map(booking => `
        <tr>
            <td>${new Date(booking.createdAt).toLocaleDateString()}</td>
            <td>${booking.service?.name || 'Service'}</td>
            <td>${booking.staff?.name || 'Not assigned'}</td>
            <td>${new Date(booking.date).toLocaleDateString()} at ${booking.time}</td>
            <td>R ${(booking.service?.price || booking.price || 0).toLocaleString()}</td>
            <td>
                <span class="badge bg-${getStatusBadgeColor(booking.status)}">
                    ${booking.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" 
                        onclick="generateReceipt('booking', '${booking._id}')">
                    <i class="fas fa-receipt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateCustomerGifts(gifts) {
    const container = document.getElementById('customerGiftsBody');
    
    if (!gifts || gifts.length === 0) {
        container.innerHTML = '<tr><td colspan="8" class="text-center">No gift orders found</td></tr>';
        return;
    }
    
    container.innerHTML = gifts.map(gift => `
        <tr>
            <td>${new Date(gift.createdAt).toLocaleDateString()}</td>
            <td>${gift.recipientName}</td>
            <td>${gift.giftPackage?.name || 'Gift Package'}</td>
            <td>${gift.assignedStaff?.name || 'Not assigned'}</td>
            <td>${new Date(gift.deliveryDate).toLocaleDateString()}</td>
            <td>R ${(gift.price || gift.total || gift.giftPackage?.basePrice || 0).toLocaleString()}</td>
            <td>
                <span class="badge bg-${getStatusBadgeColor(gift.status)}">
                    ${gift.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" 
                        onclick="generateReceipt('gift', '${gift._id}')">
                    <i class="fas fa-receipt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function getStatusBadgeColor(status) {
    const colors = {
        'completed': 'success',
        'confirmed': 'primary',
        'pending': 'warning',
        'paid': 'info',
        'delivered': 'success',
        'cancelled': 'danger'
    };
    return colors[status] || 'secondary';
}

// ===== RECEIPT FUNCTIONS =====
async function generateReceipt(type, id) {
    try {
        console.log(`📄 Generating receipt for ${type} with ID: ${id}`);
        
        const data = await apiCall(`/dashboard/receipt/${type}/${id}`);
        
        if (data.success && data.receipt) {
            showReceiptModal(data.receipt, data.company);
        } else {
            throw new Error('Failed to generate receipt data');
        }
    } catch (error) {
        console.error('Error generating receipt:', error);
        showNotification('Failed to generate receipt: ' + error.message, 'error');
    }
}

function showReceiptModal(receipt, company) {
    const receiptContent = document.getElementById('receiptContent');
    
    let receiptHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <h2>${company.name}</h2>
                <p>${company.address}</p>
                <p>${company.phone} | ${company.email}</p>
                <p><strong>Receipt</strong></p>
            </div>
            
            <div class="receipt-details">
                <div class="receipt-item">
                    <span>Receipt ID:</span>
                    <span>${receipt.id}</span>
                </div>
                <div class="receipt-item">
                    <span>Date:</span>
                    <span>${new Date(receipt.date).toLocaleString()}</span>
                </div>
                <div class="receipt-item">
                    <span>Customer:</span>
                    <span>${receipt.customer}</span>
                </div>
                <div class="receipt-item">
                    <span>Email:</span>
                    <span>${receipt.customerEmail}</span>
                </div>
    `;

    if (receipt.type === 'booking') {
        receiptHTML += `
                <div class="receipt-item">
                    <span>Service:</span>
                    <span>${receipt.service}</span>
                </div>
                <div class="receipt-item">
                    <span>Staff:</span>
                    <span>${receipt.staff}</span>
                </div>
                <div class="receipt-item">
                    <span>Appointment:</span>
                    <span>${new Date(receipt.bookingDate).toLocaleDateString()} at ${receipt.bookingTime}</span>
                </div>
                <div class="receipt-item">
                    <span>Duration:</span>
                    <span>${receipt.duration}</span>
                </div>
        `;
    } else if (receipt.type === 'order') {
        receiptHTML += `
                <div class="receipt-item">
                    <span>Processed By:</span>
                    <span>${receipt.processedBy}</span>
                </div>
                <div class="receipt-item">
                    <span>Items:</span>
                    <span></span>
                </div>
        `;
        receipt.items.forEach(item => {
            receiptHTML += `
                <div class="receipt-item" style="padding-left: 20px;">
                    <span>${item.quantity}x ${item.product}</span>
                    <span>R ${(item.subtotal || 0).toFixed(2)}</span>
                </div>
            `;
        });
    } else if (receipt.type === 'gift') {
        receiptHTML += `
                <div class="receipt-item">
                    <span>Recipient:</span>
                    <span>${receipt.recipient}</span>
                </div>
                <div class="receipt-item">
                    <span>Recipient Email:</span>
                    <span>${receipt.recipientEmail}</span>
                </div>
                <div class="receipt-item">
                    <span>Gift Package:</span>
                    <span>${receipt.giftPackage}</span>
                </div>
                <div class="receipt-item">
                    <span>Delivery Date:</span>
                    <span>${new Date(receipt.deliveryDate).toLocaleDateString()}</span>
                </div>
                <div class="receipt-item">
                    <span>Assigned Staff:</span>
                    <span>${receipt.assignedStaff || 'Not assigned'}</span>
                </div>
        `;
    }

    receiptHTML += `
                <div class="receipt-total">
                    <span>Total Amount:</span>
                    <span>R ${(receipt.amount || receipt.total || 0).toFixed(2)}</span>
                </div>
            </div>
            
            <div class="receipt-footer">
                <p>Thank you for choosing ${company.name}!</p>
                <p>For any inquiries, please contact ${company.email} or call ${company.phone}</p>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;

    receiptContent.innerHTML = receiptHTML;
    
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptModal.show();
}

// ===== PRINT CONTENT FUNCTION =====
function printContent(title, content) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .badge { padding: 5px 10px; border-radius: 10px; color: white; }
                    .bg-primary { background: #007bff; }
                    .bg-success { background: #28a745; }
                    .bg-warning { background: #ffc107; color: black; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                    th { background: #f8f9fa; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <p><strong>Staff:</strong> ${currentUser?.name || 'Unknown'}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                <hr>
                ${content}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ===== CUSTOMER PRINT FUNCTIONS =====
function printCustomerOrders() {
    const table = document.getElementById('customerOrdersBody').parentNode.parentNode;
    const content = table.outerHTML;
    printContent('My Orders - Tassel Group', content);
}

function printCustomerBookings() {
    const table = document.getElementById('customerBookingsBody').parentNode.parentNode;
    const content = table.outerHTML;
    printContent('My Bookings - Tassel Group', content);
}

function printCustomerGifts() {
    const table = document.getElementById('customerGiftsBody').parentNode.parentNode;
    const content = table.outerHTML;
    printContent('My Gift Orders - Tassel Group', content);
}

// ===== STATUS MANAGEMENT FUNCTIONS =====
// ===== STATUS MANAGEMENT FUNCTIONS =====
async function updateOrderStatus(orderId, newStatus) {
    try {
        console.log(`🔄 Updating order ${orderId} status to: ${newStatus}`);
        
        const result = await apiCall(`/orders/${orderId}/status`, {
            method: 'PATCH',
            body: { status: newStatus }
        });
        
        showNotification(`Order status updated to ${newStatus}!`, 'success');
        loadDashboard(); // Refresh dashboard
        
    } catch (error) {
        console.error('❌ Order status update failed:', error);
        showNotification('Failed to update order status: ' + error.message, 'error');
    }
}

async function updateBookingStatus(bookingId, newStatus) {
    try {
        console.log(`🔄 Updating booking ${bookingId} status to: ${newStatus}`);
        
        const result = await apiCall(`/bookings/${bookingId}/status`, {
            method: 'PATCH',
            body: { status: newStatus }
        });
        
        showNotification(`Booking status updated to ${newStatus}!`, 'success');
        loadDashboard(); // Refresh dashboard
        
    } catch (error) {
        console.error('❌ Booking status update failed:', error);
        showNotification('Failed to update booking status: ' + error.message, 'error');
    }
}

async function updateGiftOrderStatus(giftOrderId, newStatus) {
    try {
        console.log(`🔄 Updating gift order ${giftOrderId} status to: ${newStatus}`);
        
        const result = await apiCall(`/gift-orders/${giftOrderId}/status`, {
            method: 'PATCH',
            body: { status: newStatus }
        });
        
        showNotification(`Gift order status updated to ${newStatus}!`, 'success');
        loadDashboard(); // Refresh dashboard
        
    } catch (error) {
        console.error('❌ Gift order status update failed:', error);
        showNotification('Failed to update gift order status: ' + error.message, 'error');
    }
}

// ===== ADMIN STATUS MANAGEMENT MODAL =====
function showStatusModal(type, id, currentStatus) {
    const modalTitle = document.getElementById('adminModalTitle');
    const modalBody = document.getElementById('adminModalBody');
    
    modalTitle.textContent = `Update ${type.charAt(0).toUpperCase() + type.slice(1)} Status`;
    
    const statusOptions = getStatusOptions(type);
    
    modalBody.innerHTML = `
        <form id="statusUpdateForm" onsubmit="handleStatusUpdate(event, '${type}', '${id}')">
            <div class="mb-3">
                <label for="newStatus" class="form-label">Current Status: <span class="badge bg-${getStatusBadgeColor(currentStatus)}">${currentStatus}</span></label>
                <select class="form-control" id="newStatus" required>
                    ${statusOptions.map(status => 
                        `<option value="${status.value}" ${status.value === currentStatus ? 'selected' : ''}>${status.label}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label for="statusNotes" class="form-label">Notes (Optional)</label>
                <textarea class="form-control" id="statusNotes" rows="3" placeholder="Add any notes about this status change..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary w-100">Update Status</button>
        </form>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('adminModal'));
    modal.show();
}

function getStatusOptions(type) {
    const statusMap = {
        'order': [
            { value: 'pending', label: 'Pending' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'processing', label: 'Processing' },
            { value: 'shipped', label: 'Shipped' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' }
        ],
        'booking': [
            { value: 'pending', label: 'Pending' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'in-progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'no-show', label: 'No Show' }
        ],
        'gift': [
            { value: 'pending', label: 'Pending' },
            { value: 'processing', label: 'Processing' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' }
        ]
    };
    
    return statusMap[type] || [];
}

async function handleStatusUpdate(event, type, id) {
    event.preventDefault();
    
    const newStatus = document.getElementById('newStatus').value;
    const notes = document.getElementById('statusNotes').value;
    
    try {
        switch (type) {
            case 'order':
                await updateOrderStatus(id, newStatus);
                break;
            case 'booking':
                await updateBookingStatus(id, newStatus);
                break;
            case 'gift':
                await updateGiftOrderStatus(id, newStatus);
                break;
            default:
                throw new Error('Invalid type');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
        
    } catch (error) {
        showNotification('Failed to update status: ' + error.message, 'error');
    }
}

// ===== STAFF PRINT FUNCTIONS =====
function printStaffSales() {
    const content = document.getElementById('staffRecentSales').innerHTML;
    printContent('My Recent Sales - Tassel Group', content);
}

function printStaffAppointments() {
    const content = document.getElementById('staffAppointments').innerHTML;
    printContent('My Upcoming Appointments - Tassel Group', content);
}

function printStaffActivities() {
    const content = document.getElementById('staffActivitiesTable').outerHTML;
    printContent('My Activities Report - Tassel Group', content);
}

function printAllStaffReceipts() {
    const content = document.getElementById('staffReceiptsBody').parentNode.outerHTML;
    printContent('My Receipts Summary - Tassel Group', content);
}

// ===== MODAL FUNCTIONS =====
function showUserSearchModal() {
    const modal = new bootstrap.Modal(document.getElementById('userSearchModal'));
    modal.show();
}

function showMyReceipts() {
    loadStaffReceipts();
    const modal = new bootstrap.Modal(document.getElementById('staffReceiptsModal'));
    modal.show();
}

// ===== STAFF RECEIPT FUNCTIONS =====
async function loadStaffReceipts() {
    try {
        const [bookings, orders, giftOrders] = await Promise.all([
            apiCall('/bookings?staff=' + currentUser._id),
            apiCall('/orders?processedBy=' + currentUser._id),
            apiCall('/gift-orders?assignedStaff=' + currentUser._id)
        ]);

        const receiptsBody = document.getElementById('staffReceiptsBody');
        if (!receiptsBody) return;

        const allReceipts = [
            ...(bookings.bookings || bookings.data || bookings || []).map(b => ({ ...b, type: 'booking' })),
            ...(orders.orders || orders.data || orders || []).map(o => ({ ...o, type: 'order' })),
            ...(giftOrders.giftOrders || giftOrders.data || giftOrders || []).map(g => ({ ...g, type: 'gift' }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);

        if (allReceipts.length > 0) {
            receiptsBody.innerHTML = allReceipts.map(receipt => `
                <tr>
                    <td>${new Date(receipt.createdAt).toLocaleDateString()}</td>
                    <td>
                        <span class="badge bg-${getActivityTypeColor(receipt.type)}">
                            ${receipt.type.toUpperCase()}
                        </span>
                    </td>
                    <td>${receipt.user?.name || receipt.recipientName || 'Customer'}</td>
                    <td>
                        ${receipt.type === 'booking' ? receipt.service?.name : 
                          receipt.type === 'order' ? `${receipt.items?.length || 0} products` :
                          receipt.giftPackage?.name || 'Gift Package'}
                    </td>
                    <td>R ${(
                        receipt.type === 'booking' ? receipt.service?.price :
                        receipt.type === 'order' ? (receipt.finalTotal || receipt.total) :
                        receipt.price || receipt.total || 0
                    ).toFixed(2)}</td>
                    <td>
                        <span class="badge bg-${getStatusBadgeColor(receipt.status)}">
                            ${receipt.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="generateReceipt('${receipt.type}', '${receipt._id}')">
                            <i class="fas fa-print me-1"></i>Print
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            receiptsBody.innerHTML = '<tr><td colspan="7" class="text-center">No receipts found</td></tr>';
        }

    } catch (error) {
        console.error('Error loading staff receipts:', error);
        receiptsBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading receipts</td></tr>';
    }
}

function getActivityTypeColor(type) {
    switch (type) {
        case 'booking': return 'primary';
        case 'order': return 'success';
        case 'gift': return 'info';
        default: return 'secondary';
    }
}

// ===== USER SEARCH FUNCTION =====
async function searchUsers() {
    const searchInput = document.getElementById('userSearchInput').value.trim();
    const resultsDiv = document.getElementById('userSearchResults');

    if (!searchInput) {
        resultsDiv.innerHTML = '<div class="alert alert-warning">Please enter a search term</div>';
        return;
    }

    try {
        const data = await apiCall(`/users/search?q=${encodeURIComponent(searchInput)}`);
        
        if (data.users && data.users.length > 0) {
            resultsDiv.innerHTML = data.users.map(user => `
                <div class="card mb-2">
                    <div class="card-body">
                        <h6 class="card-title">${user.name}</h6>
                        <p class="card-text mb-1">Email: ${user.email}</p>
                        <p class="card-text mb-1">Phone: ${user.phone || 'Not provided'}</p>
                        <p class="card-text mb-2">Role: <span class="badge bg-${user.role === 'admin' ? 'danger' : user.role === 'staff' ? 'warning' : 'primary'}">${user.role}</span></p>
                        <button class="btn btn-sm btn-primary" onclick="viewUserActivity('${user._id}', '${user.name}')">
                            <i class="fas fa-chart-line me-1"></i>View Activity
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            resultsDiv.innerHTML = '<div class="alert alert-info">No users found</div>';
        }
    } catch (error) {
        console.error('Error searching users:', error);
        resultsDiv.innerHTML = '<div class="alert alert-danger">Error searching users</div>';
    }
}

// ===== USER ACTIVITY FUNCTION =====
async function viewUserActivity(userId, userName) {
    try {
        const data = await apiCall(`/dashboard/user-activity/${userId}`);
        
        if (data.success && data.userActivity) {
            showUserActivityModal(data.userActivity, userName);
        } else {
            throw new Error('Failed to load user activity');
        }
    } catch (error) {
        console.error('Error loading user activity:', error);
        showNotification('Failed to load user activity: ' + error.message, 'error');
    }
}

function showUserActivityModal(userActivity, userName) {
    const title = document.getElementById('userActivityTitle');
    const content = document.getElementById('userActivityContent');
    
    title.textContent = `Activity for ${userName}`;
    
    let activityHTML = `
        <div class="row">
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header">
                        <h6>Bookings (${userActivity.bookings.length})</h6>
                    </div>
                    <div class="card-body">
    `;
    
    if (userActivity.bookings.length > 0) {
        userActivity.bookings.forEach(booking => {
            activityHTML += `
                <div class="activity-item booking">
                    <strong>${booking.service?.name || 'Service'}</strong><br>
                    <small>Date: ${new Date(booking.date).toLocaleDateString()} at ${booking.time}</small><br>
                    <small>Staff: ${booking.staff?.name || 'Not assigned'}</small><br>
                    <small>Status: <span class="badge bg-${getStatusBadgeColor(booking.status)}">${booking.status}</span></small>
                    <button class="btn btn-sm btn-outline-primary mt-1" onclick="generateReceipt('booking', '${booking._id}')">
                        <i class="fas fa-receipt me-1"></i>Receipt
                    </button>
                </div>
            `;
        });
    } else {
        activityHTML += `<p class="text-muted">No bookings found</p>`;
    }
    
    activityHTML += `
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header">
                        <h6>Orders (${userActivity.orders.length})</h6>
                    </div>
                    <div class="card-body">
    `;
    
    if (userActivity.orders.length > 0) {
        userActivity.orders.forEach(order => {
            activityHTML += `
                <div class="activity-item order">
                    <strong>Order #${order._id.slice(-6)}</strong><br>
                    <small>Items: ${order.items?.length || 0}</small><br>
                    <small>Total: R ${(order.finalTotal || order.total || 0).toFixed(2)}</small><br>
                    <small>Status: <span class="badge bg-${getStatusBadgeColor(order.status)}">${order.status}</span></small>
                    <button class="btn btn-sm btn-outline-primary mt-1" onclick="generateReceipt('order', '${order._id}')">
                        <i class="fas fa-receipt me-1"></i>Receipt
                    </button>
                </div>
            `;
        });
    } else {
        activityHTML += `<p class="text-muted">No orders found</p>`;
    }
    
    activityHTML += `
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header">
                        <h6>Gift Orders (${userActivity.giftOrders.length})</h6>
                    </div>
                    <div class="card-body">
    `;
    
    if (userActivity.giftOrders.length > 0) {
        userActivity.giftOrders.forEach(gift => {
            activityHTML += `
                <div class="activity-item gift">
                    <strong>Gift for ${gift.recipientName}</strong><br>
                    <small>Package: ${gift.giftPackage?.name || 'Gift'}</small><br>
                    <small>Delivery: ${new Date(gift.deliveryDate).toLocaleDateString()}</small><br>
                    <small>Status: <span class="badge bg-${getStatusBadgeColor(gift.status)}">${gift.status}</span></small>
                    <button class="btn btn-sm btn-outline-primary mt-1" onclick="generateReceipt('gift', '${gift._id}')">
                        <i class="fas fa-receipt me-1"></i>Receipt
                    </button>
                </div>
            `;
        });
    } else {
        activityHTML += `<p class="text-muted">No gift orders found</p>`;
    }
    
    activityHTML += `
                    </div>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = activityHTML;
    
    const activityModal = new bootstrap.Modal(document.getElementById('userActivityModal'));
    activityModal.show();
}

function printReceipt() {
    window.print();
}

// ===== UTILITY FUNCTIONS =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

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

function updateRecentActivity(activities) {
    const container = document.getElementById('recentActivity');
    
    if (!activities || activities.length === 0) {
        container.innerHTML = '<li class="list-group-item">No recent activity</li>';
        return;
    }
    
    container.innerHTML = activities.map(activity => `
        <li class="list-group-item activity-item ${activity.type}">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>${activity.title}</strong>
                    <p class="mb-1">${activity.description}</p>
                    <small class="text-muted">
                        ${new Date(activity.timestamp).toLocaleDateString()} - 
                        ${activity.user?.name || 'Customer'}
                    </small>
                </div>
                <div class="text-end">
                    <strong>R ${activity.amount?.toLocaleString() || 0}</strong><br>
                    <span class="badge bg-${getStatusBadgeColor(activity.status)}">
                        ${activity.status}
                    </span>
                </div>
            </div>
        </li>
    `).join('');
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Initializing Tassel Group Application');

    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('currentUser');

    if (token && savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUIForUser();

            // ✅ FIX: Populate staff dropdowns for ALL logged-in users
            console.log('👤 User logged in, populating staff dropdowns...');
            setTimeout(() => populateStaffDropdowns(), 100);

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

    // Set up form event listeners
    setTimeout(() => {
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
    }, 200);

    // Set minimum dates
    setMinimumDates();

    // Load initial data
    loadProducts();
    loadServices();
    loadGiftPackages();

    console.log('✅ Application initialized successfully');
});