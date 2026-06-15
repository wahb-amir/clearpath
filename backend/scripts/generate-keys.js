const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, '../.keys');

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

// Generate an RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const publicKeyPath = path.join(keysDir, 'public.pem');
const privateKeyPath = path.join(keysDir, 'private.pem');

fs.writeFileSync(publicKeyPath, publicKey);
fs.writeFileSync(privateKeyPath, privateKey);

console.log('Keys generated successfully in backend/.keys/');
console.log('IMPORTANT: Never commit the private key to source control!');
