import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// theme.css dagi o'z tokenlarimiz: ularsiz "shadow-card" soya rangi deb tushuniladi
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['card', 'pop'],
      radius: ['card'],
    },
  },
});

/**
 * CSS klasslarini shart bilan birlashtirish: cn('a', isActive && 'b').
 * Bir-biriga zid klasslardan keyingisi qoladi: cn('h-11 w-full', 'h-10 w-auto') → 'h-10 w-auto'
 * (aks holda qaysi biri ishlashi CSS fayldagi tartibga bog'liq bo'ladi)
 */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}
