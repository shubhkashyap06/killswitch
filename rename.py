import os

excludes = ['node_modules', '.git', 'dist', 'build', 'artifacts', 'cache', 'typechain-types', 'package-lock.json', '.next']
extensions = ['.tsx', '.ts', '.sol', '.md', '.json', '.mjs', '.cjs']

replacements = {
    'VULTRA NODE': 'Killswitch',
    'VULTRA-NODE': 'killswitch',
    'Vultra Node': 'Killswitch',
    'Vault Sentinel': 'Killswitch',
    'VaultSentinel': 'Killswitch',
    'VULTRA': 'KILLSWITCH',
    'Vultra': 'Killswitch',
    'vultra-node': 'killswitch',
    'vultra': 'killswitch',
}

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in excludes]
    for file in files:
        if any(file.endswith(ext) for ext in extensions) and file != 'package-lock.json':
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                orig = content
                
                # Careful order ensures longer matches are replaced first if we ordered dict, but dict is ordered in 3.7+
                for k, v in replacements.items():
                    content = content.replace(k, v)
                    
                if orig != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f'Updated {path}')
            except Exception as e:
                pass
