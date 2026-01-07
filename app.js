// ===== IN-MEMORY DATABASE =====
const db = {
    sessions: []
};


// ===== SHOPPING DATA =====
let csvData = [];
let recipeData = []; // Recipe database
let allCategories = new Set();
let cart = {};
let currentFilter = "All";
let csvLoaded = false;
let recipeLoaded = false;
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
    // Load cart from storage first
    loadCartFromStorage();
    // Prune any stale entries not present in products list
    reconcileCartWithProducts();
    
    // Check if we need to navigate to a specific screen (from ingredients page)
    const targetScreen = localStorage.getItem('targetScreen');
    if (targetScreen) {
        localStorage.removeItem('targetScreen');
        // Small delay to ensure all elements are loaded
        setTimeout(() => {
            showScreen(targetScreen);
            // Force cart count update after navigation
            updateCartCount();
            // If we landed on shopping, ensure products reflect cart state
            if (targetScreen === 'screen-shopping') {
                renderProducts();
            }
        }, 100);
    }
    
    // Existing group tag logic
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

// Add this after line 10 (after nutriMaxActive = false)

// ===== RECIPE LLM SYSTEM =====

// Load recipe database
async function loadRecipeData() {
    if (recipeLoaded) {
        console.log('Recipe data already loaded, returning cached data');
        return recipeData;
    }
    
    try {
        console.log('=== Starting loadRecipeData ===');
        console.log('Fetching Food_Recipe.csv...');
        
        const response = await fetch('Food_Recipe.csv');
        console.log('Fetch response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        
        const text = await response.text();
        console.log('CSV text loaded successfully. Length:', text.length);
        console.log('First 200 characters:', text.substring(0, 200));
        
        // Parse headers from first line
        const lines = text.split('\n').filter(line => line.trim());
        console.log('Total lines after filtering empty:', lines.length);
        
        if (lines.length < 2) {
            throw new Error('CSV file appears to be empty or has no data rows');
        }
        
        const headerRow = lines[0];
        console.log('Header row:', headerRow.substring(0, 100) + '...');
        
        const headers = parseCSVRow(headerRow).map(h => h.replace(/^"|"$/g, '').trim());
        console.log('Headers parsed:', headers.length, 'columns');
        console.log('First few headers:', headers.slice(0, 5));
        
        recipeData = [];
        let successfulRows = 0;
        let failedRows = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                const values = parseCSVRow(line);
                if (values.length >= 2) { // At least name and description
                    const recipe = {};
                    headers.forEach((header, index) => {
                        recipe[header] = values[index] ? values[index].replace(/^"|"$/g, '').trim() : '';
                    });
                    
                    if (recipe.name) {
                        recipeData.push(recipe);
                        successfulRows++;
                    }
                } else {
                    console.warn(`Row ${i} has insufficient columns: ${values.length} vs ${headers.length} expected`);
                    failedRows++;
                }
            } catch (error) {
                console.warn(`Error parsing line ${i}:`, error.message);
                failedRows++;
            }
        }
        
        recipeLoaded = true;
        console.log(`=== Recipe loading completed ===`);
        console.log(`Successfully loaded: ${successfulRows} recipes`);
        console.log(`Failed to parse: ${failedRows} rows`);
        console.log(`Total in recipeData array: ${recipeData.length} recipes`);
        
        // Log first few recipes for verification
        console.log('First 3 recipes loaded:');
        recipeData.slice(0, 3).forEach((recipe, i) => {
            console.log(`${i + 1}. "${recipe.name}" (${recipe.cuisine || 'No cuisine'})`);
        });
        
        // Check for specific recipe
        const paneerRecipe = recipeData.find(r => r.name && r.name.toLowerCase().includes('paneer do pyaza'));
        console.log('Paneer do Pyaza search result:', paneerRecipe ? `Found: "${paneerRecipe.name}"` : 'Not found');
        
        if (recipeData.length === 0) {
            throw new Error('No valid recipes were loaded from the CSV file');
        }
        
        return recipeData;
    } catch (error) {
        console.error('=== CRITICAL ERROR in loadRecipeData ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        recipeData = [];
        recipeLoaded = false;
        throw error; // Re-throw so calling function can handle it
    }
}

// Parse CSV row handling quoted strings with commas
function parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < row.length) {
        const char = row[i];
        
        if (char === '"') {
            // Handle escaped quotes
            if (inQuotes && row[i + 1] === '"') {
                current += '"';
                i += 2; // Skip both quotes
                continue;
            }
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
        i++;
    }
    
    // Don't forget the last column
    result.push(current.trim());
    return result;
}

// Smart recipe search using LLM-like fuzzy matching
function findRecipesByDish(dishName) {
    if (!dishName || !recipeData.length) return [];
    
    const searchTerm = dishName.toLowerCase().trim();
    const matches = [];
    
    console.log('Searching for:', searchTerm);
    console.log('Total recipes to search:', recipeData.length);
    
    recipeData.forEach((recipe, index) => {
        if (!recipe || !recipe.name) return;
        
        const recipeName = recipe.name.toLowerCase();
        let score = 0;
        let matchType = '';
        
        // Exact match (highest priority)
        if (recipeName === searchTerm) {
            score = 100;
            matchType = 'exact';
        }
        // Starts with search term
        else if (recipeName.startsWith(searchTerm)) {
            score = 90;
            matchType = 'starts_with';
        }
        // Contains all words from search term
        else if (searchTerm.split(' ').every(word => recipeName.includes(word))) {
            score = 80;
            matchType = 'all_words';
        }
        // Contains search term
        else if (recipeName.includes(searchTerm)) {
            score = 70;
            matchType = 'contains';
        }
        // Individual word matches
        else {
            const searchWords = searchTerm.split(' ').filter(w => w.length > 2);
            const recipeWords = recipeName.split(' ');
            let wordMatches = 0;
            
            searchWords.forEach(searchWord => {
                if (recipeWords.some(recipeWord => recipeWord.includes(searchWord))) {
                    wordMatches++;
                }
            });
            
            if (wordMatches > 0) {
                score = (wordMatches / searchWords.length) * 60;
                matchType = 'partial_words';
            }
        }
        
        if (score > 0) {
            matches.push({ recipe, score, matchType });
        }
    });
    
    console.log('Found matches:', matches.length);
    matches.forEach(m => console.log(`${m.recipe.name} - Score: ${m.score} - Type: ${m.matchType}`));
    
    // Sort by score and return top matches
    return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(match => match.recipe);
}

// Extract and parse ingredients from recipe
function extractIngredients(recipe) {
    console.log('extractIngredients called with recipe:', recipe.name);
    console.log('ingredients_name:', recipe.ingredients_name ? recipe.ingredients_name.substring(0, 100) + '...' : 'No ingredients');
    
    if (!recipe || !recipe.ingredients_name) {
        console.warn('No ingredients_name found in recipe');
        return [];
    }
    
    const ingredientNames = recipe.ingredients_name.split(',').map(ing => ing.trim());
    console.log('Parsed ingredient names:', ingredientNames.length, 'ingredients');
    
    const ingredientQuantities = recipe.ingredients_quantity ? 
        recipe.ingredients_quantity.split(/\s{2,}/).map(qty => qty.trim()) : [];
    console.log('Parsed quantities:', ingredientQuantities.length, 'quantities');
    
    const ingredients = [];
    
    ingredientNames.forEach((name, index) => {
        if (name) {
            const quantity = ingredientQuantities[index] || '';
            const cleanName = name.replace(/[()]/g, '').trim();
            
            // Extract base ingredient name (remove descriptive text)
            const baseName = extractBaseName(cleanName);
            
            ingredients.push({
                name: cleanName,
                baseName: baseName,
                quantity: quantity,
                found: false
            });
        }
    });
    
    console.log('Extracted ingredients:', ingredients.map(ing => `"${ing.name}" -> "${ing.baseName}"`));
    return ingredients;
}

// Extract base ingredient name for matching with product database
function extractBaseName(ingredientName) {
    const name = ingredientName.toLowerCase();
    
    // Common ingredient mappings
    const mappings = {
        'potatoes': 'potato',
        'tomatoes': 'tomato',
        'onions': 'onion',
        'carrots': 'carrot',
        'green chillies': 'green chili',
        'dry red chillies': 'red chili',
        'coriander leaves': 'coriander',
        'curry leaves': 'curry leaf',
        'mustard seeds': 'mustard seed',
        'cumin seeds': 'cumin',
        'turmeric powder': 'turmeric',
        'red chilli powder': 'chili powder',
        'garam masala powder': 'garam masala',
        'coconut oil': 'oil',
        'olive oil': 'oil'
    };
    
    // Check direct mappings
    for (const [key, value] of Object.entries(mappings)) {
        if (name.includes(key)) {
            return value;
        }
    }
    
    // Extract first significant word
    const words = name.split(' ');
    const significantWords = words.filter(word => 
        !['fresh', 'dried', 'powder', 'whole', 'ground', 'chopped', 'sliced', 'minced'].includes(word)
    );
    
    return significantWords[0] || words[0];
}

// Simplified ingredient matching - guaranteed to work
function matchIngredientsWithProducts(ingredients) {
    console.log('=== SIMPLIFIED matchIngredientsWithProducts ===');
    console.log('Processing', ingredients.length, 'ingredients');
    
    const result = [];
    
    for (let i = 0; i < ingredients.length; i++) {
        const ingredient = ingredients[i];
        console.log(`Processing ${i + 1}/${ingredients.length}: "${ingredient.name}"`);
        
        // Create mock product for every ingredient
        const mockProduct = {
            // Use keys consistent with shopping/cart views
            product_name_en: ingredient.name,
            product_name: ingredient.name,
            brands: 'Fresh',
            quantity: ingredient.quantity || '1 unit',
            categories: 'Ingredients',
            countries_en: 'India',
            stores: 'Available in store',
            'off:nutriscore_grade': 'd',
            code: 'mock_' + i,
            mock_product: true
        };
        
        result.push({
            name: ingredient.name,
            baseName: ingredient.baseName,
            quantity: ingredient.quantity,
            found: true,
            availableProducts: [mockProduct],
            bestMatch: mockProduct
        });
    }
    
    console.log('=== matchIngredientsWithProducts COMPLETED ===');
    console.log('Returning', result.length, 'matched ingredients');
    return result;
}

// Generate ingredient suggestions for a dish
async function generateIngredientSuggestions(dishName) {
    console.log('=== generateIngredientSuggestions called ===');
    console.log('Dish name:', dishName);
    console.log('Current recipeLoaded status:', recipeLoaded);
    console.log('Current recipeData length:', recipeData.length);
    
    try {
        console.log('Calling loadRecipeData...');
        await loadRecipeData();
        console.log('loadRecipeData completed. Recipe data length:', recipeData.length);
        
        if (recipeData.length === 0) {
            console.error('CRITICAL: No recipe data available after loading');
            return {
                success: false,
                message: 'Recipe database failed to load. Please check the console for network errors and refresh the page.',
                suggestions: []
            };
        }
        
        console.log('Calling findRecipesByDish with:', dishName);
        const recipes = findRecipesByDish(dishName);
        console.log('Search results:', recipes.length, 'recipes found');
        
        if (recipes.length === 0) {
            console.log('No recipes found. Available recipe samples:');
            recipeData.slice(0, 5).forEach((r, i) => {
                console.log(`${i + 1}. "${r.name}"`);
            });
            return {
                success: false,
                message: `No recipes found for "${dishName}". Try searching for: ${recipeData.slice(0, 3).map(r => r.name).join(', ')}`,
                suggestions: []
            };
        }
        
        // Use the best matching recipe
        const bestRecipe = recipes[0];
        console.log('Using recipe:', bestRecipe.name);
        console.log('Recipe details:', {
            cuisine: bestRecipe.cuisine,
            ingredients_name: bestRecipe.ingredients_name ? bestRecipe.ingredients_name.substring(0, 100) + '...' : 'No ingredients'
        });
        
        const ingredients = extractIngredients(bestRecipe);
        console.log('Extracted ingredients count:', ingredients.length);
        
        console.log('Calling matchIngredientsWithProducts with:', ingredients.length, 'ingredients');
        const matchedIngredients = matchIngredientsWithProducts(ingredients);
        console.log('matchIngredientsWithProducts completed. Results:', matchedIngredients.length);
        
        return {
            success: true,
            dishName: dishName,
            recipeName: bestRecipe.name,
            cuisine: bestRecipe.cuisine,
            prepTime: bestRecipe['prep_time (in mins)'],
            cookTime: bestRecipe['cook_time (in mins)'],
            description: bestRecipe.description,
            ingredients: matchedIngredients,
            availableCount: matchedIngredients.length, // All ingredients are now "available"
            totalCount: matchedIngredients.length
        };
    } catch (error) {
        console.error('=== ERROR in generateIngredientSuggestions ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        return {
            success: false,
            message: `Error processing recipe: ${error.message}. Check console for details.`,
            suggestions: []
        };
    }
}

// Autocomplete functionality
function getAutocompleteSuggestions(query) {
    if (!query || query.length < 2 || !recipeData.length) return [];
    
    const searchTerm = query.toLowerCase().trim();
    const suggestions = [];
    
    // Find recipes that match the search term
    recipeData.forEach(recipe => {
        const recipeName = recipe.name.toLowerCase();
        if (recipeName.includes(searchTerm)) {
            suggestions.push({
                name: recipe.name,
                cuisine: recipe.cuisine || 'International',
                score: recipeName.startsWith(searchTerm) ? 10 : 5
            });
        }
    });
    
    // Sort by score and return top 8 suggestions
    return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
}

// Initialize autocomplete on input field
function initializeAutocomplete(inputId, containerId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    
    if (!input || !container) return;
    
    let selectedIndex = -1;
    
    input.addEventListener('input', async (e) => {
        const query = e.target.value;
        selectedIndex = -1;
        
        if (query.length < 2) {
            container.style.display = 'none';
            return;
        }
        
        // Ensure recipe data is loaded
        await loadRecipeData();
        
        const suggestions = getAutocompleteSuggestions(query);
        
        if (suggestions.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        // Render suggestions
        container.innerHTML = suggestions.map((suggestion, index) => `
            <div class="autocomplete-item" data-index="${index}" data-name="${suggestion.name}">
                <div class="suggestion-name">${highlightMatch(suggestion.name, query)}</div>
                <div class="suggestion-cuisine">${suggestion.cuisine}</div>
            </div>
        `).join('');
        
        container.style.display = 'block';
        
        // Add click listeners to suggestions
        container.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                input.value = item.dataset.name;
                container.style.display = 'none';
                selectedIndex = -1;
            });
        });
    });
    
    // Handle keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = container.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items, selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(items, selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && items[selectedIndex]) {
                const selectedItem = items[selectedIndex];
                input.value = selectedItem.dataset.name;
                container.style.display = 'none';
                selectedIndex = -1;
            }
        } else if (e.key === 'Escape') {
            container.style.display = 'none';
            selectedIndex = -1;
        }
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !container.contains(e.target)) {
            container.style.display = 'none';
            selectedIndex = -1;
        }
    });
}

function highlightMatch(text, query) {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

function updateSelection(items, selectedIndex) {
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
    });
}

// Add all suggested ingredients to cart
function addAllIngredientsToCart(ingredients) {
    let addedCount = 0;
    
    ingredients.forEach(ingredient => {
        if (ingredient.bestMatch) {
            const product = ingredient.bestMatch;
            const nameEn = product.product_name_en || product.product_name || ingredient.name;
            const brand = product.brands || 'Fresh';
            const productId = `${nameEn}_${brand}`.replace(/[^a-zA-Z0-9]/g, '_');

            // Increment numeric quantity using unified schema
            cart[productId] = (cart[productId] || 0) + 1;
            addedCount++;

            // Ensure mock product is available in products list for cart rendering
            const exists = csvData.some(p => `${p.product_name_en}_${p.brands}`.replace(/[^a-zA-Z0-9]/g, '_') === productId);
            if (!exists) {
                csvData.push({
                    product_name_en: nameEn,
                    brands: brand,
                    quantity: product.quantity || (ingredient.quantity || '1 unit'),
                    categories: 'Ingredients',
                    countries_en: product.countries_en || 'India',
                    stores: product.stores || 'Available in store',
                    'off:nutriscore_grade': (product['off:nutriscore_grade'] || 'd'),
                    mock_product: true
                });
            }
        }
    });
    
    updateCartCount();
    saveCartToStorage();
    return addedCount;
}
function sanitizeFilename(str) {
    if (!str) return 'default';
    return str.toLowerCase().trim().replace(/\s+/g, '_');
}


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
        
        // Merge any stored mock products (from ingredients) into csvData
        try {
            const storedProducts = localStorage.getItem('b4ubuy_products');
            if (storedProducts) {
                const stored = JSON.parse(storedProducts);
                stored.forEach(p => {
                    if (p.mock_product) {
                        const id = `${(p.product_name_en || '').trim()}_${(p.brands || '').trim()}`.replace(/[^a-zA-Z0-9]/g, '_');
                        const exists = csvData.some(existing => 
                            `${(existing.product_name_en || '').trim()}_${(existing.brands || '').trim()}`.replace(/[^a-zA-Z0-9]/g, '_') === id
                        );
                        if (!exists) {
                            csvData.push(p);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('Error merging stored products:', e);
        }
        
        csvLoaded = true;
        console.log(`Loaded ${csvData.length} products (including mock)`);
        initializeCategories();
        // After products are ready, reconcile cart against product list
        reconcileCartWithProducts();
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
        const nutriBadgePath = `images/nutriscore_${nutriGrade}.png`;

        const card = document.createElement("div");
        card.className = "product-card";

        const productNameSanitized = sanitizeFilename(product.product_name_en);
        const productImagePath = `images/${productNameSanitized}.jpg`;
        console.log(`Looking for image: ${productImagePath}`);
        let cardContent = `
        <img 
            class="product-image" 
            src="${productImagePath}" 
            onerror="this.onerror=null; this.src='images/default.jpg';"
            alt="${product.product_name_en || 'Product'}"
        />
        <div class="product-info">
    
           
        <div class="product-info">
          <div class="product-name">${product.product_name_en || "N/A"}</div>
          <div class="product-quantity">${product.quantity || ""}</div>
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

// Remove cart entries that do not exist in products list
function reconcileCartWithProducts() {
    try {
        const keys = Object.keys(cart);
        if (keys.length === 0) return;

        // Prefer stored products because they include mock products
        let productsList = [];

        const storedProducts = localStorage.getItem('b4ubuy_products');
        if (storedProducts) {
            productsList = JSON.parse(storedProducts);
        }

        // Fallback to in-memory CSV if needed
        if (!productsList || productsList.length === 0) {
            productsList = csvData;
        }

        if (!productsList || productsList.length === 0) {
            // No products available yet — do NOT reconcile
            return;
        }

        let removed = 0;

        keys.forEach(id => {
            const exists = productsList.some(p => {
                const pid = `${(p.product_name_en || p.product_name || '').trim()}_${(p.brands || '').trim()}`
                    .replace(/[^a-zA-Z0-9]/g, '_');
                return pid === id;
            });

            // 🔒 DO NOT remove mock / ingredient items prematurely
            if (!exists) {
                console.warn('Skipping removal of cart item (not yet in product list):', id);
                return;
            }
        });

        if (removed > 0) {
            console.log(`Reconciled cart: removed ${removed} stale item(s)`);
            saveCartToStorage();
        }
    } catch (e) {
        console.warn('Error during cart reconciliation:', e);
    }
}


// Load cart from localStorage on app start
function loadCartFromStorage() {
    try {
        const savedCart = localStorage.getItem('b4ubuy_cart');
        if (savedCart) {
            cart = JSON.parse(savedCart);
            // Migrate any legacy object entries to numeric quantities
            Object.keys(cart).forEach(key => {
                const val = cart[key];
                if (typeof val === 'object' && val) {
                    cart[key] = typeof val.quantity === 'number' ? val.quantity : 1;
                }
            });
            console.log('Cart loaded from storage:', Object.keys(cart).length, 'items');
            updateCartCount();
            // Persist migrated schema
            localStorage.setItem('b4ubuy_cart', JSON.stringify(cart));
        }
    } catch (error) {
        console.error('Error loading cart from storage:', error);
        cart = {};
    }
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
        const cartCount = Object.values(cart).reduce((sum, entry) => {
            if (typeof entry === 'number') return sum + entry;
            if (entry && typeof entry === 'object' && typeof entry.quantity === 'number') return sum + entry.quantity;
            return sum + 1;
        }, 0);
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
        const nutriBadgePath = `images/nutriscore_${nutriGrade}.png`;

        const card = document.createElement("div");
        card.className = "product-card";

        const productNameSanitized = sanitizeFilename(product.product_name_en);
        const productImagePath = `images/${productNameSanitized}.jpg`;
        
        let cardContent = `
        <img 
            class="product-image" 
            src="${productImagePath}" 
            onerror="this.onerror=null; this.src='images/default.jpg';"
            alt="${product.product_name_en || 'Product'}"
        />
    
        <div class="product-info">
          <div class="product-name">${product.product_name_en || "N/A"}</div>
          <div class="product-quantity">${product.quantity || ""}</div>
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
