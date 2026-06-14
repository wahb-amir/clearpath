import os
import re

directory = "/home/wahb-amir/Desktop/hackathon/USAII/clearpath/src"

targets = [
    r'hsl\(280,',
    r'hsl\(234,',
    r'hsla\(280,',
    r'hsla\(234,',
    r'#8b5cf6',
    r'#a855f7',
    r'#6366f1'
]

found = False
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts') or file.endswith('.css'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                for target in targets:
                    if re.search(target, content, flags=re.IGNORECASE):
                        print(f"Found {target} in {filepath}")
                        found = True

if not found:
    print("All clear!")
