import os

new_version = os.environ['NEW_VERSION']
date = os.environ['DATE']

with open('/tmp/commits.txt') as f:
    commits = f.read().strip()

with open('CHANGELOG.md') as f:
    content = f.read()

entry = f"## [{new_version}] - {date}\n\n### Changed\n{commits}\n\n"
content = content.replace('## [Unreleased]\n', f'## [Unreleased]\n\n{entry}', 1)

with open('CHANGELOG.md', 'w') as f:
    f.write(content)
