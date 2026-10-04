"""Import Table 2 from the PLOS JATS XML downloaded with type=manuscript.

Usage: python tools/import-canal-counts.py <article.xml>
Counts, not the paper's rounded percentages, are combined across left/right.
The third-molar counts are transcribed from Al-Qudah et al. (2023), Table 2.
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = ET.parse(sys.argv[1]).getroot()
table = next(t for t in root.iter('table-wrap') if t.attrib.get('id') == 'pone.0165329.t002')
types = ['central-incisor', 'lateral-incisor', 'canine', 'first-premolar', 'second-premolar', 'first-molar', 'second-molar']
entries = {}
canal_columns = [1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5]
for row in table.findall('.//tbody/tr'):
    cells = [''.join(c.itertext()).strip() for c in row]
    fdi, n = int(cells[0]), int(cells[2])
    arch = 'maxillary' if fdi < 30 else 'mandibular'
    key = f'tooth:{types[fdi % 10 - 1]}:{arch}'
    item = entries.setdefault(key, {'source': 'monsarrat2016', 'n': 0, 'counts': [0] * 5})
    counts = [0] * 5
    for canals, cell in zip(canal_columns, cells[3:]):
        counts[canals - 1] += 0 if cell == '-' else int(cell.split()[0])
    assert sum(counts) == n, (fdi, counts, n)
    item['n'] += n
    item['counts'] = [a + b for a, b in zip(item['counts'], counts)]
for arch, counts in [('maxillary', [35, 68, 310, 167, 12]), ('mandibular', [7, 188, 356, 87, 1])]:
    entries[f'tooth:third-molar:{arch}'] = {'source': 'alqudah2023', 'n': sum(counts), 'counts': counts}
data = {
    'sources': {
        'monsarrat2016': {'citation': 'Monsarrat et al. (2016), Table 2', 'url': 'https://doi.org/10.1371/journal.pone.0165329', 'population': 'toulouse', 'method': 'cbct', 'definition': 'observed', 'year': 2016},
        'alqudah2023': {'citation': 'Al-Qudah et al. (2023), Table 2', 'url': 'https://doi.org/10.1038/s41598-023-34134-7', 'population': 'jordan', 'method': 'clearing', 'definition': 'maximum', 'year': 2023},
    },
    'entries': dict(sorted(entries.items())),
}
Path('src/content/canal-counts.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
print(f'Wrote {len(entries)} tooth-type distributions; all counts reconcile with sample sizes.')
