let currentAnalysis = null;
let flaggedItems = [];
let currentInsightIndex = 0;
let currentPersona = 'standard';
let isDetailsExpanded = false;

document.addEventListener('DOMContentLoaded', function() {
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

    if (cartItems.length === 0) return;

    try {
        const itemNames = cartItems.map(item => item.name);
        
        const response = await fetch('http://127.0.0.1:5000/api/analyze-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemNames, persona: currentPersona })
        });

        if (!response.ok) return;
        
        const data = await response.json();
        currentAnalysis = data;

        if (!data.items || data.items.length === 0) return;

        flaggedItems = data.items.filter(item => 
            item.label === 'red' || item.label === 'amber'
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
        const insightBanner = document.getElementById('insight-banner');
        if (insightBanner) insightBanner.classList.add('hidden');
        return;
    }

    const item = flaggedItems[currentInsightIndex];
    const insightBanner = document.getElementById('insight-banner');
    
    if (!insightBanner) {
        console.error('Insight banner not found in DOM!');
        return;
    }

    const icon = document.getElementById('insight-icon');
    const desc = document.getElementById('insight-description');
    const detailsDiv = document.getElementById('insight-details');
    
    const emoji = item.label === 'red' ? '🔴' : '🟠';
    
    if (icon) icon.textContent = emoji;
    
    // Find alternative
    const alternative = currentAnalysis.alternatives ? currentAnalysis.alternatives.find(alt => 
        alt.original_name.toLowerCase() === item.name.toLowerCase()
    ) : null;
    
    // BUILD COMPLETE INITIAL MESSAGE
    let completeMessage = `${item.name}: ${item.explanation}`;
    
    if (alternative) {
        const improvementPct = currentAnalysis.improvement_pct || 0;
        completeMessage += ` Consider swapping to ${alternative.replacement_name} for ${improvementPct}% healthier cart.`;
    }
    
    if (desc) desc.textContent = completeMessage;
    
    // Build expandable details (more detailed breakdown)
    if (detailsDiv && alternative) {
        const improvementPct = currentAnalysis.improvement_pct || 0;
        
        detailsDiv.innerHTML = `
            <div style="margin-top: 12px; padding: 12px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                <div style="font-size: 13px; color: #111827; margin-bottom: 10px;">
                    <strong>🔄 Detailed Swap Information</strong>
                </div>
                <div style="padding: 10px; background: #fef2f2; border-radius: 6px; margin-bottom: 8px;">
                    <div style="font-size: 12px; color: #991b1b; margin-bottom: 4px;">❌ Current Item:</div>
                    <div style="font-size: 13px; color: #dc2626; font-weight: 600;">
                        ${alternative.original_name}
                    </div>
                    <div style="font-size: 11px; color: #7f1d1d; margin-top: 4px;">
                        ${item.explanation}
                    </div>
                </div>
                <div style="text-align: center; font-size: 16px; color: #6b7280; margin: 8px 0;">↓</div>
                <div style="padding: 10px; background: #f0fdf4; border-radius: 6px; margin-bottom: 10px;">
                    <div style="font-size: 12px; color: #065f46; margin-bottom: 4px;">✅ Recommended Swap:</div>
                    <div style="font-size: 14px; color: #059669; font-weight: 600;">
                        ${alternative.replacement_name}
                    </div>
                </div>
                <div style="padding: 10px; background: #eff6ff; border-radius: 6px; font-size: 12px; color: #1e40af; line-height: 1.5; margin-bottom: 10px;">
                    <strong>💡 Why this swap is better:</strong><br>
                    ${alternative.advantage}
                </div>
                <div style="margin-top: 10px; text-align: center; padding: 10px; background: #d1fae5; border-radius: 6px;">
                    <span style="font-size: 14px; color: #065f46; font-weight: 700;">
                        ✨ Swapping improves your cart by <strong>${improvementPct}%</strong>
                    </span>
                </div>
            </div>
        `;
        detailsDiv.classList.add('hidden');
    }
    
    // Show the banner
    insightBanner.classList.remove('hidden');
    console.log('✅ Insight banner displayed');
    
    isDetailsExpanded = false;
    
    const excellentBanner = document.getElementById('excellent-banner');
    if (excellentBanner) excellentBanner.classList.add('hidden');
}


function toggleInsightDetails() {
    const detailsDiv = document.getElementById('insight-details');
    if (!detailsDiv) return;
    
    isDetailsExpanded = !isDetailsExpanded;
    
    if (isDetailsExpanded) {
        detailsDiv.classList.remove('hidden');
        console.log('Details expanded');
    } else {
        detailsDiv.classList.add('hidden');
        console.log('Details collapsed');
    }
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
