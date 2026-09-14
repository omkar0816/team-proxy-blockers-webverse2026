const crypto = require("crypto");

function hashPassword(password) {
    // Simple hashing with salt
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
        .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
        .toString('hex');
    return salt + ':' + hash;
}

function verifyPassword(password, hashedPassword) {
    const parts = hashedPassword.split(':');
    const salt = parts[0];
    const hash = parts[1];
    
    const newHash = crypto
        .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
        .toString('hex');
    
    return newHash === hash;
}

module.exports = {
    hashPassword,
    verifyPassword
};