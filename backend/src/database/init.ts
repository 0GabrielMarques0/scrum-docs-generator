import mysql, { PoolConnection, PoolOptions, RowDataPacket } from 'mysql2/promise';
import '../config.js';

const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

const poolOptions: PoolOptions = {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10_000,
};

const pool = connectionUrl
  ? mysql.createPool({ uri: connectionUrl, ...poolOptions })
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'scrum_docs',
      ...poolOptions,
    });

export const db = pool;

// MySQL (unlike MariaDB) has no `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`,
// so schema checks go through information_schema.
async function columnExists(conn: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn: PoolConnection, table: string, index: string): Promise<boolean> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn: PoolConnection, table: string, column: string, definition: string) {
  if (!(await columnExists(conn, table, column))) {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`📦 Migration: added ${table}.${column}`);
  }
}

async function addIndexIfMissing(conn: PoolConnection, table: string, index: string, columns: string) {
  if (!(await indexExists(conn, table, index))) {
    await conn.query(`CREATE INDEX ${index} ON ${table} (${columns})`);
    console.log(`📦 Migration: created index ${index}`);
  }
}

export async function initDatabase() {
  const conn = await pool.getConnection();

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        figma_file_key VARCHAR(255) NULL,
        figma_url TEXT,
        description TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        token_hash CHAR(64) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Clarifying questions raised by the AI, per project (screen_name NULL = project-wide)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS project_questions (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL,
        screen_name VARCHAR(255) NULL,
        question TEXT NOT NULL,
        reason TEXT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'geral',
        options TEXT NULL,
        answer TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        answered_at DATETIME NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Migrations for databases created by older versions
    await addColumnIfMissing(conn, 'projects', 'description', 'TEXT NULL');
    await addColumnIfMissing(conn, 'projects', 'user_id', 'VARCHAR(50) NULL');
    await addIndexIfMissing(conn, 'projects', 'idx_projects_user_id', 'user_id');
    await addIndexIfMissing(conn, 'project_requirements', 'idx_project_requirements_project', 'project_id, screen_id');
    await addIndexIfMissing(conn, 'project_questions', 'idx_project_questions_project', 'project_id, status');
    await addIndexIfMissing(conn, 'password_resets', 'idx_password_resets_user', 'user_id');

    console.log('📦 Database initialized (MySQL)');
  } finally {
    conn.release();
  }
}
