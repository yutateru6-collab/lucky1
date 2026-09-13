"""Regenerate the committed PWA icons from icon.svg.

Optional maintenance command: python -m pip install CairoSVG==2.8.2
Then: python scripts/generate-icons.py
Normal app use, Node.js tests and Cloudflare deployment do not need Python.
"""
from pathlib import Path
import cairosvg

icons = Path(__file__).resolve().parents[1] / 'public' / 'icons'
svg = (icons / 'icon.svg').read_text(encoding='utf-8')
for filename, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
    cairosvg.svg2png(bytestring=svg.encode('utf-8'), output_width=size, output_height=size, write_to=str(icons / filename))
    print(f'Generated {filename}')
cairosvg.svg2png(bytestring=svg.replace('rx="115"', 'rx="0"').encode('utf-8'), output_width=512, output_height=512, write_to=str(icons / 'maskable-512.png'))
print('Generated maskable-512.png')
