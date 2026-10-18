"""Render one documented Mermaid flow/state diagram through a public renderer."""
from pathlib import Path
import base64
import re
import urllib.request
import zlib
import json
import argparse

root = Path(__file__).resolve().parents[1]
document = (root / 'docs/06_QUY_TAC_VA_SO_DO_LUONG.md').read_text(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--service', choices=['kroki','mermaid-ink'], default='kroki')
parser.add_argument('--png', action='store_true', help='Also request remote PNG; SVG remains available if PNG fails.')
parser.add_argument('--diagram', choices=['order-flow','order-state','shipping-state','payment-state','vnpay-sequence','cod-sequence','identity-erd','catalog-erd'], default='order-flow')
args = parser.parse_args()
service = args.service
heading, stem = {
    'order-flow': ('## 5. Luồng mua hàng — UC-16..26', '06_luong_dat_hang'),
    'order-state': ('## 7. Sơ đồ trạng thái đơn', '07_trang_thai_don_hang'),
    'shipping-state': ('## 8. Sơ đồ trạng thái vận chuyển', '08_trang_thai_van_chuyen'),
    'payment-state': ('## 13. Sơ đồ trạng thái thanh toán của đơn', '09_trang_thai_thanh_toan'),
    'vnpay-sequence': ('### 9.1. Luồng VNPay sandbox tối thiểu', '10_tuan_tu_vnpay_sandbox'),
    'cod-sequence': ('## 10. Sơ đồ tuần tự giao hàng và COD', '11_tuan_tu_van_chuyen_cod'),
    'identity-erd': ('## 1. ERD tài khoản, giỏ hàng và catalog', '12_erd_tai_khoan_gio_reset'),
    'catalog-erd': ('## 1. ERD tài khoản, giỏ hàng và catalog', '13_erd_catalog_sku_thong_so'),
}[args.diagram]
if args.diagram in ('identity-erd', 'catalog-erd'):
    document = (root / 'docs/07_ERD_VA_TU_DIEN_DU_LIEU.md').read_text(encoding='utf-8')
section = document.split(heading, 1)[1]
source = re.search(r'```mermaid\s*\n(.*?)```', section, re.S).group(1)
if args.diagram in ('identity-erd', 'catalog-erd'):
    tables = ({'USERS','ADDRESSES','SESSIONS','CARTS','CART_ITEMS','CART_MERGES','PASSWORD_RESET_TOKENS','PRODUCT_VARIANTS'}
              if args.diagram == 'identity-erd' else
              {'CATEGORIES','BRANDS','PRODUCTS','PRODUCT_VARIANTS','PRODUCT_IMAGES','ATTRIBUTE_DEFINITIONS','VARIANT_ATTRIBUTE_VALUES'})
    blocks = list(re.finditer(r'^  (\w+) \{\n.*?^  \}', source, re.M | re.S))
    relations = [line for line in source.splitlines() if re.match(r'^  \w+ [|o}{-]+ \w+ :', line)
                 and line.split()[0] in tables and line.split()[2] in tables]
    selected = [match.group(0) if not (args.diagram == 'identity-erd' and match.group(1) == 'PRODUCT_VARIANTS') else '  PRODUCT_VARIANTS {\n    integer id PK\n  }'
                for match in blocks if match.group(1) in tables]
    source = 'erDiagram\n' + '\n'.join(relations + selected) + '\n'
output = root / 'docs/diagrams/rendered'
output.mkdir(parents=True, exist_ok=True)
(output / f'{stem}.mmd').write_text(source, encoding='utf-8')
if service == 'mermaid-ink':
    payload = json.dumps({'code':source, 'mermaid':{'theme':'default'}}, ensure_ascii=False).encode('utf-8')
    encoded = base64.urlsafe_b64encode(zlib.compress(payload, 9)).decode('ascii')
    url = 'https://mermaid.ink/svg/pako:' + encoded
else:
    encoded = base64.urlsafe_b64encode(zlib.compress(source.encode('utf-8'), 9)).decode('ascii')
    url = 'https://kroki.io/mermaid/svg/' + encoded
request = urllib.request.Request(url, headers={'User-Agent': 'ElectroStore-document-review'})
with urllib.request.urlopen(request, timeout=25) as response:
    body = response.read()
if b'<svg' not in body:
    raise RuntimeError('Renderer did not return SVG')
if args.diagram in ('shipping-state', 'payment-state'):
    svg = body.decode('utf-8')
    svg = re.sub(r'(<svg\b[^>]*>)', r'\1<style>.edgeLabel,.edgeLabel p{font-size:14px!important;}</style>', svg, count=1)
    body = svg.encode('utf-8')
if args.diagram in ('identity-erd', 'catalog-erd'):
    svg = body.decode('utf-8')
    svg = re.sub(r'(<svg\b[^>]*>)', r'\1<style>foreignObject div,foreignObject span,foreignObject p{font-size:14px!important;}</style>', svg, count=1)
    body = svg.encode('utf-8')
(output / f'{stem}.svg').write_bytes(body)
print(f'Rendered SVG: {len(body)} bytes')
if service == 'mermaid-ink' and args.png:
    image_url = url.replace('/svg/', '/img/', 1) + '?type=png'
    with urllib.request.urlopen(urllib.request.Request(image_url, headers={'User-Agent':'ElectroStore-document-review'}), timeout=25) as response:
        raster = response.read()
    if not raster.startswith(b'\x89PNG'):
        raise RuntimeError('Renderer did not return PNG')
    (output / f'{stem}.png').write_bytes(raster)
    print(f'Rendered PNG: {len(raster)} bytes')
