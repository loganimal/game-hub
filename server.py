#!/usr/bin/env python3
"""
GameHub local server — serves games + generates ZIP downloads.

Usage:
  python3 server.py

Your son connects to the printed IP from his browser on the same WiFi.
He can play games directly or download the ZIP to play offline.
"""

import http.server
import socketserver
import zipfile
import io
import os
import socket
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIR = os.path.dirname(os.path.abspath(__file__))
GAME_DIRS = ['flappy', 'lion-king', 'teenage-mutant-crocodile-ninja-fighters', 'template']


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.254.254.254', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


class GameHubHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        if self.path == '/download.zip':
            self.send_zip('all')
        elif self.path.startswith('/download/'):
            name = self.path[len('/download/'):]
            self.send_zip(name)
        else:
            super().do_GET()

    def send_zip(self, name):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            dirs = GAME_DIRS if name == 'all' else [name]
            for game_dir in dirs:
                path = os.path.join(DIR, game_dir)
                if not os.path.isdir(path):
                    continue
                for root, dirs, files in os.walk(path):
                    for f in files:
                        full = os.path.join(root, f)
                        arcname = os.path.relpath(full, DIR)
                        zf.write(full, arcname)

        filename = 'gamehub' if name == 'all' else name
        buf.seek(0)
        self.send_response(200)
        self.send_header('Content-Type', 'application/zip')
        self.send_header('Content-Disposition', f'attachment; filename="{filename}.zip"')
        self.send_header('Content-Length', str(buf.getbuffer().nbytes))
        self.end_headers()
        self.wfile.write(buf.getvalue())

    def log_message(self, format, *args):
        msg = format % args
        if 'download.zip' in msg:
            print(f'  ↓ Download requested')
        elif '200' in msg:
            print(f'  ✓ {msg.split()[0]}')
        else:
            print(f'  {msg}')


if __name__ == '__main__':
    ip = get_local_ip()
    os.chdir(DIR)
    print(f'\n  GameHub server running at:\n')
    print(f'  →  http://{ip}:{PORT}')
    print(f'  →  http://localhost:{PORT}')
    print(f'\n  Your son opens that URL on his laptop (same WiFi).')
    print(f'  He can play games or click "Download ZIP" to save them.\n')
    print(f'  Press Ctrl+C to stop.\n')
    print(f'  ─── requests ───')

    with socketserver.TCPServer(('0.0.0.0', PORT), GameHubHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n  Stopped.\n')
            httpd.server_close()
