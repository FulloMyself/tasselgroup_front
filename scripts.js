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
        
        // POPULATE STAFF DROPDOWNS AFTER LOGIN FOR STAFF/ADMIN USERS
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
            // Populate staff dropdown for voucher assignment
            setTimeout(() => populateVoucherStaffDropdown(), 100);
            break;
        default:
            console.error('Unknown modal type:', type);
            return;
    }

    // Show the modal
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
                    <!-- Staff options will be populated dynamically -->
                </select>
            </div>
            <button type="submit" class="btn btn-primary w-100">Create Voucher</button>
        </form>
    `;
}

// Form submission handlers
async function handleServiceSubmit(event) {
    event.preventDefault();
    
    const serviceData = {
        name: document.getElementById('serviceName').value.trim(),
        description: document.getElementById('serviceDescription').value.trim(),
        price: parseFloat(document.getElementById('servicePrice').value),
        duration: parseInt(document.getElementById('serviceDuration').value) + ' min', // Fixed duration format
        category: document.getElementById('serviceCategory').value,
        image: document.getElementById('serviceImage').value.trim() || '',
        inStock: true
    };

    // Validation
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
        
        // Close modal and refresh services
        bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
        loadServices();
        loadDashboard(); // Refresh dashboard data
        
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

    // Validation
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
        
        // Close modal and refresh products
        bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
        loadProducts();
        loadDashboard(); // Refresh dashboard data
        
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

    // Validation
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
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
        
    } catch (error) {
        showNotification('Failed to create voucher: ' + error.message, 'error');
    }
}

// Populate staff dropdown in voucher form
function populateVoucherStaffDropdown() {
    const staffDropdown = document.getElementById('voucherAssignedTo');
    if (!staffDropdown) return;

    loadStaffMembers().then(staffMembers => {
        // Clear existing options except the first one
        while (staffDropdown.options.length > 1) {
            staffDropdown.remove(1);
        }

        // Add staff options
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
        
        // POPULATE STAFF DROPDOWNS AFTER REGISTRATION FOR STAFF/ADMIN USERS
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
        // Initialize charts before loading dashboard
        initializeCharts();
        setTimeout(() => loadDashboard(), 100);
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
        // Try different endpoints for gift packages
        let data;
        try {
            data = await apiCall('/gift-packages');
        } catch (error) {
            console.log('Gift packages endpoint not available, trying services as fallback');
            data = await apiCall('/services');
            // Transform services data to gift packages format
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
        document.getElementById('totalRevenue').textContent = 'R ' + totalRevenue.toFixed(2);

        console.log('💰 Total Revenue Updated:', totalRevenue);

        // Load charts with proper error handling
        setTimeout(() => {
            try {
                if (data.monthlyRevenue) {
                    createRevenueChart(data.monthlyRevenue);
                }

                if (data.staffPerformance) {
                    createStaffPerformanceChart(data.staffPerformance);
                }

                if (data.popularServices) {
                    createServicesChart(data.popularServices);
                }

                // Load recent activity
                updateRecentActivity(data.recentActivity || []);
            } catch (chartError) {
                console.error('Chart rendering error:', chartError);
            }
        }, 500);

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
        document.getElementById('staffCommission').textContent = 'R ' + (data.stats?.totalCommission || 0).toFixed(2);

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
                        <span class="badge bg-success rounded-pill">R ${(sale.amount || 0).toFixed(2)}</span>
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
function initializeCharts() {
    // Destroy any existing charts
    Object.values(chartInstances).forEach(chart => {
        if (chart) {
            try {
                chart.destroy();
            } catch (e) {
                console.log('Error destroying chart:', e);
            }
        }
    });
    
    // Reset chart instances
    chartInstances = {
        revenueChart: null,
        staffPerformanceChart: null,
        servicesChart: null
    };
}

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

    if (typeof monthlyRevenueData === 'object' && !Array.isArray(monthlyRevenueData)) {
        // Object format { "Month Year": amount }
        labels = Object.keys(monthlyRevenueData);
        data = Object.values(monthlyRevenueData);
    } else if (Array.isArray(monthlyRevenueData)) {
        // Array format
        labels = monthlyRevenueData.map(item => item.month || item.label || `Month ${item._id}`);
        data = monthlyRevenueData.map(item => item.revenue || item.data || item.amount || 0);
    } else {
        console.error('Invalid monthly revenue data format:', monthlyRevenueData);
        return;
    }

    // Sort chronologically
    const sortedData = sortMonthlyRevenueData({ labels, data });
    labels = sortedData.labels;
    data = sortedData.data;

    try {
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
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Revenue Trend'
                    },
                    legend: {
                        display: true
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
                    },
                    x: {
                        ticks: {
                            maxRotation: 45
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating revenue chart:', error);
    }
}

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

    try {
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
                maintainAspectRatio: false,
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
                    },
                    x: {
                        ticks: {
                            maxRotation: 45
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating staff performance chart:', error);
    }
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

    try {
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
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Popular Services'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating services chart:', error);
    }
}

function updateRecentActivity(activities) {
    const recentActivityList = document.getElementById('recentActivity');
    if (!recentActivityList) return;

    if (activities && activities.length > 0) {
        recentActivityList.innerHTML = activities.map(activity => `
            <li class="list-group-item">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${activity.title || activity.description || 'Activity'}</h6>
                    <small>${new Date(activity.timestamp || activity.date || new Date()).toLocaleDateString()}</small>
                </div>
                <p class="mb-1">${activity.description || activity.type || 'No description'}</p>
            </li>
        `).join('');
    } else {
        recentActivityList.innerHTML = '<li class="list-group-item">No recent activity</li>';
    }
}

// ===== STAFF MANAGEMENT =====
async function loadStaffMembers() {
    try {
        // Try staff endpoint first with proper headers
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
            // If staff endpoint fails, get all users and filter
            const allUsersResponse = await fetch(`${API_BASE}/users`);
            if (allUsersResponse.ok) {
                const allUsers = await allUsersResponse.json();
                return allUsers.filter(user => user.role === 'staff');
            } else {
                throw new Error('All users endpoint failed');
            }
        } catch (secondError) {
            console.log('Failed to load staff members from all users:', secondError.message);
            
            // If completely failed, return empty array but don't break the app
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
    
    let populatedCount = 0;
    
    loadStaffMembers().then(staffMembers => {
        if (!staffMembers || staffMembers.length === 0) {
            console.log('⚠️ No staff members available for dropdowns');
            staffMembers = [];
        }
        
        console.log(`👥 Populating ${dropdownSelectors.length} dropdowns with ${staffMembers.length} staff members`);
        
        dropdownSelectors.forEach(selector => {
            const dropdown = document.querySelector(selector);
            if (dropdown) {
                // Clear and populate the dropdown
                dropdown.innerHTML = '<option value="">Select staff member</option>' +
                    staffMembers.map(staff => 
                        `<option value="${staff._id}">${staff.name}</option>`
                    ).join('');
                populatedCount++;
                console.log(`✅ Populated dropdown: ${selector}`);
            } else {
                console.log(`❌ Dropdown not found (might be in hidden section): ${selector}`);
            }
        });
        
        console.log(`✅ Populated ${populatedCount} dropdowns with ${staffMembers.length} staff members`);
        
    }).catch(error => {
        console.error('Error populating staff dropdowns:', error);
        // Set all dropdowns to empty but don't break the app
        dropdownSelectors.forEach(selector => {
            const dropdown = document.querySelector(selector);
            if (dropdown) {
                dropdown.innerHTML = '<option value="">No staff available</option>';
            }
        });
    });
    
    return populatedCount;
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
        'giftCustomizationForm': createGift,
        'serviceForm': handleServiceSubmit,
        'productForm': handleProductSubmit,
        'voucherForm': handleVoucherSubmit
    };

    Object.entries(forms).forEach(([formId, handler]) => {
        const form = document.getElementById(formId);
        if (form) {
            // Remove existing event listeners
            form.replaceWith(form.cloneNode(true));
            // Add new event listener
            document.getElementById(formId).addEventListener('submit', handler);
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

            // ONLY populate staff dropdowns if user is logged in AND is staff/admin
            if (currentUser.role === 'staff' || currentUser.role === 'admin') {
                console.log('👤 User is staff/admin, populating staff dropdowns...');
                // Small delay to ensure DOM is ready
                setTimeout(() => populateStaffDropdowns(), 100);
            } else {
                console.log('👤 User is customer, skipping staff dropdowns');
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
        console.log('🔐 User not logged in, staff dropdowns will be populated after login');
    }

    // Safe form setup with delay
    setTimeout(() => safeFormSetup(), 200);

    // Set minimum dates
    setMinimumDates();

    // Load initial data (no auth required)
    loadProducts();
    loadServices();
    loadGiftPackages();

    console.log('✅ Application initialized successfully');
});

// ===== RECEIPT & PRINTING FUNCTIONS =====
async function generateReceipt(type, id) {
    try {
        const data = await apiCall(`/dashboard/receipt/${type}/${id}`);
        
        if (data.success && data.receipt) {
            showReceiptModal(data.receipt, data.company);
        } else {
            throw new Error('Failed to generate receipt');
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

    // Add type-specific details
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
    
    // Show the modal
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptModal.show();
}

function printReceipt() {
    window.print();
}

// ===== USER ACTIVITY FUNCTIONS =====
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
    
    // Show the modal
    const activityModal = new bootstrap.Modal(document.getElementById('userActivityModal'));
    activityModal.show();
}

function getStatusBadgeColor(status) {
    switch (status?.toLowerCase()) {
        case 'completed':
        case 'confirmed':
        case 'paid':
        case 'delivered':
            return 'success';
        case 'pending':
        case 'processing':
            return 'warning';
        case 'cancelled':
        case 'refunded':
            return 'danger';
        default:
            return 'secondary';
    }
}

// Update the recent activity display to include receipt buttons
function updateRecentActivity(activities) {
    const recentActivityList = document.getElementById('recentActivity');
    if (!recentActivityList) return;

    if (activities && activities.length > 0) {
        recentActivityList.innerHTML = activities.map(activity => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${activity.title || activity.description || 'Activity'}</h6>
                    <p class="mb-1 text-muted">${activity.description || activity.type || 'No description'}</p>
                    <small class="text-muted">${new Date(activity.timestamp || activity.date || new Date()).toLocaleString()}</small>
                </div>
                <div>
                    <span class="badge bg-primary me-2">R ${(activity.amount || 0).toFixed(2)}</span>
                    <button class="btn btn-sm btn-outline-primary" onclick="generateReceipt('${activity.type}', '${activity.id}')">
                        <i class="fas fa-receipt"></i>
                    </button>
                </div>
            </li>
        `).join('');
    } else {
        recentActivityList.innerHTML = '<li class="list-group-item">No recent activity</li>';
    }
}

// ===== RECEIPT & PDF INVOICE FUNCTIONS =====
async function generateReceipt(type, id) {
    try {
        console.log(`📄 Generating receipt for ${type} with ID: ${id}`);
        
        const data = await apiCall(`/dashboard/receipt/${type}/${id}`);
        
        if (data.success && data.receipt) {
            // Create PDF invoice
            await createPDFInvoice(data.receipt, data.company);
        } else {
            throw new Error('Failed to generate receipt data');
        }
    } catch (error) {
        console.error('Error generating receipt:', error);
        showNotification('Failed to generate receipt: ' + error.message, 'error');
    }
}

async function createPDFInvoice(receipt, company) {
    try {
        // Create a new window for the invoice
        const invoiceWindow = window.open('', '_blank');
        const invoiceDate = new Date().toLocaleDateString('en-ZA');
        const invoiceTime = new Date().toLocaleTimeString('en-ZA');
        
        let itemsHTML = '';
        if (receipt.type === 'order' && receipt.items) {
            itemsHTML = receipt.items.map(item => `
                <tr>
                    <td>${item.product}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-right">R ${item.price.toFixed(2)}</td>
                    <td class="text-right">R ${item.subtotal.toFixed(2)}</td>
                </tr>
            `).join('');
        }

        const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Invoice - ${receipt.id}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border: 2px solid #ddd;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #4e73df;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-info h1 {
            color: #4e73df;
            margin: 0;
            font-size: 28px;
        }
        .company-info p {
            margin: 5px 0;
            color: #666;
        }
        .invoice-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .customer-info, .invoice-info {
            flex: 1;
        }
        .section-title {
            background: #4e73df;
            color: white;
            padding: 10px;
            margin: 20px 0 10px 0;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #ddd;
            font-weight: bold;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .total-section {
            margin-top: 30px;
            text-align: right;
        }
        .total-amount {
            font-size: 20px;
            font-weight: bold;
            color: #4e73df;
        }
        .footer {
            margin-top: 50px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
        .status-badge {
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-confirmed { background: #d4edda; color: #155724; }
        .status-paid { background: #d4edda; color: #155724; }
        .status-pending { background: #fff3cd; color: #856404; }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="company-info">
                <h1>${company.name}</h1>
                <p>${company.address}</p>
                <p>Tel: ${company.phone} | Email: ${company.email}</p>
                <p>${company.registration} | ${company.vatNumber}</p>
            </div>
        </div>

        <div class="invoice-details">
            <div class="customer-info">
                <h3>Customer Details</h3>
                <p><strong>Name:</strong> ${receipt.customer}</p>
                <p><strong>Email:</strong> ${receipt.customerEmail}</p>
                <p><strong>Phone:</strong> ${receipt.customerPhone || 'Not provided'}</p>
            </div>
            <div class="invoice-info">
                <h3>Invoice Details</h3>
                <p><strong>Invoice #:</strong> ${receipt.id}</p>
                <p><strong>Date:</strong> ${invoiceDate}</p>
                <p><strong>Time:</strong> ${invoiceTime}</p>
                <p><strong>Type:</strong> ${receipt.type.charAt(0).toUpperCase() + receipt.type.slice(1)}</p>
                <p><strong>Status:</strong> 
                    <span class="status-badge status-${receipt.status}">${receipt.status}</span>
                </p>
            </div>
        </div>

        ${receipt.type === 'booking' ? `
        <div class="section-title">Service Details</div>
        <table>
            <tr>
                <th>Service</th>
                <th>Staff</th>
                <th>Duration</th>
                <th>Appointment</th>
                <th class="text-right">Amount</th>
            </tr>
            <tr>
                <td>${receipt.service}</td>
                <td>${receipt.staff}</td>
                <td>${receipt.duration}</td>
                <td>${new Date(receipt.bookingDate).toLocaleDateString()} at ${receipt.bookingTime}</td>
                <td class="text-right">R ${receipt.amount.toFixed(2)}</td>
            </tr>
        </table>
        ${receipt.specialRequests && receipt.specialRequests !== 'None' ? `
        <div class="section-title">Special Requests</div>
        <p>${receipt.specialRequests}</p>
        ` : ''}
        ` : ''}

        ${receipt.type === 'order' ? `
        <div class="section-title">Order Items</div>
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th class="text-center">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHTML}
            </tbody>
        </table>
        <div class="section-title">Order Information</div>
        <p><strong>Processed By:</strong> ${receipt.processedBy}</p>
        <p><strong>Shipping Address:</strong> ${receipt.shippingAddress}</p>
        ` : ''}

        ${receipt.type === 'gift' ? `
        <div class="section-title">Gift Details</div>
        <table>
            <tr>
                <th>Gift Package</th>
                <th>Recipient</th>
                <th>Delivery Date</th>
                <th>Assigned Staff</th>
                <th class="text-right">Amount</th>
            </tr>
            <tr>
                <td>${receipt.giftPackage}</td>
                <td>${receipt.recipient}<br><small>${receipt.recipientEmail}</small></td>
                <td>${new Date(receipt.deliveryDate).toLocaleDateString()}</td>
                <td>${receipt.assignedStaff}</td>
                <td class="text-right">R ${receipt.amount.toFixed(2)}</td>
            </tr>
        </table>
        ${receipt.message ? `
        <div class="section-title">Personal Message</div>
        <p><em>${receipt.message}</em></p>
        ` : ''}
        ` : ''}

        <div class="total-section">
            <div class="section-title">Total Amount</div>
            <div class="total-amount">R ${(receipt.amount || receipt.total || 0).toFixed(2)}</div>
        </div>

        <div class="footer">
            <p>Thank you for choosing ${company.name}!</p>
            <p>This is an computer-generated invoice. No signature required.</p>
            <p>For any inquiries, please contact ${company.email} or call ${company.phone}</p>
            <p>Generated on ${invoiceDate} at ${invoiceTime}</p>
        </div>
    </div>
</body>
</html>`;

        invoiceWindow.document.write(invoiceHTML);
        invoiceWindow.document.close();
        
        // Wait for content to load then trigger print
        setTimeout(() => {
            invoiceWindow.print();
            showNotification('Invoice generated successfully!', 'success');
        }, 500);

    } catch (error) {
        console.error('Error creating PDF invoice:', error);
        showNotification('Failed to create invoice: ' + error.message, 'error');
    }
}

// Alternative: Download as PDF using html2pdf.js
// Add this CDN to your index.html: <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>

async function downloadPDFInvoice(receipt, company) {
    try {
        // Create invoice HTML (same as above)
        const invoiceHTML = createInvoiceHTML(receipt, company);
        
        // Create a temporary div for the invoice
        const element = document.createElement('div');
        element.innerHTML = invoiceHTML;
        document.body.appendChild(element);
        
        // Use html2pdf to generate PDF
        const opt = {
            margin: 10,
            filename: `invoice-${receipt.id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        await html2pdf().set(opt).from(element).save();
        
        // Remove temporary element
        document.body.removeChild(element);
        
        showNotification('PDF invoice downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showNotification('Failed to download PDF invoice', 'error');
    }
}