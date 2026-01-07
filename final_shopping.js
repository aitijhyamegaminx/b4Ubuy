let cartItems = [];
let pickedCount = 0;

document.addEventListener('DOMContentLoaded', function () {
    loadLockedCart();
    loadFinalList();
});

function loadLockedCart() {
    const lockedCart = localStorage.getItem('b4ubuy_locked_cart');

    if (!lockedCart) {
        console.error('[final_shopping] No locked cart found');
        cartItems = [];
        return;
    }

    try {
        cartItems = JSON.parse(lockedCart);
        console.log('[final_shopping] Loaded', cartItems.length, 'items');
    } catch (e) {
        console.error('[final_shopping] Error parsing cart:', e);
        cartItems = [];
    }
}

function loadFinalList() {
    const shoppingList = document.getElementById('shopping-list');

    if (!shoppingList) {
        console.error('[final_shopping] shopping-list element not found');
        return;
    }

    if (cartItems.length === 0) {
        shoppingList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">🛒</div>
                <p>No items in your shopping list</p>
                <button onclick="window.location.href='cart.html'" 
                        style="margin-top: 16px; padding: 10px 20px; background: #020617; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Go Back to Cart
                </button>
            </div>
        `;
        return;
    }

    shoppingList.innerHTML = '';
    cartItems.forEach((item, index) => {
        const itemDiv = createShoppingItem(item, index);
        shoppingList.appendChild(itemDiv);
    });

    // All items are unchecked by default
    pickedCount = 0;
    updateProgress();
}

function getProductImage(name) {
    if (!name) return 'images/default.jpg';

    const fileName = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');

    return `images/${fileName}.jpg`;
}

function createShoppingItem(item, itemId) {
    const div = document.createElement('div');
    div.className = 'shopping-item';
    div.setAttribute('data-item-id', itemId);

    const nutriClass = getNutriClass(item.nutriscore);

    div.innerHTML = `
        <input type="checkbox" 
               class="item-checkbox" 
               id="checkbox-${itemId}" 
               onchange="togglePicked(${itemId})">
        <label for="checkbox-${itemId}" class="checkbox-label">
            <div class="nutri-indicator ${nutriClass}"></div>
            <img src="${getProductImage(item.name)}"
                alt="${item.name}"
                class="item-image"
                onerror="this.onerror=null; this.src='images/default.jpg'">

            <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-quantity">${item.quantity}x · ${item.brand || 'Generic'}</div>
            </div>
        </label>
    `;

    return div;
}

function getNutriClass(grade) {
    const gradeMap = {
        'a': 'nutri-a',
        'b': 'nutri-b',
        'c': 'nutri-c',
        'd': 'nutri-d',
        'e': 'nutri-e'
    };
    return gradeMap[grade?.toLowerCase()] || 'nutri-c';
}

function togglePicked(itemId) {
    const checkbox = document.getElementById(`checkbox-${itemId}`);
    const itemDiv = document.querySelector(`[data-item-id="${itemId}"]`);

    if (!checkbox || !itemDiv) return;

    if (checkbox.checked) {
        itemDiv.classList.remove('unchecked');
        pickedCount++;
    } else {
        itemDiv.classList.add('unchecked');
        pickedCount--;
    }

    updateProgress();
}

function updateProgress() {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const completeBtn = document.getElementById('complete-btn');

    const total = cartItems.length;
    const percentage = total > 0 ? Math.round((pickedCount / total) * 100) : 0;

    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent = `${pickedCount} of ${total} items picked`;
    }

    // Update button state
    if (completeBtn) {
        if (pickedCount === total) {
            completeBtn.classList.add('all-picked');
            completeBtn.innerHTML = '✓ All Items Picked - Complete Shopping';
        } else {
            completeBtn.classList.remove('all-picked');
            completeBtn.innerHTML = `Complete Shopping (${pickedCount}/${total})`;
        }
    }
}

function completeShopping() {
    if (pickedCount < cartItems.length) {
        const remaining = cartItems.length - pickedCount;
        const confirmMsg = `You have ${remaining} item${remaining > 1 ? 's' : ''} not picked. Complete anyway?`;
        if (!confirm(confirmMsg)) {
            return;
        }
    }

    alert('Shopping completed! 🎉');

    // Clear cart
    localStorage.removeItem('b4ubuy_cart');
    localStorage.removeItem('b4ubuy_locked_cart');

    // Redirect to home
    window.location.href = 'index.html';
}

function goBack() {
    if (confirm('Go back to cart? Your shopping progress will be lost.')) {
        window.location.href = 'cart.html';
    }
}
