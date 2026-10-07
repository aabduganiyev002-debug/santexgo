import { clsx, type ClassValue } from 'clsx';

/** CSS klasslarini shart bilan birlashtirish: cn('a', isActive && 'b') */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
