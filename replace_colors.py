import os
import re

directory = "/home/wahb-amir/Desktop/hackathon/USAII/clearpath/src"

replacements = [
    (r'hsl\(\s*280', r'hsl(191'),
    (r'hsla\(\s*280', r'hsla(191'),
    (r'hsl\(\s*234', r'hsl(221'),
    (r'hsla\(\s*234', r'hsla(221'),
    (r'#8b5cf6', r'#2563eb'),
    (r'#a855f7', r'#2563eb'),
    (r'#6366f1', r'#06b6d4'),
]

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts') or file.endswith('.css'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            for old, new in replacements:
                new_content = re.sub(old, new, new_content, flags=re.IGNORECASE)
                
            if content != new_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
