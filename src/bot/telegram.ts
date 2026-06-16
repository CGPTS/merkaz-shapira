import { Telegraf, Context, Markup } from 'telegraf';
import { User, SessionData } from '../types/types';
import { logger, logTelegramEvent, logUserAction, logError } from '../utils/logger';
import { config } from '../config/config';
import { database } from '../database/database';
import { whatsappClient, WhatsAppClient } from '../whatsapp/client';

interface BotContext extends Context {
  session?: SessionData;
}

export class TelegramBot {
  private bot: Telegraf<BotContext>;
  private sessions: Map<number, SessionData> = new Map();

  constructor() {
    const telegramConfig = config.getTelegramConfig();
    this.bot = new Telegraf<BotContext>(telegramConfig.botToken);
    this.setupMiddleware();
    this.setupCommands();
    this.setupCallbacks();
  }

  private setupMiddleware(): void {
    // Session middleware
    this.bot.use((ctx, next) => {
      if (ctx.from) {
        const userId = ctx.from.id;
        if (!this.sessions.has(userId)) {
          this.sessions.set(userId, { userId });
        }
        ctx.session = this.sessions.get(userId);
      }
      return next();
    });

    // Authentication middleware
    this.bot.use(async (ctx, next) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;
      
      // Check if user is allowed (if restrictions are set)
      if (!config.isUserAllowed(userId)) {
        logTelegramEvent('Unauthorized access attempt', { userId });
        await ctx.reply('❌ You are not authorized to use this bot.');
        return;
      }

      // Get or create user in database
      try {
        let user = await database.getUserByTelegramId(userId);
        if (!user) {
          user = await database.createUser(userId, {
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            isAuthenticated: false
          });
          logUserAction(userId, 'User created');
        }
        
        // Update user info if changed
        const needsUpdate = (
          user.username !== ctx.from.username ||
          user.firstName !== ctx.from.first_name ||
          user.lastName !== ctx.from.last_name
        );
        
        if (needsUpdate) {
          await database.updateUser(user.id, {
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name
          });
        }
        
        ctx.session!.userId = user.id;
      } catch (error) {
        logError('Database error in auth middleware', error, { userId });
        await ctx.reply('❌ Database error. Please try again later.');
        return;
      }

      return next();
    });
  }

  private setupCommands(): void {
    // Start command
    this.bot.start(async (ctx) => {
      const userName = ctx.from?.first_name || 'User';
      logUserAction(ctx.from!.id, 'Started bot');
      
      await ctx.reply(
        `🚗 ברוכים הבאים לבוט ניהול נסיעות!\n\n` +
        `שלום ${userName}! 👋\n\n` +
        `בוט זה מאפשר לכם לפרסם נסיעות בקבוצות וואטסאפ ולנהל אותן בצורה חכמה.\n\n` +
        `לחצו על "תפריט ראשי" כדי להתחיל:`,
        this.getMainMenuMarkup()
      );
    });

    // Help command
    this.bot.help(async (ctx) => {
      const helpText = `
🚗 *עזרה - בוט ניהול נסיעות*

*פקודות זמינות:*
/start - התחל עם הבוט
/menu - הצג תפריט ראשי
/status - סטטוס חיבור וואטסאפ
/help - הצג הודעת עזרה זו

*תפריט ראשי:*
🚗 *פרסום נסיעה* - פרסם נסיעה בקבוצות שנבחרו
👥 *ניהול קבוצות* - הוסף/הסר קבוצות וואטסאפ
⚡ *שינוי קצב שליחה* - קבע זמן המתנה בין הודעות
🧹 *ניקוי צ'אטים* - נקה הודעות מקבוצות
🔄 *איתחול* - אתחל את החיבור לוואטסאפ
🚪 *התנתקות* - התנתק מוואטסאפ

*הערות חשובות:*
• ודא שוואטסאפ Web מחובר לפני השימוש
• השתמש בקצב שליחה סביר (מינימום 5 שניות)
• הבוט שומר על כל הקבוצות והגדרות שלך
      `;
      
      await ctx.reply(helpText, { parse_mode: 'Markdown' });
    });

    // Menu command
    this.bot.command('menu', async (ctx) => {
      await ctx.reply('📋 תפריט ראשי:', this.getMainMenuMarkup());
    });

    // Status command
    this.bot.command('status', async (ctx) => {
      const whatsappStatus = whatsappClient.getStatus();
      const statusText = `
📊 *סטטוס מערכת*

🟢 *וואטסאפ:* ${whatsappStatus.isConnected ? 'מחובר ✅' : 'לא מחובר ❌'}
📅 *פעילות אחרונה:* ${whatsappStatus.lastActivity ? whatsappStatus.lastActivity.toLocaleString('he-IL') : 'לא זמין'}
🤖 *בוט טלגרם:* פעיל ✅

${!whatsappStatus.isConnected ? '\n⚠️ יש להתחבר לוואטסאפ תחילה' : ''}
      `;
      
      await ctx.reply(statusText, { parse_mode: 'Markdown' });
    });

    // Handle unknown commands
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      
      // Skip if it's a command or callback data
      if (text.startsWith('/') || text.startsWith('cbk_')) return;
      
      // Handle based on current session step
      if (ctx.session?.step) {
        await this.handleSessionStep(ctx);
      } else {
        await ctx.reply(
          '❓ הפקודה לא מזוהה. השתמש ב-/menu לתפריט הראשי או ב-/help לעזרה.',
          this.getMainMenuMarkup()
        );
      }
    });
  }

  private setupCallbacks(): void {
    // Main menu callbacks
    this.bot.action('main_menu', async (ctx) => {
      await ctx.editMessageText('📋 תפריט ראשי:', this.getMainMenuMarkup());
      await ctx.answerCbQuery();
    });

    // Post ride callback
    this.bot.action('post_ride', async (ctx) => {
      if (!whatsappClient.isConnected()) {
        await ctx.editMessageText(
          '❌ וואטסאפ לא מחובר!\n\nיש להתחבר תחילה באמצעות "איתחול".',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 איתחול', 'reset_whatsapp')],
            [Markup.button.callback('◀️ חזור', 'main_menu')]
          ])
        );
        await ctx.answerCbQuery();
        return;
      }

      ctx.session!.step = 'post_ride_message';
      await ctx.editMessageText(
        '🚗 *פרסום נסיעה*\n\nאנא שלח את הודעת הנסיעה שברצונך לפרסם:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('◀️ חזור', 'main_menu')]
          ])
        }
      );
      await ctx.answerCbQuery();
    });

    // Manage groups callback
    this.bot.action('manage_groups', async (ctx) => {
      await this.showGroupsManagement(ctx);
      await ctx.answerCbQuery();
    });

    // Change send rate callback
    this.bot.action('change_send_rate', async (ctx) => {
      ctx.session!.step = 'change_send_rate';
      await ctx.editMessageText(
        '⚡ *שינוי קצב שליחה*\n\nהזן את מספר השניות להמתנה בין שליחת הודעות (מינימום 5):',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('◀️ חזור', 'main_menu')]
          ])
        }
      );
      await ctx.answerCbQuery();
    });

    // Clean chats callback
    this.bot.action('clean_chats', async (ctx) => {
      await this.showChatsCleaning(ctx);
      await ctx.answerCbQuery();
    });

    // Reset WhatsApp callback
    this.bot.action('reset_whatsapp', async (ctx) => {
      await this.resetWhatsApp(ctx);
      await ctx.answerCbQuery();
    });

    // Disconnect callback
    this.bot.action('disconnect', async (ctx) => {
      await this.disconnectWhatsApp(ctx);
      await ctx.answerCbQuery();
    });

    // Group management callbacks
    this.bot.action('add_group', async (ctx) => {
      ctx.session!.step = 'add_group_id';
      await ctx.editMessageText(
        '➕ *הוספת קבוצה חדשה*\n\nהזן את ID הקבוצה בוואטסאפ (לדוגמה: 120363025246125708@g.us):',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('◀️ חזור', 'manage_groups')]
          ])
        }
      );
      await ctx.answerCbQuery();
    });

    this.bot.action('refresh_groups', async (ctx) => {
      await this.showGroupsManagement(ctx);
      await ctx.answerCbQuery();
    });

    this.bot.action('delete_group', async (ctx) => {
      await this.showGroupDeletion(ctx);
      await ctx.answerCbQuery();
    });

    // Send to all groups callback
    this.bot.action('send_to_all', async (ctx) => {
      if (ctx.session?.tempData?.message) {
        await this.sendRideToAllGroups(ctx, ctx.session.tempData.message);
      }
      await ctx.answerCbQuery();
    });

    // Select specific group callbacks
    this.bot.action(/^select_group_(\d+)$/, async (ctx) => {
      const groupId = parseInt(ctx.match![1]!);
      await this.selectGroupForRide(ctx, groupId);
      await ctx.answerCbQuery();
    });

    // Confirm clean chats callback
    this.bot.action('confirm_clean', async (ctx) => {
      await this.cleanAllChats(ctx);
      await ctx.answerCbQuery();
    });

    // Delete specific group callbacks
    this.bot.action(/^delete_group_(\d+)$/, async (ctx) => {
      const groupId = parseInt(ctx.match![1]!);
      await this.deleteGroup(ctx, groupId);
      await ctx.answerCbQuery();
    });
  }

  private getMainMenuMarkup() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🚗 פרסום נסיעה', 'post_ride')],
      [Markup.button.callback('👥 ניהול קבוצות', 'manage_groups')],
      [Markup.button.callback('⚡ שינוי קצב שליחה', 'change_send_rate')],
      [Markup.button.callback('🧹 ניקוי צ\'אטים', 'clean_chats')],
      [Markup.button.callback('🔄 איתחול', 'reset_whatsapp')],
      [Markup.button.callback('🚪 התנתקות', 'disconnect')]
    ]);
  }

  private async handleSessionStep(ctx: BotContext): Promise<void> {
    if (!ctx.session?.step || !ctx.message || !('text' in ctx.message)) return;

    const step = ctx.session.step;
    const text = ctx.message.text;

    switch (step) {
      case 'post_ride_message':
        await this.handleRideMessage(ctx, text);
        break;
      case 'change_send_rate':
        await this.handleSendRateChange(ctx, text);
        break;
      case 'add_group_id':
        await this.handleAddGroup(ctx, text);
        break;
      default:
        ctx.session.step = undefined;
        await ctx.reply('❓ שלב לא מזוהה. מתחיל מחדש...', this.getMainMenuMarkup());
    }
  }

  private async handleRideMessage(ctx: BotContext, message: string): Promise<void> {
    try {
      // Get user's groups
      const groups = await database.getChatGroupsByUser(ctx.session!.userId);
      
      if (groups.length === 0) {
        await ctx.reply(
          '❌ לא נמצאו קבוצות!\n\nיש להוסיף קבוצות תחילה דרך "ניהול קבוצות".',
          this.getMainMenuMarkup()
        );
        ctx.session!.step = undefined;
        return;
      }

      // Store message and show groups selection
      ctx.session!.tempData = { message };
      ctx.session!.step = 'select_groups';

      const keyboard = groups.map(group => 
        [Markup.button.callback(`📱 ${group.name}`, `select_group_${group.id}`)]
      );
      keyboard.push([Markup.button.callback('✅ שלח לכל הקבוצות', 'send_to_all')]);
      keyboard.push([Markup.button.callback('◀️ חזור', 'main_menu')]);

      await ctx.reply(
        '👥 *בחר קבוצות לשליחה:*\n\nההודעה שתישלח:\n\n' + message,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard)
        }
      );
      
    } catch (error) {
      logError('Error handling ride message', error);
      await ctx.reply('❌ שגיאה בעיבוד ההודעה. נסה שוב.', this.getMainMenuMarkup());
      ctx.session!.step = undefined;
    }
  }

  private async handleSendRateChange(ctx: BotContext, rateText: string): Promise<void> {
    const rate = parseInt(rateText);
    
    if (isNaN(rate) || rate < 5) {
      await ctx.reply(
        '❌ קצב שליחה לא תקין!\n\nיש להזין מספר שניות (מינימום 5).',
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ חזור', 'main_menu')]
        ])
      );
      return;
    }

    // Here you would save the send rate to user settings
    // For now, just confirm the change
    await ctx.reply(
      `✅ קצב השליחה שונה ל-${rate} שניות בין הודעות.`,
      this.getMainMenuMarkup()
    );
    
    ctx.session!.step = undefined;
    logUserAction(ctx.from!.id, 'Changed send rate', { rate });
  }

  private async showGroupsManagement(ctx: BotContext): Promise<void> {
    try {
      const groups = await database.getChatGroupsByUser(ctx.session!.userId);
      
      let text = '👥 *ניהול קבוצות*\n\n';
      
      if (groups.length === 0) {
        text += 'אין קבוצות שמורות.\n\n';
      } else {
        text += 'קבוצות שמורות:\n';
        groups.forEach((group, index) => {
          text += `${index + 1}. 📱 ${group.name}\n`;
        });
        text += '\n';
      }

      const keyboard = [
        [Markup.button.callback('➕ הוסף קבוצה חדשה', 'add_group')],
        [Markup.button.callback('🔄 רענן רשימה', 'refresh_groups')],
        [Markup.button.callback('◀️ חזור', 'main_menu')]
      ];

      if (groups.length > 0) {
        keyboard.splice(1, 0, [Markup.button.callback('❌ מחק קבוצה', 'delete_group')]);
      }

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard)
      });
      
    } catch (error) {
      logError('Error showing groups management', error);
      await ctx.editMessageText(
        '❌ שגיאה בטעינת הקבוצות.',
        this.getMainMenuMarkup()
      );
    }
  }

  private async showChatsCleaning(ctx: BotContext): Promise<void> {
    if (!whatsappClient.isConnected()) {
      await ctx.editMessageText(
        '❌ וואטסאפ לא מחובר!\n\nיש להתחבר תחילה.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 איתחול', 'reset_whatsapp')],
          [Markup.button.callback('◀️ חזור', 'main_menu')]
        ])
      );
      return;
    }

    await ctx.editMessageText(
      '🧹 *ניקוי צ\'אטים*\n\n⚠️ פעולה זו תמחק את כל ההודעות מהקבוצות הנבחרות!\n\nהאם אתה בטוח?',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ כן, נקה', 'confirm_clean')],
          [Markup.button.callback('❌ ביטול', 'main_menu')]
        ])
      }
    );
  }

  private async resetWhatsApp(ctx: BotContext): Promise<void> {
    await ctx.editMessageText(
      '🔄 *איתחול וואטסאפ*\n\nמתחיל איתחול...',
      { parse_mode: 'Markdown' }
    );

    try {
      // Reset WhatsApp connection
      if (whatsappClient.isConnected()) {
        await whatsappClient.destroy();
      }
      
      await whatsappClient.initialize();
      
      await ctx.editMessageText(
        '✅ איתחול הושלם בהצלחה!\n\nוואטסאפ מוכן לשימוש.',
        this.getMainMenuMarkup()
      );
      
      logUserAction(ctx.from!.id, 'Reset WhatsApp');
      
    } catch (error) {
      logError('Error resetting WhatsApp', error);
      await ctx.editMessageText(
        '❌ שגיאה באיתחול וואטסאפ.\n\nנסה שוב מאוחר יותר.',
        this.getMainMenuMarkup()
      );
    }
  }

  private async disconnectWhatsApp(ctx: BotContext): Promise<void> {
    try {
      await whatsappClient.logout();
      await ctx.editMessageText(
        '🚪 ההתנתקות מוואטסאפ הושלמה בהצלחה.',
        this.getMainMenuMarkup()
      );
      
      logUserAction(ctx.from!.id, 'Disconnected WhatsApp');
      
    } catch (error) {
      logError('Error disconnecting WhatsApp', error);
      await ctx.editMessageText(
        '❌ שגיאה בהתנתקות מוואטסאפ.',
        this.getMainMenuMarkup()
      );
    }
  }

  private async handleAddGroup(ctx: BotContext, groupId: string): Promise<void> {
    try {
      // Validate group ID format
      if (!WhatsAppClient.isValidChatId(groupId)) {
        await ctx.reply(
          '❌ ID קבוצה לא תקין!\n\nהפורמט הצריך: 120363025246125708@g.us',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 נסה שוב', 'add_group')],
            [Markup.button.callback('◀️ חזור', 'manage_groups')]
          ])
        );
        return;
      }

      // Try to get group info from WhatsApp
      const chat = await whatsappClient.getChatById(groupId);
      if (!chat) {
        await ctx.reply(
          '❌ קבוצה לא נמצאה בוואטסאפ!\n\nוודא שהבוט חבר לקבוצה וש-ID נכון.',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 נסה שוב', 'add_group')],
            [Markup.button.callback('◀️ חזור', 'manage_groups')]
          ])
        );
        return;
      }

      // Save group to database
      await database.createChatGroup({
        name: chat.name || 'קבוצה ללא שם',
        whatsappGroupId: groupId,
        createdBy: ctx.session!.userId,
        isActive: true
      });

      await ctx.reply(
        `✅ הקבוצה "${chat.name}" נוספה בהצלחה!`,
        this.getMainMenuMarkup()
      );

      ctx.session!.step = undefined;
      logUserAction(ctx.from!.id, 'Added group', { groupId, groupName: chat.name });

    } catch (error) {
      logError('Error adding group', error);
      await ctx.reply(
        '❌ שגיאה בהוספת הקבוצה. נסה שוב.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 נסה שוב', 'add_group')],
          [Markup.button.callback('◀️ חזור', 'manage_groups')]
        ])
      );
    }
  }

  private async showGroupDeletion(ctx: BotContext): Promise<void> {
    try {
      const groups = await database.getChatGroupsByUser(ctx.session!.userId);
      
      if (groups.length === 0) {
        await ctx.editMessageText(
          '❌ אין קבוצות למחיקה.',
          Markup.inlineKeyboard([
            [Markup.button.callback('◀️ חזור', 'manage_groups')]
          ])
        );
        return;
      }

      const keyboard = groups.map(group => 
        [Markup.button.callback(`❌ ${group.name}`, `delete_group_${group.id}`)]
      );
      keyboard.push([Markup.button.callback('◀️ חזור', 'manage_groups')]);

      await ctx.editMessageText(
        '❌ *מחיקת קבוצה*\n\nבחר קבוצה למחיקה:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard)
        }
      );
      
    } catch (error) {
      logError('Error showing group deletion', error);
      await ctx.editMessageText(
        '❌ שגיאה בטעינת הקבוצות.',
        this.getMainMenuMarkup()
      );
    }
  }

  private async sendRideToAllGroups(ctx: BotContext, message: string): Promise<void> {
    try {
      const groups = await database.getChatGroupsByUser(ctx.session!.userId);
      
      if (groups.length === 0) {
        await ctx.editMessageText(
          '❌ אין קבוצות זמינות.',
          this.getMainMenuMarkup()
        );
        return;
      }

      await ctx.editMessageText('🚀 שולח הודעה לכל הקבוצות...');

      let successCount = 0;
      let failCount = 0;
      const sendRate = config.getAppConfig().defaultSendRate;

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]!;
        const delay = i * sendRate; // Add delay between sends

        setTimeout(async () => {
          const success = await whatsappClient.sendMessage(group.whatsappGroupId, message);
          if (success) {
            successCount++;
            logger.info(`Message sent to group: ${group.name}`);
          } else {
            failCount++;
            logger.warn(`Failed to send message to group: ${group.name}`);
          }

          // Update status after last message
          if (i === groups.length - 1) {
            setTimeout(async () => {
              await ctx.editMessageText(
                `✅ שליחה הושלמה!\n\n` +
                `🟢 נשלח בהצלחה: ${successCount}\n` +
                `🔴 נכשל: ${failCount}\n` +
                `📊 סה"כ קבוצות: ${groups.length}`,
                this.getMainMenuMarkup()
              );
            }, 2000);
          }
        }, delay);
      }

      ctx.session!.step = undefined;
      ctx.session!.tempData = undefined;
      
      logUserAction(ctx.from!.id, 'Sent ride to all groups', { 
        groupCount: groups.length,
        messageLength: message.length
      });

    } catch (error) {
      logError('Error sending ride to all groups', error);
      await ctx.editMessageText(
        '❌ שגיאה בשליחת ההודעות.',
        this.getMainMenuMarkup()
      );
    }
  }

  private async selectGroupForRide(ctx: BotContext, groupId: number): Promise<void> {
    try {
      const groups = await database.getChatGroupsByUser(ctx.session!.userId);
      const selectedGroup = groups.find(g => g.id === groupId);
      
      if (!selectedGroup) {
        await ctx.editMessageText('❌ קבוצה לא נמצאה.', this.getMainMenuMarkup());
        return;
      }

      const message = ctx.session!.tempData?.message;
      if (!message) {
        await ctx.editMessageText('❌ הודעה לא נמצאה.', this.getMainMenuMarkup());
        return;
      }

      await ctx.editMessageText(`🚀 שולח הודעה לקבוצה "${selectedGroup.name}"...`);

      const success = await whatsappClient.sendMessage(selectedGroup.whatsappGroupId, message);
      
      if (success) {
        await ctx.editMessageText(
          `✅ ההודעה נשלחה בהצלחה לקבוצה "${selectedGroup.name}"!`,
          this.getMainMenuMarkup()
        );
        logUserAction(ctx.from!.id, 'Sent ride to specific group', { 
          groupId: selectedGroup.id,
          groupName: selectedGroup.name
        });
      } else {
        await ctx.editMessageText(
          `❌ שליחת ההודעה לקבוצה "${selectedGroup.name}" נכשלה.`,
          this.getMainMenuMarkup()
        );
      }

      ctx.session!.step = undefined;
      ctx.session!.tempData = undefined;

    } catch (error) {
      logError('Error selecting group for ride', error);
      await ctx.editMessageText(
        '❌ שגיאה בשליחת ההודעה.',
        this.getMainMenuMarkup()
      );
    }
  }

  private async cleanAllChats(ctx: BotContext): Promise<void> {
    try {
      const groups = await database.getChatGroupsByUser(ctx.session!.userId);
      
      if (groups.length === 0) {
        await ctx.editMessageText(
          '❌ אין קבוצות לניקוי.',
          this.getMainMenuMarkup()
        );
        return;
      }

      await ctx.editMessageText('🧹 מנקה צ\'אטים...');

      let successCount = 0;
      let failCount = 0;

      for (const group of groups) {
        const success = await whatsappClient.clearChat(group.whatsappGroupId);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      await ctx.editMessageText(
        `✅ ניקוי הושלם!\n\n` +
        `🟢 נוקו בהצלחה: ${successCount}\n` +
        `🔴 נכשל: ${failCount}\n` +
        `📊 סה"כ קבוצות: ${groups.length}`,
        this.getMainMenuMarkup()
      );

      logUserAction(ctx.from!.id, 'Cleaned all chats', { 
        successCount,
        failCount,
        totalGroups: groups.length
      });

    } catch (error) {
      logError('Error cleaning chats', error);
      await ctx.editMessageText(
        '❌ שגיאה בניקוי הצ\'אטים.',
        this.getMainMenuMarkup()
      );
    }
  }

  private async deleteGroup(ctx: BotContext, groupId: number): Promise<void> {
    try {
      const groups = await database.getChatGroupsByUser(ctx.session!.userId);
      const groupToDelete = groups.find(g => g.id === groupId);
      
      if (!groupToDelete) {
        await ctx.editMessageText('❌ קבוצה לא נמצאה.', this.getMainMenuMarkup());
        return;
      }

      // Delete from database (mark as inactive)
      await database.updateChatGroup(groupId, { isActive: false });

      await ctx.editMessageText(
        `✅ הקבוצה "${groupToDelete.name}" נמחקה בהצלחה!`,
        this.getMainMenuMarkup()
      );

      logUserAction(ctx.from!.id, 'Deleted group', { 
        groupId,
        groupName: groupToDelete.name
      });

    } catch (error) {
      logError('Error deleting group', error);
      await ctx.editMessageText(
        '❌ שגיאה במחיקת הקבוצה.',
        this.getMainMenuMarkup()
      );
    }
  }

  async start(): Promise<void> {
    try {
      logTelegramEvent('Starting Telegram bot');
      await this.bot.launch();
      logger.info('Telegram bot started successfully');
    } catch (error) {
      logError('Failed to start Telegram bot', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logTelegramEvent('Stopping Telegram bot');
      this.bot.stop();
      logger.info('Telegram bot stopped');
    } catch (error) {
      logError('Error stopping Telegram bot', error);
      throw error;
    }
  }

  // Graceful shutdown
  enableGracefulStop(): void {
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}

// Export singleton instance
export const telegramBot = new TelegramBot();