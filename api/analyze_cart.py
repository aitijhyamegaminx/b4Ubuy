from http.server import BaseHTTPRequestHandler
import json
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from cart_llm import analyze_cart  # reuse your logic

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body)

            items = payload.get("items", [])
            persona = payload.get("persona", "standard")

            result = analyze_cart(items, persona)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            self.wfile.write(json.dumps(result).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            self.wfile.write(json.dumps({
                "error": str(e)
            }).encode())
