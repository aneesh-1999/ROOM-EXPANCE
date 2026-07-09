import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface DiscordSettings {
  enabled: boolean;
  webhookUrl: string;
  customWebhooks?: {
    transactions?: string;
    security?: string;
    savings?: string;
    bills?: string;
  };
  events: {
    newTransaction: boolean;
    updateDeleteTransaction: boolean;
    userLoginLogout: boolean;
    passwordSecurityChanges: boolean;
    accountChanges: boolean;
    savingsGoalsChanges: boolean;
    receiptUploads: boolean;
    settingsChanges: boolean;
    financeUpdates: boolean;
    approvalRejectionActions: boolean;
    failedLogins: boolean;
  };
  messageFormat: 'embed' | 'text';
  customPrefix: string;
}

export const DEFAULT_DISCORD_SETTINGS: DiscordSettings = {
  enabled: false,
  webhookUrl: '',
  customWebhooks: {
    transactions: '',
    security: '',
    savings: '',
    bills: ''
  },
  events: {
    newTransaction: true,
    updateDeleteTransaction: true,
    userLoginLogout: true,
    passwordSecurityChanges: true,
    accountChanges: true,
    savingsGoalsChanges: true,
    receiptUploads: true,
    settingsChanges: true,
    financeUpdates: true,
    approvalRejectionActions: true,
    failedLogins: true
  },
  messageFormat: 'embed',
  customPrefix: '🏠 [Roommate Ledger]'
};

const SETTINGS_COLLECTION = 'discord_settings';
const SETTINGS_DOC_ID = 'config';

// Retrieve Discord Settings from Firestore
export async function getDiscordSettings(): Promise<DiscordSettings> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<DiscordSettings>;
      return {
        enabled: data.enabled ?? DEFAULT_DISCORD_SETTINGS.enabled,
        webhookUrl: data.webhookUrl ?? DEFAULT_DISCORD_SETTINGS.webhookUrl,
        customWebhooks: {
          transactions: data.customWebhooks?.transactions ?? '',
          security: data.customWebhooks?.security ?? '',
          savings: data.customWebhooks?.savings ?? '',
          bills: data.customWebhooks?.bills ?? ''
        },
        events: {
          ...DEFAULT_DISCORD_SETTINGS.events,
          ...data.events
        },
        messageFormat: data.messageFormat ?? DEFAULT_DISCORD_SETTINGS.messageFormat,
        customPrefix: data.customPrefix ?? DEFAULT_DISCORD_SETTINGS.customPrefix
      };
    }
    return DEFAULT_DISCORD_SETTINGS;
  } catch (error) {
    console.error('Failed to load Discord settings:', error);
    return DEFAULT_DISCORD_SETTINGS;
  }
}

// Save Discord Settings to Firestore
export async function saveDiscordSettings(settings: DiscordSettings): Promise<void> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error('Failed to save Discord settings:', error);
    throw error;
  }
}

// Test Webhook URL with a sample notification
export async function testDiscordWebhook(url: string, prefix: string): Promise<boolean> {
  if (!url) return false;
  try {
    const payload = {
      username: 'Roommate Ledger System',
      avatar_url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=100&h=100&fit=crop',
      embeds: [
        {
          title: '🔌 Webhook Connection Test',
          description: `${prefix || '🏠'} Connection test executed successfully! Webhook is active and listening for cohabitation ledger events.`,
          color: 5195493, // Indigo hex #4F46E5
          timestamp: new Date().toISOString(),
          fields: [
            { name: 'Status', value: '🟢 ACTIVE', inline: true },
            { name: 'Timestamp', value: new Date().toLocaleString(), inline: true }
          ],
          footer: {
            text: 'Roommate Ledger Integration Engine'
          }
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return response.ok;
  } catch (error) {
    console.error('Error during webhook test:', error);
    return false;
  }
}

// Send a styled Discord notification
export async function sendDiscordNotification(
  eventKey: keyof DiscordSettings['events'],
  details: {
    title: string;
    description?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    color?: number;
    category?: 'transactions' | 'security' | 'savings' | 'bills';
  },
  actor?: string
) {
  // Skip notifications for actions explicitly triggered inside the Admin Panel
  if (actor && actor.includes('Admin')) {
    console.log(`[Discord Notification] Skipped event "${eventKey}" triggered within Admin Panel.`);
    return;
  }

  try {
    const settings = await getDiscordSettings();

    // Check global toggle and specific event toggle
    if (!settings.enabled) return;
    if (!settings.events[eventKey]) return;

    // Pick Webhook URL: prefer custom webhook based on category, fallback to default
    let targetUrl = settings.webhookUrl;
    if (details.category && settings.customWebhooks?.[details.category]) {
      targetUrl = settings.customWebhooks[details.category] || settings.webhookUrl;
    }

    if (!targetUrl) {
      console.warn('[Discord Notification] No webhook URL configured.');
      return;
    }

    const prefix = settings.customPrefix ? `${settings.customPrefix} ` : '';
    const timestamp = new Date().toISOString();

    let body: any = {};

    if (settings.messageFormat === 'text') {
      let content = `**${prefix}${details.title}**\n`;
      if (details.description) {
        content += `${details.description}\n`;
      }
      if (details.fields && details.fields.length > 0) {
        details.fields.forEach((f) => {
          content += `• **${f.name}**: ${f.value}\n`;
        });
      }
      content += `_Time: ${new Date().toLocaleString()}_`;
      body = { content };
    } else {
      // Elegant Rich Embed Format
      body = {
        username: 'Roommate Ledger',
        avatar_url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=128&h=128&fit=crop',
        embeds: [
          {
            title: `${prefix}${details.title}`,
            description: details.description || '',
            color: details.color ?? 5195493, // default indigo
            timestamp,
            fields: details.fields || [],
            footer: {
              text: 'Roommate Ledger Integration Engine'
            }
          }
        ]
      };
    }

    await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error('[Discord Notification] Error sending notification:', err);
  }
}
