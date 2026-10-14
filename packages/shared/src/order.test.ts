import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  canTransitionOrderStatus,
  formatOrderNumber,
  isFinalOrderStatus,
  parseOrderNumber,
} from './order.js';

describe('buyurtma statuslari', () => {
  it('har bir status uchun o‘zbekcha nom bor', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('status faqat oldinga yuradi, oraliq bosqichni o‘tkazib yuborish mumkin', () => {
    expect(canTransitionOrderStatus('RECEIVED', 'CONFIRMING')).toBe(true);
    expect(canTransitionOrderStatus('PREPARING', 'DELIVERING')).toBe(true);
    expect(canTransitionOrderStatus('DELIVERING', 'DELIVERED')).toBe(true);
    expect(canTransitionOrderStatus('PREPARING', 'DELIVERED')).toBe(true);
    expect(canTransitionOrderStatus('DELIVERED', 'RECEIVED')).toBe(false);
    expect(canTransitionOrderStatus('DELIVERING', 'PREPARING')).toBe(false);
    expect(canTransitionOrderStatus('RECEIVED', 'RECEIVED')).toBe(false);
  });

  it('yetkazilgan yoki bekor qilingan buyurtma o‘zgarmaydi', () => {
    expect(canTransitionOrderStatus('PREPARING', 'CANCELLED')).toBe(true);
    expect(canTransitionOrderStatus('DELIVERING', 'CANCELLED')).toBe(true);
    expect(canTransitionOrderStatus('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransitionOrderStatus('CANCELLED', 'RECEIVED')).toBe(false);
  });

  it('yakuniy statuslar', () => {
    expect(isFinalOrderStatus('DELIVERED')).toBe(true);
    expect(isFinalOrderStatus('CANCELLED')).toBe(true);
    expect(isFinalOrderStatus('PREPARING')).toBe(false);
  });
});

describe('buyurtma raqami', () => {
  it('ORDER-10254 formatida chiqadi', () => {
    expect(formatOrderNumber(10254)).toBe('ORDER-10254');
  });

  it('turli yozilishlarni o‘qiydi', () => {
    expect(parseOrderNumber('ORDER-10254')).toBe(10254);
    expect(parseOrderNumber('#order-10254')).toBe(10254);
    expect(parseOrderNumber(' 10254 ')).toBe(10254);
    expect(parseOrderNumber('ORDER-')).toBeNull();
    expect(parseOrderNumber('ORDER-abc')).toBeNull();
    expect(parseOrderNumber('0')).toBeNull();
  });
});
