// Load cart from localStorage (or use global cart object if on same domain)
let cart = JSON.parse(localStorage.getItem('b4ubuy_cart')) || {};
let products = JSON.parse(localStorage.getItem('b4ubuy_products')) || [];

document.addEventListener("DOMContentLoaded", () => {
    loadCartItems();
    updateTotals();
});

function goBack() {
    window.history.back();
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
        const nutriColor = getNutriColor(nutriGrade);

        const item = document.createElement("div");
        item.className = "cart-item";

        item.innerHTML = `
      <div class="nutri-indicator nutri-${nutriGrade}"></div>
      <img class="item-image" src="default.jpg" alt="${product.product_name_en}" />
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

function getNutriColor(grade) {
    const colors = {
        'a': '#038153',
        'b': '#85bb2f',
        'c': '#fecb02',
        'd': '#ee8100',
        'e': '#e63e11'
    };
    return colors[grade] || colors['d'];
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
