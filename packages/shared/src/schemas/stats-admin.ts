import { z } from './zod.js';

/** Statistika davri: kunlik (7/30/90 kun) yoki oylik (12 oy) kesimda. */
export const STATS_RANGES = ['7d', '30d', '90d', '12m'] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export const STATS_RANGE_LABELS: Record<StatsRange, string> = {
  '7d': 'Oxirgi 7 kun',
  '30d': 'Oxirgi 30 kun',
  '90d': 'Oxirgi 90 kun',
  '12m': 'Oxirgi 12 oy',
};

export const statsQuerySchema = z.object({
  range: z.enum(STATS_RANGES).default('30d'),
});
