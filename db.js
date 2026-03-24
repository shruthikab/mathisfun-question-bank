const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mathisfun_db',
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Initialize database schema
async function initializeDatabase() {
  try {
    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        google_id VARCHAR(255) UNIQUE,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add google_id column if it doesn't exist (for existing databases)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'google_id') THEN
          ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar') THEN
          ALTER TABLE users ADD COLUMN avatar TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
          ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
        END IF;

        -- Make password_hash nullable for Google OAuth users
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
      END $$
    `);

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error.message);
  }
}

module.exports = {
  pool,
  initializeDatabase,
};
