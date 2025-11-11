// ===== CONFIGURATION =====
class AppConfig {
    static getApiBaseUrl() {
        const hostname = window.location.hostname;
        const port = window.location.port;

        // Enhanced environment detection
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname === '' || port === '5500' || port === '3000') {
            return 'http://localhost:5000/api';
        } else {
            return 'https://tasselgroup-back.onrender.com/api';
        }
    }

    static get API_BASE() {
        return this.getApiBaseUrl();
    }

    // Add fallback images with better coverage
    static getDefaultImages() {
        return {
            product: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            gift: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            service: 'https://images.unsplash.com/photo-1560067174-c5a3a8fad58b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            package: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        };
    }

    // Static image paths for packages
    static getPackageImages() {
        return {
            'Pamper Package': 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            'Executive Package': 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            'Couples Package': 'https://images.unsplash.com/photo-1511895426328-dc8714191300?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        };
    }
}

console.log('🚀 Tassel Group App Starting...', {
    environment: window.location.hostname === 'localhost' ? 'development' : 'production',
    apiBase: AppConfig.API_BASE,
    currentHost: window.location.hostname
});

// ===== APPLICATION STATE =====
class AppState {
    static currentUser = null;
    static cart = [];
    static currentBooking = null;
    static currentGift = null;
    static chartInstances = {
        revenueChart: null,
        staffPerformanceChart: null,
        servicesChart: null
    };
    static isInitialized = false;
}

// ===== CART SERVICE =====
class CartService {
    static addToCart(productId, productName, price, quantity = 1) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to add items to cart', 'warning');
            UIHelper.showSection('login');
            return;
        }

        // Validate inputs
        if (!productId || !productName || price == null) {
            console.error('Invalid product data for cart');
            Utils.showNotification('Invalid product information', 'error');
            return;
        }

        const existingItem = AppState.cart.find(item => item.productId === productId);

        if (existingItem) {
            existingItem.quantity += quantity;
            Utils.showNotification(`Updated ${this.escapeHtml(productName)} quantity to ${existingItem.quantity}`, 'info');
        } else {
            AppState.cart.push({
                productId,
                name: productName,
                price: parseFloat(price) || 0,
                quantity: parseInt(quantity) || 1
            });
            Utils.showNotification(`Added ${this.escapeHtml(productName)} to cart`, 'success');
        }

        this.updateCartDisplay();

        // Scroll to cart section so user can see it
        this.scrollToCart();
    }

    // NEW: Scroll to cart section
    static scrollToCart() {
        const cartSection = document.getElementById('cartSection');
        if (cartSection) {
            cartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    static removeFromCart(productId) {
        AppState.cart = AppState.cart.filter(item => item.productId !== productId);
        this.updateCartDisplay();
        Utils.showNotification('Item removed from cart', 'info');
    }

    static updateQuantity(productId, newQuantity) {
        if (newQuantity <= 0) {
            this.removeFromCart(productId);
            return;
        }

        const item = AppState.cart.find(item => item.productId === productId);
        if (item) {
            item.quantity = newQuantity;
            this.updateCartDisplay();
        }
    }

    static proceedToCheckout() {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to checkout', 'warning');
            UIHelper.showSection('login');
            return;
        }

        if (AppState.cart.length === 0) {
            Utils.showNotification('Your cart is empty', 'warning');
            return;
        }

        // Show the choice modal
        const modalEl = document.getElementById('checkoutChoiceModal');
        if (!modalEl) {
            Utils.showNotification('Checkout options not available', 'error');
            return;
        }
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // One-time listeners for buttons in the modal
        const payfastBtn = document.getElementById('payfastBtn');
        const emailOrderBtn = document.getElementById('emailOrderBtn');

        // Clean up previous handlers (important for repeated use)
        payfastBtn.onclick = () => {
            modal.hide();
            CartService.showPaymentOptions();
        };
        emailOrderBtn.onclick = () => {
            modal.hide();
            CartService.processManualPayment("email"); // or "manual" depending on your logic
        };
    }


    static updateCartDisplay() {
        // Update the navigation cart count
        const cartCount = document.getElementById('cartCount');
        if (cartCount) {
            const totalItems = AppState.cart.reduce((sum, item) => sum + item.quantity, 0);
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'inline' : 'none';
        }

        // Update the detailed cart section with visibility control
        this.updateDetailedCartDisplay();
    }

    static updateDetailedCartDisplay() {
        const cartSection = document.getElementById('cartSection');
        const cartItemsDetailed = document.getElementById('cartItemsDetailed');
        const cartTotalItems = document.getElementById('cartTotalItems');
        const cartSubtotal = document.getElementById('cartSubtotal');
        const cartTotalAmount = document.getElementById('cartTotalAmount');
        const checkoutBtn = document.getElementById('checkoutBtn');
        const clearCartBtn = document.getElementById('clearCartBtn');

        // Hide cart section if user is not logged in OR cart is empty
        if (!AppState.currentUser || AppState.cart.length === 0) {
            if (cartSection) {
                cartSection.style.display = 'none';
            }

            // Still update the empty state in case it becomes visible later
            if (cartItemsDetailed) {
                cartItemsDetailed.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-shopping-cart fa-3x mb-3"></i>
                        <p>Your cart is empty</p>
                        <small>${!AppState.currentUser ? 'Please log in to add items to your cart' : 'Add some products from above to get started!'}</small>
                    </div>
                `;
            }

            // Disable buttons
            if (checkoutBtn) checkoutBtn.disabled = true;
            if (clearCartBtn) clearCartBtn.disabled = true;

            // Update totals
            if (cartTotalItems) cartTotalItems.textContent = '0';
            if (cartSubtotal) cartSubtotal.textContent = Utils.formatCurrency(0);
            if (cartTotalAmount) cartTotalAmount.textContent = Utils.formatCurrency(0);

            return;
        }

        // Show cart section only when user is logged in AND has items
        if (cartSection) {
            cartSection.style.display = 'block';
        }

        // Cart has items and user is logged in - render cart items
        if (cartItemsDetailed) {
            cartItemsDetailed.innerHTML = AppState.cart.map(item => `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-6">
                                <h5 class="card-title">${this.escapeHtml(item.name)}</h5>
                                <p class="card-text text-muted">${Utils.formatCurrency(item.price)} each</p>
                            </div>
                            <div class="col-md-3">
                                <div class="quantity-controls d-flex align-items-center justify-content-center">
                                    <button class="btn btn-outline-secondary btn-sm" 
                                            onclick="CartService.updateQuantity('${item.productId}', ${item.quantity - 1})">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <span class="mx-3 fw-bold">${item.quantity}</span>
                                    <button class="btn btn-outline-secondary btn-sm" 
                                            onclick="CartService.updateQuantity('${item.productId}', ${item.quantity + 1})">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="col-md-2 text-end">
                                <strong class="h5">${Utils.formatCurrency(item.price * item.quantity)}</strong>
                            </div>
                            <div class="col-md-1 text-end">
                                <button class="btn btn-danger btn-sm" 
                                        onclick="CartService.removeFromCart('${item.productId}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Calculate totals
        const totalItems = AppState.cart.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = AppState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Update display
        if (cartTotalItems) cartTotalItems.textContent = totalItems;
        if (cartSubtotal) cartSubtotal.textContent = Utils.formatCurrency(subtotal);
        if (cartTotalAmount) cartTotalAmount.textContent = Utils.formatCurrency(subtotal);

        // Enable buttons
        if (checkoutBtn) checkoutBtn.disabled = false;
        if (clearCartBtn) clearCartBtn.disabled = false;

        // Handle staff section visibility
        this.handleStaffSection();
    }

    static handleStaffSection() {
        const staffSection = document.getElementById('cartStaffSection');
        if (!staffSection) return;

        // Only show staff section for admin/staff roles when cart has items
        if ((AppState.currentUser?.role === 'admin' || AppState.currentUser?.role === 'staff') && AppState.cart.length > 0) {
            staffSection.style.display = 'block';
            this.loadStaffMembers();
        } else {
            staffSection.style.display = 'none';
        }
    }

    static async loadStaffMembers() {
        const staffSelect = document.getElementById('cartStaff');
        if (!staffSelect) return;

        try {
            // Clear existing options except the first one
            while (staffSelect.children.length > 1) {
                staffSelect.removeChild(staffSelect.lastChild);
            }

            // Load staff members from API
            const staffMembers = await StaffService.loadStaffMembers();

            if (staffMembers && staffMembers.length > 0) {
                staffMembers.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member._id;
                    option.textContent = member.name;
                    staffSelect.appendChild(option);
                });
                console.log(`✅ Loaded ${staffMembers.length} staff members for cart`);
            } else {
                console.warn('No staff members found');
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No staff available';
                option.disabled = true;
                staffSelect.appendChild(option);
            }
        } catch (error) {
            console.error('Failed to load staff members for cart:', error);
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading staff';
            option.disabled = true;
            staffSelect.appendChild(option);
        }
    }

    static async showPaymentOptions() {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to complete your order', 'warning');
            return;
        }

        if (AppState.cart.length === 0) {
            Utils.showNotification('Your cart is empty', 'warning');
            return;
        }

        try {
            Utils.showNotification('Initiating payment process...', 'info');

            // Prepare order data for Payfast
            const orderData = {
                type: 'order',
                items: AppState.cart.map(item => ({
                    productId: item.productId,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                })),
                totalAmount: AppState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                staffId: document.getElementById('cartStaff')?.value || null
            };

            console.log('🛒 Initiating Payfast payment with:', orderData);

            // Call your Payfast initiation endpoint
            const response = await ApiService.post('/payment/initiate', orderData);

            if (response.success && response.payfastUrl && response.data) {
                console.log('🔗 Redirecting to Payfast:', response.payfastUrl);

                // Create and submit form to Payfast
                this.submitToPayfast(response.payfastUrl, response.data);

            } else {
                throw new Error(response.message || 'Failed to initiate payment');
            }

        } catch (error) {
            console.error('❌ Payment initiation error:', error);
            Utils.showNotification('Failed to initiate payment: ' + error.message, 'error');

            // Fallback: show manual payment options
            this.showManualPaymentOptions();
        }
    }

    static submitToPayfast(payfastUrl, payfastData) {
        // Create a form dynamically
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payfastUrl;
        form.style.display = 'none';

        // Add all Payfast data as hidden inputs
        Object.keys(payfastData).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = payfastData[key];
            form.appendChild(input);
        });

        // Add form to document and submit
        document.body.appendChild(form);
        form.submit();
    }

    static showManualPaymentOptions() {
        try {
            const paymentModalElement = document.getElementById('paymentModal');
            if (!paymentModalElement) {
                console.error('Payment modal element not found');
                Utils.showNotification('Payment system not available', 'error');
                return;
            }

            const paymentModal = new bootstrap.Modal(paymentModalElement);
            paymentModal.show();
        } catch (error) {
            console.error('Error showing payment modal:', error);
            Utils.showNotification('Error opening payment options', 'error');
        }
    }

    static async processManualPayment(paymentMethod) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to complete your order', 'error');
            return;
        }

        if (AppState.cart.length === 0) {
            Utils.showNotification('Your cart is empty', 'warning');
            return;
        }

        try {
            Utils.showNotification('Processing manual order...', 'info');

            const orderData = {
                type: 'order',
                items: AppState.cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price
                })),
                totalAmount: AppState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                staffId: document.getElementById('cartStaff')?.value || null
            };

            const result = await ApiService.post('/payment/manual-order', orderData);

            if (result.success) {
                // Clear cart on successful order
                AppState.cart = [];
                this.updateCartDisplay();

                // Close modal
                const paymentModalElement = document.getElementById('paymentModal');
                if (paymentModalElement) {
                    const paymentModal = bootstrap.Modal.getInstance(paymentModalElement);
                    if (paymentModal) {
                        paymentModal.hide();
                    }
                }

                Utils.showNotification('Order placed successfully! Confirmation email sent.', 'success');

                // Redirect to dashboard
                setTimeout(() => {
                    UIHelper.showSection('dashboard');
                }, 2000);
            } else {
                throw new Error(result.message || 'Failed to process manual order');
            }

        } catch (error) {
            console.error('Manual payment processing error:', error);
            Utils.showNotification('Failed to process order: ' + error.message, 'error');
        }
    }

    static clearCart() {
        AppState.cart = [];
        this.updateCartDisplay();
        Utils.showNotification('Cart cleared', 'info');
    }

    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ===== ENHANCED API SERVICE WITH BETTER ERROR HANDLING =====
class ApiService {
    static async apiCall(endpoint, options = {}) {
        const token = Utils.getAuthToken();
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

        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        config.signal = controller.signal;

        try {
            console.log(`📡 Making API call to: ${AppConfig.API_BASE}${endpoint}`);
            const response = await fetch(`${AppConfig.API_BASE}${endpoint}`, config);
            clearTimeout(timeoutId);

            // Handle non-200 responses
            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }

                // Enhanced error handling for server errors
                if (response.status === 500) {
                    console.warn(`Server error (500) for ${endpoint}, using fallback`);
                    // Return appropriate fallback based on endpoint
                    if (endpoint.includes('/orders')) return [];
                    if (endpoint.includes('/bookings')) return [];
                    if (endpoint.includes('/gift-orders')) return [];
                    if (endpoint.includes('/dashboard')) return { success: false, stats: {} };
                }

                throw new Error(errorMessage);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }

        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`❌ API call failed: ${error.message}`, error);

            // Special handling for specific endpoints
            if (endpoint.includes('/orders') || endpoint.includes('/bookings') || endpoint.includes('/gift-orders')) {
                console.log('Using fallback for data endpoint');
                return []; // Return empty array for data endpoints
            }

            if (endpoint.includes('/dashboard')) {
                console.log('Using fallback for dashboard endpoint');
                return { success: false, stats: {} };
            }

            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please check your connection and try again.');
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to server. Please check your internet connection and try again.');
            }
            throw error;
        }
    }

    // Add these specific error handlers in your ApiService class
    static async patch(endpoint, data) {
        return this.apiCall(endpoint, {
            method: 'PATCH',
            body: data
        });
    }

    static async put(endpoint, data) {
        return this.apiCall(endpoint, {
            method: 'PUT',
            body: data
        });
    }

    // Add this method to the ApiService class
    static async apiCall(endpoint, options = {}) {
        const token = Utils.getAuthToken();
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

        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        config.signal = controller.signal;

        try {
            console.log(`📡 Making API call to: ${AppConfig.API_BASE}${endpoint}`);
            const response = await fetch(`${AppConfig.API_BASE}${endpoint}`, config);
            clearTimeout(timeoutId);

            // Handle non-200 responses
            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }

                // Enhanced error handling for server errors - SPECIFIC FIX FOR PRODUCTS
                if (response.status === 500 || response.status === 404) {
                    console.warn(`Server error (${response.status}) for ${endpoint}, using fallback`);
                    // Return appropriate fallback based on endpoint
                    if (endpoint.includes('/products')) return []; // Return empty array for products
                    if (endpoint.includes('/orders')) return [];
                    if (endpoint.includes('/bookings')) return [];
                    if (endpoint.includes('/gift-orders')) return [];
                    if (endpoint.includes('/dashboard')) return { success: false, stats: {} };
                }

                throw new Error(errorMessage);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }

        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`❌ API call failed: ${error.message}`, error);

            // Special handling for specific endpoints - SPECIFIC FIX FOR PRODUCTS
            if (endpoint.includes('/products')) {
                console.log('Using fallback for products endpoint');
                return []; // Return empty array for products
            }

            if (endpoint.includes('/orders') || endpoint.includes('/bookings') || endpoint.includes('/gift-orders')) {
                console.log('Using fallback for data endpoint');
                return [];
            }

            if (endpoint.includes('/dashboard')) {
                console.log('Using fallback for dashboard endpoint');
                return { success: false, stats: {} };
            }

            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please check your connection and try again.');
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to server. Please check your internet connection and try again.');
            }
            throw error;
        }
    }

    static async get(endpoint) {
        return this.apiCall(endpoint);
    }

    static async post(endpoint, data) {
        return this.apiCall(endpoint, {
            method: 'POST',
            body: data
        });
    }

    static async patch(endpoint, data) {
        return this.apiCall(endpoint, {
            method: 'PATCH',
            body: data
        });
    }

    static async delete(endpoint) {
        return this.apiCall(endpoint, {
            method: 'DELETE'
        });
    }
}

// ===== ENHANCED UTILITY FUNCTIONS =====
class Utils {
    static getStatusColor(status) {
        const colors = {
            'pending': 'warning',
            'confirmed': 'info',
            'completed': 'success',
            'delivered': 'success',
            'cancelled': 'danger',
            'processing': 'primary',
            'shipped': 'info',
            'paid': 'success',
            'active': 'success',
            'inactive': 'secondary'
        };
        return colors[status?.toLowerCase()] || 'secondary';
    }

    static getAuthToken() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    }

    static showNotification(message, type = 'info', duration = 5000) {
        // Remove existing notifications
        document.querySelectorAll('.alert.position-fixed').forEach(alert => {
            if (alert.parentNode) alert.parentNode.removeChild(alert);
        });

        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px; max-width: 400px;';
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${this.getNotificationIcon(type)} me-2"></i>
                <div class="flex-grow-1">${message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }

    static getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static formatCurrency(amount) {
        return `R ${parseFloat(amount || 0).toLocaleString('en-ZA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    static setMinimumDates() {
        const today = new Date().toISOString().split('T')[0];
        const dateInputs = ['bookingDate', 'deliveryDate', 'voucherValidUntil'];

        dateInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.min = today;
                // Set default value to today for better UX
                if (!element.value) {
                    element.value = today;
                }
            }
        });
    }

    static handleImageError(imgElement, type = 'product') {
        const defaultImages = AppConfig.getDefaultImages();
        const packageImages = AppConfig.getPackageImages();

        // Check if it's a package image first
        const altText = imgElement.alt || '';
        const packageName = Object.keys(packageImages).find(pkg =>
            altText.toLowerCase().includes(pkg.toLowerCase())
        );

        if (packageName && packageImages[packageName]) {
            imgElement.src = packageImages[packageName];
        } else {
            imgElement.src = defaultImages[type] || defaultImages.product;
        }
        imgElement.alt = 'Default ' + type + ' image';

        // Prevent infinite loop
        imgElement.onerror = null;
    }

    static safeParseJSON(str, fallback = {}) {
        try {
            return JSON.parse(str);
        } catch {
            return fallback;
        }
    }

    // Enhanced image source handler
    static getImageSource(imagePath, altText = '', type = 'product') {
        if (!imagePath || imagePath.includes('undefined') || imagePath.includes('null')) {
            const packageImages = AppConfig.getPackageImages();
            const packageName = Object.keys(packageImages).find(pkg =>
                altText.toLowerCase().includes(pkg.toLowerCase())
            );

            if (packageName && packageImages[packageName]) {
                return packageImages[packageName];
            }
            return AppConfig.getDefaultImages()[type] || AppConfig.getDefaultImages().product;
        }

        // Handle relative paths
        if (imagePath.startsWith('/') || !imagePath.includes('://')) {
            // Convert to absolute URL or use default
            const packageImages = AppConfig.getPackageImages();
            const packageName = Object.keys(packageImages).find(pkg =>
                altText.toLowerCase().includes(pkg.toLowerCase())
            );

            if (packageName && packageImages[packageName]) {
                return packageImages[packageName];
            }
            return AppConfig.getDefaultImages()[type] || AppConfig.getDefaultImages().product;
        }

        return imagePath;
    }
}

// ===== ENHANCED AUTHENTICATION SERVICE =====
class AuthService {
    static async login(email, password) {
        try {
            if (!email || !password) {
                throw new Error('Please enter both email and password');
            }

            const data = await ApiService.post('/auth/login', { email, password });

            if (!data.token || !data.user) {
                throw new Error('Invalid response from server');
            }

            localStorage.setItem('token', data.token);
            AppState.currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(data.user));

            // FIX: Use the method that exists
            UIHelper.updateUIForUser();
            await StaffService.populateStaffDropdowns();

            Utils.showNotification(`Welcome back, ${data.user.name}!`, 'success');

            // Redirect to Home Page after successful login
            setTimeout(() => {
                UIHelper.showSection('home'); // Changed from dashboard to home
            }, 1000);

            return data.user;

        } catch (error) {
            Utils.showNotification('Login failed: ' + error.message, 'error');
            throw error;
        }
    }

    static async register(userData) {
        try {
            // Validation
            if (!userData.name?.trim() || !userData.email?.trim() || !userData.password || !userData.phone?.trim() || !userData.address?.trim()) {
                throw new Error('Please fill in all required fields');
            }

            if (!Utils.validateEmail(userData.email)) {
                throw new Error('Please enter a valid email address');
            }

            const data = await ApiService.post('/auth/register', userData);

            if (!data.token || !data.user) {
                throw new Error('Invalid response from server');
            }

            localStorage.setItem('token', data.token);
            AppState.currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(data.user));

            // FIX: Use the method that exists
            UIHelper.updateUIForUser();
            await StaffService.populateStaffDropdowns();

            Utils.showNotification(`Welcome to Tassel Group, ${data.user.name}!`, 'success');

            // Redirect to Home Page after successful registration
            setTimeout(() => {
                UIHelper.showSection('home'); // Changed from dashboard to home
            }, 1000);

            return data.user;

        } catch (error) {
            Utils.showNotification('Registration failed: ' + error.message, 'error');
            throw error;
        }
    }

    static async fetchCurrentUser() {
        try {
            const data = await ApiService.get('/auth/me');
            AppState.currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            UIHelper.updateUIForUser();
            return data.user;
        } catch (error) {
            console.error('Failed to fetch current user:', error);
            this.logout();
            throw error;
        }
    }

    static logout() {
        AppState.currentUser = null;
        AppState.cart = [];
        AppState.currentBooking = null;
        AppState.currentGift = null;

        // Clear all sensitive data from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');

        // Transform user menu back to login button
        UIHelper.updateUIForUser();
        Utils.showNotification('You have been logged out.', 'info');

        // Redirect to Home Page after logout
        setTimeout(() => {
            UIHelper.showSection('home');
        }, 1000);
    }
}

// ===== ENHANCED UI HELPER =====
class UIHelper {
    static hideAllSections() {
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(section => {
            section.style.display = 'none';
        });
    }

    static showSection(sectionId) {
        this.hideAllSections();

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';

            // Handle section-specific initialization
            this.handleSectionChange(sectionId);
        } else {
            console.error(`Section ${sectionId} not found`);
        }
    }

    static async handleSectionChange(sectionId) {
        try {
            // Handle section-specific logic
            await this.loadSectionContent(sectionId);

            // NEW: Handle profile section specifically
            if (sectionId === 'profile') {
                await loadProfileData(); // Call the standalone function directly
            }

        } catch (error) {
            console.error(`Error loading section ${sectionId}:`, error);
            this.showErrorMessage(`Failed to load ${sectionId}`);
        }
    }


    static showErrorMessage(message) {
        Utils.showNotification(message, 'error');
    }

    static async loadSectionContent(sectionId) {
        const sectionHandlers = {
            dashboard: () => this.loadDashboardContent(),
            shop: () => this.loadShopContent(),
            services: () => this.loadServicesContent(),
            giftPackages: () => this.loadGiftPackagesContent()
        };

        const handler = sectionHandlers[sectionId];
        if (handler) {
            await handler();
        }
    }

    static async handleSectionChange(sectionId) {
        try {
            // Handle section-specific logic
            await this.loadSectionContent(sectionId);

            // Handle profile section specifically
            if (sectionId === 'profile') {
                await loadProfileData(); // Call the standalone function
            }

        } catch (error) {
            console.error(`Error loading section ${sectionId}:`, error);
            this.showErrorMessage(`Failed to load ${sectionId}`);
        }
    }

    static async loadDashboardContent() {
        if (!AppState.currentUser) return;

        try {
            // Initialize charts first
            if (typeof ChartHelper !== 'undefined' && ChartHelper.initializeCharts) {
                ChartHelper.initializeCharts();
            }

            // Load dashboard data
            if (typeof DashboardService !== 'undefined' && DashboardService.loadDashboard) {
                await DashboardService.loadDashboard();
            }

            // Load admin management if user is admin
            if (AppState.currentUser.role === 'admin') {
                if (typeof AdminService !== 'undefined' && AdminService.loadAdminManagementTables) {
                    await AdminService.loadAdminManagementTables();
                }
            }
        } catch (error) {
            console.error('Error loading dashboard content:', error);
        }
    }

    static async loadShopContent() {
        try {
            // Load products first
            if (typeof ProductService !== 'undefined' && ProductService.loadProducts) {
                await ProductService.loadProducts();
            }

            // Update cart display with visibility logic
            if (typeof CartService !== 'undefined' && CartService.updateCartDisplay) {
                CartService.updateCartDisplay();
            }

        } catch (error) {
            console.error('Error loading shop content:', error);
            this.showErrorMessage('Failed to load products');
        }
    }

    static async loadServicesContent() {
        try {
            if (typeof ServiceManager !== 'undefined' && ServiceManager.loadServices) {
                await ServiceManager.loadServices();
            }
        } catch (error) {
            console.error('Error loading services content:', error);
        }
    }

    static showLoading(message = 'Loading...') {
        // Create or update a loading indicator
        let loadingElement = document.getElementById('globalLoading');

        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.id = 'globalLoading';
            loadingElement.className = 'global-loading';
            loadingElement.innerHTML = `
                <div class="loading-overlay">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">${message}</div>
                </div>
            `;
            document.body.appendChild(loadingElement);
        } else {
            const loadingText = loadingElement.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }

        loadingElement.style.display = 'block';
    }

    static hideLoading() {
        const loadingElement = document.getElementById('globalLoading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    static showSectionLoading(sectionId, message = 'Loading...') {
        const section = document.getElementById(sectionId);
        if (section) {
            let loadingElement = section.querySelector('.section-loading');

            if (!loadingElement) {
                loadingElement = document.createElement('div');
                loadingElement.className = 'section-loading';
                loadingElement.innerHTML = `
                    <div class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 text-muted">${message}</p>
                    </div>
                `;
                section.appendChild(loadingElement);
            }

            loadingElement.style.display = 'block';
        }
    }

    static hideSectionLoading(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            const loadingElement = section.querySelector('.section-loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }
    }

    static updateUIForUser() {
        const currentUser = AppState.currentUser;
        const authNav = document.getElementById('authNav');

        if (!authNav) {
            console.error('authNav element not found');
            return;
        }

        console.log('🔄 Updating UI for user:', currentUser);

        if (currentUser) {
            // User is logged in - show user dropdown
            authNav.innerHTML = `
            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" 
                   data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="fas fa-user me-1"></i>
                    ${currentUser.name || currentUser.email}
                </a>
                <ul class="dropdown-menu" aria-labelledby="userDropdown">
                    <li><a class="dropdown-item" href="#" onclick="UIHelper.showSection('profile')">
                        <i class="fas fa-user-circle me-2"></i>Profile
                    </a></li>
                    <li><a class="dropdown-item" href="#" onclick="UIHelper.showSection('dashboard')">
                        <i class="fas fa-tachometer-alt me-2"></i>Dashboard
                    </a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" onclick="logout()">
                        <i class="fas fa-sign-out-alt me-2"></i>Logout
                    </a></li>
                </ul>
            </li>
        `;
        } else {
            // User is logged out - show login button
            authNav.innerHTML = `
            <li class="nav-item">
                <a class="nav-link" href="#" onclick="UIHelper.showSection('login')">
                    <i class="fas fa-sign-in-alt me-1"></i>Login
                </a>
            </li>
        `;
        }

        // Update cart display
        if (typeof CartService !== 'undefined' && CartService.updateCartDisplay) {
            CartService.updateCartDisplay();
        }
    }
    static showUserMenu(user) {
        console.log('👤 Showing user menu for:', user.name);

        // Remove any existing login button
        const loginButton = document.querySelector('.nav-item .nav-link[onclick*="login"]');
        if (loginButton) {
            const loginNavItem = loginButton.closest('.nav-item');
            if (loginNavItem) {
                // Replace login button with user dropdown
                loginNavItem.outerHTML = `
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" 
                           data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="fas fa-user me-1"></i>
                            ${user.name || user.email}
                        </a>
                        <ul class="dropdown-menu" aria-labelledby="userDropdown">
                            <li><a class="dropdown-item" href="#" onclick="UIHelper.showSection('profile')"><i class="fas fa-user-circle me-2"></i>Profile</a></li>
                            <li><a class="dropdown-item" href="#" onclick="UIHelper.showSection('dashboard')"><i class="fas fa-tachometer-alt me-2"></i>Dashboard</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="#" onclick="logout()"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                        </ul>
                    </li>
                `;
            }
        } else {
            // If no login button found, check if user dropdown already exists and update it
            const existingDropdown = document.querySelector('.nav-item.dropdown');
            if (existingDropdown) {
                const userNameElement = existingDropdown.querySelector('.dropdown-toggle');
                if (userNameElement) {
                    userNameElement.innerHTML = `<i class="fas fa-user me-1"></i>${user.name || user.email}`;
                }
            } else {
                // Create new user dropdown at the end of navbar
                this.createUserDropdown(user);
            }
        }
    }

    static showLoginButton() {
        console.log('🔐 Showing login button');

        // Remove any existing user dropdown
        const userDropdown = document.querySelector('.nav-item.dropdown');
        if (userDropdown) {
            // Replace user dropdown with login button
            userDropdown.outerHTML = `
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="UIHelper.showSection('login')">
                        <i class="fas fa-sign-in-alt me-1"></i>Login
                    </a>
                </li>
            `;
        } else {
            // If no dropdown found, check if login button exists and show it
            const loginButton = document.querySelector('.nav-item .nav-link[onclick*="login"]');
            if (loginButton) {
                const loginNavItem = loginButton.closest('.nav-item');
                if (loginNavItem) {
                    loginNavItem.style.display = 'block';
                }
            } else {
                // Create new login button
                this.createLoginButton();
            }
        }
    }

    static async handleProfileUpdate(e) {
        e.preventDefault();

        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to update profile', 'error');
            return;
        }

        try {
            const formData = {
                name: document.getElementById('profileFullName')?.value.trim() || '',
                email: document.getElementById('profileEmailInput')?.value.trim() || '',
                phone: document.getElementById('profilePhone')?.value.trim() || '',
                address: document.getElementById('profileAddress')?.value.trim() || ''
            };

            console.log('📝 Updating profile with data:', formData);

            // Validation
            if (!formData.name || !formData.email) {
                Utils.showNotification('Name and email are required', 'warning');
                return;
            }

            if (!Utils.validateEmail(formData.email)) {
                Utils.showNotification('Please enter a valid email address', 'warning');
                return;
            }

            Utils.showNotification('Updating profile...', 'info');

            // Use PUT method for profile update
            const result = await ApiService.put('/users/profile', formData);

            if (result && result._id) {
                // Update local state - your backend returns the user object directly
                AppState.currentUser = { ...AppState.currentUser, ...result };
                localStorage.setItem('currentUser', JSON.stringify(AppState.currentUser));

                // Update UI - use UIHelper class directly instead of 'this'
                UIHelper.updateUIForUser();
                await UIHelper.loadProfileData();
                Utils.showNotification('Profile updated successfully!', 'success');
            } else {
                throw new Error('Failed to update profile');
            }

        } catch (error) {
            console.error('Profile update error:', error);
            Utils.showNotification('Failed to update profile: ' + error.message, 'error');
        }
    }

    static async handlePasswordChange(e) {
        e.preventDefault();

        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to change password', 'error');
            return;
        }

        try {
            const currentPassword = document.getElementById('currentPassword')?.value || '';
            const newPassword = document.getElementById('newPassword')?.value || '';
            const confirmPassword = document.getElementById('confirmPassword')?.value || '';

            console.log('🔐 Processing password change...');

            // Validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                Utils.showNotification('All password fields are required', 'warning');
                return;
            }

            if (newPassword !== confirmPassword) {
                Utils.showNotification('New passwords do not match', 'warning');
                return;
            }

            if (newPassword.length < 6) {
                Utils.showNotification('New password must be at least 6 characters long', 'warning');
                return;
            }

            Utils.showNotification('Changing password...', 'info');

            const passwordData = {
                currentPassword: currentPassword,
                newPassword: newPassword
            };

            // Use PUT method for password change
            const result = await ApiService.put('/users/change-password', passwordData);

            if (result && result.message) {
                // Clear password fields
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';

                Utils.showNotification('Password changed successfully!', 'success');
            } else {
                throw new Error(result?.message || 'Failed to change password');
            }

        } catch (error) {
            console.error('Password change error:', error);
            Utils.showNotification('Failed to change password: ' + error.message, 'error');
        }
    }

    static createUserDropdown(user) {
        const navbarNav = document.querySelector('.navbar-nav');
        if (navbarNav) {
            const dropdownHTML = `
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" 
                       data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="fas fa-user me-1"></i>
                        ${user.name || user.email}
                    </a>
                    <ul class="dropdown-menu" aria-labelledby="userDropdown">
                        <li><a class="dropdown-item" href="#" onclick="UIHelper.showSection('profile')"><i class="fas fa-user-circle me-2"></i>Profile</a></li>
                        <li><a class="dropdown-item" href="#" onclick="UIHelper.showSection('dashboard')"><i class="fas fa-tachometer-alt me-2"></i>Dashboard</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" onclick="logout()"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                    </ul>
                </li>
            `;
            navbarNav.insertAdjacentHTML('beforeend', dropdownHTML);
        }
    }

    static createLoginButton() {
        const navbarNav = document.querySelector('.navbar-nav');
        if (navbarNav) {
            const loginHTML = `
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="UIHelper.showSection('login')">
                        <i class="fas fa-sign-in-alt me-1"></i>Login
                    </a>
                </li>
            `;
            navbarNav.insertAdjacentHTML('beforeend', loginHTML);
        }
    }

    static async loadProfileData() {
        if (!AppState.currentUser) {
            console.warn('No user logged in for profile');
            Utils.showNotification('Please log in to view profile', 'warning');
            UIHelper.showSection('login');
            return;
        }

        console.log('👤 Loading profile data for:', AppState.currentUser);

        try {
            // Update profile display elements
            const profileName = document.getElementById('profileName');
            const profileEmail = document.getElementById('profileEmail');
            const profileRole = document.getElementById('profileRole');
            const profileAvatar = document.getElementById('profileAvatar');

            if (profileName) profileName.textContent = AppState.currentUser.name || 'User Name';
            if (profileEmail) profileEmail.textContent = AppState.currentUser.email || 'user@example.com';
            if (profileRole) {
                const roleText = AppState.currentUser.role?.charAt(0).toUpperCase() + AppState.currentUser.role?.slice(1) || 'Customer';
                profileRole.textContent = roleText;
                profileRole.className = `badge bg-${Utils.getStatusColor(AppState.currentUser.role || 'customer')}`;
            }
            if (profileAvatar) {
                profileAvatar.textContent = (AppState.currentUser.name?.charAt(0) || AppState.currentUser.email?.charAt(0) || 'U').toUpperCase();
            }

            // Populate form fields
            const profileFullName = document.getElementById('profileFullName');
            const profileEmailInput = document.getElementById('profileEmailInput');
            const profilePhone = document.getElementById('profilePhone');
            const profileAddress = document.getElementById('profileAddress');

            if (profileFullName) profileFullName.value = AppState.currentUser.name || '';
            if (profileEmailInput) profileEmailInput.value = AppState.currentUser.email || '';
            if (profilePhone) profilePhone.value = AppState.currentUser.phone || '';
            if (profileAddress) profileAddress.value = AppState.currentUser.address || '';

            // Clear password fields
            const currentPassword = document.getElementById('currentPassword');
            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmPassword');

            if (currentPassword) currentPassword.value = '';
            if (newPassword) newPassword.value = '';
            if (confirmPassword) confirmPassword.value = '';

            console.log('✅ Profile data loaded successfully');

        } catch (error) {
            console.error('Error loading profile data:', error);
            Utils.showNotification('Error loading profile data', 'error');
        }
    }

    // Add this temporary debug method
    static debugNavbar() {
        console.log('🔍 Debugging navbar elements:');

        const elements = [
            '#userMenu', '#authButtons', '#userName',
            '#adminDashboardLink', '#staffDashboardLink', '#customerDashboardLink',
            '.user-menu', '.auth-buttons'
        ];

        elements.forEach(selector => {
            const element = document.querySelector(selector);
            console.log(`${selector}:`, element ? 'FOUND' : 'NOT FOUND', element);
        });
    }

    static updateDashboardLinks(userRole) {
        const dashboardLinks = {
            'admin': ['#adminDashboardLink', '.admin-dashboard', '[data-admin-link]'],
            'staff': ['#staffDashboardLink', '.staff-dashboard', '[data-staff-link]'],
            'customer': ['#customerDashboardLink', '.customer-dashboard', '[data-customer-link]']
        };

        // Hide all dashboard links first
        Object.values(dashboardLinks).flat().forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                element.classList.add('d-none');
            });
        });

        // Show appropriate links based on role
        if (userRole && dashboardLinks[userRole]) {
            dashboardLinks[userRole].forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.style.display = 'block';
                    element.classList.remove('d-none');
                });
            });
        }
    }

    static async loadGiftPackagesContent() {
        try {
            if (typeof GiftService !== 'undefined' && GiftService.loadGiftPackages) {
                await GiftService.loadGiftPackages();
            }
        } catch (error) {
            console.error('Error loading gift packages content:', error);
        }
    }
}

// ===== ADMIN ACTION HANDLER =====
async function submitAdminAction() {
    const form = document.getElementById('adminActionForm');
    if (!form) {
        console.error('Admin action form not found');
        return;
    }

    const type = form.dataset.type;
    const id = form.dataset.id;
    const status = document.getElementById('adminStatus')?.value;
    const staff = document.getElementById('adminStaff')?.value;
    const notes = document.getElementById('adminNotes')?.value;

    if (!status) {
        Utils.showNotification('Please select a status', 'warning');
        return;
    }

    try {
        let endpoint = '';
        let data = { status };

        // Add notes if provided
        if (notes) {
            data.notes = notes;
        }

        // Add staff assignment based on type
        if (staff && staff !== 'unassigned') {
            switch (type) {
                case 'order':
                    data.processedBy = staff;
                    break;
                case 'booking':
                    data.staff = staff;
                    break;
                case 'gift':
                    data.assignedStaff = staff;
                    break;
            }
        } else if (staff === 'unassigned') {
            // Handle unassignment
            switch (type) {
                case 'order':
                    data.processedBy = null;
                    break;
                case 'booking':
                    data.staff = null;
                    break;
                case 'gift':
                    data.assignedStaff = null;
                    break;
            }
        }

        // Determine endpoint based on type
        switch (type) {
            case 'order':
                endpoint = `/orders/${id}`;
                break;
            case 'booking':
                endpoint = `/bookings/${id}`;
                break;
            case 'gift':
                endpoint = `/gift-orders/${id}`;
                break;
            default:
                throw new Error(`Unknown type: ${type}`);
        }

        console.log(`🔄 Updating ${type} with data:`, data);
        const result = await ApiService.patch(endpoint, data);

        // Close modal
        const modalElement = document.getElementById('adminActionModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }

        Utils.showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully!`, 'success');

        // Reload admin tables
        setTimeout(() => {
            if (AppState.currentUser?.role === 'admin') {
                AdminService.loadAdminManagementTables();
            }
        }, 1000);

    } catch (error) {
        console.error('Error updating admin action:', error);
        Utils.showNotification('Failed to update: ' + error.message, 'error');
    }
}

// ===== ENHANCED PRODUCT SERVICE WITH BETTER ERROR HANDLING =====
class ProductService {
    static async loadProducts() {
        const container = document.getElementById('productsContainer');
        if (!container) {
            console.warn('⚠️ productsContainer not found in DOM');
            return;
        }

        // Show loading state directly in the container (FIXED)
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading products...</span>
                </div>
                <p class="mt-2 text-muted">Loading products...</p>
            </div>
        `;

        try {
            const response = await ApiService.get('/products');
            console.log('📦 Products API raw response:', response);

            let products = this.extractProductsArray(response);
            console.log(`📦 Extracted ${products.length} products`);

            this.renderProducts(products);

        } catch (error) {
            console.error('Failed to load products:', error);
            this.showError('productsContainer', 'Unable to load products. Please try again later.');
            this.renderProducts([]);
        }
    }

    static extractProductsArray(data) {
        if (!data) return [];

        // Case 1: Direct array
        if (Array.isArray(data)) {
            return data;
        }

        // Case 2: Object with products array
        if (data.products && Array.isArray(data.products)) {
            return data.products;
        }

        // Case 3: Object with data array
        if (data.data && Array.isArray(data.data)) {
            return data.data;
        }

        // Case 4: Object with success property
        if (data.success && Array.isArray(data.products)) {
            return data.products;
        }

        if (data.success && Array.isArray(data.data)) {
            return data.data;
        }

        // Case 5: Try to find any array in the object
        if (typeof data === 'object') {
            for (let key in data) {
                if (Array.isArray(data[key])) {
                    console.log(`📦 Found products array in key: ${key}`);
                    return data[key];
                }
            }
        }

        console.warn('⚠️ Could not extract products array from response:', data);
        return [];
    }

    static renderProducts(products) {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = this.getEmptyStateHTML('products');
            return;
        }

        container.innerHTML = products.map(product => `
            <div class="col-md-4 mb-4">
                <div class="card h-100 product-card">
                    <img src="${Utils.getImageSource(product.image, product.name, 'product')}" 
                         class="card-img-top product-image" 
                         alt="${product.name}"
                         onerror="Utils.handleImageError(this, 'product')"
                         style="height: 200px; object-fit: cover;">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${this.escapeHtml(product.name)}</h5>
                        <p class="card-text flex-grow-1 text-muted">${this.escapeHtml(product.description || 'No description available')}</p>
                        <div class="mt-auto">
                            <p class="card-text h5 text-primary">${Utils.formatCurrency(product.price)}</p>
                            <button class="btn btn-primary w-100" 
                                    onclick="CartService.addToCart('${product._id}', '${this.escapeString(product.name)}', ${product.price || 0})">
                                <i class="fas fa-shopping-cart me-2"></i>Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        console.log(`✅ Loaded ${products.length} products`);
    }

    static getDefaultImage(type) {
        return AppConfig.getDefaultImages()[type] || AppConfig.getDefaultImages().product;
    }

    static escapeString(str) {
        return (str || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${message}
                    </div>
                </div>
            `;
        }
    }

    static getEmptyStateHTML(type) {
        const messages = {
            products: 'No products available at the moment. Please check back later.',
            services: 'No services available at the moment. Please check back later.',
            gifts: 'No gift packages available at the moment. Please check back later.'
        };
        return `
            <div class="col-12 text-center py-5">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    ${messages[type] || 'No items available.'}
                </div>
            </div>
        `;
    }
}

// ===== ENHANCED SERVICE MANAGER =====
class ServiceManager {
    static async loadServices() {
        const container = document.getElementById('servicesContainer');
        if (!container) {
            console.warn('⚠️ servicesContainer not found in DOM');
            return;
        }

        // Loading UI
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading services...</span>
                </div>
                <p class="mt-2 text-muted">Loading services...</p>
            </div>
        `;

        try {
            const data = await ApiService.get('/services');
            // Defensive array extraction like ProductService!
            let services = [];
            if (Array.isArray(data)) services = data;
            else if (Array.isArray(data.services)) services = data.services;
            else if (Array.isArray(data.data)) services = data.data;
            else {
                // Try to find any array property
                for (let key in data) {
                    if (Array.isArray(data[key])) {
                        services = data[key];
                        break;
                    }
                }
            }
            this.renderServices(services);
            console.log(`✅ Loaded ${services.length} services`);
        } catch (error) {
            console.error('Failed to load services:', error);
            this.showError('Unable to load services. Please try again later.');
            this.renderServices([]); // Empty state UI
        }
    }

    static renderServices(services) {
        const container = document.getElementById('servicesContainer');
        if (!container) return;

        if (services.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        container.innerHTML = services.map(service => `
            <div class="col-md-6 mb-4">
                <div class="card service-card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${this.escapeHtml(service.name)}</h5>
                        <p class="card-text text-muted">${this.escapeHtml(service.description || 'No description available')}</p>
                        <div class="service-details mb-3">
                            <small class="text-muted"><i class="fas fa-clock me-1"></i> ${service.duration || 'Not specified'}</small>
                            <small class="text-muted ms-3"><i class="fas fa-tag me-1"></i> ${service.category || 'General'}</small>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <strong class="h5 text-primary mb-0">${Utils.formatCurrency(service.price)}</strong>
                            <button class="btn btn-primary" 
                                    onclick="ServiceManager.bookService('${service._id}', '${this.escapeString(service.name)}', ${service.price}, '${service.duration || ''}')">
                                <i class="fas fa-calendar-plus me-1"></i>Book Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        console.log(`✅ Loaded ${services.length} services`);
    }

    static showError(message) {
        const container = document.getElementById('servicesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${message}
                    </div>
                    <button class="btn btn-primary mt-2" onclick="ServiceManager.loadServices()">
                        <i class="fas fa-redo me-2"></i>Try Again
                    </button>
                </div>
            `;
        }
    }

    static getEmptyStateHTML() {
        return `
            <div class="col-12 text-center">
                <div class="text-muted py-5">
                    <i class="fas fa-concierge-bell fa-3x mb-3"></i>
                    <p>No services available at the moment.</p>
                    <small>Please check back later for our service offerings.</small>
                </div>
            </div>
        `;
    }

    static escapeString(text) {
        if (!text) return '';
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    static async bookService(serviceId, serviceName, price, duration) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to book services', 'warning');
            UIHelper.showSection('login');
            return;
        }

        AppState.currentBooking = { serviceId, name: serviceName, price, duration };

        const serviceNameInput = document.getElementById('serviceName');
        const bookingForm = document.getElementById('bookingForm');
        const staffSection = document.getElementById('staffSelectionSection');

        if (serviceNameInput && bookingForm) {
            serviceNameInput.value = serviceName;
            if (typeof StaffService !== 'undefined' && StaffService.populateStaffDropdowns) {
                await StaffService.populateStaffDropdowns();
            }

            if (staffSection) staffSection.style.display = 'block';
            bookingForm.style.display = 'block';
            bookingForm.scrollIntoView({ behavior: 'smooth' });
        }
    }

    static async confirmBooking(e) {
        e.preventDefault();

        if (!AppState.currentBooking) {
            Utils.showNotification('No service selected for booking', 'error');
            return;
        }

        const date = document.getElementById('bookingDate').value;
        const time = document.getElementById('bookingTime').value;
        const assignedStaff = document.getElementById('assignedStaff').value;
        const specialRequests = document.getElementById('specialRequests').value;

        if (!date || !time || !assignedStaff) {
            Utils.showNotification('Please select date, time, and staff member for your booking', 'warning');
            return;
        }

        try {
            const bookingData = {
                service: AppState.currentBooking.serviceId,
                date,
                time,
                assignedStaff,
                specialRequests: specialRequests || '',
                status: 'confirmed'
            };

            await ApiService.post('/bookings', bookingData);

            document.getElementById('bookingDetailsForm').reset();
            document.getElementById('bookingForm').style.display = 'none';
            document.getElementById('staffSelectionSection').style.display = 'none';
            AppState.currentBooking = null;

            Utils.showNotification('Booking confirmed! We look forward to seeing you.', 'success');

        } catch (error) {
            console.error('Booking error details:', error);
            Utils.showNotification('Failed to create booking: ' + error.message, 'error');
        }
    }

    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ===== ENHANCED GIFT SERVICE =====
class GiftService {
    static async loadGiftPackages() {
        const container = document.getElementById('giftPackagesContainer');
        if (!container) {
            console.warn('⚠️ giftPackagesContainer not found in DOM');
            return;
        }

        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading gift packages...</span>
                </div>
                <p class="mt-2 text-muted">Loading gift packages...</p>
            </div>
        `;

        try {
            const data = await ApiService.get('/gift-packages');
            // Defensive extraction as with products/services
            let giftPackages = [];
            if (Array.isArray(data)) giftPackages = data;
            else if (Array.isArray(data.giftPackages)) giftPackages = data.giftPackages;
            else if (Array.isArray(data.data)) giftPackages = data.data;
            else {
                for (let key in data) {
                    if (Array.isArray(data[key])) {
                        giftPackages = data[key];
                        break;
                    }
                }
            }
            this.renderGiftPackages(giftPackages);
            console.log(`✅ Loaded ${giftPackages.length} gift packages`);
        } catch (error) {
            console.error('Failed to load gift packages:', error);
            this.showError('Unable to load gift packages. Please try again later.');
            this.renderGiftPackages([]);
        }
    }

    static renderGiftPackages(giftPackages) {
        const container = document.getElementById('giftPackagesContainer');
        if (!container) return;

        if (giftPackages.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        container.innerHTML = giftPackages.map(gift => {
            const includesList = Array.isArray(gift.includes)
                ? gift.includes.map(item => `<li class="text-muted">${this.escapeHtml(item)}</li>`).join('')
                : `<li class="text-muted">${this.escapeHtml(gift.description || 'No details available')}</li>`;

            return `
                <div class="col-md-4 mb-4">
                    <div class="card h-100 gift-card">
                        <img src="${Utils.getImageSource(gift.image, gift.name, 'gift')}" 
                             class="card-img-top" 
                             alt="${gift.name}"
                             onerror="Utils.handleImageError(this, 'gift')"
                             style="height: 200px; object-fit: cover;">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${this.escapeHtml(gift.name)}</h5>
                            <p class="card-text flex-grow-1 text-muted">${this.escapeHtml(gift.description || 'No description available')}</p>
                            <div class="mb-3">
                                <strong class="text-primary">Includes:</strong>
                                <ul class="mt-2 ps-3">
                                    ${includesList}
                                </ul>
                            </div>
                            <div class="mt-auto">
                                <p class="card-text h5 text-primary">From ${Utils.formatCurrency(gift.basePrice || gift.price)}</p>
                                <button class="btn btn-primary w-100" 
                                        onclick="GiftService.customizeGift('${gift._id}', '${this.escapeString(gift.name)}')">
                                    <i class="fas fa-gift me-2"></i>Customize Gift
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        console.log(`✅ Loaded ${giftPackages.length} gift packages`);
    }

    static showError(message) {
        const container = document.getElementById('giftPackagesContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${message}
                    </div>
                    <button class="btn btn-primary mt-2" onclick="GiftService.loadGiftPackages()">
                        <i class="fas fa-redo me-2"></i>Try Again
                    </button>
                </div>
            `;
        }
    }

    static getEmptyStateHTML() {
        return `
            <div class="col-12 text-center">
                <div class="text-muted py-5">
                    <i class="fas fa-gift fa-3x mb-3"></i>
                    <p>No gift packages available at the moment.</p>
                    <small>Please check back later for special gift offerings.</small>
                </div>
            </div>
        `;
    }

    static escapeString(text) {
        if (!text) return '';
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    static customizeGift(giftId, giftName) {
        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to create gift packages', 'warning');
            UIHelper.showSection('login');
            return;
        }

        AppState.currentGift = { giftId, name: giftName };

        const giftPackageInput = document.getElementById('giftPackage');
        const giftCustomization = document.getElementById('giftCustomization');
        const giftStaffSection = document.getElementById('giftStaffSection');

        if (giftPackageInput && giftCustomization) {
            giftPackageInput.value = giftName;
            if (typeof StaffService !== 'undefined' && StaffService.populateGiftStaffDropdown) {
                StaffService.populateGiftStaffDropdown();
            }

            if (giftStaffSection) giftStaffSection.style.display = 'block';
            giftCustomization.style.display = 'block';
            giftCustomization.scrollIntoView({ behavior: 'smooth' });
        }
    }

    static async createGift(e) {
        e.preventDefault();

        const recipientName = document.getElementById('recipientName').value.trim();
        const recipientEmail = document.getElementById('recipientEmail').value.trim();
        const giftMessage = document.getElementById('giftMessage').value.trim();
        const deliveryDate = document.getElementById('deliveryDate').value;
        const assignedStaff = document.getElementById('giftStaff').value;

        if (!recipientName || !recipientEmail || !deliveryDate) {
            Utils.showNotification('Please fill in all required fields: Recipient Name, Recipient Email, and Delivery Date', 'warning');
            return;
        }

        if (!Utils.validateEmail(recipientEmail)) {
            Utils.showNotification('Please enter a valid recipient email address', 'warning');
            return;
        }

        try {
            const giftOrderData = {
                giftPackage: AppState.currentGift.giftId,
                recipientName,
                recipientEmail,
                message: giftMessage || '',
                deliveryDate,
                assignedStaff: assignedStaff || null
            };

            await ApiService.post('/gift-orders', giftOrderData);

            Utils.showNotification(`Gift package created for ${recipientName}! An email will be sent to ${recipientEmail} with the gift details.`, 'success');

            document.getElementById('giftCustomizationForm').reset();
            document.getElementById('giftCustomization').style.display = 'none';
            document.getElementById('giftStaffSection').style.display = 'none';
            AppState.currentGift = null;

        } catch (error) {
            Utils.showNotification('Failed to create gift order: ' + error.message, 'error');
        }
    }

    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ===== ENHANCED STAFF SERVICE WITH FALLBACKS =====
class StaffService {
    static async loadStaffMembers() {
        try {
            console.log('👥 Loading staff members from API...');

            // Try to get staff from the dedicated staff endpoint
            const staffResponse = await ApiService.get('/users/staff');

            if (staffResponse && Array.isArray(staffResponse)) {
                console.log(`✅ Loaded ${staffResponse.length} staff members from API`);
                return staffResponse;
            } else if (staffResponse && staffResponse.users && Array.isArray(staffResponse.users)) {
                console.log(`✅ Loaded ${staffResponse.users.length} staff members from API (nested)`);
                return staffResponse.users;
            } else if (staffResponse && staffResponse.data && Array.isArray(staffResponse.data)) {
                console.log(`✅ Loaded ${staffResponse.data.length} staff members from API (data)`);
                return staffResponse.data;
            } else {
                throw new Error('Invalid staff response format');
            }

        } catch (error) {
            console.log('❌ Staff endpoint not available, using fallback data:', error.message);

            // Fallback: return mock staff data
            return [
                { _id: '1', name: 'Sarah Johnson', role: 'staff', email: 'sarah@tasselgroup.com' },
                { _id: '2', name: 'Mike Wilson', role: 'staff', email: 'mike@tasselgroup.com' },
                { _id: '3', name: 'Emily Brown', role: 'staff', email: 'emily@tasselgroup.com' },
                { _id: '4', name: 'David Smith', role: 'staff', email: 'david@tasselgroup.com' }
            ];
        }

    }

    static async handleProfileUpdate(e) {
        e.preventDefault();

        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to update profile', 'error');
            return;
        }

        try {
            const formData = {
                name: document.getElementById('profileFullName')?.value.trim() || '',
                email: document.getElementById('profileEmailInput')?.value.trim() || '',
                phone: document.getElementById('profilePhone')?.value.trim() || '',
                address: document.getElementById('profileAddress')?.value.trim() || ''
            };

            console.log('📝 Updating profile with data:', formData);

            // Validation
            if (!formData.name || !formData.email) {
                Utils.showNotification('Name and email are required', 'warning');
                return;
            }

            if (!Utils.validateEmail(formData.email)) {
                Utils.showNotification('Please enter a valid email address', 'warning');
                return;
            }

            Utils.showNotification('Updating profile...', 'info');

            // Update via API - try different endpoints
            let result;
            try {
                result = await ApiService.patch('/auth/profile', formData);
            } catch (error) {
                console.log('Trying alternative profile endpoint...');
                result = await ApiService.patch('/users/profile', formData);
            }

            if (result && (result.success || result.user)) {
                // Update local state
                const updatedUser = result.user || result;
                AppState.currentUser = { ...AppState.currentUser, ...updatedUser };
                localStorage.setItem('currentUser', JSON.stringify(AppState.currentUser));

                // Update UI
                this.updateUIForUser();
                await this.loadProfileData(); // Reload profile data to reflect changes
                Utils.showNotification('Profile updated successfully!', 'success');
            } else {
                throw new Error(result?.message || 'Failed to update profile');
            }

        } catch (error) {
            console.error('Profile update error:', error);
            Utils.showNotification('Failed to update profile: ' + error.message, 'error');
        }
    }

    static async handlePasswordChange(e) {
        e.preventDefault();

        if (!AppState.currentUser) {
            Utils.showNotification('Please log in to change password', 'error');
            return;
        }

        try {
            const currentPassword = document.getElementById('currentPassword')?.value || '';
            const newPassword = document.getElementById('newPassword')?.value || '';
            const confirmPassword = document.getElementById('confirmPassword')?.value || '';

            console.log('🔐 Processing password change...');

            // Validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                Utils.showNotification('All password fields are required', 'warning');
                return;
            }

            if (newPassword !== confirmPassword) {
                Utils.showNotification('New passwords do not match', 'warning');
                return;
            }

            if (newPassword.length < 6) {
                Utils.showNotification('New password must be at least 6 characters long', 'warning');
                return;
            }

            Utils.showNotification('Changing password...', 'info');

            const passwordData = {
                currentPassword: currentPassword,
                newPassword: newPassword
            };

            // Change password via API
            let result;
            try {
                result = await ApiService.patch('/auth/change-password', passwordData);
            } catch (error) {
                console.log('Trying alternative password endpoint...');
                result = await ApiService.patch('/users/change-password', passwordData);
            }

            if (result && result.success) {
                // Clear password fields
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';

                Utils.showNotification('Password changed successfully!', 'success');
            } else {
                throw new Error(result?.message || 'Failed to change password');
            }

        } catch (error) {
            console.error('Password change error:', error);
            Utils.showNotification('Failed to change password: ' + error.message, 'error');
        }
    }

    static async populateStaffDropdowns() {
        const dropdownSelectors = ['#cartStaff', '#assignedStaff', '#giftStaff'];

        try {
            const staffMembers = await this.loadStaffMembers();
            console.log(`👥 Populating ${dropdownSelectors.length} dropdowns with ${staffMembers.length} staff members`);

            dropdownSelectors.forEach(selector => {
                const dropdown = document.querySelector(selector);
                if (dropdown) {
                    dropdown.innerHTML = '<option value="">Select staff member</option>' +
                        staffMembers.map(staff =>
                            `<option value="${staff._id}">${staff.name}</option>`
                        ).join('');

                    if (selector === '#cartStaff') {
                        const cartStaffSection = document.getElementById('cartStaffSection');
                        if (cartStaffSection && staffMembers.length > 0) {
                            cartStaffSection.style.display = 'block';
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error populating staff dropdowns:', error);
        }
    }

    static async populateGiftStaffDropdown() {
        try {
            const staffMembers = await this.loadStaffMembers();
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
            }
        } catch (error) {
            console.error('Failed to populate gift staff dropdown:', error);
        }
    }
}

// ===== DASHBOARD SERVICE =====
class DashboardService {
    static async loadDashboard() {
        if (!AppState.currentUser) return;

        console.log('🚀 Loading dashboard for:', AppState.currentUser.role);

        try {
            // For staff users, try staff endpoint but fallback to customer data
            if (AppState.currentUser.role === 'staff') {
                try {
                    const dashboardData = await ApiService.get('/dashboard/staff');
                    this.displayStaffDashboard(dashboardData);
                } catch (error) {
                    console.log('Staff dashboard failed, loading customer view:', error);
                    // Fallback to customer dashboard
                    await this.loadCustomerDashboard();
                }
            } else if (AppState.currentUser.role === 'admin') {
                // ... admin code
            } else {
                await this.loadCustomerDashboard();
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.displayFallbackDashboard();
        }
    }

    static initializeChartsWithData(dashboardData) {
        // Initialize charts with actual data from dashboard
        if (dashboardData.monthlyRevenue) {
            ChartHelper.updateRevenueChart(dashboardData.monthlyRevenue);
        }

        if (dashboardData.staffPerformance) {
            ChartHelper.updateStaffPerformanceChart(dashboardData.staffPerformance);
        }

        if (dashboardData.popularServices) {
            ChartHelper.updateServicesChart(dashboardData.popularServices);
        }

        // If no chart data available, show sample data for demonstration
        if (!dashboardData.monthlyRevenue && !dashboardData.staffPerformance && !dashboardData.popularServices) {
            this.showSampleCharts();
        }
    }

    static showSampleCharts() {
        // Sample data for demonstration when no real data is available
        const sampleMonthlyRevenue = {
            '2024-01': 15000,
            '2024-02': 18000,
            '2024-03': 22000,
            '2024-04': 19000,
            '2024-05': 25000,
            '2024-06': 28000
        };

        const sampleStaffPerformance = [
            { name: 'John Smith', totalRevenue: 12000 },
            { name: 'Sarah Johnson', totalRevenue: 9500 },
            { name: 'Mike Wilson', totalRevenue: 7800 },
            { name: 'Emily Brown', totalRevenue: 6500 }
        ];

        const samplePopularServices = [
            { name: 'Spa Treatment', count: 45 },
            { name: 'Hair Styling', count: 32 },
            { name: 'Manicure', count: 28 },
            { name: 'Massage', count: 25 },
            { name: 'Facial', count: 20 }
        ];

        ChartHelper.updateRevenueChart(sampleMonthlyRevenue);
        ChartHelper.updateStaffPerformanceChart(sampleStaffPerformance);
        ChartHelper.updateServicesChart(samplePopularServices);
    }

    static displayFallbackDashboard() {
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('staffDashboard').style.display = 'none';
        document.getElementById('customerDashboard').style.display = 'block';

        // Show basic customer dashboard with limited functionality
        const stats = {
            'customerOrders': '0',
            'customerBookings': '0',
            'customerGifts': '0',
            'customerSpent': Utils.formatCurrency(0)
        };

        Object.entries(stats).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Show sample charts in fallback mode
        this.showSampleCharts();

        Utils.showNotification('Dashboard data is currently unavailable. Please try again later.', 'info');
    }

    static displayAdminDashboard(data) {
        if (!data.success) {
            this.displayFallbackDashboard();
            return;
        }

        // Make sure admin dashboard is visible
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('staffDashboard').style.display = 'none';
        document.getElementById('customerDashboard').style.display = 'none';

        // Update stats
        this.updateElementText('totalUsers', data.stats.totalUsers);
        this.updateElementText('totalProducts', data.stats.totalProducts);
        this.updateElementText('totalServices', data.stats.totalServices);
        this.updateElementText('totalBookings', data.stats.totalBookings);
        this.updateElementText('totalOrders', data.stats.totalOrders);
        this.updateElementText('totalGiftOrders', data.stats.totalGiftOrders);
        this.updateElementText('totalRevenue', `R ${data.stats.totalRevenue}`);

        console.log('📊 Admin dashboard stats updated');

        // Check for unassigned items when dashboard loads
        setTimeout(() => {
            AdminNotificationService.checkUnassignedItems();
        }, 2000);

        // Load management tables after a short delay to ensure DOM is ready
        setTimeout(() => {
            AdminService.loadAdminManagementTables();
        }, 300);
    }

    static updateElementText(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Element ${elementId} not found for dashboard update`);
        }
    }

    static displayStaffDashboard(data) {
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('staffDashboard').style.display = 'block';
        document.getElementById('customerDashboard').style.display = 'none';

        const stats = {
            'staffSales': data.stats?.totalSales?.toLocaleString() || '0',
            'staffClients': data.stats?.totalClients?.toLocaleString() || '0',
            'staffHours': data.stats?.totalHours?.toLocaleString() || '0',
            'staffCommission': Utils.formatCurrency(data.stats?.totalCommission || 0)
        };

        Object.entries(stats).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    static async loadCustomerDashboard() {
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('staffDashboard').style.display = 'none';
        document.getElementById('customerDashboard').style.display = 'block';

        try {
            const [orders, bookings, giftOrders] = await Promise.allSettled([
                ApiService.get('/dashboard/orders/my-orders'),
                ApiService.get('/dashboard/bookings/my-bookings'),
                ApiService.get('/dashboard/gift-orders/my-gifts')
            ]);

            // Handle potential failures gracefully
            const ordersData = orders.status === 'fulfilled' ? orders.value : [];
            const bookingsData = bookings.status === 'fulfilled' ? bookings.value : [];
            const giftsData = giftOrders.status === 'fulfilled' ? giftOrders.value : [];

            this.updateCustomerDashboard(ordersData, bookingsData, giftsData);
        } catch (error) {
            console.error('Failed to load customer dashboard:', error);
            this.updateCustomerDashboard([], [], []);
        }
    }

    static updateCustomerDashboard(orders, bookings, gifts) {
        const ordersCount = Array.isArray(orders) ? orders.length : 0;
        const bookingsCount = Array.isArray(bookings) ? bookings.length : 0;
        const giftsCount = Array.isArray(gifts) ? gifts.length : 0;

        document.getElementById('customerOrders').textContent = ordersCount;
        document.getElementById('customerBookings').textContent = bookingsCount;
        document.getElementById('customerGifts').textContent = giftsCount;

        const totalSpent = this.calculateTotalSpent(orders, bookings, gifts);
        document.getElementById('customerSpent').textContent = Utils.formatCurrency(totalSpent);
    }

    static calculateTotalSpent(orders, bookings, gifts) {
        let total = 0;

        if (Array.isArray(orders)) {
            orders.forEach(order => total += order.finalTotal || order.total || 0);
        }
        if (Array.isArray(bookings)) {
            bookings.forEach(booking => total += booking.service?.price || booking.price || 0);
        }
        if (Array.isArray(gifts)) {
            gifts.forEach(gift => total += gift.price || gift.total || gift.giftPackage?.basePrice || 0);
        }

        return total;
    }

    static calculateTotalRevenue(orders, bookings, giftOrders) {
        let total = 0;

        // Calculate from orders (only include completed/paid orders)
        if (Array.isArray(orders)) {
            orders.forEach(order => {
                const status = order.status?.toLowerCase();
                if (['completed', 'paid', 'delivered'].includes(status)) {
                    total += order.finalTotal || order.total || 0;
                }
            });
        }

        // Calculate from bookings (only include completed bookings)
        if (Array.isArray(bookings)) {
            bookings.forEach(booking => {
                const status = booking.status?.toLowerCase();
                if (['completed', 'confirmed'].includes(status)) {
                    total += booking.service?.price || booking.price || 0;
                }
            });
        }

        // Calculate from gift orders (only include delivered/completed gifts)
        if (Array.isArray(giftOrders)) {
            giftOrders.forEach(gift => {
                const status = gift.status?.toLowerCase();
                if (['delivered', 'completed', 'paid'].includes(status)) {
                    total += gift.price || gift.total || gift.giftPackage?.basePrice || 0;
                }
            });
        }

        return total;
    }


}

// ===== ADMIN NOTIFICATION SERVICE =====
class AdminNotificationService {
    static async checkUnassignedItems() {
        if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
            return;
        }

        try {
            const [orders, bookings, giftOrders] = await Promise.allSettled([
                ApiService.get('/orders?limit=100'),
                ApiService.get('/bookings?limit=100'),
                ApiService.get('/gift-orders?limit=100')
            ]);

            const ordersData = orders.status === 'fulfilled' ? orders.value : [];
            const bookingsData = bookings.status === 'fulfilled' ? bookings.value : [];
            const giftsData = giftOrders.status === 'fulfilled' ? giftOrders.value : [];

            const unassignedStats = this.calculateUnassignedStats(ordersData, bookingsData, giftsData);

            if (unassignedStats.hasUnassigned) {
                this.showAdminNotification(unassignedStats);
            }

        } catch (error) {
            console.error('Error checking unassigned items:', error);
        }
    }

    static calculateUnassignedStats(orders, bookings, gifts) {
        // Extract arrays from response objects
        const ordersArray = Array.isArray(orders) ? orders : (orders.orders || orders.data || []);
        const bookingsArray = Array.isArray(bookings) ? bookings : (bookings.bookings || bookings.data || []);
        const giftsArray = Array.isArray(gifts) ? gifts : (gifts.giftOrders || gifts.data || []);

        const unassignedOrders = ordersArray.filter(order =>
            !order.processedBy && !order.assignedStaff &&
            ['pending', 'confirmed', 'processing'].includes(order.status)
        ).length;

        const unassignedBookings = bookingsArray.filter(booking =>
            !booking.staff && !booking.assignedStaff &&
            ['pending', 'confirmed'].includes(booking.status)
        ).length;

        const unassignedGifts = giftsArray.filter(gift =>
            !gift.assignedStaff &&
            ['pending', 'confirmed', 'processing'].includes(gift.status)
        ).length;

        const totalUnassigned = unassignedOrders + unassignedBookings + unassignedGifts;
        const hasUnassigned = totalUnassigned > 0;

        return {
            hasUnassigned,
            totalUnassigned,
            unassignedOrders,
            unassignedBookings,
            unassignedGifts,
            orders: unassignedOrders,
            bookings: unassignedBookings,
            gifts: unassignedGifts
        };
    }

    static showAdminNotification(stats) {
        const notification = document.createElement('div');
        notification.className = 'alert alert-warning alert-dismissible fade show position-fixed';
        notification.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 400px; max-width: 500px;';

        let message = `⚠️ <strong>Staff Assignment Needed:</strong> `;
        const items = [];

        if (stats.unassignedOrders > 0) {
            items.push(`${stats.unassignedOrders} order${stats.unassignedOrders !== 1 ? 's' : ''}`);
        }
        if (stats.unassignedBookings > 0) {
            items.push(`${stats.unassignedBookings} booking${stats.unassignedBookings !== 1 ? 's' : ''}`);
        }
        if (stats.unassignedGifts > 0) {
            items.push(`${stats.unassignedGifts} gift order${stats.unassignedGifts !== 1 ? 's' : ''}`);
        }

        message += items.join(', ') + ' need staff assignment.';

        notification.innerHTML = `
        <div class="d-flex align-items-start">
            <i class="fas fa-exclamation-triangle me-2 mt-1"></i>
            <div class="flex-grow-1">
                <div class="fw-bold mb-1">${message}</div>
                <small class="text-muted">Assign staff to ensure proper revenue tracking.</small>
                <div class="mt-2 d-flex flex-wrap gap-2">
                    <button class="btn btn-sm btn-primary" onclick="AdminNotificationService.showBulkAssignment(${JSON.stringify(stats).replace(/"/g, '&quot;')})">
                        <i class="fas fa-users me-1"></i>Bulk Assign
                    </button>
                    <button class="btn btn-sm btn-outline-primary" onclick="AdminNotificationService.goToDashboard()">
                        <i class="fas fa-tachometer-alt me-1"></i>Dashboard
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="AdminNotificationService.dismissNotification(this)">
                        <i class="fas fa-times me-1"></i>Dismiss
                    </button>
                </div>
            </div>
        </div>
    `;

        // Remove any existing admin notifications
        document.querySelectorAll('.alert.position-fixed[style*="top: 80px"]').forEach(alert => {
            alert.remove();
        });

        document.body.appendChild(notification);

        // Auto-dismiss after 20 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 20000);
    }

    static async showBulkAssignment(stats) {
        // Ensure modal exists
        ensureBulkAssignmentModalExists();

        const modal = new bootstrap.Modal(document.getElementById('bulkAssignmentModal'));
        const modalTitle = document.getElementById('bulkModalTitle');

        // Store stats for later use
        document.getElementById('bulkAssignmentForm').dataset.stats = JSON.stringify(stats);

        modalTitle.textContent = `Bulk Staff Assignment - ${stats.totalUnassigned} Items`;

        // Populate staff dropdown
        await this.populateBulkStaffDropdown();

        // Load items for bulk assignment
        await this.loadBulkAssignmentItems();

        modal.show();

        // Remove the notification when opening bulk modal
        document.querySelectorAll('.alert.position-fixed[style*="top: 80px"]').forEach(alert => {
            alert.remove();
        });
    }

    static async populateBulkStaffDropdown() {
        const staffSelect = document.getElementById('bulkStaff');
        if (!staffSelect) return;

        try {
            const staffMembers = await StaffService.loadStaffMembers();
            staffSelect.innerHTML = '<option value="">Select staff member...</option>' +
                staffMembers.map(staff =>
                    `<option value="${staff._id}">${staff.name}</option>`
                ).join('');
        } catch (error) {
            console.error('Failed to load staff for bulk assignment:', error);
            staffSelect.innerHTML = '<option value="">Failed to load staff</option>';
        }
    }

    static async loadBulkAssignmentItems() {
        const itemsList = document.getElementById('bulkItemsList');
        const selectedCount = document.getElementById('selectedCount');
        if (!itemsList || !selectedCount) return;

        try {
            const itemType = document.getElementById('bulkItemType')?.value || 'all';
            const selectedStatuses = this.getSelectedStatuses();

            const [orders, bookings, gifts] = await Promise.allSettled([
                ApiService.get('/orders?limit=100'),
                ApiService.get('/bookings?limit=100'),
                ApiService.get('/gift-orders?limit=100')
            ]);

            const ordersData = orders.status === 'fulfilled' ? orders.value : [];
            const bookingsData = bookings.status === 'fulfilled' ? bookings.value : [];
            const giftsData = gifts.status === 'fulfilled' ? gifts.value : [];

            // Extract arrays and filter unassigned items
            const ordersArray = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []);
            const bookingsArray = Array.isArray(bookingsData) ? bookingsData : (bookingsData.bookings || bookingsData.data || []);
            const giftsArray = Array.isArray(giftsData) ? giftsData : (giftsData.giftOrders || giftsData.data || []);

            let unassignedItems = [];

            if (itemType === 'all' || itemType === 'orders') {
                unassignedItems.push(...this.filterUnassignedItems(ordersArray, 'order', selectedStatuses));
            }

            if (itemType === 'all' || itemType === 'bookings') {
                unassignedItems.push(...this.filterUnassignedItems(bookingsArray, 'booking', selectedStatuses));
            }

            if (itemType === 'all' || itemType === 'gifts') {
                unassignedItems.push(...this.filterUnassignedItems(giftsArray, 'gift', selectedStatuses));
            }

            // Display items
            if (unassignedItems.length === 0) {
                itemsList.innerHTML = '<div class="text-muted text-center py-3">No unassigned items found</div>';
            } else {
                itemsList.innerHTML = unassignedItems.map(item => `
                <div class="form-check mb-2">
                    <input class="form-check-input bulk-item-checkbox" type="checkbox" value="${item.id}" data-type="${item.type}" checked>
                    <label class="form-check-label small">
                        <strong>${item.type.toUpperCase()}</strong> - ${item.name}
                        <br><small class="text-muted">${item.date} • ${item.status}</small>
                    </label>
                </div>
            `).join('');
            }

            selectedCount.textContent = `${unassignedItems.length} items found`;

        } catch (error) {
            console.error('Error loading bulk assignment items:', error);
            itemsList.innerHTML = '<div class="text-danger text-center py-3">Failed to load items</div>';
        }
    }

    static filterUnassignedItems(items, type, statuses) {
        return items.filter(item => {
            // Check if item is unassigned
            const isUnassigned =
                (type === 'order' && !item.processedBy && !item.assignedStaff) ||
                (type === 'booking' && !item.staff && !item.assignedStaff) ||
                (type === 'gift' && !item.assignedStaff);

            // Check if status matches selected statuses
            const statusMatches = statuses.includes(item.status);

            return isUnassigned && statusMatches;
        }).map(item => ({
            id: item._id,
            type: type,
            name: this.getItemDisplayName(item, type),
            date: this.getFormattedDate(item, type),
            status: item.status
        }));
    }

    static getItemDisplayName(item, type) {
        switch (type) {
            case 'order':
                return `Order #${item._id.toString().slice(-6)} - ${item.user?.name || 'Customer'}`;
            case 'booking':
                return `Booking - ${item.service?.name || 'Service'} (${item.user?.name || 'Customer'})`;
            case 'gift':
                return `Gift - ${item.giftPackage?.name || 'Package'} for ${item.recipientName}`;
            default:
                return 'Unknown Item';
        }
    }

    static getFormattedDate(item, type) {
        const date = item.createdAt || item.date || new Date();
        return new Date(date).toLocaleDateString();
    }

    static getSelectedStatuses() {
        const statuses = [];
        if (document.getElementById('statusPending')?.checked) statuses.push('pending');
        if (document.getElementById('statusConfirmed')?.checked) statuses.push('confirmed');
        if (document.getElementById('statusProcessing')?.checked) statuses.push('processing');
        return statuses;
    }

    static goToDashboard() {
        UIHelper.showSection('dashboard');
        // Remove the notification when going to dashboard
        document.querySelectorAll('.alert.position-fixed[style*="top: 80px"]').forEach(alert => {
            alert.remove();
        });
    }

    static dismissNotification(button) {
        const notification = button.closest('.alert');
        if (notification) {
            notification.remove();
        }
    }

    static async handleBulkAssignment(e) {
        e.preventDefault();

        const staffId = document.getElementById('bulkStaff')?.value;

        if (!staffId) {
            Utils.showNotification('Please select a staff member', 'warning');
            return;
        }

        const selectedItems = Array.from(document.querySelectorAll('.bulk-item-checkbox:checked'));

        if (selectedItems.length === 0) {
            Utils.showNotification('Please select at least one item to assign', 'warning');
            return;
        }

        const assignBtn = document.getElementById('bulkAssignBtn');
        const originalText = assignBtn.innerHTML;
        assignBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Assigning...';
        assignBtn.disabled = true;

        try {
            let successCount = 0;
            let errorCount = 0;

            // Process items in batches to avoid overwhelming the server
            for (let i = 0; i < selectedItems.length; i++) {
                const checkbox = selectedItems[i];
                const itemId = checkbox.value;
                const itemType = checkbox.dataset.type;

                try {
                    await this.assignSingleItem(itemId, itemType, staffId);
                    successCount++;

                    // Update progress
                    assignBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i>Assigning... (${successCount}/${selectedItems.length})`;

                } catch (error) {
                    console.error(`Failed to assign ${itemType} ${itemId}:`, error);
                    errorCount++;
                }

                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Show results
            if (successCount > 0) {
                Utils.showNotification(`Successfully assigned ${successCount} items to staff`, 'success');
            }
            if (errorCount > 0) {
                Utils.showNotification(`${errorCount} items failed to assign`, 'error');
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('bulkAssignmentModal'));
            if (modal) modal.hide();

            // Reload dashboard and tables
            setTimeout(() => {
                if (AppState.currentUser?.role === 'admin') {
                    DashboardService.loadDashboard();
                    AdminService.loadAdminManagementTables();
                }
            }, 1000);

        } catch (error) {
            console.error('Bulk assignment failed:', error);
            Utils.showNotification('Bulk assignment failed: ' + error.message, 'error');
        } finally {
            assignBtn.innerHTML = originalText;
            assignBtn.disabled = false;
        }
    }

    static async assignSingleItem(itemId, itemType, staffId) {
        let endpoint = '';
        let data = {};

        switch (itemType) {
            case 'order':
                endpoint = `/orders/${itemId}`;
                data = { processedBy: staffId };
                break;
            case 'booking':
                endpoint = `/bookings/${itemId}`;
                data = { staff: staffId };
                break;
            case 'gift':
                endpoint = `/gift-orders/${itemId}`;
                data = { assignedStaff: staffId };
                break;
        }

        await ApiService.patch(endpoint, data);
    }

    // Check for unassigned items periodically (every 5 minutes)
    static startPeriodicChecking() {
        if (AppState.currentUser?.role === 'admin') {
            // Check immediately
            this.checkUnassignedItems();

            // Then check every 5 minutes
            setInterval(() => {
                this.checkUnassignedItems();
            }, 5 * 60 * 1000); // 5 minutes
        }
    }
}



function ensureBulkAssignmentModalExists() {
    if (document.getElementById('bulkAssignmentModal')) {
        return;
    }

    const modalHTML = `
    <div class="modal fade" id="bulkAssignmentModal" tabindex="-1" aria-labelledby="bulkModalTitle" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="bulkModalTitle">Bulk Staff Assignment</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <form id="bulkAssignmentForm">
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="bulkItemType" class="form-label">Item Type</label>
                                <select class="form-select" id="bulkItemType" required>
                                    <option value="">Select type...</option>
                                    <option value="orders">Orders</option>
                                    <option value="bookings">Bookings</option>
                                    <option value="gifts">Gift Orders</option>
                                    <option value="all">All Types</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label for="bulkStaff" class="form-label">Assign Staff</label>
                                <select class="form-select" id="bulkStaff" required>
                                    <option value="">Select staff member...</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Filter by Status</label>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" value="pending" id="statusPending" checked>
                                <label class="form-check-label" for="statusPending">Pending</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" value="confirmed" id="statusConfirmed" checked>
                                <label class="form-check-label" for="statusConfirmed">Confirmed</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" value="processing" id="statusProcessing" checked>
                                <label class="form-check-label" for="statusProcessing">Processing</label>
                            </div>
                        </div>
                        
                        <div class="selected-items-section">
                            <h6>Items to be Assigned:</h6>
                            <div id="bulkItemsList" class="border rounded p-2" style="max-height: 200px; overflow-y: auto;">
                                <div class="text-muted text-center py-3">No items selected</div>
                            </div>
                            <small class="text-muted" id="selectedCount">0 items selected</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="bulkAssignBtn">
                            <i class="fas fa-users me-1"></i>Assign to All Selected
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners - FIXED THIS LINE
    const bulkForm = document.getElementById('bulkAssignmentForm');
    if (bulkForm) {
        bulkForm.addEventListener('submit', (e) => AdminNotificationService.handleBulkAssignment(e));
    }

    const itemTypeSelect = document.getElementById('bulkItemType');
    if (itemTypeSelect) {
        itemTypeSelect.addEventListener('change', () => AdminNotificationService.loadBulkAssignmentItems());
    }

    // Add status filter change listeners
    ['statusPending', 'statusConfirmed', 'statusProcessing'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => AdminNotificationService.loadBulkAssignmentItems());
        }
    });
}

// ===== CHART HELPER =====
class ChartHelper {
    static initializeCharts() {
        // Clear existing charts
        Object.values(AppState.chartInstances).forEach(chart => {
            if (chart) {
                try {
                    chart.destroy();
                } catch (e) {
                    console.log('Error destroying chart:', e);
                }
            }
        });

        AppState.chartInstances = {
            revenueChart: null,
            staffPerformanceChart: null,
            servicesChart: null
        };

        // Create canvas elements if they don't exist
        this.ensureChartCanvases();
    }

    static ensureChartCanvases() {
        const chartContainers = [
            { id: 'revenueChart', type: 'line' },
            { id: 'staffPerformanceChart', type: 'bar' },
            { id: 'servicesChart', type: 'doughnut' }
        ];

        chartContainers.forEach(({ id, type }) => {
            let canvas = document.getElementById(id);
            if (!canvas) {
                console.log(`Creating missing canvas for ${id}`);
                // Find the chart container and add canvas
                const container = document.querySelector(`[data-chart="${id}"]`) ||
                    document.querySelector(`.chart-container:has(> #${id})`);
                if (container) {
                    canvas = document.createElement('canvas');
                    canvas.id = id;
                    canvas.width = 400;
                    canvas.height = 300;
                    container.appendChild(canvas);
                }
            }

            // Ensure canvas has proper styling
            if (canvas) {
                canvas.style.maxWidth = '100%';
                canvas.style.height = '300px';
            }
        });
    }

    // EDIT: Always destroy chart before creating new one!
    static updateRevenueChart(monthlyRevenue) {
        const ctx = document.getElementById('revenueChart')?.getContext('2d');
        if (!ctx) {
            console.warn('Revenue chart canvas not found');
            return;
        }

        // Destroy existing chart if present
        if (this.chartInstances.revenueChart) {
            this.chartInstances.revenueChart.destroy();
        }

        const labels = Object.keys(monthlyRevenue);
        const data = Object.values(monthlyRevenue);

        if (labels.length === 0) {
            this.showChartEmptyState('revenueChart', 'No revenue data available');
            return;
        }

        try {
            AppState.chartInstances.revenueChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Monthly Revenue (R)',
                        data: data,
                        borderColor: '#8a6d3b',
                        backgroundColor: 'rgba(138, 109, 59, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function (value) {
                                    return 'R ' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating revenue chart:', error);
        }
    }

    static updateStaffPerformanceChart(staffPerformance) {
        const ctx = document.getElementById('staffPerformanceChart')?.getContext('2d');
        if (!ctx) {
            console.warn('Staff performance chart canvas not found');
            return;
        }

        if (AppState.chartInstances.staffPerformanceChart) {
            AppState.chartInstances.staffPerformanceChart.destroy();
        }

        // If no data, show empty state
        if (!staffPerformance || staffPerformance.length === 0) {
            this.showChartEmptyState('staffPerformanceChart', 'No staff performance data available');
            return;
        }

        const labels = staffPerformance.map(staff => staff.name);
        const data = staffPerformance.map(staff => staff.totalRevenue);

        try {
            AppState.chartInstances.staffPerformanceChart = new Chart(ctx, {
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
                                callback: function (value) {
                                    return 'R ' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating staff performance chart:', error);
        }
    }

    static updateServicesChart(popularServices) {
        const ctx = document.getElementById('servicesChart')?.getContext('2d');
        if (!ctx) {
            console.warn('Services chart canvas not found');
            return;
        }

        if (AppState.chartInstances.servicesChart) {
            AppState.chartInstances.servicesChart.destroy();
        }

        // If no data, show empty state
        if (!popularServices || popularServices.length === 0) {
            this.showChartEmptyState('servicesChart', 'No services data available');
            return;
        }

        const labels = popularServices.map(service => service.name);
        const data = popularServices.map(service => service.count);

        try {
            AppState.chartInstances.servicesChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: ['#8a6d3b', '#d4af37', '#a9925d', '#c5b089', '#e6d8b8'],
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
        } catch (error) {
            console.error('Error creating services chart:', error);
        }
    }

    static showChartEmptyState(canvasId, message) {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const container = canvas.parentElement;
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-chart-bar fa-3x mb-3"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }
}



// ===== ADMIN SERVICE =====
class AdminService {
    static async loadAdminManagementTables() {
        try {
            console.log('🔍 Loading admin management tables...');

            // First, ensure admin dashboard is visible
            this.ensureAdminDashboardVisible();

            // Load all data including users
            const [ordersResponse, bookingsResponse, giftOrdersResponse, usersResponse, vouchersResponse] = await Promise.allSettled([
                ApiService.get('/orders?limit=50'),
                ApiService.get('/bookings?limit=50'),
                ApiService.get('/gift-orders?limit=50'),
                ApiService.get('/users'),
                ApiService.get('/vouchers')
            ]);

            // Process responses
            const orders = this.processResponse(ordersResponse, 'orders');
            const bookings = this.processResponse(bookingsResponse, 'bookings');
            const giftOrders = this.processResponse(giftOrdersResponse, 'giftOrders');
            const users = this.processResponse(usersResponse, 'users');
            const vouchers = this.processResponse(vouchersResponse, 'vouchers');


            console.log(`✅ Loaded: ${orders.length} orders, ${bookings.length} bookings, ${giftOrders.length} gift orders, ${users.length} users, ${vouchers.length} vouchers`);

            // Now pass vouchers to your update function:
            this.updateDashboardStats(orders, bookings, giftOrders, users, vouchers);

            // If you have a stat card for vouchers:
            this.updateStatCard('totalVouchers', vouchers.length);

            // Find and populate existing tables
            this.populateExistingTables(orders, bookings, giftOrders, vouchers);

            // Initialize charts
            this.initializeCharts(orders, bookings, giftOrders, vouchers);

            // Add click handlers for interactive stats
            this.addStatsInteractivity();

        } catch (error) {
            console.error('❌ Error loading admin data:', error);
            this.showEmptyStates();
        }
    }

    static async showVouchersManagement() {
        try {
            console.log('🎫 Loading vouchers management...');

            // Load all vouchers and users
            const [vouchers, users] = await Promise.all([
                ApiService.get('/vouchers'),
                ApiService.get('/users')
            ]);

            // Debug!
            console.log('Loaded vouchers:', vouchers);

            // Show vouchers management modal
            this.showVouchersManagementModal(vouchers, users);

        } catch (error) {
            console.error('❌ Error loading vouchers:', error);

            // If vouchers endpoint doesn't exist yet, show a modal to create the first one
            if (error.message.includes('404') || error.message.includes('vouchers')) {
                this.showVouchersManagementModal([], []);
            } else {
                alert('Failed to load vouchers data');
            }
        }
    }


    static showVouchersManagementModal(vouchers, users) {
        const now = new Date();

        console.log('Raw vouchers received by modal:', vouchers);
        vouchers.forEach(v => {
            console.log(
                `Voucher ${v._id} code=${v.code} isActive=${v.isActive} validUntil=${v.validUntil} used=${v.used} assignedTo=${v.assignedTo}`
            );
        });


        // Expired = validUntil in the past but still active and unused
        const expiredVouchers = vouchers.filter(v => new Date(v.validUntil) < now && v.isActive && !v.used);

        // Used = marked used, regardless of isActive
        const usedVouchers = vouchers.filter(v => v.used);

        // Inactive = isActive is false and not used/expired
        // At the top, be sure your filter is correct:
        const inactiveVouchers = vouchers.filter(
            v => v.isActive === false && (!v.used || v.used === 0)
        );


        // Active = active, not used, not expired
        const activeVouchers = vouchers.filter(v =>
            v.isActive &&
            !v.used &&
            new Date(v.validUntil) >= now
        );

        const assignedVouchers = vouchers.filter(v =>
            v.isActive && v.assignedTo && !v.used && new Date(v.validUntil) >= now
        );

        const unassignedVouchers = vouchers.filter(v =>
            v.isActive && !v.assignedTo && !v.used && new Date(v.validUntil) >= now
        );

        // By user type (assignments may also be used)
        const customerVouchers = vouchers.filter(v => {
            const user = users.find(u => u._id === v.assignedTo);
            return user && user.role === 'customer';
        });
        const staffVouchers = vouchers.filter(v => {
            const user = users.find(u => u._id === v.assignedTo);
            return user && user.role === 'staff';
        });


        const modalHtml = `
        <div class="modal fade" id="vouchersManagementModal" tabindex="-1" aria-labelledby="vouchersManagementModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header bg-warning text-white">
                        <h5 class="modal-title" id="vouchersManagementModalLabel">
                            <i class="fas fa-tags me-2"></i>
                            Vouchers Management
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Quick Stats -->
                        <div class="row mb-4">
                            <div class="col-md-3">
                                <div class="card text-center bg-success text-white">
                                    <div class="card-body">
                                        <h3>${assignedVouchers.length + unassignedVouchers.length}</h3>
                                        <p class="mb-0">Active Vouchers</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card text-center bg-info text-white">
                                    <div class="card-body">
                                        <h3>${assignedVouchers.length}</h3>
                                        <p class="mb-0">Assigned</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card text-center bg-secondary text-white">
                                    <div class="card-body">
                                        <h3>${unassignedVouchers.length}</h3>
                                        <p class="mb-0">Unassigned</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card text-center bg-danger text-white">
                                    <div class="card-body">
                                        <h3>${expiredVouchers.length + inactiveVouchers.length}</h3>
                                        <p class="mb-0">Inactive</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="row mb-4">
                            <div class="col-12">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h5 class="mb-0">Voucher Management</h5>
                                    <div class="btn-group">
                                        <button type="button" class="btn btn-primary" onclick="AdminService.showCreateVoucherModal()">
                                            <i class="fas fa-plus me-2"></i>Create New Voucher
                                        </button>
                                        <button type="button" class="btn btn-success" onclick="AdminService.bulkAssignVouchers()">
                                            <i class="fas fa-users me-2"></i>Bulk Assign
                                        </button>
                                        <button type="button" class="btn btn-info" onclick="AdminService.exportVouchersReport()">
                                            <i class="fas fa-download me-2"></i>Export
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tabs for different views -->
                        <ul class="nav nav-tabs" id="vouchersTabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" id="active-tab" data-bs-toggle="tab" data-bs-target="#active" type="button" role="tab">
                                    Active Vouchers (${activeVouchers.length})
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="assigned-tab" data-bs-toggle="tab" data-bs-target="#assigned" type="button" role="tab">
                                    Assigned (${assignedVouchers.length})
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="unassigned-tab" data-bs-toggle="tab" data-bs-target="#unassigned" type="button" role="tab">
                                    Unassigned (${unassignedVouchers.length + activeVouchers.length})
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="inactive-tab" data-bs-toggle="tab" data-bs-target="#inactive" type="button" role="tab">
                                    Inactive (${expiredVouchers.length + usedVouchers.length + inactiveVouchers.length})
                                </button>
                            </li>
                        </ul>

                        <div class="tab-content mt-3" id="vouchersTabContent">
                            <!-- Active Vouchers Tab -->
                            <div class="tab-pane fade show active" id="active" role="tabpanel">
                                ${this.generateVouchersTableHTML(activeVouchers, users, 'active')}
                            </div>
                            
                            <!-- Assigned Vouchers Tab -->
                            <div class="tab-pane fade" id="assigned" role="tabpanel">
                                ${this.generateVouchersTableHTML(assignedVouchers, users, 'assigned')}
                            </div>
                            
                            <!-- Unassigned Vouchers Tab -->
                            <div class="tab-pane fade" id="unassigned" role="tabpanel">
                                ${this.generateVouchersTableHTML(unassignedVouchers, users, 'unassigned')}
                            </div>
                            
                            <!-- Inactive Vouchers Tab -->
                            <div class="tab-pane fade" id="inactive" role="tabpanel">
                                ${this.generateVouchersTableHTML([...expiredVouchers, ...inactiveVouchers], users, 'inactive')}
                            </div>
                        </div>

                        <!-- User Type Breakdown -->
                        <div class="row mt-4">
                            <div class="col-md-6">
                                <div class="card">
                                    <div class="card-header">
                                        <h6 class="mb-0"><i class="fas fa-user-friends me-2"></i>Vouchers by User Type</h6>
                                    </div>
                                    <div class="card-body">
                                        <div class="table-responsive">
                                            <table class="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>User Type</th>
                                                        <th class="text-end">Count</th>
                                                        <th class="text-end">Total Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td>Customers</td>
                                                        <td class="text-end">${customerVouchers.length}</td>
                                                        <td class="text-end">${this.calculateTotalVoucherValue(customerVouchers)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Staff</td>
                                                        <td class="text-end">${staffVouchers.length}</td>
                                                        <td class="text-end">${this.calculateTotalVoucherValue(staffVouchers)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Unassigned</td>
                                                        <td class="text-end">${unassignedVouchers.length}</td>
                                                        <td class="text-end">${this.calculateTotalVoucherValue(unassignedVouchers)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card">
                                    <div class="card-header">
                                        <h6 class="mb-0"><i class="fas fa-chart-pie me-2"></i>Status Distribution</h6>
                                    </div>
                                    <div class="card-body">
                                        <div class="table-responsive">
                                            <table class="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>Status</th>
                                                        <th class="text-end">Count</th>
                                                        <th class="text-end">Percentage</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td><span class="badge bg-success">Active</span></td>
                                                        <td class="text-end">${activeVouchers.length}</td>
                                                        <td class="text-end">${vouchers.length ? ((activeVouchers.length / vouchers.length) * 100).toFixed(1) : 0}%</td>
                                                    </tr>
                                                    <tr>
                                                        <td><span class="badge bg-secondary">Expired</span></td>
                                                        <td class="text-end">${expiredVouchers.length}</td>
                                                        <td class="text-end">${vouchers.length ? ((expiredVouchers.length / vouchers.length) * 100).toFixed(1) : 0}%</td>
                                                    </tr>
                                                    <tr>
                                                        <td><span class="badge bg-info">Used</span></td>
                                                        <td class="text-end">${usedVouchers.length}</td>
                                                        <td class="text-end">${vouchers.length ? ((usedVouchers.length / vouchers.length) * 100).toFixed(1) : 0}%</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="AdminService.showCreateVoucherModal()">
                            <i class="fas fa-plus me-2"></i>Create New Voucher
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

        // Remove existing modal if any
        const existingModal = document.getElementById('vouchersManagementModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('vouchersManagementModal'));
        modal.show();
    }

    static calculateTotalVoucherValue(vouchers) {
        const total = vouchers.reduce((sum, voucher) => {
            if (voucher.discountType === 'percentage') {
                return sum + (voucher.value || 0);
            } else {
                return sum + (voucher.value || 0);
            }
        }, 0);

        return vouchers.length > 0 && vouchers[0].discountType !== 'percentage'
            ? Utils.formatCurrency(total)
            : `${total}% total`;
    }

    static showCreateVoucherModal() {
        // Generate and display a real modal form for voucher creation
        const modalHtml = `
        <div class="modal fade" id="createVoucherModal" tabindex="-1" aria-labelledby="createVoucherModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <form id="createVoucherForm">
                        <div class="modal-header">
                            <h5 class="modal-title" id="createVoucherModalLabel">Create New Voucher</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Voucher Code</label>
                                <input type="text" name="code" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Discount Type</label>
                                <select name="discountType" class="form-select">
                                    <option value="fixed">Fixed Amount</option>
                                    <option value="percentage">Percentage</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Value</label>
                                <input type="number" name="value" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Expiry Date</label>
                                <input type="date" name="expires" class="form-control" required>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Voucher</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
        // Remove existing modal and add the new one
        document.getElementById('createVoucherModal')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add submit handler
        document.getElementById('createVoucherForm').onsubmit = async (e) => {
            e.preventDefault();
            const form = e.target;
            const data = {
                code: form.code.value,
                discountType: form.discountType.value,
                value: form.value.value,
                expires: form.expires.value
            };
            try {
                await ApiService.post('/vouchers', data);
                Utils.showNotification('Voucher created!', 'success');
                bootstrap.Modal.getInstance(form.closest('.modal')).hide();
                AdminService.showVouchersManagement();
            } catch (error) {
                Utils.showNotification('Error creating voucher: ' + error.message, 'error');
            }
        };
        new bootstrap.Modal(document.getElementById('createVoucherModal')).show();
    }


    static bulkAssignVouchers() {
        // Show a modal to select users and assign a voucher (modal HTML needs to be created)
        document.getElementById('bulkAssignModal')?.remove();
        const modalHTML = `
        <div class="modal fade" id="bulkAssignModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <form id="bulkAssignForm">
                        <div class="modal-header">
                            <h5 class="modal-title">Bulk Assign Vouchers</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <label>Select users (Ctrl+Click):</label>
                            <select multiple name="userIds" class="form-select" required>
                                <!-- Option generation with JS -->
                            </select>
                            <label>Select voucher:</label>
                            <select name="voucherId" class="form-select" required>
                                <!-- Option generation with JS -->
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Assign</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        // Populate selects with users and vouchers (fetch via API)
        // ...insert JS population code here...
        document.getElementById('bulkAssignForm').onsubmit = async (e) => {
            e.preventDefault();
            const form = e.target;
            const userIds = [...form.userIds.selectedOptions].map(opt => opt.value);
            const voucherId = form.voucherId.value;
            try {
                await ApiService.post(`/vouchers/bulk-assign`, { userIds, voucherId });
                Utils.showNotification('Vouchers assigned!', 'success');
                bootstrap.Modal.getInstance(form.closest('.modal')).hide();
                AdminService.loadAdminManagementTables();
            } catch (error) {
                Utils.showNotification('Bulk assign failed: ' + error.message, 'error');
            }
        };
        new bootstrap.Modal(document.getElementById('bulkAssignModal')).show();
    }

    static async activateVoucher(voucherId) {
        try {
            await ApiService.put(`/vouchers/${voucherId}`, { isActive: true });
            Utils.showNotification('Voucher activated!', 'success');
            AdminService.loadAdminManagementTables();
        } catch (error) {
            console.log('Activate response:', response);
            console.error('Activate error:', error);
            Utils.showNotification('Activation failed: ' + error.message, 'error');
        }
    }


    static async exportVouchersReport() {
        try {
            const report = await ApiService.get('/vouchers/export');
            // Use download logic or show a modal, e.g.:
            Utils.downloadFile(report.fileUrl, 'vouchers_report.csv');
            Utils.showNotification('Vouchers report exported!', 'success');
        } catch (error) {
            Utils.showNotification('Export failed: ' + error.message, 'error');
        }
    }

    // Show prefilled modal for editing a voucher
    static showEditVoucherModal(voucher) {
        document.getElementById('editVoucherModal')?.remove();
        const modalHTML = `
        <div class="modal fade" id="editVoucherModal" tabindex="-1" aria-labelledby="editVoucherModalLabel">
            <div class="modal-dialog">
                <div class="modal-content">
                    <form id="editVoucherForm">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editVoucherModalLabel">Edit Voucher: ${voucher.code}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Code</label>
                                <input type="text" name="code" class="form-control" value="${voucher.code}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Type</label>
                                <select name="type" class="form-select">
                                    <option value="fixed" ${voucher.type === 'fixed' ? 'selected' : ''}>Fixed</option>
                                    <option value="percentage" ${voucher.type === 'percentage' ? 'selected' : ''}>Percentage</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Discount</label>
                                <input type="number" name="discount" class="form-control" value="${voucher.discount}" min="1" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Valid Until</label>
                                <input type="date" name="validUntil" class="form-control" value="${voucher.validUntil ? new Date(voucher.validUntil).toISOString().split('T')[0] : ''}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Max Uses</label>
                                <input type="number" name="maxUses" class="form-control" value="${voucher.maxUses || 1}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Description</label>
                                <textarea name="description" class="form-control">${voucher.description || ''}</textarea>
                            </div>
                            <div class="form-check mb-3">
                                <input type="checkbox" id="activeCheck" name="isActive" class="form-check-input" ${voucher.isActive ? 'checked' : ''}>
                                <label for="activeCheck" class="form-check-label">Active</label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('editVoucherForm').onsubmit = async (e) => {
            e.preventDefault();
            const form = e.target;
            const updateData = {
                code: form.code.value.trim(),
                type: form.type.value,
                discount: Number(form.discount.value),
                validUntil: form.validUntil.value,
                maxUses: Number(form.maxUses.value),
                description: form.description.value,
                isActive: form.isActive.checked,
            };
            // Use PUT (your backend supports PUT for voucher update)
            await AdminService.editVoucher(voucher._id, updateData);
            bootstrap.Modal.getInstance(document.getElementById('editVoucherModal')).hide();
        };

        new bootstrap.Modal(document.getElementById('editVoucherModal')).show();
    }

    // Edit a voucher - calls the backend PUT endpoint
    static async editVoucher(voucherId, updateFields) {
        // Defensive validation of inputs
        if (!voucherId || typeof voucherId !== 'string') {
            Utils.showNotification('No voucher selected, cannot edit.', 'error');
            return;
        }
        if (!updateFields || typeof updateFields !== 'object') {
            Utils.showNotification('No update data provided for voucher edit.', 'error');
            return;
        }

        try {
            await ApiService.put(`/vouchers/${voucherId}`, updateFields);
            Utils.showNotification('Voucher updated!', 'success');
            AdminService.loadAdminManagementTables(); // Refresh admin tables after edit
        } catch (error) {
            Utils.showNotification('Update failed: ' + error.message, 'error');
        }
    }

    static async assignVoucher(voucherId) {
        // Show a modal for choosing a user, then assign
        // Or assign the current selected user directly:
        try {
            const userId = window.currentSelectedUser?._id;
            if (!userId) throw new Error('No user selected');
            await ApiService.post(`/vouchers/assign`, { userId, voucherId });
            Utils.showNotification('Voucher assigned!', 'success');
            AdminService.loadAdminManagementTables();
        } catch (error) {
            Utils.showNotification('Assign failed: ' + error.message, 'error');
        }
    }

    static async showAssignUserModal(voucher, staffList) {
        document.getElementById('assignUserModal')?.remove();
        const modalHTML = `
      <div id="assignUserModal" class="modal fade" tabindex="-1" aria-labelledby="assignUserModalLabel">
        <div class="modal-dialog">
          <div class="modal-content">
            <form id="assignUserForm">
              <div class="modal-header">
                <h5 class="modal-title" id="assignUserModalLabel">Assign Voucher: ${voucher.code}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <label for="staffDropdown" class="form-label">Select Staff Member:</label>
                <select id="staffDropdown" name="assignedTo" class="form-select" required>
                  ${staffList.map(staff => `
                      <option value="${staff._id}" ${voucher.assignedTo === staff._id ? 'selected' : ''}>${staff.name} (${staff.email})</option>
                  `).join('')}
                </select>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Assign</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('assignUserForm').onsubmit = async (e) => {
            e.preventDefault();
            const assignedTo = e.target.assignedTo.value;
            // Use PUT to update assignedTo field in the voucher
            await AdminService.editVoucher(voucher._id, { assignedTo });
            bootstrap.Modal.getInstance(document.getElementById('assignUserModal')).hide();
        };

        new bootstrap.Modal(document.getElementById('assignUserModal')).show();
    }



    // Deactivate Voucher
    static async deactivateVoucher(voucherId) {
        try {
            await ApiService.put(`/vouchers/${voucherId}`, { isActive: false });
            Utils.showNotification('Voucher deactivated!', 'info');
            AdminService.loadAdminManagementTables();
        } catch (error) {
            Utils.showNotification('Deactivation failed: ' + error.message, 'error');
        }
    }



    static async deleteVoucher(voucherId) {
        if (!confirm('Are you sure you want to delete this voucher? This action cannot be undone.')) return;
        try {
            await ApiService.delete(`/vouchers/${voucherId}`);
            Utils.showNotification('Voucher deleted!', 'success');
            AdminService.loadAdminManagementTables();
        } catch (error) {
            Utils.showNotification('Could not delete voucher: ' + error.message, 'error');
        }
    }

    static getVoucherStatusColor(status) {
        const statusColors = {
            active: 'success',
            expired: 'secondary',
            used: 'info',
            inactive: 'danger'
        };
        return statusColors[status] || 'primary';
    }

    static generateVouchersTableHTML(vouchers, users, type) {

        if (vouchers.length === 0) {
            return `
            <div class="text-center text-muted py-4">
                <i class="fas fa-tags fa-3x mb-3"></i>
                <p class="mb-0">No ${type} vouchers found</p>
                ${type === 'unassigned' ? '<button class="btn btn-primary mt-2" onclick="AdminService.showCreateVoucherModal()">Create First Voucher</button>' : ''}
            </div>
        `;
        }

        return `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Assigned To</th>
                        <th>Expires</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${vouchers.map(voucher => {
            const assignedUser = users.find(u => u._id === voucher.assignedTo);
            const userName = assignedUser ? assignedUser.name : 'Unassigned';
            const userRole = assignedUser ? assignedUser.role : 'none';

            return `
                        <tr>
                            <td>
                                <strong class="font-monospace">${voucher.code || 'N/A'}</strong>
                            </td>
                            <td>${voucher.type || 'Discount'}</td>
                            <td>
                                ${voucher.discountType === 'percentage'
                    ? `${voucher.value}%`
                    : Utils.formatCurrency(voucher.value)}
                            </td>
                            <td>
                                ${assignedUser ? `
                                    <div class="d-flex align-items-center">
                                        <div class="avatar-placeholder bg-${userRole === 'staff' ? 'info' : 'success'} text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 24px; height: 24px; font-size: 10px;">
                                            ${userName.charAt(0).toUpperCase()}
                                        </div>
                                        ${userName}
                                        <small class="text-muted ms-1">(${userRole})</small>
                                    </div>
                                ` : '<span class="text-muted">Unassigned</span>'}
                            </td>
                            <td>${voucher.expiryDate ? new Date(voucher.expiryDate).toLocaleDateString() : 'No expiry'}</td>
                            <td>
                                <span class="badge bg-${this.getVoucherStatusColor(voucher.status)}">
                                    ${voucher.status ? voucher.status.charAt(0).toUpperCase() + voucher.status.slice(1) : 'Active'}
                                </span>
                            </td>
                            <td>${voucher.createdAt ? new Date(voucher.createdAt).toLocaleDateString() : 'N/A'}</td>
                            <td>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary" onclick="AdminService.editVoucher('${voucher._id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-outline-success" onclick="AdminService.assignVoucher('${voucher._id}')">
                                        <i class="fas fa-user-plus"></i>
                                    </button>
                                    ${voucher.isActive === false
                    ? `<button class="btn btn-outline-success" onclick="AdminService.activateVoucher('${voucher._id}')">
        <i class="fas fa-check"></i>
     </button>`
                    : `<button class="btn btn-outline-warning" onclick="AdminService.deactivateVoucher('${voucher._id}')">
        <i class="fas fa-ban"></i>
     </button>`
                }

                                    <button class="btn btn-outline-danger" onclick="AdminService.deleteVoucher('${voucher._id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        </div>
    `;
    }

    static ensureAdminDashboardVisible() {
        console.log('🔄 Applying comprehensive admin dashboard visibility fix...');
        const adminDash = document.getElementById('adminDashboard');

        if (adminDash) {
            // Reset all problematic styles
            const resetStyles = {
                'height': 'auto',
                'min-height': '600px',
                'max-height': 'none',
                'width': 'auto',
                'min-width': 'auto',
                'max-width': 'none',
                'overflow': 'visible',
                'position': 'static',
                'display': 'block',
                'visibility': 'visible',
                'opacity': '1'
            };

            Object.keys(resetStyles).forEach(prop => {
                adminDash.style[prop] = resetStyles[prop];
            });

            console.log('✅ All admin dashboard styles reset');

            // Also fix parents up to body
            let current = adminDash;
            while (current && current !== document.body) {
                current = current.parentElement;
                if (current && current.offsetHeight === 0) {
                    current.style.height = 'auto';
                    current.style.minHeight = '100px';
                    console.log(`✅ Fixed parent: ${current.tagName}.${current.className}`);
                }
            }

            // Final check
            setTimeout(() => {
                console.log('Final dimensions - Height:', adminDash.offsetHeight, 'Width:', adminDash.offsetWidth);
                console.log('Admin dashboard should now be visible!');
            }, 200);
        } else {
            console.error('❌ adminDashboard element not found');
        }
    }

    static addStatsInteractivity() {
        console.log('🎯 Adding stats interactivity...');

        // Make Total Revenue clickable
        const revenueCard = document.getElementById('totalRevenue')?.closest('.dashboard-card');
        if (revenueCard) {
            revenueCard.style.cursor = 'pointer';
            revenueCard.classList.add('clickable-stat');
            revenueCard.addEventListener('click', () => this.showRevenueBreakdown());
        }

        // Make Total Users clickable
        const usersCard = document.getElementById('totalUsers')?.closest('.dashboard-card');
        if (usersCard) {
            usersCard.style.cursor = 'pointer';
            usersCard.classList.add('clickable-stat');
            usersCard.addEventListener('click', () => this.showUsersManagement());
        }

        // Make Active Vouchers clickable
        const vouchersCard = document.getElementById('totalVouchers')?.closest('.dashboard-card');
        if (vouchersCard) {
            vouchersCard.style.cursor = 'pointer';
            vouchersCard.classList.add('clickable-stat');
            vouchersCard.addEventListener('click', () => this.showVouchersManagement());
        }
    }

    static async showRevenueBreakdown() {
        try {
            console.log('💰 Generating revenue breakdown...');

            // Load fresh data for the report
            const [orders, bookings, giftOrders] = await Promise.all([
                ApiService.get('/orders?limit=100'),
                ApiService.get('/bookings?limit=100'),
                ApiService.get('/gift-orders?limit=100')
            ]);

            // Calculate revenue breakdown
            const revenueData = this.calculateRevenueBreakdown(orders, bookings, giftOrders);

            // Show modal with revenue breakdown
            this.showRevenueBreakdownModal(revenueData);

        } catch (error) {
            console.error('❌ Error generating revenue breakdown:', error);
            alert('Failed to load revenue breakdown data');
        }
    }

    static calculateRevenueBreakdown(orders, bookings, giftOrders) {
        const breakdown = {
            totalRevenue: 0,
            byType: {
                orders: { revenue: 0, count: orders.length, items: [] },
                bookings: { revenue: 0, count: bookings.length, items: [] },
                gifts: { revenue: 0, count: giftOrders.length, items: [] }
            },
            byProduct: {},
            byService: {},
            byStaff: {},
            monthly: {}
        };

        // Process orders
        orders.forEach(order => {
            const revenue = order.finalTotal || order.total || 0;
            breakdown.totalRevenue += revenue;
            breakdown.byType.orders.revenue += revenue;

            // Add to orders items
            breakdown.byType.orders.items.push({
                id: order._id,
                type: 'Order',
                customer: order.user?.name || 'Unknown',
                amount: revenue,
                date: order.createdAt,
                status: order.status
            });

            // Process by product
            if (order.items) {
                order.items.forEach(item => {
                    const productName = item.product?.name || 'Unknown Product';
                    if (!breakdown.byProduct[productName]) {
                        breakdown.byProduct[productName] = { revenue: 0, count: 0 };
                    }
                    breakdown.byProduct[productName].revenue += item.price * item.quantity;
                    breakdown.byProduct[productName].count += item.quantity;
                });
            }

            // Process by staff
            if (order.processedBy) {
                const staffName = order.processedBy.name;
                if (!breakdown.byStaff[staffName]) {
                    breakdown.byStaff[staffName] = { revenue: 0, orders: 0, bookings: 0, gifts: 0 };
                }
                breakdown.byStaff[staffName].revenue += revenue;
                breakdown.byStaff[staffName].orders += 1;
            }

            // Process monthly
            if (order.createdAt) {
                const month = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                if (!breakdown.monthly[month]) {
                    breakdown.monthly[month] = { revenue: 0, orders: 0, bookings: 0, gifts: 0 };
                }
                breakdown.monthly[month].revenue += revenue;
                breakdown.monthly[month].orders += 1;
            }
        });

        // Process bookings
        bookings.forEach(booking => {
            const revenue = booking.service?.price || 0;
            breakdown.totalRevenue += revenue;
            breakdown.byType.bookings.revenue += revenue;

            // Add to bookings items
            breakdown.byType.bookings.items.push({
                id: booking._id,
                type: 'Booking',
                customer: booking.user?.name || 'Unknown',
                service: booking.service?.name || 'Unknown Service',
                amount: revenue,
                date: booking.date,
                status: booking.status
            });

            // Process by service
            const serviceName = booking.service?.name || 'Unknown Service';
            if (!breakdown.byService[serviceName]) {
                breakdown.byService[serviceName] = { revenue: 0, count: 0 };
            }
            breakdown.byService[serviceName].revenue += revenue;
            breakdown.byService[serviceName].count += 1;

            // Process by staff
            if (booking.staff) {
                const staffName = booking.staff.name;
                if (!breakdown.byStaff[staffName]) {
                    breakdown.byStaff[staffName] = { revenue: 0, orders: 0, bookings: 0, gifts: 0 };
                }
                breakdown.byStaff[staffName].revenue += revenue;
                breakdown.byStaff[staffName].bookings += 1;
            }

            // Process monthly
            if (booking.date) {
                const month = new Date(booking.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                if (!breakdown.monthly[month]) {
                    breakdown.monthly[month] = { revenue: 0, orders: 0, bookings: 0, gifts: 0 };
                }
                breakdown.monthly[month].revenue += revenue;
                breakdown.monthly[month].bookings += 1;
            }
        });

        // Process gift orders
        giftOrders.forEach(gift => {
            const revenue = gift.giftPackage?.price || 0;
            breakdown.totalRevenue += revenue;
            breakdown.byType.gifts.revenue += revenue;

            // Add to gifts items
            breakdown.byType.gifts.items.push({
                id: gift._id,
                type: 'Gift Order',
                customer: gift.user?.name || 'Unknown',
                package: gift.giftPackage?.name || 'Unknown Package',
                recipient: gift.recipientName || 'Unknown',
                amount: revenue,
                date: gift.deliveryDate,
                status: gift.status
            });

            // Process by staff
            if (gift.assignedStaff) {
                const staffName = gift.assignedStaff.name;
                if (!breakdown.byStaff[staffName]) {
                    breakdown.byStaff[staffName] = { revenue: 0, orders: 0, bookings: 0, gifts: 0 };
                }
                breakdown.byStaff[staffName].revenue += revenue;
                breakdown.byStaff[staffName].gifts += 1;
            }

            // Process monthly
            if (gift.createdAt) {
                const month = new Date(gift.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                if (!breakdown.monthly[month]) {
                    breakdown.monthly[month] = { revenue: 0, orders: 0, bookings: 0, gifts: 0 };
                }
                breakdown.monthly[month].revenue += revenue;
                breakdown.monthly[month].gifts += 1;
            }
        });

        return breakdown;
    }

    static showRevenueBreakdownModal(revenueData) {
        const modalHtml = `
            <div class="modal fade" id="revenueBreakdownModal" tabindex="-1" aria-labelledby="revenueBreakdownModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title" id="revenueBreakdownModalLabel">
                                <i class="fas fa-chart-pie me-2"></i>
                                Revenue Breakdown Report
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4">
                                <div class="col-md-3">
                                    <div class="card text-center bg-light">
                                        <div class="card-body">
                                            <h3 class="text-primary">${Utils.formatCurrency(revenueData.totalRevenue)}</h3>
                                            <p class="mb-0">Total Revenue</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="card text-center bg-light">
                                        <div class="card-body">
                                            <h3 class="text-success">${Utils.formatCurrency(revenueData.byType.orders.revenue)}</h3>
                                            <p class="mb-0">From Orders (${revenueData.byType.orders.count})</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="card text-center bg-light">
                                        <div class="card-body">
                                            <h3 class="text-info">${Utils.formatCurrency(revenueData.byType.bookings.revenue)}</h3>
                                            <p class="mb-0">From Bookings (${revenueData.byType.bookings.count})</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="card text-center bg-light">
                                        <div class="card-body">
                                            <h3 class="text-warning">${Utils.formatCurrency(revenueData.byType.gifts.revenue)}</h3>
                                            <p class="mb-0">From Gifts (${revenueData.byType.gifts.count})</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card mb-4">
                                        <div class="card-header">
                                            <h6 class="mb-0"><i class="fas fa-box me-2"></i>Revenue by Product</h6>
                                        </div>
                                        <div class="card-body">
                                            ${this.generateProductRevenueHTML(revenueData.byProduct)}
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card mb-4">
                                        <div class="card-header">
                                            <h6 class="mb-0"><i class="fas fa-spa me-2"></i>Revenue by Service</h6>
                                        </div>
                                        <div class="card-body">
                                            ${this.generateServiceRevenueHTML(revenueData.byService)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="card mb-4">
                                <div class="card-header">
                                    <h6 class="mb-0"><i class="fas fa-users me-2"></i>Revenue by Staff Member</h6>
                                </div>
                                <div class="card-body">
                                    ${this.generateStaffRevenueHTML(revenueData.byStaff)}
                                </div>
                            </div>

                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0"><i class="fas fa-calendar me-2"></i>Monthly Revenue Breakdown</h6>
                                </div>
                                <div class="card-body">
                                    ${this.generateMonthlyRevenueHTML(revenueData.monthly)}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="AdminService.exportRevenueReport()">
                                <i class="fas fa-download me-2"></i>Export Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('revenueBreakdownModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('revenueBreakdownModal'));
        modal.show();
    }

    static generateProductRevenueHTML(byProduct) {
        const products = Object.entries(byProduct)
            .sort(([, a], [, b]) => b.revenue - a.revenue)
            .slice(0, 10); // Top 10 products

        if (products.length === 0) {
            return '<p class="text-muted text-center">No product revenue data</p>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-sm table-striped">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th class="text-end">Quantity</th>
                            <th class="text-end">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(([product, data]) => `
                            <tr>
                                <td>${this.escapeHtml(product)}</td>
                                <td class="text-end">${data.count}</td>
                                <td class="text-end">${Utils.formatCurrency(data.revenue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    static generateServiceRevenueHTML(byService) {
        const services = Object.entries(byService)
            .sort(([, a], [, b]) => b.revenue - a.revenue);

        if (services.length === 0) {
            return '<p class="text-muted text-center">No service revenue data</p>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-sm table-striped">
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th class="text-end">Bookings</th>
                            <th class="text-end">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${services.map(([service, data]) => `
                            <tr>
                                <td>${this.escapeHtml(service)}</td>
                                <td class="text-end">${data.count}</td>
                                <td class="text-end">${Utils.formatCurrency(data.revenue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    static generateStaffRevenueHTML(byStaff) {
        const staff = Object.entries(byStaff)
            .sort(([, a], [, b]) => b.revenue - a.revenue);

        if (staff.length === 0) {
            return '<p class="text-muted text-center">No staff revenue data</p>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-sm table-striped">
                    <thead>
                        <tr>
                            <th>Staff Member</th>
                            <th class="text-end">Orders</th>
                            <th class="text-end">Bookings</th>
                            <th class="text-end">Gifts</th>
                            <th class="text-end">Total Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${staff.map(([staffName, data]) => `
                            <tr>
                                <td>${this.escapeHtml(staffName)}</td>
                                <td class="text-end">${data.orders}</td>
                                <td class="text-end">${data.bookings}</td>
                                <td class="text-end">${data.gifts}</td>
                                <td class="text-end fw-bold">${Utils.formatCurrency(data.revenue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    static generateMonthlyRevenueHTML(monthly) {
        const months = Object.entries(monthly)
            .sort(([a], [b]) => new Date(a) - new Date(b));

        if (months.length === 0) {
            return '<p class="text-muted text-center">No monthly revenue data</p>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-sm table-striped">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th class="text-end">Orders</th>
                            <th class="text-end">Bookings</th>
                            <th class="text-end">Gifts</th>
                            <th class="text-end">Total Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${months.map(([month, data]) => `
                            <tr>
                                <td>${month}</td>
                                <td class="text-end">${data.orders}</td>
                                <td class="text-end">${data.bookings}</td>
                                <td class="text-end">${data.gifts}</td>
                                <td class="text-end fw-bold">${Utils.formatCurrency(data.revenue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    static exportRevenueReport() {
        // Simple export functionality - could be enhanced with proper CSV/PDF generation
        const modal = document.getElementById('revenueBreakdownModal');
        const content = modal.querySelector('.modal-body').innerText;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'revenue-breakdown-report.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    static async showUsersManagement() {
        try {
            console.log('👥 Loading users management...');

            // Load all users
            const users = await ApiService.get('/users');

            // Show users management modal
            this.showUsersManagementModal(users);

        } catch (error) {
            console.error('❌ Error loading users:', error);
            alert('Failed to load users data');
        }
    }

    static showUsersManagementModal(users) {
        // Separate users by role
        const staffUsers = users.filter(user => user.role === 'staff');
        const customerUsers = users.filter(user => user.role === 'customer');
        const adminUsers = users.filter(user => user.role === 'admin');

        const modalHtml = `
            <div class="modal fade" id="usersManagementModal" tabindex="-1" aria-labelledby="usersManagementModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-info text-white">
                            <h5 class="modal-title" id="usersManagementModalLabel">
                                <i class="fas fa-users-cog me-2"></i>
                                Users Management
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4">
                                <div class="col-md-4">
                                    <div class="card text-center bg-primary text-white">
                                        <div class="card-body">
                                            <h3>${adminUsers.length}</h3>
                                            <p class="mb-0">Admin Users</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card text-center bg-success text-white">
                                        <div class="card-body">
                                            <h3>${staffUsers.length}</h3>
                                            <p class="mb-0">Staff Members</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card text-center bg-warning text-white">
                                        <div class="card-body">
                                            <h3>${customerUsers.length}</h3>
                                            <p class="mb-0">Customers</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <ul class="nav nav-tabs" id="usersTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" id="staff-tab" data-bs-toggle="tab" data-bs-target="#staff" type="button" role="tab">
                                        Staff Members (${staffUsers.length})
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="customers-tab" data-bs-toggle="tab" data-bs-target="#customers" type="button" role="tab">
                                        Customers (${customerUsers.length})
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="admins-tab" data-bs-toggle="tab" data-bs-target="#admins" type="button" role="tab">
                                        Admins (${adminUsers.length})
                                    </button>
                                </li>
                            </ul>

                            <div class="tab-content mt-3" id="usersTabContent">
                                <div class="tab-pane fade show active" id="staff" role="tabpanel">
                                    ${this.generateUsersTableHTML(staffUsers, 'staff')}
                                </div>
                                <div class="tab-pane fade" id="customers" role="tabpanel">
                                    ${this.generateUsersTableHTML(customerUsers, 'customer')}
                                </div>
                                <div class="tab-pane fade" id="admins" role="tabpanel">
                                    ${this.generateUsersTableHTML(adminUsers, 'admin')}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="AdminService.exportUsersReport()">
                                <i class="fas fa-download me-2"></i>Export Users
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('usersManagementModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('usersManagementModal'));
        modal.show();
    }

    static generateUsersTableHTML(users, role) {
        if (users.length === 0) {
            return '<p class="text-muted text-center">No users found</p>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Joined</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <div class="avatar-placeholder bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px; font-size: 12px;">
                                            ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        ${this.escapeHtml(user.name || 'Unknown')}
                                    </div>
                                </td>
                                <td>${this.escapeHtml(user.email)}</td>
                                <td>${user.phone || 'N/A'}</td>
                                <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                                <td>
                                    <span class="badge bg-success">Active</span>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-primary" onclick="AdminService.viewUserDetails('${user._id}')">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-outline-warning" onclick="AdminService.editUser('${user._id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        ${role !== 'admin' ? `
                                        <button class="btn btn-outline-danger" onclick="AdminService.deleteUser('${user._id}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    static async viewUserDetails(userId) {
        try {
            const user = await ApiService.get(`/users/${userId}`);
            AdminService.showUserDetailsModal(user);
        } catch (error) {
            Utils.showNotification('Failed to load user details: ' + error.message, 'error');
        }
    }

    // Helper to display modal (you should define HTML for user details modal)
    static showUserDetailsModal(user) {
        // Remove any existing modal
        document.getElementById('userDetailsModal')?.remove();
        const modalHTML = `
        <div class="modal fade" id="userDetailsModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${user.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Role:</strong> ${user.role}</p>
                        <p><strong>Phone:</strong> ${user.phone || '-'}</p>
                        <!-- Add more user properties as needed -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        new bootstrap.Modal(document.getElementById('userDetailsModal')).show();
    }


    static async editUser(userId) {
        try {
            const user = await ApiService.get(`users/${userId}`);
            // Populate a modal form with user data and show it
            AdminService.showEditUserModal(user);
        } catch (error) {
            Utils.showNotification("Failed to load user: " + error.message, "error");
        }
    }


    static async deleteUser(userId) {
        if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
        try {
            await ApiService.delete(`users/${userId}`);
            Utils.showNotification("User deleted successfully.", "success");
            // Refresh management tables
            AdminService.loadAdminManagementTables();
        } catch (error) {
            Utils.showNotification("Failed to delete user: " + error.message, "error");
        }
    }


    static exportUsersReport() {
        // Simple export functionality
        const modal = document.getElementById('usersManagementModal');
        const content = modal.querySelector('.modal-body').innerText;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'users-management-report.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    static processResponse(response, type) {
        console.log(`🔄 Processing ${type} response:`, response);

        if (response.status !== 'fulfilled') {
            console.warn(`❌ ${type} API failed:`, response.reason);
            return [];
        }

        const data = response.value;
        console.log(`🔍 ${type} raw data:`, data);

        // Handle different response formats
        if (Array.isArray(data)) {
            console.log(`✅ ${type}: Returning array directly, length:`, data.length);
            return data;
        } else if (data && Array.isArray(data.users)) {
            console.log(`✅ ${type}: Returning data.users, length:`, data.users.length);
            return data.users;
        } else if (data && Array.isArray(data.data)) {
            console.log(`✅ ${type}: Returning data.data, length:`, data.data.length);
            return data.data;
        } else if (data && data[type] && Array.isArray(data[type])) {
            console.log(`✅ ${type}: Returning data.${type}, length:`, data[type].length);
            return data[type];
        } else {
            console.warn(`⚠️ Unexpected ${type} response format:`, data);
            console.log(`❌ ${type}: Returning empty array`);
            return [];
        }
    }

    static async updateDashboardStats(orders, bookings, giftOrders, users, vouchers) {
        console.log('📊 Updating dashboard statistics with REAL DATA...');

        try {
            // Fetch all data from database with PROPER error handling
            const promises = [
                users && users.length > 0 ? Promise.resolve(users) : ApiService.get('/users'),
                ApiService.get('/products'),
                ApiService.get('/services'),
                ApiService.get('/vouchers').catch(() => [])
            ];

            const [actualUsers, products, services, vouchers] = await Promise.all(
                promises.map(p => p.catch(error => {
                    console.warn('⚠️ API call failed, using fallback:', error);
                    return []; // Always return an array
                }))
            );

            // Calculate totals with SAFETY CHECKS
            const totalRevenue = orders.reduce((sum, order) => sum + (order.finalTotal || order.total || 0), 0);
            const totalBookings = bookings.length;
            const totalOrders = orders.length;
            const totalGiftOrders = giftOrders.length;
            const totalUsers = actualUsers.length;

            // SAFE: Use optional chaining and nullish coalescing
            const totalProducts = products?.length ?? 0;
            const totalServices = services?.length ?? 0;

            const activeVouchers = vouchers?.filter(v => v.status === 'active') ?? [];
            const totalVouchers = vouchers.length;

            console.log('✅ REAL DATA stats - Products:', totalProducts, 'Services:', totalServices, 'Vouchers:', totalVouchers);

            // Update stats - ALL values are now guaranteed to be numbers
            this.updateStatCard('totalRevenue', `R ${totalRevenue.toLocaleString()}`);
            this.updateStatCard('totalUsers', totalUsers.toString());
            this.updateStatCard('totalBookings', totalBookings.toString());
            this.updateStatCard('totalProducts', totalProducts.toString());
            this.updateStatCard('totalServices', totalServices.toString());
            this.updateStatCard('totalOrders', totalOrders.toString());
            this.updateStatCard('totalGiftOrders', totalGiftOrders.toString());
            this.updateStatCard('totalVouchers', totalVouchers.toString());

            console.log('✅ Dashboard stats updated successfully!');

        } catch (error) {
            console.error('❌ Critical error in updateDashboardStats:', error);
        }
    }

    static updateStatCard(elementId, value) {
        console.log(`🔄 Updating stat card: ${elementId} with value: ${value}`); // Debug line
        const element = document.getElementById(elementId);
        if (element) {
            console.log(`✅ Found element, updating text from '${element.textContent}' to '${value}'`); // Debug line
            element.textContent = value;
        } else {
            console.warn(`❌ Stat card element not found: ${elementId}`);
            // Let's see what elements exist
            const allStats = document.querySelectorAll('[id*="total"]');
            console.log('Available stat elements:', Array.from(allStats).map(el => el.id));
        }
    }

    static initializeCharts(orders, bookings, giftOrders) {
        console.log('📈 Initializing charts...');

        try {
            // Initialize Revenue Chart
            this.initializeRevenueChart(orders);

            // Initialize Staff Performance Chart
            this.initializeStaffPerformanceChart(orders, bookings);

            // Initialize Services Chart
            this.initializeServicesChart(bookings);

            console.log('✅ Charts initialized');
        } catch (error) {
            console.error('❌ Error initializing charts:', error);
        }
    }

    static initializeRevenueChart(orders) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) {
            console.warn('❌ Revenue chart canvas not found');
            return;
        }

        try {
            // Group orders by month for revenue chart
            const monthlyRevenue = {};
            orders.forEach(order => {
                if (order.createdAt) {
                    const date = new Date(order.createdAt);
                    const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                    const revenue = order.finalTotal || order.total || 0;

                    if (!monthlyRevenue[monthYear]) {
                        monthlyRevenue[monthYear] = 0;
                    }
                    monthlyRevenue[monthYear] += revenue;
                }
            });

            const labels = Object.keys(monthlyRevenue).sort();
            const data = labels.map(label => monthlyRevenue[label]);

            // Create the chart
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Monthly Revenue',
                        data: data,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        fill: true,
                        backgroundColor: 'rgba(75, 192, 192, 0.1)'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Revenue Over Time'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error creating revenue chart:', error);
        }
    }

    static initializeStaffPerformanceChart(orders, bookings) {
        const ctx = document.getElementById('staffPerformanceChart');
        if (!ctx) {
            console.warn('❌ Staff performance chart canvas not found');
            return;
        }

        try {
            // Calculate staff performance (orders processed + bookings assigned)
            const staffPerformance = {};

            // Count orders processed by each staff
            orders.forEach(order => {
                if (order.processedBy) {
                    const staffId = order.processedBy._id;
                    const staffName = order.processedBy.name;

                    if (!staffPerformance[staffId]) {
                        staffPerformance[staffId] = { name: staffName, orders: 0, bookings: 0 };
                    }
                    staffPerformance[staffId].orders++;
                }
            });

            // Count bookings assigned to each staff
            bookings.forEach(booking => {
                if (booking.staff) {
                    const staffId = booking.staff._id;
                    const staffName = booking.staff.name;

                    if (!staffPerformance[staffId]) {
                        staffPerformance[staffId] = { name: staffName, orders: 0, bookings: 0 };
                    }
                    staffPerformance[staffId].bookings++;
                }
            });

            const staffNames = Object.values(staffPerformance).map(staff => staff.name);
            const ordersData = Object.values(staffPerformance).map(staff => staff.orders);
            const bookingsData = Object.values(staffPerformance).map(staff => staff.bookings);

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: staffNames,
                    datasets: [
                        {
                            label: 'Orders Processed',
                            data: ordersData,
                            backgroundColor: 'rgba(54, 162, 235, 0.8)'
                        },
                        {
                            label: 'Bookings Assigned',
                            data: bookingsData,
                            backgroundColor: 'rgba(255, 99, 132, 0.8)'
                        }
                    ]
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
                        x: {
                            stacked: false
                        },
                        y: {
                            stacked: false,
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error creating staff performance chart:', error);
        }
    }

    static initializeServicesChart(bookings) {
        const ctx = document.getElementById('servicesChart');
        if (!ctx) {
            console.warn('❌ Services chart canvas not found');
            return;
        }

        try {
            // Count bookings by service
            const serviceCounts = {};
            bookings.forEach(booking => {
                if (booking.service) {
                    const serviceName = booking.service.name;
                    serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
                }
            });

            const labels = Object.keys(serviceCounts);
            const data = Object.values(serviceCounts);

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.8)',
                            'rgba(54, 162, 235, 0.8)',
                            'rgba(255, 205, 86, 0.8)',
                            'rgba(75, 192, 192, 0.8)',
                            'rgba(153, 102, 255, 0.8)',
                            'rgba(255, 159, 64, 0.8)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Bookings by Service'
                        },
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error creating services chart:', error);
        }
    }

    static populateExistingTables(orders, bookings, giftOrders) {
        console.log('🔍 Looking for existing tables in admin dashboard...');

        const adminDashboard = document.getElementById('adminDashboard');
        if (!adminDashboard) {
            console.error('❌ adminDashboard not found');
            return;
        }

        // Find all tables in the admin dashboard
        const tables = adminDashboard.querySelectorAll('table');
        console.log(`📊 Found ${tables.length} tables to populate`);

        // Try to identify tables by their content or position
        this.identifyAndPopulateTables(tables, orders, bookings, giftOrders);
    }

    static identifyAndPopulateTables(tables, orders, bookings, giftOrders) {
        tables.forEach((table, index) => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.toLowerCase());
            console.log(`Table ${index + 1} headers:`, headers);

            // More specific table identification
            if (headers.some(header => header.includes('order') && header.includes('id') &&
                !headers.some(header => header.includes('gift') || header.includes('recipient') || header.includes('package')))) {
                console.log(`✅ Identified Table ${index + 1} as ORDERS table`);
                this.populateOrdersTable(table, orders);
            }
            else if (headers.some(header => header.includes('booking') && header.includes('id'))) {
                console.log(`✅ Identified Table ${index + 1} as BOOKINGS table`);
                this.populateBookingsTable(table, bookings);
            }
            else if (headers.some(header => header.includes('gift') || header.includes('recipient') || header.includes('package') || header.includes('delivery'))) {
                console.log(`✅ Identified Table ${index + 1} as GIFTS table`);
                this.populateGiftsTable(table, giftOrders);
            }
            else {
                console.log(`❓ Table ${index + 1} - Unknown type, headers:`, headers);
            }
        });
    }

    static populateOrdersTable(table, orders) {
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.warn('❌ No tbody found in orders table');
            return;
        }

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    <i class="fas fa-shopping-cart fa-2x mb-2 d-block"></i>
                    No orders found
                </td>
            </tr>
        `;
            return;
        }

        tbody.innerHTML = orders.map(order => {
            const orderId = order._id ? order._id.toString().slice(-8) : 'N/A';
            const userName = order.user?.name || 'Unknown User';
            const itemCount = order.items ? order.items.length : 0;
            const total = order.finalTotal || order.total || 0;
            const status = order.status || 'pending';
            const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A';

            // FIX: Use processedBy instead of assignedStaff for orders
            const staffName = order.processedBy?.name || order.assignedStaff?.name || 'Not assigned';
            const staffId = order.processedBy?._id || order.assignedStaff?._id || '';

            return `
            <tr>
                <td>${date}</td>
                <td><strong>#${orderId}</strong></td>
                <td>${this.escapeHtml(userName)}</td>
                <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
                <td>${this.escapeHtml(staffName)}</td>
                <td><strong>${Utils.formatCurrency(total)}</strong></td>
                <td>
                    <span class="badge bg-${Utils.getStatusColor(status)}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" 
                                onclick="showAdminModal('order', '${order._id}', '${status}', '${staffId}')">
                            <i class="fas fa-cog"></i> Manage
                        </button>
                        <button class="btn btn-outline-secondary" 
                                onclick="ReceiptService.generateReceipt('order', '${order._id}')">
                            <i class="fas fa-receipt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        console.log(`✅ Populated orders table with ${orders.length} orders`);
    }

    static populateBookingsTable(table, bookings) {
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.warn('❌ No tbody found in bookings table');
            return;
        }

        if (!bookings || bookings.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted py-4">
                    <i class="fas fa-calendar fa-2x mb-2 d-block"></i>
                    No bookings found
                </td>
            </tr>
        `;
            return;
        }

        tbody.innerHTML = bookings.map(booking => {
            const bookingId = booking._id ? booking._id.toString().slice(-8) : 'N/A';
            const bookingDate = booking.date ? new Date(booking.date).toLocaleDateString() : 'N/A';
            const createdAt = booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A';
            const userName = booking.user?.name || 'Customer';
            const serviceName = booking.service?.name || 'Service';

            // FIX: Use staff field (not assignedStaff)
            const staffName = booking.staff?.name || 'Not assigned';
            const staffId = booking.staff?._id || '';

            const status = booking.status || 'pending';

            return `
            <tr>
                <td>${createdAt}</td>
                <td>#${bookingId}</td>
                <td>${this.escapeHtml(userName)}</td>
                <td>${this.escapeHtml(serviceName)}</td>
                <td>${this.escapeHtml(staffName)}</td>
                <td>${bookingDate} at ${booking.time || 'N/A'}</td>
                <td>
                    <span class="badge bg-${Utils.getStatusColor(status)}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" 
                                onclick="showAdminModal('booking', '${booking._id}', '${status}', '${staffId}')">
                            <i class="fas fa-cog"></i> Manage
                        </button>
                        <button class="btn btn-outline-secondary" 
                                onclick="ReceiptService.generateReceipt('booking', '${booking._id}')">
                            <i class="fas fa-receipt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        console.log(`✅ Populated bookings table with ${bookings.length} bookings`);
    }

    static populateGiftsTable(table, giftOrders) {
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.warn('❌ No tbody found in gifts table');
            return;
        }

        if (!giftOrders || giftOrders.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-muted py-4">
                    <i class="fas fa-gift fa-2x mb-2 d-block"></i>
                    No gift orders found
                </td>
            </tr>
        `;
            return;
        }

        tbody.innerHTML = giftOrders.map(gift => {
            const giftId = gift._id ? gift._id.toString().slice(-8) : 'N/A';
            const createdAt = gift.createdAt ? new Date(gift.createdAt).toLocaleDateString() : 'N/A';
            const deliveryDate = gift.deliveryDate ? new Date(gift.deliveryDate).toLocaleDateString() : 'N/A';
            const userName = gift.user?.name || 'Customer';
            const recipientName = gift.recipientName || 'N/A';
            const packageName = gift.giftPackage?.name || 'Gift Package';
            const staffName = gift.assignedStaff?.name || 'Not assigned';
            const status = gift.status || 'pending';

            return `
            <tr>
                <td>${createdAt}</td>
                <td>#${giftId}</td>
                <td>${this.escapeHtml(userName)}</td>
                <td>${this.escapeHtml(recipientName)}</td>
                <td>${this.escapeHtml(packageName)}</td>
                <td>${this.escapeHtml(staffName)}</td>
                <td>${deliveryDate}</td>
                <td>
                    <span class="badge bg-${Utils.getStatusColor(status)}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" 
                                onclick="showAdminModal('gift', '${gift._id}', '${status}', '${gift.assignedStaff?._id || ''}')">
                            <i class="fas fa-cog"></i> Manage
                        </button>
                        <button class="btn btn-outline-secondary" 
                                onclick="ReceiptService.generateReceipt('gift', '${gift._id}')">
                            <i class="fas fa-receipt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        console.log(`✅ Populated gifts table with ${giftOrders.length} gift orders`);
    }

    static showEmptyStates() {
        const tables = document.querySelectorAll('#adminDashboard table');
        tables.forEach(table => {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" class="text-center text-muted py-4">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Failed to load data
                        </td>
                    </tr>
                `;
            }
        });

        // Also reset stats to 0
        const statIds = ['totalRevenue', 'totalUsers', 'totalBookings', 'totalProducts',
            'totalServices', 'totalOrders', 'totalGiftOrders', 'totalVouchers'];
        statIds.forEach(id => this.updateStatCard(id, '0'));
    }

    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ===== ADMIN MODAL FUNCTIONS =====
function showAdminModal(type, id, currentStatus = '', currentStaff = '') {
    // First, ensure the modal HTML exists in the DOM
    ensureAdminModalExists();

    const modalElement = document.getElementById('adminActionModal');
    if (!modalElement) {
        console.error('Admin modal element not found');
        Utils.showNotification('Admin modal not available', 'error');
        return;
    }

    let modal = bootstrap.Modal.getInstance(modalElement);
    if (!modal) {
        modal = new bootstrap.Modal(modalElement);
    }

    const modalTitle = document.getElementById('adminModalTitle');
    const modalForm = document.getElementById('adminActionForm');

    if (!modalTitle || !modalForm) {
        console.error('Admin modal elements not found');
        return;
    }

    // Set modal title based on type
    const titles = {
        'order': 'Manage Order',
        'booking': 'Manage Booking',
        'gift': 'Manage Gift Order'
    };

    modalTitle.textContent = titles[type] || 'Manage Item';

    // Store the current item info in the form
    modalForm.dataset.type = type;
    modalForm.dataset.id = id;

    // Populate status dropdown
    const statusSelect = document.getElementById('adminStatus');
    if (statusSelect) {
        const statusOptions = {
            'order': ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
            'booking': ['pending', 'confirmed', 'completed', 'cancelled'],
            'gift': ['pending', 'confirmed', 'processing', 'delivered', 'completed', 'cancelled']
        };

        statusSelect.innerHTML = statusOptions[type].map(status =>
            `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status.charAt(0).toUpperCase() + status.slice(1)}</option>`
        ).join('');
    }

    // Populate staff dropdown with SAFETY CHECKS
    const staffSelect = document.getElementById('adminStaff');
    if (staffSelect) {
        staffSelect.innerHTML = '<option value="">Loading staff...</option>';

        // Show the modal first
        modal.show();

        // Populate staff dropdown after modal is shown with ERROR HANDLING
        setTimeout(() => {
            populateAdminStaffDropdown(currentStaff);
        }, 100);
    } else {
        // If no staff select element, just show the modal
        modal.show();
    }
}

function ensureAdminModalExists() {
    if (document.getElementById('adminActionModal')) {
        return; // Modal already exists
    }

    // Create the admin modal HTML if it doesn't exist
    const modalHTML = `
        <div class="modal fade" id="adminActionModal" tabindex="-1" aria-labelledby="adminModalTitle" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="adminModalTitle">Manage Item</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="adminActionForm">
                            <input type="hidden" name="itemType">
                            <input type="hidden" name="itemId">
                            
                            <div class="mb-3">
                                <label for="adminStatus" class="form-label">Status</label>
                                <select class="form-select" id="adminStatus" name="status">
                                    <option value="">Select status...</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label for="adminStaff" class="form-label">Assign Staff</label>
                                <select class="form-select" id="adminStaff" name="staff">
                                    <option value="">Loading staff...</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label for="adminNotes" class="form-label">Notes</label>
                                <textarea class="form-control" id="adminNotes" name="notes" rows="3" placeholder="Add any notes or instructions..."></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitAdminAction()">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log('✅ Admin modal created in DOM');
}


function populateAdminStaffDropdown(currentStaff = '') {
    const staffSelect = document.getElementById('adminStaff');
    if (!staffSelect) {
        console.warn('Staff select element not found');
        return;
    }

    try {
        // SAFE: Get staff members with error handling
        let staffMembers = [];

        // Try multiple possible sources for staff data
        if (window.staffMembers && Array.isArray(window.staffMembers)) {
            staffMembers = window.staffMembers;
        } else if (window.appData && window.appData.staffMembers && Array.isArray(window.appData.staffMembers)) {
            staffMembers = window.appData.staffMembers;
        } else {
            console.warn('No staff members data found in window.staffMembers or window.appData.staffMembers');

            // Try to load staff members from API
            ApiService.get('/users/staff').then(staff => {
                if (Array.isArray(staff)) {
                    staffMembers = staff;
                    updateStaffDropdown(staffMembers, currentStaff);
                } else {
                    throw new Error('Invalid staff data format from API');
                }
            }).catch(error => {
                console.error('Failed to load staff from API:', error);
                staffSelect.innerHTML = '<option value="">No staff available</option>';
            });
            return;
        }

        updateStaffDropdown(staffMembers, currentStaff);

    } catch (error) {
        console.error('Error populating staff dropdown:', error);
        staffSelect.innerHTML = `
            <option value="">Error loading staff</option>
            <option value="unassigned">Unassigned</option>
        `;
    }
}

function updateStaffDropdown(staffMembers, currentStaff) {
    const staffSelect = document.getElementById('adminStaff');
    if (!staffSelect) return;

    if (!staffMembers || staffMembers.length === 0) {
        staffSelect.innerHTML = `
            <option value="">No staff members available</option>
            <option value="unassigned">Unassigned</option>
        `;
        return;
    }

    // Create staff options
    const options = [
        '<option value="">Select staff member...</option>',
        '<option value="unassigned">Unassigned</option>'
    ];

    // Add each staff member
    staffMembers.forEach(staff => {
        if (staff && staff._id && staff.name) {
            const selected = staff._id === currentStaff ? 'selected' : '';
            options.push(`<option value="${staff._id}" ${selected}>${staff.name} (${staff.role || 'staff'})</option>`);
        }
    });

    staffSelect.innerHTML = options.join('');

    console.log(`✅ Staff dropdown populated with ${staffMembers.length} staff members`);
}


async function handleAdminAction(e) {
    e.preventDefault();

    const form = document.getElementById('adminActionForm');
    if (!form) return;

    const type = form.dataset.type;
    const id = form.dataset.id;
    const status = document.getElementById('adminStatus')?.value;
    const staff = document.getElementById('adminStaff')?.value;

    if (!status) {
        Utils.showNotification('Please select a status', 'warning');
        return;
    }

    try {
        let endpoint = '';
        let data = { status };

        if (staff) {
            switch (type) {
                case 'order':
                    data.processedBy = staff; // Orders use processedBy
                    break;
                case 'booking':
                    data.staff = staff; // Bookings use staff (not assignedStaff)
                    break;
                case 'gift':
                    data.assignedStaff = staff; // Gift orders use assignedStaff
                    break;
            }
        }

        switch (type) {
            case 'order':
                endpoint = `/orders/${id}`;
                break;
            case 'booking':
                endpoint = `/bookings/${id}`;
                break;
            case 'gift':
                endpoint = `/gift-orders/${id}`;
                break;
        }

        console.log(`🔄 Updating ${type} with data:`, data);
        const result = await ApiService.patch(endpoint, data);

        // Close modal
        const modalElement = document.getElementById('adminActionModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }

        Utils.showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully!`, 'success');

        // Reload tables
        setTimeout(() => AdminService.loadAdminManagementTables(), 500);

    } catch (error) {
        console.error('Error updating admin action:', error);

        if (error.message.includes('500')) {
            Utils.showNotification('Server error. Check backend logs.', 'error');
        } else {
            Utils.showNotification('Failed to update: ' + error.message, 'error');
        }
    }
}

// ===== RECEIPT SERVICE =====
class ReceiptService {
    static async generateReceipt(type, id) {
        try {
            console.log(`📄 Generating receipt for ${type} with ID: ${id}`);

            const data = await ApiService.get(`/dashboard/receipt/${type}/${id}`);

            if (data.success && data.receipt) {
                this.showReceiptModal(data.receipt, data.company);
            } else {
                throw new Error('Failed to generate receipt data');
            }
        } catch (error) {
            console.error('Error generating receipt:', error);
            Utils.showNotification('Failed to generate receipt: ' + error.message, 'error');
        }
    }

    static showReceiptModal(receipt, company) {
        const receiptContent = document.getElementById('receiptContent');
        if (!receiptContent) return;

        let receiptHTML = `
            <div class="receipt">
                <div class="receipt-header">
                    <h2>${company?.name || 'Tassel Group'}</h2>
                    <p>${company?.address || ''}</p>
                    <p>${company?.phone || ''} ${company?.email ? '| ' + company.email : ''}</p>
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
            `;
        } else if (receipt.type === 'order') {
            receiptHTML += `
                    <div class="receipt-item">
                        <span>Processed By:</span>
                        <span>${receipt.processedBy}</span>
                    </div>
            `;
            if (receipt.items) {
                receipt.items.forEach(item => {
                    receiptHTML += `
                        <div class="receipt-item" style="padding-left: 20px;">
                            <span>${item.quantity}x ${item.product}</span>
                            <span>${Utils.formatCurrency(item.subtotal)}</span>
                        </div>
                    `;
                });
            }
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
            `;
        }

        receiptHTML += `
                    <div class="receipt-total">
                        <span>Total Amount:</span>
                        <span>${Utils.formatCurrency(receipt.amount || receipt.total)}</span>
                    </div>
                </div>
                
                <div class="receipt-footer">
                    <p>Thank you for choosing ${company?.name || 'Tassel Group'}!</p>
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `;

        receiptContent.innerHTML = receiptHTML;

        const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
        receiptModal.show();
    }
}

async function loadProfileData() {
    if (!AppState.currentUser) {
        console.warn('No user logged in for profile');
        Utils.showNotification('Please log in to view profile', 'warning');
        UIHelper.showSection('login');
        return;
    }

    console.log('👤 Loading profile data for:', AppState.currentUser);

    try {
        // Update profile display elements
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileRole = document.getElementById('profileRole');
        const profileAvatar = document.getElementById('profileAvatar');

        if (profileName) profileName.textContent = AppState.currentUser.name || 'User Name';
        if (profileEmail) profileEmail.textContent = AppState.currentUser.email || 'user@example.com';
        if (profileRole) {
            const roleText = AppState.currentUser.role?.charAt(0).toUpperCase() + AppState.currentUser.role?.slice(1) || 'Customer';
            profileRole.textContent = roleText;
            profileRole.className = `badge bg-${Utils.getStatusColor(AppState.currentUser.role || 'customer')}`;
        }
        if (profileAvatar) {
            profileAvatar.textContent = (AppState.currentUser.name?.charAt(0) || AppState.currentUser.email?.charAt(0) || 'U').toUpperCase();
        }

        // Populate form fields
        const profileFullName = document.getElementById('profileFullName');
        const profileEmailInput = document.getElementById('profileEmailInput');
        const profilePhone = document.getElementById('profilePhone');
        const profileAddress = document.getElementById('profileAddress');

        if (profileFullName) profileFullName.value = AppState.currentUser.name || '';
        if (profileEmailInput) profileEmailInput.value = AppState.currentUser.email || '';
        if (profilePhone) profilePhone.value = AppState.currentUser.phone || '';
        if (profileAddress) profileAddress.value = AppState.currentUser.address || '';

        // Clear password fields
        const currentPassword = document.getElementById('currentPassword');
        const newPassword = document.getElementById('newPassword');
        const confirmPassword = document.getElementById('confirmPassword');

        if (currentPassword) currentPassword.value = '';
        if (newPassword) newPassword.value = '';
        if (confirmPassword) confirmPassword.value = '';

        console.log('✅ Profile data loaded successfully');

    } catch (error) {
        console.error('Error loading profile data:', error);
        Utils.showNotification('Error loading profile data', 'error');
    }
}

// ===== STAFF DASHBOARD FUNCTIONS =====
function showUserSearchModal() {
    // Create the modal if it doesn't exist
    if (!document.getElementById('userSearchModal')) {
        const modalHTML = `
        <div class="modal fade" id="userSearchModal" tabindex="-1" aria-labelledby="userSearchModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="userSearchModalLabel">Search Users</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="userSearchInput" class="form-label">Search by Name or Email</label>
                            <input type="text" class="form-control" id="userSearchInput" 
                                   placeholder="Enter name or email..." 
                                   onkeyup="debouncedUserSearch()">
                        </div>
                        <div id="userSearchResults" class="mt-3">
                            <div class="text-center text-muted">
                                Enter search terms to find users
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('userSearchModal'));
    modal.show();

    // Clear previous results
    document.getElementById('userSearchResults').innerHTML = `
        <div class="text-center text-muted">
            Enter search terms to find users
        </div>
    `;
}

// Debounced search function
const debouncedUserSearch = Utils.debounce(async function () {
    const searchTerm = document.getElementById('userSearchInput').value.trim();
    const resultsContainer = document.getElementById('userSearchResults');

    if (!searchTerm) {
        resultsContainer.innerHTML = `
            <div class="text-center text-muted">
                Enter search terms to find users
            </div>
        `;
        return;
    }

    // Show loading
    resultsContainer.innerHTML = `
        <div class="text-center">
            <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span class="ms-2">Searching users...</span>
        </div>
    `;

    try {
        const response = await ApiService.get(`/users/search?q=${encodeURIComponent(searchTerm)}`);

        if (response.success && response.users && response.users.length > 0) {
            resultsContainer.innerHTML = response.users.map(user => `
                <div class="card mb-2">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h6 class="card-title mb-1">${user.name}</h6>
                                <p class="card-text text-muted mb-1">${user.email}</p>
                                <small class="text-muted">${user.phone || 'No phone'}</small>
                            </div>
                            <div class="col-md-4 text-end">
                                <span class="badge bg-${Utils.getStatusColor(user.role)}">${user.role}</span>
                                <button class="btn btn-sm btn-primary"
                                     onclick='showUserActivityModal(${JSON.stringify({
                _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone
            })})'>View Activity</button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = `
                <div class="text-center text-muted">
                    No users found matching "${searchTerm}"
                </div>
            `;
        }
    } catch (error) {
        console.error('User search error:', error);
        resultsContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error searching users: ${error.message}
            </div>
        `;
    }
}, 500);

function selectUser(user) {
    console.log('🎯 selectUser called with:', { user });

    // Show the user activity modal
    showUserActivityModal(user);

    // Close the search modal if it's open
    const searchModal = bootstrap.Modal.getInstance(document.getElementById('userSearchModal'));
    if (searchModal) {
        console.log('🔒 Closing search modal');
        searchModal.hide();
    } else {
        console.log('⚠️ Search modal not found or already closed');
    }
}

function showMyReceipts() {
    // Create the modal if it doesn't exist
    if (!document.getElementById('myReceiptsModal')) {
        const modalHTML = `
        <div class="modal fade" id="myReceiptsModal" tabindex="-1" aria-labelledby="myReceiptsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="myReceiptsModalLabel">My Receipts & Commissions</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-4">
                            <div class="col-md-4">
                                <div class="card bg-primary text-white">
                                    <div class="card-body text-center">
                                        <h4 id="totalCommission">R 0.00</h4>
                                        <p class="mb-0">Total Commission</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-success text-white">
                                    <div class="card-body text-center">
                                        <h4 id="completedServices">0</h4>
                                        <p class="mb-0">Completed Services</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-info text-white">
                                    <div class="card-body text-center">
                                        <h4 id="totalSales">R 0.00</h4>
                                        <p class="mb-0">Total Sales</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="receiptsList">
                            <div class="text-center">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading receipts...</span>
                                </div>
                                <p class="mt-2">Loading your receipts...</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="printReceiptsSummary()">
                            <i class="fas fa-print me-2"></i>Print Summary
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('myReceiptsModal'));
    modal.show();

    // Load staff receipts data
    loadStaffReceipts();
}

async function loadStaffReceipts() {
    try {
        // Load data for the current staff member
        const [orders, bookings, giftOrders] = await Promise.allSettled([
            ApiService.get('/orders?limit=100'),
            ApiService.get('/bookings?limit=100'),
            ApiService.get('/gift-orders?limit=100')
        ]);

        const ordersData = orders.status === 'fulfilled' ? orders.value : [];
        const bookingsData = bookings.status === 'fulfilled' ? bookings.value : [];
        const giftsData = giftOrders.status === 'fulfilled' ? giftOrders.value : [];

        // Filter items assigned to current staff member
        const currentStaffId = AppState.currentUser._id;

        const myOrders = Array.isArray(ordersData) ? ordersData.filter(order =>
            order.processedBy?._id === currentStaffId || order.assignedStaff?._id === currentStaffId
        ) : [];

        const myBookings = Array.isArray(bookingsData) ? bookingsData.filter(booking =>
            booking.staff?._id === currentStaffId || booking.assignedStaff?._id === currentStaffId
        ) : [];

        const myGifts = Array.isArray(giftsData) ? giftsData.filter(gift =>
            gift.assignedStaff?._id === currentStaffId
        ) : [];

        // Calculate totals
        const totalSales = calculateTotalSales(myOrders, myBookings, myGifts);
        const totalCommission = calculateCommission(totalSales);
        const completedServices = myBookings.filter(b => b.status === 'completed').length;

        // Update stats
        document.getElementById('totalCommission').textContent = Utils.formatCurrency(totalCommission);
        document.getElementById('completedServices').textContent = completedServices;
        document.getElementById('totalSales').textContent = Utils.formatCurrency(totalSales);

        // Display receipts list
        displayStaffReceipts(myOrders, myBookings, myGifts);

    } catch (error) {
        console.error('Error loading staff receipts:', error);
        document.getElementById('receiptsList').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load receipts: ${error.message}
            </div>
        `;
    }
}

function calculateTotalSales(orders, bookings, gifts) {
    let total = 0;

    // Calculate from completed orders
    orders.forEach(order => {
        if (['completed', 'delivered', 'paid'].includes(order.status)) {
            total += order.finalTotal || order.total || 0;
        }
    });

    // Calculate from completed bookings
    bookings.forEach(booking => {
        if (['completed', 'confirmed'].includes(booking.status)) {
            total += booking.service?.price || booking.price || 0;
        }
    });

    // Calculate from completed gifts
    gifts.forEach(gift => {
        if (['delivered', 'completed', 'paid'].includes(gift.status)) {
            total += gift.price || gift.total || gift.giftPackage?.basePrice || 0;
        }
    });

    return total;
}

function calculateCommission(totalSales) {
    // Example commission calculation (10% of total sales)
    // You can adjust this based on your business rules
    return totalSales * 0.10;
}

function displayStaffReceipts(orders, bookings, gifts) {
    const receiptsList = document.getElementById('receiptsList');

    const allItems = [
        ...orders.map(order => ({ ...order, type: 'order' })),
        ...bookings.map(booking => ({ ...booking, type: 'booking' })),
        ...gifts.map(gift => ({ ...gift, type: 'gift' }))
    ].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    if (allItems.length === 0) {
        receiptsList.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-receipt fa-3x mb-3"></i>
                <p>No receipts found</p>
                <small>Your assigned services and sales will appear here</small>
            </div>
        `;
        return;
    }

    receiptsList.innerHTML = allItems.map(item => {
        const date = new Date(item.createdAt || item.date).toLocaleDateString();
        const amount = item.finalTotal || item.total || item.price || item.service?.price || 0;
        const status = item.status || 'pending';

        let description = '';
        if (item.type === 'order') {
            description = `Order #${item._id.toString().slice(-6)} - ${item.items?.length || 0} items`;
        } else if (item.type === 'booking') {
            description = `Booking - ${item.service?.name || 'Service'}`;
        } else if (item.type === 'gift') {
            description = `Gift - ${item.giftPackage?.name || 'Package'} for ${item.recipientName}`;
        }

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-6">
                            <h6 class="card-title mb-1">${description}</h6>
                            <small class="text-muted">${date} • ${item.type.toUpperCase()}</small>
                        </div>
                        <div class="col-md-3 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2 text-end">
                            <strong>${Utils.formatCurrency(amount)}</strong>
                        </div>
                        <div class="col-md-1 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('${item.type}', '${item._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function printReceiptsSummary() {
    // Simple print functionality for the receipts summary
    const printContent = document.getElementById('receiptsList').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Staff Receipts Summary - ${AppState.currentUser.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .card { border: 1px solid #ddd; margin-bottom: 10px; padding: 15px; }
                    .badge { padding: 5px 10px; border-radius: 4px; }
                    .text-end { text-align: right; }
                    .text-center { text-align: center; }
                </style>
            </head>
            <body>
                <h2>Staff Receipts Summary</h2>
                <p><strong>Staff:</strong> ${AppState.currentUser.name}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <hr>
                ${printContent}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}


// ===== EVENT HANDLERS =====
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    await AuthService.login(email, password);
}

async function handleRegister(e) {
    e.preventDefault();
    const userData = {
        name: document.getElementById('registerName').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        password: document.getElementById('registerPassword').value,
        phone: document.getElementById('registerPhone').value.trim(),
        address: document.getElementById('registerAddress').value.trim()
    };
    await AuthService.register(userData);
}

function handlePaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference');
    const status = window.location.pathname;

    if (status.includes('success') && reference) {
        Utils.showNotification(`Payment successful! Order reference: ${reference}`, 'success');
        AppState.cart = [];
        CartService.updateCartDisplay();
    } else if (status.includes('cancelled')) {
        Utils.showNotification('Payment was cancelled', 'warning');
    } else if (status.includes('error')) {
        Utils.showNotification('Payment failed. Please try again.', 'error');
    }
}

// Define profile functions first
function handleProfileUpdate(e) {
    e.preventDefault();
    UIHelper.handleProfileUpdate(e);
}

function handlePasswordChange(e) {
    e.preventDefault();
    UIHelper.handlePasswordChange(e);
}

function searchUsers() {
    const searchTerm = document.getElementById('userSearchInput')?.value.trim();

    if (!searchTerm) {
        Utils.showNotification('Please enter a search term', 'warning');
        return;
    }

    // If there's a specific search input in your staff dashboard, use this:
    performUserSearch(searchTerm);
}

async function performUserSearch(searchTerm) {
    try {
        Utils.showNotification(`Searching for "${searchTerm}"...`, 'info');

        const response = await ApiService.get(`/users/search?q=${encodeURIComponent(searchTerm)}`);

        if (response.success && response.users && response.users.length > 0) {
            // Display results in a specific container if you have one
            const resultsContainer = document.getElementById('userSearchResults') || document.getElementById('searchResultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = response.users.map(user => `
                    <div class="card mb-2">
                        <div class="card-body">
                            <div class="row align-items-center">
                                <div class="col-md-8">
                                    <h6 class="card-title mb-1">${user.name}</h6>
                                    <p class="card-text text-muted mb-1">${user.email}</p>
                                    <small class="text-muted">${user.phone || 'No phone'} • ${user.role}</small>
                                </div>
                                <div class="col-md-4 text-end">
                                  <button class="btn btn-sm btn-primary"
                                     onclick='showUserActivityModal(${JSON.stringify({
                    _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone
                })})'>View Activity</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                // If no specific container, show in modal
                showUserSearchModal();
                // Populate the search input
                document.getElementById('userSearchInput').value = searchTerm;
                // Trigger the search
                debouncedUserSearch();
            }
        } else {
            Utils.showNotification('No users found matching your search', 'info');
        }
    } catch (error) {
        console.error('User search error:', error);
        Utils.showNotification('Error searching users: ' + error.message, 'error');
    }
}

function selectUserForAction(userId, userName) {
    // This function can be used when you need to select a user for a specific action
    // like creating a booking, order, or gift for them

    console.log('Selected user for action:', { userId, userName });
    Utils.showNotification(`Selected: ${userName}`, 'success');

    // You can implement specific actions here, for example:
    // - Pre-fill forms with user details
    // - Set the user for a new booking/order
    // - Navigate to user details

    // Example: If you have a quick booking form
    const quickBookingUser = document.getElementById('quickBookingUser');
    if (quickBookingUser) {
        quickBookingUser.value = userName;
        quickBookingUser.dataset.userId = userId;
    }

    // Example: If you have a user details section
    const selectedUserSection = document.getElementById('selectedUserSection');
    if (selectedUserSection) {
        selectedUserSection.innerHTML = `
            <div class="alert alert-info">
                <strong>Selected User:</strong> ${userName}
                <button class="btn btn-sm btn-outline-secondary float-end" onclick="clearSelectedUser()">
                    Clear
                </button>
            </div>
        `;
        selectedUserSection.style.display = 'block';
    }
}

function clearSelectedUser() {
    const selectedUserSection = document.getElementById('selectedUserSection');
    if (selectedUserSection) {
        selectedUserSection.style.display = 'none';
    }

    const quickBookingUser = document.getElementById('quickBookingUser');
    if (quickBookingUser) {
        quickBookingUser.value = '';
        quickBookingUser.dataset.userId = '';
    }

    Utils.showNotification('User selection cleared', 'info');
}

async function loadUserActivity(user) {
    console.log('Loading activity for:', user);
    let containers = {};
    try {
        if (!user || !user._id) {
            throw new Error("No valid user specified.");
        }
        const userId = user._id;
        const isStaff = user.role === 'staff';

        console.log('📊 Loading user activity for:', userId, `(role: ${user.role})`);

        // Wait for modal to render
        await new Promise(resolve => setTimeout(resolve, 100));

        let retryCount = 0;
        const maxRetries = 5;

        // Try repeatedly to find all DOM containers
        while (retryCount < maxRetries) {
            containers = {
                userBookingsList: document.getElementById('userBookingsList'),
                userOrdersList: document.getElementById('userOrdersList'),
                userGiftsList: document.getElementById('userGiftsList'),
                totalBookingsCount: document.getElementById('totalBookingsCount'),
                totalOrdersCount: document.getElementById('totalOrdersCount'),
                totalGiftsCount: document.getElementById('totalGiftsCount'),
                totalSpent: document.getElementById('totalSpent')
            };
            const allFound = Object.values(containers).every(el => el !== null);
            if (allFound) break;
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (Object.values(containers).some(el => el === null)) {
            throw new Error("Missing one or more modal DOM containers");
        }

        resetUserActivityContainers(containers);

        // Choose correct endpoints based on role
        const ordersUrl = isStaff
            ? `/orders?processedBy=${userId}`
            : `/orders/user/${userId}`;

        const bookingsUrl = isStaff
            ? `/bookings?staff=${userId}`
            : `/bookings/user/${userId}`;

        const giftOrdersUrl = isStaff
            ? `/gift-orders?assignedStaff=${userId}`
            : `/gift-orders/user/${userId}`;

        // Parallel data loading with robust fallback
        const [bookingsRes, ordersRes, giftsRes] = await Promise.allSettled([
            ApiService.get(bookingsUrl),
            ApiService.get(ordersUrl),
            ApiService.get(giftOrdersUrl)
        ]);

        const bookings = bookingsRes.status === 'fulfilled'
            ? (Array.isArray(bookingsRes.value)
                ? bookingsRes.value
                : bookingsRes.value.bookings || bookingsRes.value.data || [])
            : [];
        const orders = ordersRes.status === 'fulfilled'
            ? (Array.isArray(ordersRes.value)
                ? ordersRes.value
                : ordersRes.value.orders || ordersRes.value.data || [])
            : [];
        const gifts = giftsRes.status === 'fulfilled'
            ? (Array.isArray(giftsRes.value)
                ? giftsRes.value
                : giftsRes.value.giftOrders || giftsRes.value.data || [])
            : [];

        // Update statistics
        if (containers.totalBookingsCount) containers.totalBookingsCount.textContent = bookings.length;
        if (containers.totalOrdersCount) containers.totalOrdersCount.textContent = orders.length;
        if (containers.totalGiftsCount) containers.totalGiftsCount.textContent = gifts.length;

        // Total spent (user only)
        const totalSpent = isStaff ? 0 : calculateUserTotalSpent(orders, bookings, gifts);
        if (containers.totalSpent) containers.totalSpent.textContent = Utils.formatCurrency(totalSpent);

        // Show data
        if (containers.userBookingsList) displayUserBookings(bookings, containers.userBookingsList);
        if (containers.userOrdersList) displayUserOrders(orders, containers.userOrdersList);
        if (containers.userGiftsList) displayUserGifts(gifts, containers.userGiftsList);

    } catch (error) {
        console.error('Error loading user activity:', error);
        Object.values(containers).forEach(container => {
            if (container && "innerHTML" in container) {
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Failed to load data: ${error.message}
                    </div>
                `;
            }
        });
    }
}



function displayUserBookings(bookings, container) {
    console.log('🎨 displayUserBookings called with:', bookings.length, 'bookings');
    console.log('🎯 Container:', container);

    if (!container) {
        console.error('❌ displayUserBookings: Container is null');
        return;
    }

    if (!bookings || bookings.length === 0) {
        console.log('ℹ️ No bookings to display');
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-calendar fa-3x mb-3"></i>
                <p>No bookings found</p>
                <small>This user hasn't made any bookings yet</small>
            </div>
        `;
        return;
    }

    console.log('📝 Rendering', bookings.length, 'bookings to DOM');

    try {
        const html = bookings.map(booking => {
            const date = booking.date ? new Date(booking.date).toLocaleDateString() : 'Date not set';
            const time = booking.time || 'Not specified';
            const serviceName = booking.service?.name || 'Service';
            const price = booking.service?.price || booking.price || 0;
            const status = booking.status || 'pending';

            console.log(`📅 Rendering booking: ${serviceName} - ${date} - ${Utils.formatCurrency(price)}`);

            return `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-4">
                                <h6 class="card-title mb-1">${serviceName}</h6>
                                <small class="text-muted">${date} at ${time}</small>
                            </div>
                            <div class="col-md-2 text-center">
                                <span class="badge bg-${Utils.getStatusColor(status)}">
                                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                            </div>
                            <div class="col-md-2">
                                <small>Staff: ${booking.staff?.name || 'Not assigned'}</small>
                            </div>
                            <div class="col-md-2 text-end">
                                <strong>${Utils.formatCurrency(price)}</strong>
                            </div>
                            <div class="col-md-2 text-end">
                                <button class="btn btn-sm btn-outline-primary" 
                                        onclick="ReceiptService.generateReceipt('booking', '${booking._id}')">
                                    <i class="fas fa-receipt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        console.log('✅ HTML generated, updating container...');
        container.innerHTML = html;
        console.log('✅ Container updated successfully');

    } catch (error) {
        console.error('❌ Error rendering bookings:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error displaying bookings: ${error.message}
            </div>
        `;
    }
}

function displayUserOrders(orders, container) {
    console.log('🎨 displayUserOrders called with:', orders.length, 'orders');
    console.log('🎯 Container:', container);

    if (!container) {
        console.error('❌ displayUserOrders: Container is null');
        return;
    }

    if (!orders || orders.length === 0) {
        console.log('ℹ️ No orders to display');
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-shopping-cart fa-3x mb-3"></i>
                <p>No orders found</p>
                <small>This user hasn't placed any orders yet</small>
            </div>
        `;
        return;
    }

    console.log('📝 Rendering', orders.length, 'orders to DOM');

    try {
        const html = orders.map(order => {
            const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Date not set';
            const itemCount = order.items ? order.items.length : 0;
            const total = order.finalTotal || order.total || 0;
            const status = order.status || 'pending';

            console.log(`🛒 Rendering order: #${order._id?.slice(-6)} - ${itemCount} items - ${Utils.formatCurrency(total)}`);

            return `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-4">
                                <h6 class="card-title mb-1">Order #${order._id ? order._id.toString().slice(-6) : 'N/A'}</h6>
                                <small class="text-muted">${date} • ${itemCount} item${itemCount !== 1 ? 's' : ''}</small>
                            </div>
                            <div class="col-md-2 text-center">
                                <span class="badge bg-${Utils.getStatusColor(status)}">
                                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                            </div>
                            <div class="col-md-2">
                                <small>Staff: ${order.processedBy?.name || 'Not assigned'}</small>
                            </div>
                            <div class="col-md-2 text-end">
                                <strong>${Utils.formatCurrency(total)}</strong>
                            </div>
                            <div class="col-md-2 text-end">
                                <button class="btn btn-sm btn-outline-primary" 
                                        onclick="ReceiptService.generateReceipt('order', '${order._id}')">
                                    <i class="fas fa-receipt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        console.log('✅ HTML generated, updating container...');
        container.innerHTML = html;
        console.log('✅ Container updated successfully');

    } catch (error) {
        console.error('❌ Error rendering orders:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error displaying orders: ${error.message}
            </div>
        `;
    }
}

function displayUserStatistics(bookings, orders, gifts, container) {
    console.log('🎨 displayUserStatistics called with:', {
        bookings: bookings.length,
        orders: orders.length,
        gifts: gifts.length
    });
    console.log('🎯 Container:', container);

    if (!container) {
        console.error('❌ displayUserStatistics: Container is null');
        return;
    }

    const totalBookings = bookings.length;
    const totalOrders = orders.length;
    const totalGifts = gifts.length;

    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const completedOrders = orders.filter(o => ['completed', 'delivered'].includes(o.status)).length;
    const deliveredGifts = gifts.filter(g => g.status === 'delivered').length;

    const totalSpent = calculateUserTotalSpent(bookings, orders, gifts);

    console.log('📊 Statistics calculated:', {
        totalBookings, completedBookings,
        totalOrders, completedOrders,
        totalGifts, deliveredGifts,
        totalSpent
    });

    try {
        const html = `
            <div class="row">
                <div class="col-md-3 mb-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body text-center">
                            <h3>${totalBookings}</h3>
                            <p class="mb-0">Total Bookings</p>
                            <small>${completedBookings} completed</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card bg-success text-white">
                        <div class="card-body text-center">
                            <h3>${totalOrders}</h3>
                            <p class="mb-0">Total Orders</p>
                            <small>${completedOrders} completed</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card bg-info text-white">
                        <div class="card-body text-center">
                            <h3>${totalGifts}</h3>
                            <p class="mb-0">Gifts Sent</p>
                            <small>${deliveredGifts} delivered</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card bg-warning text-white">
                        <div class="card-body text-center">
                            <h3>${Utils.formatCurrency(totalSpent)}</h3>
                            <p class="mb-0">Total Spent</p>
                            <small>Lifetime value</small>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mt-4">
                <h5>Activity Summary</h5>
                <div class="list-group">
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        Bookings Completion Rate
                        <span class="badge bg-primary rounded-pill">
                            ${totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0}%
                        </span>
                    </div>
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        Orders Completion Rate
                        <span class="badge bg-success rounded-pill">
                            ${totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}%
                        </span>
                    </div>
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        Average Order Value
                        <span class="badge bg-warning rounded-pill">
                            ${totalOrders > 0 ? Utils.formatCurrency(totalSpent / totalOrders) : Utils.formatCurrency(0)}
                        </span>
                    </div>
                </div>
            </div>
        `;

        console.log('✅ Statistics HTML generated, updating container...');
        container.innerHTML = html;
        console.log('✅ Statistics container updated successfully');

    } catch (error) {
        console.error('❌ Error rendering statistics:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error displaying statistics: ${error.message}
            </div>
        `;
    }
}

function checkModalVisibility() {
    const modal = document.getElementById('userActivityModal');
    if (!modal) {
        console.error('❌ Modal element not found');
        return;
    }

    console.log('🔍 Modal visibility check:');
    console.log('   Display style:', modal.style.display);
    console.log('   Class list:', modal.classList);
    console.log('   Is visible:', modal.offsetParent !== null);
    console.log('   Client dimensions:', modal.clientWidth, 'x', modal.clientHeight);

    // Check if Bootstrap thinks it's shown
    const bsModal = bootstrap.Modal.getInstance(modal);
    console.log('   Bootstrap instance:', bsModal ? 'EXISTS' : 'NULL');

    // Check tab content visibility
    const tabContent = document.getElementById('userActivityTabContent');
    if (tabContent) {
        console.log('   Tab content found:', tabContent.children.length, 'tabs');

        // Check each tab pane
        Array.from(tabContent.children).forEach((pane, index) => {
            console.log(`   Tab ${index}:`, {
                id: pane.id,
                display: pane.style.display,
                classList: pane.classList,
                isActive: pane.classList.contains('active')
            });
        });
    }
}

function verifyUserData(userId, userName) {
    console.log(`🔍 VERIFYING DATA for ${userName} (${userId})`);

    // Test all data sources to see what's actually available
    Promise.all([
        ApiService.get('/bookings?limit=100'),
        ApiService.get('/orders?limit=100'),
        ApiService.get('/gift-orders?limit=100'),
        ApiService.get('/users/staff') // Get all users to verify IDs
    ]).then(([bookings, orders, gifts, staff]) => {

        console.log('=== DATA VERIFICATION REPORT ===');
        console.log('📊 Total Bookings:', bookings.length);
        console.log('📊 Total Orders:', orders.length);
        console.log('📊 Total Gifts:', gifts.length);
        console.log('👥 Total Staff/Users:', staff.length);

        // Check what user IDs actually exist in the data
        const bookingUserIds = [...new Set(bookings.map(b => b.user?._id || b.user))];
        const orderUserIds = [...new Set(orders.map(o => o.user?._id || o.user))];
        const giftUserIds = [...new Set(gifts.map(g => g.user?._id || g.user))];

        console.log('🔍 Unique User IDs in Bookings:', bookingUserIds);
        console.log('🔍 Unique User IDs in Orders:', orderUserIds);
        console.log('🔍 Unique User IDs in Gifts:', giftUserIds);

        // Check if our target user exists in each dataset
        console.log(`🎯 Target User ${userId} exists in:`);
        console.log(`   Bookings: ${bookingUserIds.includes(userId)}`);
        console.log(`   Orders: ${orderUserIds.includes(userId)}`);
        console.log(`   Gifts: ${giftUserIds.includes(userId)}`);

        // Show actual data for this user
        const userBookings = bookings.filter(booking =>
            booking.user?._id === userId ||
            booking.staff?._id === userId
        );
        console.log(`📅 Final filtered: ${userBookings.length} bookings for user ${userId}`);

        const userOrders = ordersData.filter(order =>
            order.user?._id === userId ||
            order.processedBy?._id === userId
        );
        console.log(`🛒 Final filtered: ${userOrders.length} orders for user ${userId}`);

        const userGiftOrders = giftsData.filter(gift =>
            gift.user?._id === userId ||
            gift.processedBy?._id === userId
        );
        console.log(`🎁 Final filtered: ${userGiftOrders.length} gifts for user ${userId}`);

        console.log(`📈 Actual Data Count for ${userName}:`);
        console.log(`   Bookings: ${userBookings.length}`);
        console.log(`   Orders: ${userOrders.length}`);
        console.log(`   Gifts: ${userGifts.length}`);

        // Show sample of what the data looks like
        if (userBookings.length > 0) {
            console.log('📅 Sample Booking:', userBookings[0]);
        }
        if (userOrders.length > 0) {
            console.log('🛒 Sample Order:', userOrders[0]);
        }

    }).catch(error => {
        console.error('❌ Verification failed:', error);
    });
}

function compareAdminVsModalData(userId) {
    console.log(`🔍 COMPARING Admin Dashboard vs Modal Data for ${userId}`);

    // Load data the same way Admin Dashboard does
    Promise.all([
        ApiService.get('/orders?limit=100'),
        ApiService.get('/bookings?limit=100'),
        ApiService.get('/gift-orders?limit=100')
    ]).then(([orders, bookings, gifts]) => {

        console.log('=== ADMIN DASHBOARD DATA ===');

        // Show how Admin Dashboard would see this user
        const adminOrders = Array.isArray(orders) ? orders : (orders.orders || orders.data || []);
        const adminBookings = Array.isArray(bookings) ? bookings : (bookings.bookings || bookings.data || []);
        const adminGifts = Array.isArray(gifts) ? gifts : (gifts.giftOrders || gifts.data || []);

        const adminUserOrders = adminOrders.filter(order => {
            const orderUserId = order.user?._id || order.user;
            return orderUserId === userId;
        });

        const adminUserBookings = adminBookings.filter(booking => {
            const bookingUserId = booking.user?._id || booking.user;
            return bookingUserId === userId;
        });

        const adminUserGifts = adminGifts.filter(gift => {
            const giftUserId = gift.user?._id || gift.user;
            return giftUserId === userId;
        });

        console.log(`📊 Admin Dashboard would show:`);
        console.log(`   Orders: ${adminUserOrders.length}`);
        console.log(`   Bookings: ${adminUserBookings.length}`);
        console.log(`   Gifts: ${adminUserGifts.length}`);

        // Show the actual data structure
        if (adminUserOrders.length > 0) {
            console.log('🛒 Admin Order Sample:', JSON.stringify(adminUserOrders[0], null, 2));
        }
        if (adminUserBookings.length > 0) {
            console.log('📅 Admin Booking Sample:', JSON.stringify(adminUserBookings[0], null, 2));
        }

    }).catch(error => {
        console.error('❌ Comparison failed:', error);
    });
}

// Update display functions to accept container parameter
function displayUserBookings(bookings, container) {
    if (!container) {
        console.error('❌ displayUserBookings: Container is null');
        return;
    }

    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-calendar fa-3x mb-3"></i>
                <p>No bookings found</p>
                <small>This user hasn't made any bookings yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = bookings.map(booking => {
        const date = booking.date ? new Date(booking.date).toLocaleDateString() : 'Date not set';
        const time = booking.time || 'Not specified';
        const serviceName = booking.service?.name || 'Service';
        const price = booking.service?.price || booking.price || 0;
        const status = booking.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">${serviceName}</h6>
                            <small class="text-muted">${date} at ${time}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${booking.staff?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <strong>${Utils.formatCurrency(price)}</strong>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('booking', '${booking._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserOrders(orders, container) {
    if (!container) {
        console.error('❌ displayUserOrders: Container is null');
        return;
    }

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-shopping-cart fa-3x mb-3"></i>
                <p>No orders found</p>
                <small>This user hasn't placed any orders yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => {
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Date not set';
        const itemCount = order.items ? order.items.length : 0;
        const total = order.finalTotal || order.total || 0;
        const status = order.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">Order #${order._id ? order._id.toString().slice(-6) : 'N/A'}</h6>
                            <small class="text-muted">${date} • ${itemCount} item${itemCount !== 1 ? 's' : ''}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${order.processedBy?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <strong>${Utils.formatCurrency(total)}</strong>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('order', '${order._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserGifts(gifts, container) {
    if (!container) {
        console.error('❌ displayUserGifts: Container is null');
        return;
    }

    if (!gifts || gifts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-gift fa-3x mb-3"></i>
                <p>No gift orders found</p>
                <small>This user hasn't sent any gifts yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = gifts.map(gift => {
        const date = gift.createdAt ? new Date(gift.createdAt).toLocaleDateString() : 'Date not set';
        const deliveryDate = gift.deliveryDate ? new Date(gift.deliveryDate).toLocaleDateString() : 'Not scheduled';
        const packageName = gift.giftPackage?.name || 'Gift Package';
        const recipient = gift.recipientName || 'Unknown';
        const status = gift.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">${packageName}</h6>
                            <small class="text-muted">For: ${recipient}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Delivery: ${deliveryDate}</small>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${gift.assignedStaff?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('gift', '${gift._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserStatistics(bookings, orders, gifts, container) {
    if (!container) {
        console.error('❌ displayUserStatistics: Container is null');
        return;
    }

    const totalBookings = bookings.length;
    const totalOrders = orders.length;
    const totalGifts = gifts.length;

    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const completedOrders = orders.filter(o => ['completed', 'delivered'].includes(o.status)).length;
    const deliveredGifts = gifts.filter(g => g.status === 'delivered').length;

    const totalSpent = calculateUserTotalSpent(bookings, orders, gifts);

    container.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h3>${totalBookings}</h3>
                        <p class="mb-0">Total Bookings</p>
                        <small>${completedBookings} completed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h3>${totalOrders}</h3>
                        <p class="mb-0">Total Orders</p>
                        <small>${completedOrders} completed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h3>${totalGifts}</h3>
                        <p class="mb-0">Gifts Sent</p>
                        <small>${deliveredGifts} delivered</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-warning text-white">
                    <div class="card-body text-center">
                        <h3>${Utils.formatCurrency(totalSpent)}</h3>
                        <p class="mb-0">Total Spent</p>
                        <small>Lifetime value</small>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-4">
            <h5>Activity Summary</h5>
            <div class="list-group">
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Bookings Completion Rate
                    <span class="badge bg-primary rounded-pill">
                        ${totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0}%
                    </span>
                </div>
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Orders Completion Rate
                    <span class="badge bg-success rounded-pill">
                        ${totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}%
                    </span>
                </div>
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Average Order Value
                    <span class="badge bg-warning rounded-pill">
                        ${totalOrders > 0 ? Utils.formatCurrency(totalSpent / totalOrders) : Utils.formatCurrency(0)}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function calculateUserTotalSpent(orders, bookings, gifts) {
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

function displayUserBookings(bookings, container) {
    if (!container) return;

    if (bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-calendar fa-2x mb-3"></i>
                <p>No bookings found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Staff</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${bookings.map(booking => `
                    <tr>
                        <td>${new Date(booking.date).toLocaleDateString()}</td>
                        <td>${booking.service?.name || 'Service'}</td>
                        <td>${booking.staff?.name || 'Not assigned'}</td>
                        <td>${booking.time || 'N/A'}</td>
                        <td>
                            <span class="badge bg-${Utils.getStatusColor(booking.status)}">
                                ${booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
                            </span>
                        </td>
                        <td>${Utils.formatCurrency(booking.service?.price || booking.price || 0)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function displayUserOrders(orders, container) {
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-shopping-cart fa-2x mb-3"></i>
                <p>No orders found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Staff</th>
                    <th>Status</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(order => `
                    <tr>
                        <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                        <td>${order.items?.length || 0} items</td>
                        <td>${order.processedBy?.name || 'Not assigned'}</td>
                        <td>
                            <span class="badge bg-${Utils.getStatusColor(order.status)}">
                                ${order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                            </span>
                        </td>
                        <td>${Utils.formatCurrency(order.finalTotal || order.total || 0)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function displayUserGifts(gifts, container) {
    if (!container) return;

    if (gifts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-gift fa-2x mb-3"></i>
                <p>No gift orders found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Recipient</th>
                    <th>Package</th>
                    <th>Delivery Date</th>
                    <th>Status</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${gifts.map(gift => `
                    <tr>
                        <td>${new Date(gift.createdAt).toLocaleDateString()}</td>
                        <td>${gift.recipientName}</td>
                        <td>${gift.giftPackage?.name || 'Package'}</td>
                        <td>${new Date(gift.deliveryDate).toLocaleDateString()}</td>
                        <td>
                            <span class="badge bg-${Utils.getStatusColor(gift.status)}">
                                ${gift.status?.charAt(0).toUpperCase() + gift.status?.slice(1)}
                            </span>
                        </td>
                        <td>${Utils.formatCurrency(gift.price || gift.total || gift.giftPackage?.basePrice || 0)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function exportUserActivity() {
    // Simple export functionality
    const modal = document.getElementById('userActivityModal');
    const content = modal.querySelector('.modal-body').innerText;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-activity-${window.currentSelectedUser?.name || 'user'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function resetUserActivityContainers(containers) {
    Object.keys(containers).forEach(containerKey => {
        const container = containers[containerKey];
        if (container && container.innerHTML !== undefined) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading data...</p>
                </div>
            `;
        } else {
            console.warn(`⚠️ Container ${containerKey} not found during reset`);
        }
    });
}

function showUserActivityError(message) {
    const containers = [
        'userBookingsList',
        'userOrdersList',
        'userGiftsList',
        'userStats'
    ];

    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                </div>
            `;
        }
    });
}



function resetUserActivityContainers() {
    const containers = [
        'userBookingsList',
        'userOrdersList',
        'userGiftsList',
        'userStats'
    ];

    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading data...</p>
                </div>
            `;
        } else {
            console.warn(`⚠️ Container ${containerId} not found during reset`);
        }
    });
}

function resetUserActivityContainers() {
    const containers = [
        'userBookingsList',
        'userOrdersList',
        'userGiftsList',
        'userStats'
    ];

    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading data...</p>
                </div>
            `;
        }
    });
}

function showUserActivityError(message) {
    const containers = [
        'userBookingsList',
        'userOrdersList',
        'userGiftsList',
        'userStats'
    ];

    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                </div>
            `;
        }
    });
}

// Update the display functions to handle null containers safely
function displayUserBookings(bookings) {
    const container = document.getElementById('userBookingsList');
    if (!container) {
        console.error('❌ userBookingsList container not found');
        return;
    }

    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-calendar fa-3x mb-3"></i>
                <p>No bookings found</p>
                <small>This user hasn't made any bookings yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = bookings.map(booking => {
        const date = booking.date ? new Date(booking.date).toLocaleDateString() : 'Date not set';
        const time = booking.time || 'Not specified';
        const serviceName = booking.service?.name || 'Service';
        const price = booking.service?.price || booking.price || 0;
        const status = booking.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">${serviceName}</h6>
                            <small class="text-muted">${date} at ${time}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${booking.staff?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <strong>${Utils.formatCurrency(price)}</strong>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('booking', '${booking._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserOrders(orders) {
    const container = document.getElementById('userOrdersList');
    if (!container) {
        console.error('❌ userOrdersList container not found');
        return;
    }

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-shopping-cart fa-3x mb-3"></i>
                <p>No orders found</p>
                <small>This user hasn't placed any orders yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => {
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Date not set';
        const itemCount = order.items ? order.items.length : 0;
        const total = order.finalTotal || order.total || 0;
        const status = order.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">Order #${order._id ? order._id.toString().slice(-6) : 'N/A'}</h6>
                            <small class="text-muted">${date} • ${itemCount} item${itemCount !== 1 ? 's' : ''}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${order.processedBy?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <strong>${Utils.formatCurrency(total)}</strong>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('order', '${order._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserGifts(gifts) {
    const container = document.getElementById('userGiftsList');
    if (!container) {
        console.error('❌ userGiftsList container not found');
        return;
    }

    if (!gifts || gifts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-gift fa-3x mb-3"></i>
                <p>No gift orders found</p>
                <small>This user hasn't sent any gifts yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = gifts.map(gift => {
        const date = gift.createdAt ? new Date(gift.createdAt).toLocaleDateString() : 'Date not set';
        const deliveryDate = gift.deliveryDate ? new Date(gift.deliveryDate).toLocaleDateString() : 'Not scheduled';
        const packageName = gift.giftPackage?.name || 'Gift Package';
        const recipient = gift.recipientName || 'Unknown';
        const status = gift.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">${packageName}</h6>
                            <small class="text-muted">For: ${recipient}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Delivery: ${deliveryDate}</small>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${gift.assignedStaff?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('gift', '${gift._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserStatistics(bookings, orders, gifts) {
    const container = document.getElementById('userStats');
    if (!container) {
        console.error('❌ userStats container not found');
        return;
    }

    const totalBookings = bookings.length;
    const totalOrders = orders.length;
    const totalGifts = gifts.length;

    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const completedOrders = orders.filter(o => ['completed', 'delivered'].includes(o.status)).length;
    const deliveredGifts = gifts.filter(g => g.status === 'delivered').length;

    const totalSpent = calculateUserTotalSpent(bookings, orders, gifts);

    container.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h3>${totalBookings}</h3>
                        <p class="mb-0">Total Bookings</p>
                        <small>${completedBookings} completed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h3>${totalOrders}</h3>
                        <p class="mb-0">Total Orders</p>
                        <small>${completedOrders} completed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h3>${totalGifts}</h3>
                        <p class="mb-0">Gifts Sent</p>
                        <small>${deliveredGifts} delivered</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-warning text-white">
                    <div class="card-body text-center">
                        <h3>${Utils.formatCurrency(totalSpent)}</h3>
                        <p class="mb-0">Total Spent</p>
                        <small>Lifetime value</small>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-4">
            <h5>Activity Summary</h5>
            <div class="list-group">
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Bookings Completion Rate
                    <span class="badge bg-primary rounded-pill">
                        ${totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0}%
                    </span>
                </div>
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Orders Completion Rate
                    <span class="badge bg-success rounded-pill">
                        ${totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}%
                    </span>
                </div>
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Average Order Value
                    <span class="badge bg-warning rounded-pill">
                        ${totalOrders > 0 ? Utils.formatCurrency(totalSpent / totalOrders) : Utils.formatCurrency(0)}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function displayUserBookings(bookings) {
    const container = document.getElementById('userBookingsList');

    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-calendar fa-3x mb-3"></i>
                <p>No bookings found</p>
                <small>This user hasn't made any bookings yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = bookings.map(booking => {
        const date = new Date(booking.date).toLocaleDateString();
        const time = booking.time || 'Not specified';
        const serviceName = booking.service?.name || 'Service';
        const price = booking.service?.price || booking.price || 0;
        const status = booking.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">${serviceName}</h6>
                            <small class="text-muted">${date} at ${time}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${booking.staff?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <strong>${Utils.formatCurrency(price)}</strong>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('booking', '${booking._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-secondary ms-1" 
                                    onclick="editBooking('${booking._id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserOrders(orders) {
    const container = document.getElementById('userOrdersList');

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-shopping-cart fa-3x mb-3"></i>
                <p>No orders found</p>
                <small>This user hasn't placed any orders yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => {
        const date = new Date(order.createdAt).toLocaleDateString();
        const itemCount = order.items ? order.items.length : 0;
        const total = order.finalTotal || order.total || 0;
        const status = order.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">Order #${order._id.toString().slice(-6)}</h6>
                            <small class="text-muted">${date} • ${itemCount} item${itemCount !== 1 ? 's' : ''}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${order.processedBy?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <strong>${Utils.formatCurrency(total)}</strong>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('order', '${order._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserGifts(gifts) {
    const container = document.getElementById('userGiftsList');

    if (!gifts || gifts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-gift fa-3x mb-3"></i>
                <p>No gift orders found</p>
                <small>This user hasn't sent any gifts yet</small>
            </div>
        `;
        return;
    }

    container.innerHTML = gifts.map(gift => {
        const date = new Date(gift.createdAt).toLocaleDateString();
        const deliveryDate = gift.deliveryDate ? new Date(gift.deliveryDate).toLocaleDateString() : 'Not scheduled';
        const packageName = gift.giftPackage?.name || 'Gift Package';
        const recipient = gift.recipientName || 'Unknown';
        const status = gift.status || 'pending';

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <h6 class="card-title mb-1">${packageName}</h6>
                            <small class="text-muted">For: ${recipient}</small>
                        </div>
                        <div class="col-md-2 text-center">
                            <span class="badge bg-${Utils.getStatusColor(status)}">
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small>Delivery: ${deliveryDate}</small>
                        </div>
                        <div class="col-md-2">
                            <small>Staff: ${gift.assignedStaff?.name || 'Not assigned'}</small>
                        </div>
                        <div class="col-md-2 text-end">
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="ReceiptService.generateReceipt('gift', '${gift._id}')">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayUserStatistics(bookings, orders, gifts) {
    const container = document.getElementById('userStats');

    const totalBookings = bookings.length;
    const totalOrders = orders.length;
    const totalGifts = gifts.length;

    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const completedOrders = orders.filter(o => ['completed', 'delivered'].includes(o.status)).length;
    const deliveredGifts = gifts.filter(g => g.status === 'delivered').length;

    const totalSpent = calculateUserTotalSpent(bookings, orders, gifts);

    container.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h3>${totalBookings}</h3>
                        <p class="mb-0">Total Bookings</p>
                        <small>${completedBookings} completed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h3>${totalOrders}</h3>
                        <p class="mb-0">Total Orders</p>
                        <small>${completedOrders} completed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h3>${totalGifts}</h3>
                        <p class="mb-0">Gifts Sent</p>
                        <small>${deliveredGifts} delivered</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-warning text-white">
                    <div class="card-body text-center">
                        <h3>${Utils.formatCurrency(totalSpent)}</h3>
                        <p class="mb-0">Total Spent</p>
                        <small>Lifetime value</small>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-4">
            <h5>Activity Summary</h5>
            <div class="list-group">
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Bookings Completion Rate
                    <span class="badge bg-primary rounded-pill">
                        ${totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0}%
                    </span>
                </div>
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Orders Completion Rate
                    <span class="badge bg-success rounded-pill">
                        ${totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}%
                    </span>
                </div>
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    Average Order Value
                    <span class="badge bg-warning rounded-pill">
                        ${totalOrders > 0 ? Utils.formatCurrency(totalSpent / totalOrders) : Utils.formatCurrency(0)}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function fixModalTabs() {
    console.log('🔧 Fixing modal tabs visibility...');

    const tabPanes = [
        document.getElementById('bookings'),
        document.getElementById('orders'),
        document.getElementById('gifts'),
        document.getElementById('stats')
    ];

    tabPanes.forEach((pane, index) => {
        if (pane) {
            console.log(`🔧 Tab ${index} (${pane.id}):`, {
                before: pane.style.display,
                classes: pane.classList
            });

            // Force show the first tab, hide others
            if (index === 0) {
                pane.style.display = 'block';
                pane.classList.add('show', 'active');
            } else {
                pane.style.display = 'none';
                pane.classList.remove('show', 'active');
            }

            console.log(`🔧 Tab ${index} after fix:`, pane.style.display);
        }
    });
}

// Quick action functions
function createQuickBooking() {
    if (!window.currentSelectedUser) {
        Utils.showNotification('No user selected', 'warning');
        return;
    }

    Utils.showNotification(`Creating quick booking for ${window.currentSelectedUser.name}`, 'info');
    // Close the modal and navigate to bookings section
    const modal = bootstrap.Modal.getInstance(document.getElementById('userActivityModal'));
    if (modal) modal.hide();

    // Navigate to services and pre-fill user info
    UIHelper.showSection('services');
    // You can add logic here to pre-fill the booking form with user info
}

function createQuickOrder() {
    if (!window.currentSelectedUser) {
        Utils.showNotification('No user selected', 'warning');
        return;
    }

    Utils.showNotification(`Creating quick order for ${window.currentSelectedUser.name}`, 'info');
    // Close the modal and navigate to shop
    const modal = bootstrap.Modal.getInstance(document.getElementById('userActivityModal'));
    if (modal) modal.hide();

    UIHelper.showSection('shop');
    // You can add logic here to pre-fill order info
}

function createGiftForUser() {
    if (!window.currentSelectedUser) {
        Utils.showNotification('No user selected', 'warning');
        return;
    }

    Utils.showNotification(`Creating gift for ${window.currentSelectedUser.name}`, 'info');
    // Close the modal and navigate to gifts
    const modal = bootstrap.Modal.getInstance(document.getElementById('userActivityModal'));
    if (modal) modal.hide();

    UIHelper.showSection('giftPackages');
    // You can add logic here to pre-fill gift recipient info
}

function printUserActivity() {
    // Print functionality for user activity report
    const printWindow = window.open('', '_blank');
    const userName = document.getElementById('userActivityName').textContent;
    const userEmail = document.getElementById('userActivityEmail').textContent;

    printWindow.document.write(`
        <html>
            <head>
                <title>User Activity Report - ${userName}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .card { border: 1px solid #ddd; margin-bottom: 10px; padding: 15px; }
                    .badge { padding: 5px 10px; border-radius: 4px; }
                    .text-end { text-align: right; }
                    .text-center { text-align: center; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <h2>User Activity Report</h2>
                <p><strong>User:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userEmail}</p>
                <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
                <hr>
                <div id="printContent">
                    ${document.getElementById('userActivityTabContent').innerHTML}
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Update the selectUser function to show the activity modal
function selectUser(user, userName, userEmail) {
    console.log('🎯 selectUser called with:', { user, userName, userEmail });

    // Show the user activity modal with email
    showUserActivityModal(user);

    // Close the search modal if it's open
    const searchModal = bootstrap.Modal.getInstance(document.getElementById('userSearchModal'));
    if (searchModal) {
        console.log('🔒 Closing search modal');
        searchModal.hide();
    } else {
        console.log('⚠️ Search modal not found or already closed');
    }
}

function openSecondModal() {
    // Grab the currently open modal, and the one you want to open
    var firstModal = bootstrap.Modal.getInstance(document.getElementById('firstModal'));
    var secondModal = new bootstrap.Modal(document.getElementById('secondModal'));

    // If the first modal is open, close it
    if (firstModal) {
        firstModal.hide();
    }

    // Then open the new modal
    secondModal.show();
}

function openModalAndClosePrevious(previousModalId, nextModalId) {
    var prevModal = bootstrap.Modal.getInstance(document.getElementById(previousModalId));
    var nextModal = new bootstrap.Modal(document.getElementById(nextModalId));
    if (prevModal) { prevModal.hide(); }
    nextModal.show();
}


// ===== USER ACTIVITY MODAL =====
function showUserActivityModal(user) {
    console.log('showUserActivityModal:', user);

    // Defensive check
    if (!user || !user._id) {
        Utils.showNotification("No user information provided for activity lookup.", "error");
        return;
    }

    // Store the current selected user globally for access in other functions
    window.currentSelectedUser = user;

    // Create the modal if it doesn't exist
    if (!document.getElementById('userActivityModal')) {
        const modalHTML = `
        <div class="modal fade" id="userActivityModal" tabindex="-1" aria-labelledby="userActivityModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="userActivityModalLabel">
                            <i class="fas fa-user-clock me-2"></i>
                            User Activity: <span id="userActivityName">${user.name}</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <!-- ... [content unchanged, IDs included] ... -->
                        <!-- Keep your stats, tab nav, userBookingsList, etc -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="exportUserActivity()">
                            <i class="fas fa-download me-2"></i>Export Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Update the user name in the modal
    const userNameElement = document.getElementById('userActivityName');
    if (userNameElement) {
        userNameElement.textContent = user.name;
    }

    // Show the modal
    openModalAndClosePrevious('userSearchModal', 'userActivityModal');

    // Load user activity data
    loadUserActivity(user);
}



function resetUserActivityContainers(containers) {
    // Reset all containers to loading state
    Object.keys(containers).forEach(key => {
        const container = containers[key];
        if (container) {
            if (key.includes('List')) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Loading...</p>
                    </div>
                `;
            } else if (key === 'userStats') {
                // Reset stats to zero
                const statElements = container.querySelectorAll('[id$="Count"], #totalSpent');
                statElements.forEach(el => {
                    if (el.id === 'totalSpent') {
                        el.textContent = 'R 0.00';
                    } else {
                        el.textContent = '0';
                    }
                });
            }
        }
    });
}

// Ensure all forms have proper event listeners
function initializeEventListeners() {
    // Admin form submission
    const adminForm = document.getElementById('adminActionForm');
    if (adminForm) {
        adminForm.addEventListener('submit', function (e) {
            e.preventDefault();
            submitAdminAction();
        });
    }

    // Other form listeners...
    console.log('✅ Registered all event listeners');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Initializing Tassel Group Application');

    // Check if already initialized
    if (AppState.isInitialized) {
        console.log('⚠️ App already initialized');
        return;
    }

    // Initialize app state
    const token = Utils.getAuthToken();
    const savedUser = localStorage.getItem('currentUser');

    if (token && savedUser) {
        try {
            AppState.currentUser = Utils.safeParseJSON(savedUser);
            // Update UI to show user menu
            UIHelper.updateUIForUser();

            setTimeout(() => StaffService.populateStaffDropdowns(), 100);

            if (AppState.currentUser.role === 'admin') {
                setTimeout(() => {
                    AdminNotificationService.startPeriodicChecking();
                }, 3000);
            }
        } catch (error) {
            console.error('Error parsing saved user:', error);
            AuthService.logout();
        }
    } else {
        // Ensure UI shows logged out state (login button)
        UIHelper.updateUIForUser();
    }

    // Set up form event listeners - UPDATED WITH BOTH PROFILE FORMS
    const forms = {
        'loginFormElement': handleLogin,
        'registerFormElement': handleRegister,
        'bookingDetailsForm': ServiceManager.confirmBooking,
        'giftCustomizationForm': GiftService.createGift,
        'profileForm': UIHelper.handleProfileUpdate,
        'passwordForm': UIHelper.handlePasswordChange
    };

    Object.entries(forms).forEach(([formId, handler]) => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', handler);
            console.log(`✅ Registered event listener for form: ${formId}`);
        } else {
            console.warn(`❌ Form ${formId} not found during initialization`);
        }
    });

    // Hide global loading overlay
    const globalLoading = document.getElementById('globalLoading');
    if (globalLoading) {
        globalLoading.style.display = 'none';
    }

    // Pre-create admin modal
    ensureAdminModalExists();

    // Set minimum dates and load initial data
    Utils.setMinimumDates();

    window.showUserSearchModal = showUserSearchModal;
    window.showMyReceipts = showMyReceipts;
    window.debouncedUserSearch = debouncedUserSearch;
    window.selectUser = selectUser;
    window.printReceiptsSummary = printReceiptsSummary;
    window.searchUsers = searchUsers;
    window.performUserSearch = performUserSearch;
    window.selectUserForAction = selectUserForAction;
    window.clearSelectedUser = clearSelectedUser;
    window.showUserActivityModal = showUserActivityModal;
    window.createQuickBooking = createQuickBooking;
    window.createQuickOrder = createQuickOrder;
    window.createGiftForUser = createGiftForUser;
    window.printUserActivity = printUserActivity;

    // Load data with staggered timing to avoid overwhelming the server
    setTimeout(() => ProductService.loadProducts(), 100);
    setTimeout(() => ServiceManager.loadServices(), 300);
    setTimeout(() => GiftService.loadGiftPackages(), 500);

    handlePaymentReturn();
    // Ensure bulk assignment modal exists during initialization
    ensureBulkAssignmentModalExists();

    AppState.isInitialized = true;
    console.log('✅ Application initialized successfully');
});

// Global functions for HTML onclick handlers
function showSection(sectionId) {
    UIHelper.showSection(sectionId);
}

function logout() {
    AuthService.logout();
}

function initCheckout() {
    CartService.showPaymentOptions();
}

function printReceipt() {
    window.print();
}