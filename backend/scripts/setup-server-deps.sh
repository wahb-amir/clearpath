#!/usr/bin/env bash
# scripts/setup-server-deps.sh
# Run once on your Linux server or inside your Dockerfile.
# Installs:
#   - Tesseract OCR (native binary, much faster than tesseract.js/WASM)
#   - English + Urdu language packs for Tesseract
#   - poppler-utils (pdftotext + pdftoppm for PDF extraction + rasterisation)

set -euo pipefail

echo "==> Updating apt..."
apt-get update -q

echo "==> Installing OCR and PDF tools..."
apt-get install -y --no-install-recommends \
  tesseract-ocr \
  tesseract-ocr-eng \
  tesseract-ocr-urd \
  poppler-utils

echo "==> Verifying installs..."
tesseract --version
pdftotext -v 2>&1 | head -1
pdftoppm -h 2>&1 | head -1

echo "==> Done. Tesseract languages available:"
tesseract --list-langs

# Optional: pre-warm the @xenova/transformers model cache so the first
# worker job doesn't block on a model download.
# Adjust TRANSFORMERS_CACHE to match your .env setting.
#
# export TRANSFORMERS_CACHE=/var/cache/transformers
# node -e "
#   const { pipeline } = require('@xenova/transformers');
#   pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5')
#     .then(() => { console.log('Model cached.'); process.exit(0); });
# "
