// Load cart from localStorage
let cart = JSON.parse(localStorage.getItem('b4ubuy_cart')) || {};
function loadProducts() {
    return JSON.parse(localStorage.getItem('b4ubuy_products')) || [];
}

document.addEventListener("DOMContentLoaded", () => {
    pruneUnknownCartItems();
    loadCartItems();
    updateTotals();
});

function goBack() {
    window.history.back();
}

function sanitizeFilename(str) {
    if (!str) return 'default';
    return str.toLowerCase().trim().replace(/\s+/g, '_');
}

function loadCartItems() {
    const products = loadProducts();
    const container = document.getElementById("cart-items");
    const cartKeys = Object.keys(cart);

    if (cartKeys.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <p>Your cart is empty</p>
            </div>
        `;
        return;
    }

    container.innerHTML = "";

    cartKeys.forEach(productId => {
        const quantity = cart[productId];
        const product = products.find(p => {
            const name = (p.product_name_en || p.product_name || '').trim();
            const brand = (p.brands || 'Fresh').trim();
        
            const pid = `${name}_${brand}`.replace(/[^a-zA-Z0-9]/g, '_');
            return pid === productId;
        });
        
        if (!product) return;

        const nutriGrade = getNutriGrade(product);
        
        // Create product-specific image path with fallback
        const productNameSanitized = sanitizeFilename(product.product_name_en);
        const productImagePath = `images/${productNameSanitized}.jpg`;

        const item = document.createElement("div");
        item.className = "cart-item";

        item.innerHTML = `
            <div class="nutri-indicator nutri-${nutriGrade}"></div>
            <img 
                class="item-image" 
                src="${productImagePath}" 
                onerror="this.src='images/default.jpg'"
                alt="${product.product_name_en}" 
            />
            <div class="item-details">
                <div class="item-name">${product.product_name_en || "N/A"}</div>
                <div class="item-quantity">
                    ${product.mock_product ? 'N/A' : (product.quantity || 'N/A')}
                </div>
                <div class="item-added-by">Added by You</div>
                <div class="item-footer">
                    <div class="item-price">₹89</div>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="decrementItem('${productId}')">−</button>
                        <div class="qty-display">${quantity}</div>
                        <button class="qty-btn" onclick="incrementItem('${productId}')">+</button>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(item);
    });
    if (window.analyzeCart) analyzeCart();
}

function getNutriGrade(product) {
    let grade = (product['off:nutriscore_grade'] || "").trim().toLowerCase();
    if (!grade || grade === 'unknown' || grade === 'not-applicable') {
        grade = 'b';
    }
    return grade;
}

function incrementItem(productId) {
    cart[productId] = (cart[productId] || 0) + 1;
    saveCart();
    loadCartItems();
    updateTotals();
    if (window.analyzeCart) analyzeCart();
}

function decrementItem(productId) {
    if (cart[productId] > 1) {
        cart[productId]--;
    } else {
        delete cart[productId];
    }
    saveCart();
    loadCartItems();
    updateTotals();
    if (window.analyzeCart) analyzeCart();
}

function saveCart() {
    localStorage.setItem('b4ubuy_cart', JSON.stringify(cart));
}

function pruneUnknownCartItems() {
    try {
        const keys = Object.keys(cart);
        if (keys.length === 0) return;

        let products = JSON.parse(localStorage.getItem('b4ubuy_products')) || [];
        if (products.length === 0) return;

        keys.forEach(id => {
            const exists = products.some(p =>
                `${(p.product_name_en || '').trim()}_${(p.brands || '').trim()}`
                    .replace(/[^a-zA-Z0-9]/g, '_') === id
            );

            if (!exists) {
                // 🚫 DO NOT DELETE
                console.warn('Cart item missing product metadata, keeping:', id);
            }
        });

    } catch (e) {
        console.warn('Error pruning cart items:', e);
    }
}


function updateTotals() {
    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    const totalAmount = totalItems * 89; // Mock pricing

    document.getElementById("item-count").textContent = `${totalItems} items`;
    document.getElementById("total-amount").textContent = `₹${totalAmount}`;
    document.getElementById("lock-count").textContent = totalItems;
}

// Lock cart function - saves cart and navigates to final shopping
function lockCart() {
    const cartObj = JSON.parse(localStorage.getItem('b4ubuy_cart') || '{}');
    const products = JSON.parse(localStorage.getItem('b4ubuy_products') || '[]');
    
    // Build locked cart items array
    const lockedItems = [];
    
    for (const productId in cartObj) {
        const quantity = cartObj[productId];
        if (quantity > 0) {
            const product = products.find(p => {
                const pid = `${p.product_name_en}_${p.brands}`.replace(/[^a-zA-Z0-9]/g, '_');
                return pid === productId;
            });
            
            if (product) {
                lockedItems.push({
                    id: productId,
                    name: product.product_name_en || 'Unknown Product',
                    quantity: quantity,
                    packageQuantity: product.quantity || 'N/A',
                    nutriscore: (product['off:nutriscore_grade'] || 'd').toLowerCase(),
                    brands: product.brands || '',
                    picked: false  // For shopping list tracking
                });
            }
        }
    }
    
    if (lockedItems.length === 0) {
        alert('Your cart is empty! Add items before locking.');
        return;
    }
    
    // Save locked cart to localStorage
    localStorage.setItem('b4ubuy_locked_cart', JSON.stringify(lockedItems));
    
    console.log(`✅ Locked ${lockedItems.length} items`);
    
    // Navigate to final shopping page
    window.location.href = 'final_shopping.html';
}
