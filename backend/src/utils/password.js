const bcrypt = require('bcryptjs');

async function hash(plain) {
  return bcrypt.hash(plain, 12);
}

async function compare(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

module.exports = { hash, compare };
