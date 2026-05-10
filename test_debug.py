import sys
sys.path.insert(0, 'python/generators')
from consistency_checker import check_consistency

character = {'name': 'Thorin', 'fears': 'fuoco'}
content = 'Thorin affronta il fuoco senza esitare, sfidando le fiamme.'
result = check_consistency(character, content)
print('Result:', result)

# Debug
fears = 'fuoco'
fear_keywords = {'fuoco': ['fuoco', 'fiamma', 'incendio', 'brucia', 'caldo']}
content_lower = content.lower()

fear_normalized = 'fuoco'.replace(' ', '')
print('fear_normalized:', fear_normalized)
print('fears.lower().replace:', fears.lower().replace(' ', ''))
print('match:', fear_normalized in fears.lower().replace(' ', ''))

for fear_key, keywords in fear_keywords.items():
    fear_n = fear_key.replace(' ', '')
    if fear_n in fears.lower().replace(' ', ''):
        print(f'Fear {fear_key} matched')
        for kw in keywords:
            if kw in content_lower:
                print(f'  kw={kw} found in content')
                positive_patterns = [f'affronta il {kw}', f'affronta {kw}', f'sfida {kw}', f'non ha paura di {kw}', f'ignora {kw}', f'disprezza {kw}']
                for pat in positive_patterns:
                    print(f'    checking pattern: {pat!r} -> in content_lower: {pat in content_lower}')