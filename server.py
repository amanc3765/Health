import http.server
import socketserver
import os
import sys
import json

PORT = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8000))

web_dir = os.path.join(os.path.dirname(__file__))
os.chdir(web_dir)
DATA_DIR = os.path.join(web_dir, 'data')
os.makedirs(DATA_DIR, exist_ok=True)
PLANS_FILE = os.path.join(DATA_DIR, 'saved_plans.json')

class HealthHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map['.js'] = 'application/javascript'

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/plans':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if os.path.exists(PLANS_FILE):
                with open(PLANS_FILE, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode())
            else:
                self.wfile.write(b'{"savedPlans":[],"state":{}}')
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/plans':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
                with open(PLANS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"success":true}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode())
            return
        super().do_POST()

socketserver.TCPServer.allow_reuse_address = True
print(f"Serving at http://localhost:{PORT}")
with socketserver.TCPServer(("", PORT), HealthHandler) as httpd:
    httpd.serve_forever()
