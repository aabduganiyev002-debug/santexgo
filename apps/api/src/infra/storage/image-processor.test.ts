import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { InvalidImageError, isPdf, processImage } from './image-processor.js';

describe('processImage', () => {
  it('katta rasmni WebP formatida 3 o‘lchamga keltiradi', async () => {
    const input = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#2a6' },
    })
      .jpeg()
      .toBuffer();
    const result = await processImage(input);
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1067);
    for (const [buffer, size] of [
      [result.large, 1600],
      [result.medium, 800],
      [result.thumb, 400],
    ] as const) {
      const meta = await sharp(buffer).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(size);
    }
  });

  it('kichik rasmni kattalashtirmaydi', async () => {
    const input = await sharp({
      create: { width: 300, height: 200, channels: 4, background: '#fff0' },
    })
      .png()
      .toBuffer();
    const result = await processImage(input);
    expect(result.width).toBe(300);
  });

  it('rasm bo‘lmagan faylni rad etadi', async () => {
    await expect(processImage(Buffer.from('<svg onload="alert(1)"></svg>'))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
    await expect(processImage(Buffer.from('salom'))).rejects.toBeInstanceOf(InvalidImageError);
  });
});

describe('isPdf', () => {
  it('PDF sarlavhasini tekshiradi', () => {
    expect(isPdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(isPdf(Buffer.from('<html>'))).toBe(false);
  });
});
