#!/usr/bin/env python3
"""Encrypt the FURLONG members card to members_card.enc — matches functions/api/card.js.
Runs LOCALLY so your CARD_KEY never leaves your machine. No Node needed.

  CARD_KEY=<same base64url value as your Cloudflare CARD_KEY secret> \
      python encrypt_members_card.py members_card_0818.html members_card.enc
"""
import os, sys, base64

inp = sys.argv[1] if len(sys.argv) > 1 else 'members_card_0818.html'
out = sys.argv[2] if len(sys.argv) > 2 else 'members_card.enc'
KEY = os.environ.get('CARD_KEY')
if not KEY:
    sys.exit('ERROR: set CARD_KEY (same base64url value as your Cloudflare CARD_KEY secret).')

def from_b64url(s):
    s = s.replace('-', '+').replace('_', '/')
    s += '=' * (-len(s) % 4)
    return base64.b64decode(s)

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    import subprocess
    print('installing cryptography ...')
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--quiet', 'cryptography'])
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

key = from_b64url(KEY)
pt = open(inp, 'rb').read()
iv = os.urandom(12)
ct = AESGCM(key).encrypt(iv, pt, None)   # ciphertext + 16-byte GCM tag
open(out, 'wb').write(iv + ct)
print('Wrote %s (%d bytes) from %s (%d bytes plaintext).' % (out, len(iv) + len(ct), inp, len(pt)))
