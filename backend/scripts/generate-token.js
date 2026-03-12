const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET || 'development-secret-key-change-in-prod-min-32-chars';
const token = jwt.sign(
    { sub: '12345678-1234-1234-1234-123456789012', email: 'admin@bypass.com', role: 'admin' },
    secret,
    { expiresIn: '24h' }
);
console.log('generated_token=' + token);
