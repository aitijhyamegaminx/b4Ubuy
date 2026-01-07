from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cart_llm import FastEngine

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize the engine at startup
print("Initializing B4UBuy engine...")
try:
    engine = FastEngine(csv_path='openfoodfacts_precomputed.csv')
    print("Engine initialized successfully")
except Exception as e:
    print(f"❌ Engine initialization failed: {e}")
    engine = None

@app.route('/api/analyze-cart', methods=['POST'])
def analyze_cart():
    """
    Analyze cart items and return health insights
    
    Request JSON:
    {
        "items": ["Product Name 1", "Product Name 2"],
        "persona": "diabetic"  // optional, default: "standard"
    }
    
    Response JSON:
    {
        "items": [...],
        "alternatives": [...],
        "swapped_cart": [...],
        "improvement_pct": 25,
        "narrative": "..."
    }
    """
    if not engine:
        return jsonify({
            'error': 'Engine not initialized. Check if openfoodfacts_precomputed.csv exists.'
        }), 500
    
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        items = data.get('items', [])
        persona = data.get('persona', 'standard')
        
        # Validate
        if not items or len(items) == 0:
            return jsonify({'error': 'No items provided'}), 400
        
        if not isinstance(items, list):
            return jsonify({'error': 'Items must be a list'}), 400
        
        # Analyze cart
        print(f"Analyzing {len(items)} items for {persona} persona...")
        report = engine.analyze_cart(items, persona=persona)
        
        # Build response
        response = {
            'items': [
                {
                    'name': scored_item.product.name,
                    'label': scored_item.product.health_label,
                    'explanation': scored_item.explanation,
                    'score': scored_item.product.health_score
                }
                for scored_item in report.items
            ],
            'alternatives': [
                {
                    'original_name': alt.original.product.name,
                    'replacement_name': alt.replacement.name,
                    'advantage': alt.advantage,
                    'improvement': alt.improvement
                }
                for alt in report.alternatives
            ],
            'swapped_cart': [
                {
                    'name': product.name,
                    'label': product.health_label
                }
                for product in (report.swapped_cart or [])
            ],
            'improvement_pct': report.improvement_pct or 0,
            'narrative': report.final_narrative or ''
        }
        
        print(f"✅ Analysis complete: {len(response['items'])} items, {len(response['alternatives'])} alternatives")
        return jsonify(response), 200
    
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'Analysis failed: {str(e)}'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'engine_loaded': engine is not None
    }), 200

@app.route('/', methods=['GET'])
def home():
    """Home endpoint"""
    return jsonify({
        'message': 'B4UBuy Cart Analysis API',
        'endpoints': {
            '/api/analyze-cart': 'POST - Analyze cart items',
            '/api/health': 'GET - Health check'
        }
    }), 200

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Starting B4UBuy Backend API Server")
    print("="*60)
    print("Server: http://127.0.0.1:5000")
    print("Endpoint: POST http://127.0.0.1:5000/api/analyze-cart")
    print("="*60 + "\n")
    
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True,
        use_reloader=False  # Prevent double initialization
    )
