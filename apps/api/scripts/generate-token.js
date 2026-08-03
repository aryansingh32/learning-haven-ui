const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
    console.error('JWT_SECRET must be set and at least 32 characters.');
    process.exit(1);
}
const token = jwt.sign(
    { sub: '12345678-1234-1234-1234-123456789012', email: 'admin@bypass.com', role: 'admin' },
    secret,
    { expiresIn: '24h' }
);
console.log('generated_token=' + token);
