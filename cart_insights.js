let currentAnalysis = null;
let flaggedItems = [];
let currentInsightIndex = 0;
let currentPersona = 'standard';

document.addEventListener('DOMContentLoaded', function () {
    console.log('[Cart Insights] Initialized');
    setTimeout(analyzeCart, 800);
});

async function analyzeCart() {
    console.log('[analyzeCart] Starting...');

    const cartObj = JSON.parse(localStorage.getItem('b4ubuy_cart') || '{}');
    const products = JSON.parse(localStorage.getItem('b4ubuy_products') || '[]');

    const cartItems = [];
    for (const productId in cartObj) {
        const quantity = cartObj[productId];
        if (quantity > 0) {
            const product = products.find(p => {
                const pid = `${p.product_name_en}_${p.brands}`.replace(/[^a-zA-Z0-9]/g, '_');
                return pid === productId;
            });

            if (product && product.product_name_en) {
                cartItems.push({
                    name: product.product_name_en,
                    quantity: quantity
                });
            }
        }
    }

    if (cartItems.length === 0) {
        document.getElementById('insight-banner')?.classList.add('hidden');
        document.getElementById('excellent-banner')?.classList.add('hidden');
        return;
    }

    try {
        const itemNames = cartItems.map(item => item.name);

        const response = await fetch('api/analyze-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemNames, persona: currentPersona })
        });

        if (!response.ok) return;

        const data = await response.json();
        currentAnalysis = data;

        if (!data.items || data.items.length === 0) return;

        flaggedItems = data.items.filter(item =>
            ['red', 'amber', 'orange'].includes(item.label?.toLowerCase())
        );

        if (flaggedItems.length === 0) {
            showExcellentChoice(data);
        } else {
            currentInsightIndex = 0;
            showInsightBanner();
        }
    } catch (err) {
        console.error('[analyzeCart] Error:', err);
    }
}

function showExcellentChoice(data) {
    const banner = document.getElementById('excellent-banner');
    const message = document.getElementById('excellent-message');

    if (banner && message) {
        message.textContent = data.items.length === 1
            ? 'Your cart contains an excellent choice that supports your wellness goals.'
            : `Your cart contains ${data.items.length} nutritious items. Great choices for your health!`;
        banner.classList.remove('hidden');
    }

    const insightBanner = document.getElementById('insight-banner');
    if (insightBanner) insightBanner.classList.add('hidden');
}

function showInsightBanner() {
    if (currentInsightIndex >= flaggedItems.length) {
        document.getElementById('insight-banner')?.classList.add('hidden');
        return;
    }

    const item = flaggedItems[currentInsightIndex];
    const banner = document.getElementById('insight-banner');

    if (!banner) {
        console.error('Insight banner not found in DOM!');
        return;
    }

    const icon = document.getElementById('insight-icon');
    const desc = document.getElementById('insight-description');
    const detailsDiv = document.getElementById('insight-details');

    icon.textContent = item.label === 'red' ? '🔴' : '🟠';

    const alternative = currentAnalysis?.alternatives?.find(
        alt => alt.original_name.toLowerCase() === item.name.toLowerCase()
    );

    const improvementPct = currentAnalysis.improvement_pct || 0;

    // Main message
    desc.textContent =
        `${item.name}: ${item.explanation} ` +
        (alternative
            ? `Consider swapping to ${alternative.replacement_name} for ${improvementPct}% healthier cart.`
            : '');

    // FULL DETAILS — ALWAYS VISIBLE
    if (detailsDiv && alternative) {
        detailsDiv.innerHTML = `
            <div class="insight-detail-box">
                <div class="detail-current">
                    ❌ <strong>Current Item:</strong><br/>
                    ${item.name}<br/>
                    <span class="muted">${item.explanation}</span>
                </div>

                <div class="detail-arrow">↓</div>

                <div class="detail-reco">
                    ✅ <strong>Recommended Swap:</strong><br/>
                    ${alternative.replacement_name}<br/>
                    <span class="muted">${alternative.advantage}</span>
                </div>

                <div class="detail-impact">
                    ✨ Improves your cart by <strong>${improvementPct}%</strong>
                </div>
            </div>
        `;
        detailsDiv.classList.remove('hidden');
    }

    banner.classList.remove('hidden');
    document.getElementById('excellent-banner')?.classList.add('hidden');
}


function ignoreCurrentInsight() {
    currentInsightIndex++;
    showInsightBanner();
}

function swapCurrentInsight() {
    const item = flaggedItems[currentInsightIndex];

    if (!currentAnalysis || !currentAnalysis.alternatives) {
        alert('No alternatives available');
        currentInsightIndex++;
        showInsightBanner();
        return;
    }

    const alternative = currentAnalysis.alternatives.find(alt =>
        alt.original_name.toLowerCase() === item.name.toLowerCase()
    );

    if (!alternative) {
        alert('No alternative found for this item');
        currentInsightIndex++;
        showInsightBanner();
        return;
    }

    const products = JSON.parse(localStorage.getItem('b4ubuy_products') || '[]');
    const cart = JSON.parse(localStorage.getItem('b4ubuy_cart') || '{}');

    const originalProduct = products.find(p =>
        p.product_name_en.toLowerCase() === item.name.toLowerCase()
    );

    const replacementProduct = products.find(p =>
        p.product_name_en.toLowerCase() === alternative.replacement_name.toLowerCase()
    );

    if (!replacementProduct) {
        alert('Replacement item not available');
        currentInsightIndex++;
        showInsightBanner();
        return;
    }

    if (originalProduct) {
        const originalKey = `${originalProduct.product_name_en}_${originalProduct.brands}`.replace(/[^a-zA-Z0-9]/g, '_');
        delete cart[originalKey];
    }

    const replacementKey = `${replacementProduct.product_name_en}_${replacementProduct.brands}`.replace(/[^a-zA-Z0-9]/g, '_');
    cart[replacementKey] = 1;

    localStorage.setItem('b4ubuy_cart', JSON.stringify(cart));
    location.reload();
}
