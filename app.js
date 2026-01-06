// ===== IN-MEMORY DATABASE =====
const db = {
    sessions: []
};

// ===== SHOPPING DATA =====
let csvData = [];
let allCategories = new Set();
let cart = {};
let currentFilter = "All";
let csvLoaded = false;
let selectedDietFilters = [];
let selectedAllergenFilters = [];
let nutriMaxActive = false;

// ===== ONBOARDING LOGIC =====
function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");

    // If navigating to shopping screen, load products if not already loaded
    if (id === "screen-shopping" && !csvLoaded) {
        loadCSV();
    }
}

// Group tag selection
document.addEventListener("DOMContentLoaded", () => {
    const tagContainer = document.getElementById("group-tags");
    if (tagContainer) {
        tagContainer.addEventListener("click", (e) => {
            const tag = e.target.closest(".tag");
            if (!tag) return;
            [...tagContainer.querySelectorAll(".tag")].forEach(t => t.classList.remove("active"));
            tag.classList.add("active");

            const isCustom = tag.dataset.value === "Custom";
            const customWrap = document.getElementById("custom-group-wrap");
            if (customWrap) {
                customWrap.style.display = isCustom ? "block" : "none";
                if (!isCustom) {
                    document.getElementById("custom-group-name").value = "";
                }
            }
        });
    }
    setupFilterListeners();
});

function addPerson() {
    const container = document.getElementById("people-container");
    const block = document.createElement("div");
    block.className = "person-block";

    const memberCount = container.querySelectorAll(".person-block").length + 1;

    block.innerHTML = `
      <div class="group-member-label">Member ${memberCount}</div>
      <div class="field">
        <label>Name</label>
        <input type="text" class="person-name" placeholder="Name" />
      </div>
      <div class="field">
        <label>Phone or email</label>
        <input type="text" class="person-contact" placeholder="Phone or email" />
      </div>
    `;
    container.appendChild(block);
}

function getSelectedGroup() {
    const active = document.querySelector(".group-tags .tag.active");
    if (!active) return null;
    const value = active.dataset.value;
    if (value === "Custom") {
        const customName = document.getElementById("custom-group-name").value.trim();
        return customName || "Custom";
    }
    return value;
}

function savePrimaryUser() {
    const contact = document.getElementById("signin-contact").value.trim();
    const name = document.getElementById("signin-name").value.trim();

    if (!contact && !name) {
        alert("Please enter at least name or contact in Welcome screen.");
        return false;
    }

    return { name, contact };
}

function saveAndContinue() {
    const primaryUser = savePrimaryUser();
    if (!primaryUser) return;

    const group = getSelectedGroup();
    const people = [];
    document.querySelectorAll(".person-block").forEach(block => {
        const n = block.querySelector(".person-name").value.trim();
        const c = block.querySelector(".person-contact").value.trim();
        if (n || c) {
            people.push({ name: n, contact: c });
        }
    });

    const session = {
        user: primaryUser,
        group,
        people,
        savedAt: new Date().toISOString()
    };
    db.sessions.push(session);

    console.log("DB sessions:", db.sessions);

    // Update user name in shopping screen
    if (primaryUser.name) {
        const userName = document.getElementById("user-name");
        const userAvatar = document.getElementById("user-avatar");
        if (userName) userName.textContent = primaryUser.name;
        if (userAvatar) userAvatar.textContent = primaryUser.name.charAt(0).toUpperCase();
    }

    // Navigate to shopping screen
    showScreen("screen-shopping");
}

function skipForNow() {
    const primaryUser = savePrimaryUser();
    if (!primaryUser) return;

    const session = {
        user: primaryUser,
        group: null,
        people: [],
        skipped: true,
        savedAt: new Date().toISOString()
    };
    db.sessions.push(session);

    console.log("DB sessions (skipped group setup):", db.sessions);

    // Update user name in shopping screen
    if (primaryUser.name) {
        const userName = document.getElementById("user-name");
        const userAvatar = document.getElementById("user-avatar");
        if (userName) userName.textContent = primaryUser.name;
        if (userAvatar) userAvatar.textContent = primaryUser.name.charAt(0).toUpperCase();
    }

    // Navigate to shopping screen
    showScreen("screen-shopping");
}

// ===== SHOPPING LOGIC =====

async function loadCSV() {
    if (csvLoaded) return;

    try {
        const response = await fetch("openfoodfacts_categorized.csv");
        const csvText = await response.text();
        parseCSV(csvText);
        csvLoaded = true;
        console.log(`Loaded ${csvData.length} products`);
        initializeCategories();
        renderProducts();
        setupEventListeners();
    } catch (error) {
        console.error("Error loading CSV:", error);
        const container = document.getElementById("products-container");
        if (container) {
            container.innerHTML = "<p style='text-align: center; color: #ef4444; padding: 20px;'>Error loading products. Check console.</p>";
        }
    }
}

function parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = parseCSVRow(lines[0]);

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVRow(lines[i]);
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] || "";
        });

        if (row.product_name_en && row.product_name_en.trim()) {
            csvData.push(row);
        }
    }
}

function parseCSVRow(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && nextChar === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

function initializeCategories() {
    const categoryScroll = document.getElementById("category-scroll");
    if (!categoryScroll) return;

    const categories = [
        "All", "Snacks", "Staples & Grains", "Beverages", "Condiments",
        "Dairy", "Pulses & Legumes", "Fruits", "Nuts & Seeds",
        "Health & Nutrition", "Oils & Fats", "Ingredients",
        "Sweets & Confectionery", "Ready Foods", "Spices & Herbs",
        "Bakery", "Alcoholic Beverages"
    ];

    categoryScroll.innerHTML = "";

    categories.forEach((cat, index) => {
        const btn = document.createElement("button");
        btn.className = index === 0 ? "category-btn active" : "category-btn";
        btn.textContent = cat;
        btn.dataset.category = cat;
        categoryScroll.appendChild(btn);
    });

    document.querySelectorAll(".category-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.category;
            renderProducts();
        });
    });
}

// ===== FILTER LOGIC ===== (Add this section after updateUserDisplay)

function toggleFilterModal() {
    const modal = document.getElementById("filter-modal");
    const overlay = document.getElementById("filter-overlay");
    if (modal && overlay) {
        modal.classList.toggle("active");
        overlay.classList.toggle("active");
    }
}

function setupFilterListeners() {
    document.addEventListener("click", (e) => {
        if (e.target.matches('[data-diet]')) {
            e.target.classList.toggle("active");
        }
        if (e.target.matches('[data-allergen]')) {
            e.target.classList.toggle("active");
        }
    });
}

function clearFilters() {
    document.querySelectorAll(".filter-tag.active").forEach(t => t.classList.remove("active"));
    selectedDietFilters = [];
    selectedAllergenFilters = [];
}

function applyFilters() {
    selectedDietFilters = Array.from(document.querySelectorAll('[data-diet].active'))
        .map(el => el.dataset.diet.toLowerCase());

    selectedAllergenFilters = Array.from(document.querySelectorAll('[data-allergen].active'))
        .map(el => el.dataset.allergen);

    toggleFilterModal();
    renderProducts();
    console.log("Filters applied:", { selectedDietFilters, selectedAllergenFilters });
}

function toggleNutriMax() {
    nutriMaxActive = !nutriMaxActive;
    const btn = document.getElementById("nutrimax-toggle");
    if (btn) btn.classList.toggle("active");
    renderProducts();
}


function getFilteredProducts() {
    let filtered = csvData;

    if (currentFilter !== "All") {
        filtered = filtered.filter((p) => p.category === currentFilter);
    }

    if (selectedDietFilters.length > 0) {
        filtered = filtered.filter(p => {
            const labels = (p.labels || "").toLowerCase();
            return selectedDietFilters.every(diet => labels.includes(diet));
        });
    }

    if (selectedAllergenFilters.length > 0) {
        filtered = filtered.filter(p => {
            return selectedAllergenFilters.every(allergen => {
                const colName = `has_${allergen}`;
                return p[colName] !== "1";
            });
        });
    }

    if (nutriMaxActive) {
        filtered = filtered.filter(p => {
            const grade = getNutriGrade(p);
            return grade === 'a' || grade === 'b';
        });

        filtered.sort((a, b) => {
            const gradeA = getNutriGrade(a);
            const gradeB = getNutriGrade(b);
            if (gradeA === gradeB) return 0;
            if (gradeA === 'a') return -1;
            if (gradeB === 'a') return 1;
            return 0;
        });
    }

    return filtered;
}

function getNutriGrade(product) {
    let grade = (product['off:nutriscore_grade'] || "").trim().toLowerCase();
    if (!grade || grade === 'unknown' || grade === 'not-applicable') {
        grade = 'd';
    }
    return grade;
}

function renderProducts() {
    const container = document.getElementById("products-container");
    if (!container) return;

    const filtered = getFilteredProducts();

    if (filtered.length === 0) {
        container.innerHTML = "<p style='text-align: center; color: #9ca3af; padding: 20px;'>No products found</p>";
        return;
    }

    const grid = document.createElement("div");
    grid.className = "products-grid";

    filtered.forEach((product) => {
        const productId = `${product.product_name_en}_${product.brands}`.replace(/[^a-zA-Z0-9]/g, '_');
        const quantity = cart[productId] || 0;
        const nutriGrade = getNutriGrade(product);
        const nutriBadgePath = `images/nutri_${nutriGrade}.png`;

        const card = document.createElement("div");
        card.className = "product-card";

        let cardContent = `
        <img class="product-image" src="images/default.jpg" alt="${product.product_name_en || 'Product'}" />
        <div class="product-info">
          <div class="product-name">${product.product_name_en || "N/A"}</div>
          <div class="product-brand">${product.brands || "N/A"}</div>
          <div class="product-quantity">${product.quantity || "N/A"}</div>
          <div class="product-footer">
            <img class="nutri-badge" src="${nutriBadgePath}" alt="Nutri ${nutriGrade.toUpperCase()}" onerror="this.style.display='none'" />
      `;

        if (quantity === 0) {
            cardContent += `<button class="add-btn" onclick="addToCart('${productId}', '${escapeHtml(product.product_name_en)}')">+</button>`;
        } else {
            cardContent += `
          <div class="qty-control">
            <button class="qty-btn" onclick="decrementCart('${productId}')">−</button>
            <div class="qty-display">${quantity}</div>
            <button class="qty-btn" onclick="incrementCart('${productId}')">+</button>
          </div>`;
        }

        cardContent += `</div></div>`;
        card.innerHTML = cardContent;
        grid.appendChild(card);
    });

    container.innerHTML = "";
    container.appendChild(grid);
}

// Save cart to localStorage whenever it changes
function saveCartToStorage() {
    localStorage.setItem('b4ubuy_cart', JSON.stringify(cart));
    localStorage.setItem('b4ubuy_products', JSON.stringify(csvData));
}

// Call this after every cart update
function addToCart(productId, productName) {
    cart[productId] = 1;
    updateCartCount();
    saveCartToStorage(); // ADD THIS
    renderProducts();
}

function incrementCart(productId) {
    cart[productId] = (cart[productId] || 0) + 1;
    updateCartCount();
    saveCartToStorage(); // ADD THIS
    renderProducts();
}

function decrementCart(productId) {
    if (cart[productId] > 1) cart[productId]--;
    else delete cart[productId];
    updateCartCount();
    saveCartToStorage(); // ADD THIS
    renderProducts();
}


function updateCartCount() {
    const cartCountEl = document.getElementById("cart-count");
    if (cartCountEl) {
        const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
        cartCountEl.textContent = cartCount;
    }
    console.log("Cart:", cart);
}

function setupEventListeners() {
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length > 0) {
                const filtered = csvData.filter(p =>
                    (p.product_name_en && p.product_name_en.toLowerCase().includes(query)) ||
                    (p.brands && p.brands.toLowerCase().includes(query))
                );
                renderSearchResults(filtered);
            } else {
                renderProducts();
            }
        });
    }
}

function renderSearchResults(results) {
    const container = document.getElementById("products-container");
    if (!container) return;

    // Apply filters to search results
    let filtered = results;

    // Diet preference filters
    if (selectedDietFilters.length > 0) {
        filtered = filtered.filter(p => {
            const labels = (p.labels || "").toLowerCase();
            return selectedDietFilters.every(diet => labels.includes(diet));
        });
    }

    // Allergen filters
    if (selectedAllergenFilters.length > 0) {
        filtered = filtered.filter(p => {
            return selectedAllergenFilters.every(allergen => {
                const colName = `has_${allergen}`;
                return p[colName] !== "1";
            });
        });
    }

    // NutriMax filter
    if (nutriMaxActive) {
        filtered = filtered.filter(p => {
            const grade = getNutriGrade(p);
            return grade === 'a' || grade === 'b';
        });

        filtered.sort((a, b) => {
            const gradeA = getNutriGrade(a);
            const gradeB = getNutriGrade(b);
            if (gradeA === gradeB) return 0;
            if (gradeA === 'a') return -1;
            if (gradeB === 'a') return 1;
            return 0;
        });
    }

    if (filtered.length === 0) {
        container.innerHTML = "<p style='text-align: center; color: #9ca3af; padding: 20px;'>No products found</p>";
        return;
    }

    const grid = document.createElement("div");
    grid.className = "products-grid";

    filtered.forEach((product) => {
        const productId = `${product.product_name_en}_${product.brands}`.replace(/[^a-zA-Z0-9]/g, '_');
        const quantity = cart[productId] || 0;
        const nutriGrade = getNutriGrade(product);
        const nutriBadgePath = `images/nutri_${nutriGrade}.png`;

        const card = document.createElement("div");
        card.className = "product-card";

        let cardContent = `
        <img class="product-image" src="default.jpg" alt="${product.product_name_en || 'Product'}" />
        <div class="product-info">
          <div class="product-name">${product.product_name_en || "N/A"}</div>
          <div class="product-brand">${product.brands || "N/A"}</div>
          <div class="product-quantity">${product.quantity || "N/A"}</div>
          <div class="product-footer">
            <img class="nutri-badge" src="${nutriBadgePath}" alt="Nutri ${nutriGrade.toUpperCase()}" onerror="this.style.display='none'" />
      `;

        if (quantity === 0) {
            cardContent += `<button class="add-btn" onclick="addToCart('${productId}', '${escapeHtml(product.product_name_en)}')">+</button>`;
        } else {
            cardContent += `
          <div class="qty-control">
            <button class="qty-btn" onclick="decrementCart('${productId}')">−</button>
            <div class="qty-display">${quantity}</div>
            <button class="qty-btn" onclick="incrementCart('${productId}')">+</button>
          </div>`;
        }

        cardContent += `</div></div>`;
        card.innerHTML = cardContent;
        grid.appendChild(card);
    });

    container.innerHTML = "";
    container.appendChild(grid);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
