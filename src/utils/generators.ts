import { AccountRecord } from '../types';

export function formatTimeNow(includeSeconds = false): string {
  const d = new Date();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  if (includeSeconds) {
    const seconds = d.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${hours}:${minutes}`;
}

// Audio notification chime using Web Audio API
export function playNotificationSound(type: 'otp' | 'success' | 'click' = 'otp') {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'otp') {
      // Pleasant double chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    }
  } catch (e) {
    console.debug('Audio not enabled', e);
  }
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export function formatSheetText(acc: AccountRecord): string {
  return `${acc.orderId ? `Order #${acc.orderId}` : acc.id} | ${acc.number} | ${acc.name || 'Account'} | ${acc.password || 'Pass'} | ${acc.uid || 'N/A'} | ${acc.service || 'Facebook'} | ${acc.status} | Code: ${acc.otpCode || 'WAITING_SMS'}`;
}

export function formatAllSheets(accounts: AccountRecord[]): string {
  return accounts.map(formatSheetText).join('\n');
}

const FIRST_NAMES = [
  'Trisha', 'Nayeem', 'Sabbir', 'Tania', 'Mehedi', 'Ayesha', 'Rakib', 'Fatima',
  'Shakil', 'Sadia', 'Arman', 'Nusrat', 'Fahim', 'Mim', 'Arif', 'Rima', 'Tamim', 'Sumaya', 'Tanvir', 'Farhana'
];

const LAST_NAMES = [
  'Rahman', 'Islam', 'Hossain', 'Akter', 'Hasan', 'Ahmed', 'Siddika', 'Khan',
  'Chowdhury', 'Begum', 'Ali', 'Mahmud', 'Sarker', 'Bhuiyan'
];

export function generatePersonName(): string {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${f} ${l}`;
}

export function generateAccountUID(): string {
  return `1000${Math.floor(10000000000 + Math.random() * 90000000000)}`;
}

