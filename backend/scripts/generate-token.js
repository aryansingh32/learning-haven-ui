
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const secret = process.env.JWT_SECRET || 'development-secret-key-change-in-prod-min-32-chars';

const payload = {
    sub: '12345678-1234-1234-1234-123456789012',
    email: 'admin@bypass.com',
    role: 'super_admin',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7),
};

const token = jwt.sign(payload, secret);
console.log(token);
