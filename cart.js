// Load cart from localStorage
let cart = JSON.parse(localStorage.getItem('b4ubuy_cart')) || {};
let products = JSON.parse(localStorage.getItem('b4ubuy_products')) || [];

document.addEventListener("DOMContentLoaded", () => {
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
        const product = products.find(p =>
            `${p.product_name_en}_${p.brands}`.replace(/[^a-zA-Z0-9]/g, '_') === productId
        );

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
                <div class="item-quantity">${product.quantity || "N/A"}</div>
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
}

function getNutriGrade(product) {
    let grade = (product['off:nutriscore_grade'] || "").trim().toLowerCase();
    if (!grade || grade === 'unknown' || grade === 'not-applicable') {
        grade = 'd';
    }
    return grade;
}

function incrementItem(productId) {
    cart[productId] = (cart[productId] || 0) + 1;
    saveCart();
    loadCartItems();
    updateTotals();
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
}

function saveCart() {
    localStorage.setItem('b4ubuy_cart', JSON.stringify(cart));
}

function updateTotals() {
    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    const totalAmount = totalItems * 89; // Mock pricing

    document.getElementById("item-count").textContent = `${totalItems} items`;
    document.getElementById("total-amount").textContent = `₹${totalAmount}`;
    document.getElementById("lock-count").textContent = totalItems;
}
