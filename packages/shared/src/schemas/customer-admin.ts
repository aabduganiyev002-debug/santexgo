import { z } from './zod.js';

export const CUSTOMER_SORTS = ['recent', 'orders', 'spent', 'name'] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  recent: 'Yangi ro‘yxatdan o‘tganlar',
  orders: 'Buyurtmalar soni',
  spent: 'Xarid summasi',
  name: 'Ism bo‘yicha',
};

/** Admin: mijozlar bazasi — qidiruv (ism, familiya, telefon), saralash, holat. */
export const adminCustomerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(CUSTOMER_SORTS).default('recent'),
  status: z.enum(['all', 'active', 'blocked']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export type AdminCustomerListQuery = z.input<typeof adminCustomerListQuerySchema>;

export const adminCustomerUpdateSchema = z.object({
  /** false — akkaunt bloklanadi: kira olmaydi, barcha qurilmalardan chiqariladi */
  isActive: z.boolean(),
});
