const { Sequelize } = require('sequelize');

// Use SQLite for local development, PostgreSQL for production
const isProduction = process.env.NODE_ENV === 'production';
const useSQLite = !isProduction && !process.env.DATABASE_URL;

let sequelize;

if (useSQLite) {
  // SQLite for local development (no installation required!)
  console.log('📦 Using SQLite for local development');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
} else {
  // PostgreSQL for production or if DATABASE_URL is explicitly set
  console.log('🐘 Using PostgreSQL');
  // Enable SSL for remote databases (render.com, etc.)
  const needsSSL = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: (isProduction || needsSSL) ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {}
  });
}

module.exports = sequelize;
