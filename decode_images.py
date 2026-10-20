#!/usr/bin/env python3
"""Decode every *.jpg.b64 / *.png.b64 / *.webp.b64 payload back to its binary file.
Usage: python3 decode_images.py   (run from repo root)
"""
import base64, glob, os, sys
root = os.path.dirname(os.path.abspath(__file__))
count = 0
for payload in sorted(glob.glob(os.path.join(root, '**', '*.b64'), recursive=True)):
    target = payload[:-4]  # strip .b64
    with open(payload) as f:
        data = base64.b64decode(f.read().strip())
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, 'wb') as f:
        f.write(data)
    count += 1
print(f'decoded {count} image payloads')
