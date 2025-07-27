import dotenv from 'dotenv';
import { Config, LogLevel } from '../types/types';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): Config {
    return {
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        allowedUsers: process.env.ALLOWED_USERS 
          ? process.env.ALLOWED_USERS.split(',').map(id => parseInt(id.trim()))
          : undefined
      },
      whatsapp: {
        sessionPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-session',
        headless: process.env.WHATSAPP_HEADLESS === 'true',
        devtools: process.env.WHATSAPP_DEVTOOLS === 'true'
      },
      database: {
        path: process.env.DATABASE_PATH || './database.sqlite'
      },
      app: {
        port: parseInt(process.env.PORT || '3000'),
        logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        defaultSendRate: parseInt(process.env.DEFAULT_SEND_RATE || '5000')
      }
    };
  }

  private validateConfig(): void {
    const errors: string[] = [];

    // Validate required fields
    if (!this.config.telegram.botToken) {
      errors.push('TELEGRAM_BOT_TOKEN is required');
    }

    if (!this.config.database.path) {
      errors.push('DATABASE_PATH is required');
    }

    if (this.config.app.port < 1 || this.config.app.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    if (this.config.app.maxRetries < 0) {
      errors.push('MAX_RETRIES must be non-negative');
    }

    if (this.config.app.defaultSendRate < 1000) {
      errors.push('DEFAULT_SEND_RATE must be at least 1000ms');
    }

    const validLogLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(this.config.app.logLevel)) {
      errors.push('LOG_LEVEL must be one of: ' + validLogLevels.join(', '));
    }

    if (errors.length > 0) {
      logger.error('Configuration validation failed:', errors);
      throw new Error('Configuration validation failed: ' + errors.join(', '));
    }
  }

  public get(): Config {
    return { ...this.config };
  }

  public getTelegramConfig() {
    return { ...this.config.telegram };
  }

  public getWhatsAppConfig() {
    return { ...this.config.whatsapp };
  }

  public getDatabaseConfig() {
    return { ...this.config.database };
  }

  public getAppConfig() {
    return { ...this.config.app };
  }

  public isUserAllowed(userId: number): boolean {
    if (!this.config.telegram.allowedUsers) {
      return true; // If no restrictions, allow all users
    }
    return this.config.telegram.allowedUsers.includes(userId);
  }

  public updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }
}

// Export singleton instance
export const config = new ConfigManager();