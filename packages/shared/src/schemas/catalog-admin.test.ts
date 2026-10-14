import { describe, expect, it } from 'vitest';
import {
  attributeInputSchema,
  brandUpdateSchema,
  inventoryAdjustSchema,
  productInputSchema,
  productUpdateSchema,
} from './catalog-admin.js';

const uuid = '01a11522-32e2-712b-985b-568c1b38a2bc';

describe('admin sxemalari', () => {
  it('tahrirlashda berilmagan maydonlar o‘zgarmaydi (standart qiymat qo‘shilmaydi)', () => {
    expect(productUpdateSchema.parse({ basePrice: 52000 })).toEqual({ basePrice: 52000 });
    expect(brandUpdateSchema.parse({ name: 'Vero' })).toEqual({ name: 'Vero' });
  });

  it('bo‘sh matn maydonni tozalaydi (kalit qoladi, qiymati undefined)', () => {
    const result = productUpdateSchema.parse({ description: '' });
    expect('description' in result).toBe(true);
    expect(result.description).toBeUndefined();
  });

  it('SKU katta harfga o‘tadi, narx butun so‘m', () => {
    const product = productInputSchema.parse({
      sku: 'plt-ppr-25',
      name: 'Truba',
      brandId: uuid,
      categoryId: uuid,
      basePrice: '50000',
    });
    expect(product.sku).toBe('PLT-PPR-25');
    expect(product.basePrice).toBe(50000);
    expect(productInputSchema.safeParse({ ...product, basePrice: 10.5 }).success).toBe(false);
  });

  it('xususiyat kaliti katalog parametrlari bilan bir xil bo‘lmasligi kerak', () => {
    expect(attributeInputSchema.safeParse({ key: 'brand', name: 'X' }).success).toBe(false);
    expect(attributeInputSchema.safeParse({ key: 'thread_type', name: 'Rezba' }).success).toBe(
      true,
    );
  });

  it('ombor: kirim 0 bo‘lmasligi kerak, inventarizatsiyada 0 mumkin', () => {
    expect(inventoryAdjustSchema.safeParse({ operation: 'add', quantity: 0 }).success).toBe(false);
    expect(inventoryAdjustSchema.safeParse({ operation: 'set', quantity: 0 }).success).toBe(true);
  });
});
