import { db } from '@/lib/firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
} from 'firebase/firestore';

export interface UserCredits {
    msgCredits: number;
    imgCredits: number;
    lastReset: string;
    totalMsgUsed: number;
    totalImgUsed: number;
}

export const DAILY_MSG_CREDITS = 10;
export const DAILY_IMG_CREDITS = 3;

function getTodayString(): string {
    return new Date().toISOString().split('T')[0]; // "2024-03-04"
}

function getDefaultCredits(): UserCredits {
    return {
        msgCredits: DAILY_MSG_CREDITS,
        imgCredits: DAILY_IMG_CREDITS,
        lastReset: getTodayString(),
        totalMsgUsed: 0,
        totalImgUsed: 0,
    };
}

export async function getUserCredits(userId: string): Promise<UserCredits> {
    const ref = doc(db, 'users', userId, 'private', 'credits');
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        const defaults = getDefaultCredits();
        await setDoc(ref, defaults);
        return defaults;
    }

    const data = snap.data() as UserCredits;
    const today = getTodayString();

    // Reset daily if it's a new day
    if (data.lastReset !== today) {
        const reset: UserCredits = {
            ...data,
            msgCredits: DAILY_MSG_CREDITS,
            imgCredits: DAILY_IMG_CREDITS,
            lastReset: today,
        };
        await setDoc(ref, reset);
        return reset;
    }

    return data;
}

export async function deductMsgCredit(userId: string): Promise<boolean> {
    const credits = await getUserCredits(userId);
    if (credits.msgCredits <= 0) return false;

    const ref = doc(db, 'users', userId, 'private', 'credits');
    await updateDoc(ref, {
        msgCredits: increment(-1),
        totalMsgUsed: increment(1),
    });
    return true;
}

export async function deductImgCredit(userId: string): Promise<boolean> {
    const credits = await getUserCredits(userId);
    if (credits.imgCredits <= 0) return false;

    const ref = doc(db, 'users', userId, 'private', 'credits');
    await updateDoc(ref, {
        imgCredits: increment(-1),
        totalImgUsed: increment(1),
    });
    return true;
}
