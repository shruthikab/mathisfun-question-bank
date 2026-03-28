let pool = null;
let isConnected = false;

// Only load pg and create pool if DATABASE_URL is provided
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Test database connection
  pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
    isConnected = true;
  });

  pool.on('error', (err) => {
    console.error('Database connection error:', err);
    isConnected = false;
  });
} else {
  console.log('No DATABASE_URL provided - running without database');
}

// Initialize database schema
async function initializeDatabase() {
  if (!pool || !isConnected) {
    console.log('Skipping database initialization - no database connection');
    return;
  }

  try {
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

        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
      END $$
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error.message);
  }
}

module.exports = {
  pool,
  isConnected,
  initializeDatabase,
};
