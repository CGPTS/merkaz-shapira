import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { WhatsAppStatus } from '../types/types';
import { logger, logWhatsAppEvent, logError } from '../utils/logger';
import { config } from '../config/config';
import { EventEmitter } from 'events';

export class WhatsAppClient extends EventEmitter {
  private client: Client | null = null;
  private status: WhatsAppStatus = { isConnected: false };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 30000; // 30 seconds

  constructor() {
    super();
    this.initializeClient();
  }

  private initializeClient(): void {
    const whatsappConfig = config.getWhatsAppConfig();
    
    logWhatsAppEvent('Initializing WhatsApp client');

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'cgpts-bot',
        dataPath: whatsappConfig.sessionPath
      }),
      puppeteer: {
        headless: whatsappConfig.headless,
        devtools: whatsappConfig.devtools,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    // QR Code generation
    this.client.on('qr', (qr) => {
      logWhatsAppEvent('QR Code generated');
      this.status.qrCode = qr;
      
      // Display QR code in terminal
      console.log('\n--- WhatsApp QR Code ---');
      qrcode.generate(qr, { small: true });
      console.log('Please scan the QR code with your WhatsApp app\n');
      
      this.emit('qr', qr);
    });

    // Client ready
    this.client.on('ready', () => {
      logWhatsAppEvent('Client is ready');
      this.status.isConnected = true;
      this.status.lastActivity = new Date();
      this.reconnectAttempts = 0;
      
      this.emit('ready');
    });

    // Authentication success
    this.client.on('authenticated', () => {
      logWhatsAppEvent('Client authenticated');
      this.emit('authenticated');
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      logError('WhatsApp authentication failed', new Error(msg));
      this.status.isConnected = false;
      this.emit('auth_failure', msg);
    });

    // Client disconnected
    this.client.on('disconnected', (reason) => {
      logWhatsAppEvent('Client disconnected', { reason });
      this.status.isConnected = false;
      this.emit('disconnected', reason);
      
      // Attempt to reconnect
      this.handleReconnection();
    });

    // Message received
    this.client.on('message', (message) => {
      logWhatsAppEvent('Message received', { 
        from: message.from,
        type: message.type,
        hasMedia: message.hasMedia
      });
      this.status.lastActivity = new Date();
      this.emit('message', message);
    });

    // Message sent
    this.client.on('message_create', (message) => {
      if (message.fromMe) {
        logWhatsAppEvent('Message sent', { 
          to: message.to,
          type: message.type
        });
        this.status.lastActivity = new Date();
        this.emit('message_sent', message);
      }
    });

    // Group join
    this.client.on('group_join', (notification) => {
      logWhatsAppEvent('Group join event', { 
        groupId: notification.chatId,
        participants: notification.recipientIds
      });
      this.emit('group_join', notification);
    });

    // Group leave
    this.client.on('group_leave', (notification) => {
      logWhatsAppEvent('Group leave event', { 
        groupId: notification.chatId,
        participants: notification.recipientIds
      });
      this.emit('group_leave', notification);
    });
  }

  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logError('Max reconnection attempts reached', new Error('WhatsApp client failed to reconnect'));
      return;
    }

    this.reconnectAttempts++;
    logWhatsAppEvent('Attempting to reconnect', { 
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    });

    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logError('Reconnection attempt failed', error);
      }
    }, this.reconnectDelay);
  }

  async initialize(): Promise<void> {
    if (!this.client) {
      this.initializeClient();
    }

    try {
      logWhatsAppEvent('Starting WhatsApp client');
      await this.client!.initialize();
    } catch (error) {
      logError('Failed to initialize WhatsApp client', error);
      throw error;
    }
  }

  async sendMessage(chatId: string, message: string): Promise<boolean> {
    if (!this.client || !this.status.isConnected) {
      logError('WhatsApp client not connected', new Error('Client not ready'));
      return false;
    }

    try {
      logWhatsAppEvent('Sending message', { chatId, messageLength: message.length });
      await this.client.sendMessage(chatId, message);
      return true;
    } catch (error) {
      logError('Failed to send message', error, { chatId });
      return false;
    }
  }

  async sendMessageWithDelay(chatId: string, message: string, delay: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await this.sendMessage(chatId, message);
        resolve(result);
      }, delay);
    });
  }

  async getChats(): Promise<any[]> {
    if (!this.client || !this.status.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      logWhatsAppEvent('Retrieving chats');
      const chats = await this.client.getChats();
      return chats.filter(chat => chat.isGroup);
    } catch (error) {
      logError('Failed to get chats', error);
      throw error;
    }
  }

  async getChatById(chatId: string): Promise<any | null> {
    if (!this.client || !this.status.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      logWhatsAppEvent('Retrieving chat by ID', { chatId });
      const chat = await this.client.getChatById(chatId);
      return chat;
    } catch (error) {
      logError('Failed to get chat by ID', error, { chatId });
      return null;
    }
  }

  async clearChat(chatId: string): Promise<boolean> {
    if (!this.client || !this.status.isConnected) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      logWhatsAppEvent('Clearing chat', { chatId });
      const chat = await this.client.getChatById(chatId);
      await chat.clearMessages();
      return true;
    } catch (error) {
      logError('Failed to clear chat', error, { chatId });
      return false;
    }
  }

  async logout(): Promise<void> {
    if (this.client) {
      try {
        logWhatsAppEvent('Logging out');
        await this.client.logout();
        this.status.isConnected = false;
      } catch (error) {
        logError('Failed to logout', error);
        throw error;
      }
    }
  }

  async destroy(): Promise<void> {
    if (this.client) {
      try {
        logWhatsAppEvent('Destroying client');
        await this.client.destroy();
        this.client = null;
        this.status.isConnected = false;
      } catch (error) {
        logError('Failed to destroy client', error);
        throw error;
      }
    }
  }

  getStatus(): WhatsAppStatus {
    return { ...this.status };
  }

  isConnected(): boolean {
    return this.status.isConnected;
  }

  // Utility method to format chat ID for WhatsApp
  static formatChatId(phoneNumber: string, isGroup: boolean = false): string {
    // Remove any non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (isGroup) {
      return `${cleaned}@g.us`;
    } else {
      return `${cleaned}@c.us`;
    }
  }

  // Validate if a chat ID is properly formatted
  static isValidChatId(chatId: string): boolean {
    return /^[0-9]+@(c|g)\.us$/.test(chatId);
  }
}

// Export singleton instance
export const whatsappClient = new WhatsAppClient();