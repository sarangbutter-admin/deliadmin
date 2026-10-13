#!/bin/bash
# Make a restore point of the current code. Usage: tools/backup.sh "short-label"
# Run it BEFORE each change. Creates a git tag backup/<date>-<n>-<label> and pushes it to GitHub.
set -e
cd "$(dirname "$0")/.."
label=$(echo "${1:-update}" | tr -c 'a-zA-Z0-9\n' '-' | sed 's/-*$//' | cut -c1-40)
d=$(date +%Y-%m-%d)
n=$(git tag -l "backup/$d-*" | wc -l | tr -d ' '); n=$((n+1))
tag="backup/$d-$(printf %02d $n)-$label"
git tag -a "$tag" -m "Restore point before: $label"
git push -q origin "$tag"
echo "$tag"
