import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface AppSettings {
    // Appearance
    theme: 'dark' | 'light' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    messageDensity: 'compact' | 'comfortable' | 'spacious';
    // Notifications
    notifyCreditAlerts: boolean;
    notifyNewFeatures: boolean;
    // Privacy
    saveChatHistory: boolean;
    enableMemory: boolean;
    shareAnalytics: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
    theme: 'dark',
    fontSize: 'medium',
    messageDensity: 'comfortable',
    notifyCreditAlerts: true,
    notifyNewFeatures: true,
    saveChatHistory: true,
    enableMemory: true,
    shareAnalytics: false,
};

export async function getSettings(userId: string): Promise<AppSettings> {
    const ref = doc(db, 'users', userId, 'private', 'settings');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, DEFAULT_SETTINGS);
        return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) };
}

export async function saveSettings(userId: string, settings: Partial<AppSettings>): Promise<void> {
    const ref = doc(db, 'users', userId, 'private', 'settings');
    const snap = await getDoc(ref);
    if (snap.exists()) {
        await updateDoc(ref, settings);
    } else {
        await setDoc(ref, { ...DEFAULT_SETTINGS, ...settings });
    }
}

/**
 * Apply appearance settings to the document root via CSS variables / class names.
 */
export function applyTheme(settings: Pick<AppSettings, 'theme' | 'fontSize' | 'messageDensity'>) {
    const root = document.documentElement;

    // Theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Font size
    const fontMap = { small: '13px', medium: '15px', large: '17px' };
    root.style.setProperty('--chat-font-size', fontMap[settings.fontSize] || '15px');

    // Message density (gap between messages)
    const densityMap = { compact: '10px', comfortable: '20px', spacious: '32px' };
    root.style.setProperty('--message-gap', densityMap[settings.messageDensity] || '20px');
}
