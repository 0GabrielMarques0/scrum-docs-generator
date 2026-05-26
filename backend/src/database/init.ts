import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'scrum_docs',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = pool;

export async function initDatabase() {
  const connection = await pool.getConnection();
  
  try {
    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        figma_file_key VARCHAR(255),
        figma_url TEXT,
        description TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS project_screens (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL,
        screen_id VARCHAR(255) NOT NULL,
        screen_name VARCHAR(255) NOT NULL,
        image_path VARCHAR(500),
        status VARCHAR(50) DEFAULT 'pending',
        document_path TEXT,
        generated_at DATETIME,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS requirements (
        id VARCHAR(50) PRIMARY KEY,
        screen_name VARCHAR(255) NOT NULL,
        file_key VARCHAR(255) NOT NULL,
        node_id VARCHAR(255) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        markdown LONGTEXT NOT NULL,
        json_data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table for saved requirements per project
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS project_requirements (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL,
        screen_id VARCHAR(255) NOT NULL,
        screen_name VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Table for project description (AI-generated)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS project_descriptions (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL UNIQUE,
        description LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Persistent Figma cache - survives server restarts
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS figma_cache (
        cache_key VARCHAR(255) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `);

    // Migrations - Add new columns to existing tables
    // Add image_path to project_screens if not exists
    await connection.execute(`
      ALTER TABLE project_screens ADD COLUMN IF NOT EXISTS image_path VARCHAR(500) AFTER screen_name
    `).catch(() => {});

    // Make figma_file_key nullable in projects
    await connection.execute(`
      ALTER TABLE projects MODIFY COLUMN figma_file_key VARCHAR(255) NULL
    `).catch(() => {});

    // Add description to projects if not exists
    await connection.execute(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT AFTER figma_url
    `).catch(() => {});

    // Create indexes (MySQL syntax)
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_requirements_file_key ON requirements(file_key)
    `).catch(() => {}); // Ignore if exists

    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_project_screens_project ON project_screens(project_id)
    `).catch(() => {}); // Ignore if exists

    console.log('📦 Database initialized (MySQL)');
  } finally {
    connection.release();
  }
}
