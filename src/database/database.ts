import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { User, ChatGroup, RidePost, BotSettings } from '../types/types';
import { logger, logDatabaseOperation, logError } from '../utils/logger';
import { config } from '../config/config';

// Define the promisified database methods type
type RunResult = { lastID: number; changes: number };

class Database {
  private db: sqlite3.Database | null = null;
  private isConnected = false;

  constructor() {
    sqlite3.verbose();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dbPath = config.getDatabaseConfig().path;
      logDatabaseOperation('Connecting to database', { path: dbPath });

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logError('Failed to connect to database', err);
          reject(err);
        } else {
          this.isConnected = true;
          logger.info('Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          logError('Failed to close database connection', err);
          reject(err);
        } else {
          this.isConnected = false;
          logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }

  async initialize(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const run = promisify(this.db.run.bind(this.db));

    try {
      logDatabaseOperation('Initializing database tables');

      // Create users table
      await run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_id INTEGER UNIQUE NOT NULL,
          username TEXT,
          first_name TEXT,
          last_name TEXT,
          phone_number TEXT,
          is_authenticated BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create chat_groups table
      await run(`
        CREATE TABLE IF NOT EXISTS chat_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          whatsapp_group_id TEXT UNIQUE NOT NULL,
          created_by INTEGER NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users (id)
        )
      `);

      // Create ride_posts table
      await run(`
        CREATE TABLE IF NOT EXISTS ride_posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          target_groups TEXT NOT NULL, -- JSON array
          send_rate INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Create bot_settings table
      await run(`
        CREATE TABLE IF NOT EXISTS bot_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE NOT NULL,
          default_send_rate INTEGER DEFAULT 5000,
          auto_clean_chats BOOLEAN DEFAULT 0,
          max_groups_per_post INTEGER DEFAULT 10,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Create indexes for better performance
      await run('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_chat_groups_whatsapp_id ON chat_groups (whatsapp_group_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_ride_posts_user_id ON ride_posts (user_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_ride_posts_status ON ride_posts (status)');

      logger.info('Database tables initialized successfully');
    } catch (error) {
      logError('Failed to initialize database tables', error);
      throw error;
    }
  }

  // User operations
  async createUser(telegramId: number, userData: Partial<User>): Promise<User> {
    if (!this.db) throw new Error('Database not connected');

    const run = promisify<string, any[], RunResult>(this.db.run.bind(this.db));
    const get = promisify<string, any[], any>(this.db.get.bind(this.db));

    try {
      logDatabaseOperation('Creating user', { telegramId });

      const result = await run(`
        INSERT INTO users (telegram_id, username, first_name, last_name, phone_number, is_authenticated)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        telegramId,
        userData.username || null,
        userData.firstName || null,
        userData.lastName || null,
        userData.phoneNumber || null,
        userData.isAuthenticated ? 1 : 0
      ]);

      const user = await get('SELECT * FROM users WHERE id = ?', [result.lastID]);
      return this.mapUserFromDb(user);
    } catch (error) {
      logError('Failed to create user', error, { telegramId });
      throw error;
    }
  }

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    if (!this.db) throw new Error('Database not connected');

    const get = promisify<string, any[], any>(this.db.get.bind(this.db));

    try {
      const user = await get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
      return user ? this.mapUserFromDb(user) : null;
    } catch (error) {
      logError('Failed to get user by telegram ID', error, { telegramId });
      throw error;
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    if (!this.db) throw new Error('Database not connected');

    const run = promisify<string, any[], RunResult>(this.db.run.bind(this.db));
    const get = promisify<string, any[], any>(this.db.get.bind(this.db));

    try {
      logDatabaseOperation('Updating user', { id, updates });

      await run(`
        UPDATE users 
        SET username = COALESCE(?, username),
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            phone_number = COALESCE(?, phone_number),
            is_authenticated = COALESCE(?, is_authenticated),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        updates.username,
        updates.firstName,
        updates.lastName,
        updates.phoneNumber,
        updates.isAuthenticated !== undefined ? (updates.isAuthenticated ? 1 : 0) : null,
        id
      ]);

      const user = await get('SELECT * FROM users WHERE id = ?', [id]);
      return this.mapUserFromDb(user);
    } catch (error) {
      logError('Failed to update user', error, { id });
      throw error;
    }
  }

  // Chat group operations
  async createChatGroup(groupData: Omit<ChatGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChatGroup> {
    if (!this.db) throw new Error('Database not connected');

    const run = promisify<string, any[], RunResult>(this.db.run.bind(this.db));
    const get = promisify<string, any[], any>(this.db.get.bind(this.db));

    try {
      logDatabaseOperation('Creating chat group', { name: groupData.name });

      const result = await run(`
        INSERT INTO chat_groups (name, whatsapp_group_id, created_by, is_active)
        VALUES (?, ?, ?, ?)
      `, [groupData.name, groupData.whatsappGroupId, groupData.createdBy, groupData.isActive ? 1 : 0]);

      const group = await get('SELECT * FROM chat_groups WHERE id = ?', [result.lastID]);
      return this.mapChatGroupFromDb(group);
    } catch (error) {
      logError('Failed to create chat group', error, { groupData });
      throw error;
    }
  }

  async getChatGroupsByUser(userId: number): Promise<ChatGroup[]> {
    if (!this.db) throw new Error('Database not connected');

    const all = promisify<string, any[], any[]>(this.db.all.bind(this.db));

    try {
      const groups = await all('SELECT * FROM chat_groups WHERE created_by = ? AND is_active = 1', [userId]);
      return groups.map((group: any) => this.mapChatGroupFromDb(group));
    } catch (error) {
      logError('Failed to get chat groups by user', error, { userId });
      throw error;
    }
  }

  // Helper methods to map database rows to objects
  private mapUserFromDb(row: any): User {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      phoneNumber: row.phone_number,
      isAuthenticated: Boolean(row.is_authenticated),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapChatGroupFromDb(row: any): ChatGroup {
    return {
      id: row.id,
      name: row.name,
      whatsappGroupId: row.whatsapp_group_id,
      createdBy: row.created_by,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  // Health check
  isHealthy(): boolean {
    return this.isConnected && this.db !== null;
  }
}

// Export singleton instance
export const database = new Database();