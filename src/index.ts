import { logger, logError, updateLoggerLevel } from './utils/logger';
import { config } from './config/config';
import { database } from './database/database';
import { telegramBot } from './bot/telegram';
import { whatsappClient } from './whatsapp/client';
import express from 'express';
import cors from 'cors';

class Application {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupExpress();
  }

  private setupExpress(): void {
    // Middleware
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const status = {
        timestamp: new Date().toISOString(),
        status: 'ok',
        database: database.isHealthy(),
        whatsapp: whatsappClient.isConnected(),
        uptime: process.uptime()
      };
      
      res.json(status);
    });

    // Status endpoint
    this.app.get('/status', (req, res) => {
      const whatsappStatus = whatsappClient.getStatus();
      
      res.json({
        timestamp: new Date().toISOString(),
        telegram: {
          status: 'connected'
        },
        whatsapp: {
          connected: whatsappStatus.isConnected,
          lastActivity: whatsappStatus.lastActivity
        },
        database: {
          healthy: database.isHealthy()
        }
      });
    });

    // QR code endpoint for WhatsApp
    this.app.get('/qr', (req, res) => {
      const whatsappStatus = whatsappClient.getStatus();
      
      if (whatsappStatus.qrCode) {
        res.json({
          qrCode: whatsappStatus.qrCode,
          connected: whatsappStatus.isConnected
        });
      } else {
        res.status(404).json({
          error: 'No QR code available',
          connected: whatsappStatus.isConnected
        });
      }
    });

    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logError('Express error', error);
      res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupWhatsAppEventHandlers(): void {
    whatsappClient.on('qr', (qr) => {
      logger.info('WhatsApp QR code generated. Scan with your phone to connect.');
    });

    whatsappClient.on('ready', () => {
      logger.info('WhatsApp client is ready and connected!');
    });

    whatsappClient.on('authenticated', () => {
      logger.info('WhatsApp client authenticated successfully');
    });

    whatsappClient.on('auth_failure', (msg) => {
      logError('WhatsApp authentication failed', new Error(msg));
    });

    whatsappClient.on('disconnected', (reason) => {
      logger.warn(`WhatsApp client disconnected: ${reason}`);
    });

    whatsappClient.on('message', (message) => {
      logger.debug('WhatsApp message received', {
        from: message.from,
        type: message.type,
        timestamp: message.timestamp
      });
    });
  }

  private async initializeDatabase(): Promise<void> {
    try {
      logger.info('Initializing database...');
      await database.connect();
      await database.initialize();
      logger.info('Database initialized successfully');
    } catch (error) {
      logError('Failed to initialize database', error);
      throw error;
    }
  }

  private async initializeWhatsApp(): Promise<void> {
    try {
      logger.info('Initializing WhatsApp client...');
      this.setupWhatsAppEventHandlers();
      
      // Don't wait for WhatsApp to be ready, as it might require QR scan
      whatsappClient.initialize().catch((error) => {
        logError('WhatsApp initialization failed', error);
      });
      
      logger.info('WhatsApp client initialization started (may require QR scan)');
    } catch (error) {
      logError('Failed to start WhatsApp initialization', error);
      // Don't throw here - WhatsApp can be initialized later
    }
  }

  private async initializeTelegramBot(): Promise<void> {
    try {
      logger.info('Initializing Telegram bot...');
      telegramBot.enableGracefulStop();
      await telegramBot.start();
      logger.info('Telegram bot initialized successfully');
    } catch (error) {
      logError('Failed to initialize Telegram bot', error);
      throw error;
    }
  }

  private startExpressServer(): void {
    const port = config.getAppConfig().port;
    
    this.server = this.app.listen(port, () => {
      logger.info(`Express server started on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Status endpoint: http://localhost:${port}/status`);
      logger.info(`QR code endpoint: http://localhost:${port}/qr`);
    });

    this.server.on('error', (error: Error) => {
      logError('Express server error', error);
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting CGPTS Telegram-WhatsApp Bot...');
      
      // Update logger level based on config
      updateLoggerLevel(config.getAppConfig().logLevel);
      
      // Initialize components in order
      await this.initializeDatabase();
      await this.initializeWhatsApp();
      await this.initializeTelegramBot();
      
      // Start Express server
      this.startExpressServer();
      
      logger.info('🚀 Application started successfully!');
      logger.info('📱 Use /start in Telegram to begin');
      
      // Log configuration (without sensitive data)
      const appConfig = config.getAppConfig();
      logger.info('Configuration loaded', {
        port: appConfig.port,
        logLevel: appConfig.logLevel,
        defaultSendRate: appConfig.defaultSendRate,
        maxRetries: appConfig.maxRetries
      });
      
    } catch (error) {
      logError('Failed to start application', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    logger.info('Shutting down application...');
    
    try {
      // Stop Telegram bot
      await telegramBot.stop();
      
      // Disconnect WhatsApp
      await whatsappClient.destroy();
      
      // Close database connection
      await database.disconnect();
      
      // Close Express server
      if (this.server) {
        this.server.close();
      }
      
      logger.info('Application shut down successfully');
    } catch (error) {
      logError('Error during shutdown', error);
    }
  }
}

// Global error handlers
process.on('uncaughtException', (error) => {
  logError('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled rejection', new Error(String(reason)), { promise });
  process.exit(1);
});

// Graceful shutdown handlers
const app = new Application();

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await app.stop();
  process.exit(0);
});

// Start the application
app.start().catch((error) => {
  logError('Failed to start application', error);
  process.exit(1);
});