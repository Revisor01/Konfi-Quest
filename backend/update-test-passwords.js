const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres',
  database: 'konfi_db',
  user: 'konfi_user',
  password: 'konfi_password'
});

async function updatePasswords() {
  try {
    const superHash = await bcrypt.hash('SuperTest2025!', 10);
    const adminHash = await bcrypt.hash('GoogleTest2025!', 10);
    const konfiHash = await bcrypt.hash('KonfiTest2025!', 10);

    await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [superHash, 'google-test-super']);
    console.log('Super admin password updated');

    await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [adminHash, 'google-test-admin']);
    console.log('Org admin password updated');

    await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [konfiHash, 'google-test-konfi']);
    console.log('Konfi password updated');

    console.log('All passwords updated successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

updatePasswords();
