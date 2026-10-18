"""Render one selected use-case source with the public PlantUML service.

Only the named diagram is sent; no environment/configuration is read.
"""
from pathlib import Path
import urllib.request
import zlib
import base64
import argparse

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Render one existing document diagram.')
parser.add_argument('diagram', nargs='?', default='00_tong_quat',
                    choices=['00_tong_quat', '01_khach_hang', '02_nhan_vien', '03_quan_tri', '04_cong_thanh_toan', '05_van_chuyen'])
diagram = parser.parse_args().diagram
source = root / f'docs/diagrams/{diagram}.puml'
output = root / 'docs/diagrams/rendered'
output.mkdir(parents=True, exist_ok=True)
raw = source.read_bytes()
compressed = zlib.compress(raw)[2:-4]
encoded = base64.b64encode(compressed).decode('ascii').translate(
    str.maketrans('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
                 '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_')
).rstrip('=')
for extension in ('svg', 'png'):
    url = f'https://www.plantuml.com/plantuml/{extension}/{encoded}'
    request = urllib.request.Request(url, headers={'User-Agent': 'ElectroStore-document-review'})
    with urllib.request.urlopen(request, timeout=25) as response:
        body = response.read()
    if extension == 'svg' and b'<svg' not in body:
        raise RuntimeError('Response is not SVG')
    if extension == 'svg' and any(message in body for message in (b'bad URL', b'Syntax Error', b'HUFFMAN data')):
        raise RuntimeError('PlantUML returned an error diagram')
    if extension == 'png' and not body.startswith(b'\x89PNG'):
        raise RuntimeError('Response is not PNG')
    (output / f'{diagram}.{extension}').write_bytes(body)
    print(f'Rendered {extension}: {len(body)} bytes')
