export interface User {
  id: number;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  isAuthenticated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatGroup {
  id: number;
  name: string;
  whatsappGroupId: string;
  createdBy: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RidePost {
  id: number;
  userId: number;
  message: string;
  targetGroups: string[]; // JSON array of group IDs
  sendRate: number; // milliseconds between sends
  status: 'pending' | 'sending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface BotSettings {
  id: number;
  userId: number;
  defaultSendRate: number;
  autoCleanChats: boolean;
  maxGroupsPerPost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionData {
  userId: number;
  step?: string;
  tempData?: Record<string, any>;
}

export interface WhatsAppStatus {
  isConnected: boolean;
  qrCode?: string;
  sessionPath?: string;
  lastActivity?: Date;
}

export interface TelegramContext {
  message?: {
    text?: string;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
  chat?: {
    id: number;
  };
  callbackQuery?: {
    data?: string;
    from: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

// Remove MenuButton and MenuOptions as we'll use Telegraf's types

// Logger levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Configuration interface
export interface Config {
  telegram: {
    botToken: string;
    allowedUsers?: number[];
  };
  whatsapp: {
    sessionPath: string;
    headless: boolean;
    devtools: boolean;
  };
  database: {
    path: string;
  };
  app: {
    port: number;
    logLevel: LogLevel;
    maxRetries: number;
    defaultSendRate: number;
  };
}