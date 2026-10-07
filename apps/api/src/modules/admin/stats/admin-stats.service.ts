import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AdminSalesStats,
  type AdminStatsOverview,
  LOW_STOCK_DISPLAY_THRESHOLD,
  ORDER_STATUSES,
  type OrderStatus,
  type StatsRange,
} from '@santexgo/shared';
import type { Env } from '../../../config/env.schema.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

const RANGES: Record<StatsRange, { bucket: 'day' | 'month'; count: number }> = {
  '7d': { bucket: 'day', count: 7 },
  '30d': { bucket: 'day', count: 30 },
  '90d': { bucket: 'day', count: 90 },
  '12m': { bucket: 'month', count: 12 },
};

/** Kod tanlaydigan qat'iy SQL bo'laklari (foydalanuvchi qiymati emas) */
const UNIT = { day: Prisma.raw(`'day'`), month: Prisma.raw(`'month'`) };
const STEP = { day: Prisma.raw(`interval '1 day'`), month: Prisma.raw(`interval '1 month'`) };

interface OverviewRow {
  todayOrders: number;
  todayRevenue: bigint;
  todayItems: bigint;
  yesterdayOrders: number;
  yesterdayRevenue: bigint;
  monthOrders: number;
  monthRevenue: bigint;
  prevOrders: number;
  prevRevenue: bigint;
}

/**
 * Admin statistikasi. Savdo — bekor qilinmagan buyurtmalar summasi, buyurtma berilgan
 * kun bo'yicha (do'kon vaqt zonasida: APP_TIMEZONE). Hisob-kitob to'liq bazada bajariladi.
 */
@Injectable()
export class AdminStatsService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.tz = config.get('APP_TIMEZONE', { infer: true });
  }

  async overview(): Promise<AdminStatsOverview> {
    const tz = this.tz;
    const [rows, customers, newCustomers, products, pending] = await this.prisma.$transaction([
      this.prisma.$queryRaw<OverviewRow[]>`
        WITH b AS (
          SELECT now() AT TIME ZONE ${tz} AS local_now,
                 date_trunc('day', now() AT TIME ZONE ${tz}) AS today,
                 date_trunc('month', now() AT TIME ZONE ${tz}) AS month
        ), o AS (
          SELECT o.total, o.items_count, o.created_at AT TIME ZONE ${tz} AS at
          FROM orders o, b
          WHERE o.status <> 'CANCELLED'
            AND o.created_at >= ((b.month - interval '1 month') AT TIME ZONE ${tz})
        )
        SELECT
          COUNT(o.at) FILTER (WHERE o.at >= b.today)::int AS "todayOrders",
          COALESCE(SUM(o.total) FILTER (WHERE o.at >= b.today), 0)::bigint AS "todayRevenue",
          COALESCE(SUM(o.items_count) FILTER (WHERE o.at >= b.today), 0)::bigint AS "todayItems",
          COUNT(o.at) FILTER (WHERE o.at >= b.today - interval '1 day' AND o.at < b.today)::int
            AS "yesterdayOrders",
          COALESCE(SUM(o.total) FILTER (WHERE o.at >= b.today - interval '1 day' AND o.at < b.today), 0)::bigint
            AS "yesterdayRevenue",
          COUNT(o.at) FILTER (WHERE o.at >= b.month)::int AS "monthOrders",
          COALESCE(SUM(o.total) FILTER (WHERE o.at >= b.month), 0)::bigint AS "monthRevenue",
          COUNT(o.at) FILTER (
            WHERE o.at >= b.month - interval '1 month'
              AND o.at < LEAST(b.month - interval '1 month' + (b.local_now - b.month), b.month)
          )::int AS "prevOrders",
          COALESCE(SUM(o.total) FILTER (
            WHERE o.at >= b.month - interval '1 month'
              AND o.at < LEAST(b.month - interval '1 month' + (b.local_now - b.month), b.month)
          ), 0)::bigint AS "prevRevenue"
        FROM b LEFT JOIN o ON TRUE
        GROUP BY b.today, b.month, b.local_now`,
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM users
        WHERE role = 'CUSTOMER'
          AND created_at >= (date_trunc('month', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`,
      this.prisma.$queryRaw<{ active: number; inStock: number; low: number; out: number }[]>`
        SELECT COUNT(*)::int AS active,
               COUNT(*) FILTER (WHERE available_stock > 0)::int AS "inStock",
               COUNT(*) FILTER (WHERE available_stock > 0
                 AND available_stock <= ${LOW_STOCK_DISPLAY_THRESHOLD})::int AS low,
               COUNT(*) FILTER (WHERE available_stock = 0)::int AS out
        FROM products WHERE is_active`,
      this.prisma.order.count({ where: { status: { in: ['RECEIVED', 'CONFIRMING'] } } }),
    ]);
    const r = rows[0]!;
    const p = products[0]!;
    return {
      today: {
        orders: r.todayOrders,
        revenue: Number(r.todayRevenue),
        itemsSold: Number(r.todayItems),
      },
      yesterday: { orders: r.yesterdayOrders, revenue: Number(r.yesterdayRevenue) },
      month: { orders: r.monthOrders, revenue: Number(r.monthRevenue) },
      previousMonth: { orders: r.prevOrders, revenue: Number(r.prevRevenue) },
      pendingOrders: pending,
      customers: { total: customers, newThisMonth: newCustomers[0]?.count ?? 0 },
      products: { active: p.active, inStock: p.inStock, lowStock: p.low, outOfStock: p.out },
    };
  }

  async sales(range: StatsRange): Promise<AdminSalesStats> {
    const tz = this.tz;
    const { bucket, count } = RANGES[range];
    const unit = UNIT[bucket];
    const step = STEP[bucket];
    const startRows = await this.prisma.$queryRaw<{ start: Date }[]>`
      SELECT ((date_trunc(${unit}, now() AT TIME ZONE ${tz}) - ${count - 1} * ${step})
        AT TIME ZONE ${tz}) AS start`;
    const start = startRows[0]!.start;
    const notCancelled = Prisma.sql`o.status <> 'CANCELLED' AND o.created_at >= ${start}`;

    const [series, statuses, topProducts, topBrands, topCustomers] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw<
          { period: string; orders: number; revenue: bigint; itemsSold: bigint }[]
        >`
        WITH buckets AS (
          SELECT generate_series(
            date_trunc(${unit}, now() AT TIME ZONE ${tz}) - ${count - 1} * ${step},
            date_trunc(${unit}, now() AT TIME ZONE ${tz}),
            ${step}
          ) AS bucket
        )
        SELECT to_char(b.bucket, ${bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'}) AS period,
               COUNT(o.id)::int AS orders,
               COALESCE(SUM(o.total), 0)::bigint AS revenue,
               COALESCE(SUM(o.items_count), 0)::bigint AS "itemsSold"
        FROM buckets b
        LEFT JOIN orders o
          ON date_trunc(${unit}, o.created_at AT TIME ZONE ${tz}) = b.bucket
         AND o.status <> 'CANCELLED'
        GROUP BY b.bucket
        ORDER BY b.bucket`,
        this.prisma.order.groupBy({
          by: ['status'],
          where: { createdAt: { gte: start } },
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<
          { productId: string; name: string; sku: string; quantity: bigint; revenue: bigint }[]
        >`
        SELECT p.id AS "productId", p.name, p.sku,
               SUM(oi.quantity)::bigint AS quantity, SUM(oi.line_total)::bigint AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE ${notCancelled}
        GROUP BY p.id, p.name, p.sku
        ORDER BY quantity DESC, revenue DESC
        LIMIT 10`,
        this.prisma.$queryRaw<
          { brandId: string; name: string; quantity: bigint; revenue: bigint }[]
        >`
        SELECT b.id AS "brandId", b.name,
               SUM(oi.quantity)::bigint AS quantity, SUM(oi.line_total)::bigint AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        JOIN brands b ON b.id = p.brand_id
        WHERE ${notCancelled}
        GROUP BY b.id, b.name
        ORDER BY revenue DESC
        LIMIT 10`,
        this.prisma.$queryRaw<
          { userId: string; name: string; phone: string; orders: number; revenue: bigint }[]
        >`
        SELECT u.id AS "userId", u.first_name || ' ' || u.last_name AS name, u.phone,
               COUNT(o.id)::int AS orders, SUM(o.total)::bigint AS revenue
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE ${notCancelled}
        GROUP BY u.id, u.first_name, u.last_name, u.phone
        ORDER BY revenue DESC
        LIMIT 10`,
      ],
    );

    const points = series.map((s) => ({
      period: s.period,
      orders: s.orders,
      revenue: Number(s.revenue),
      itemsSold: Number(s.itemsSold),
    }));
    const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
      OrderStatus,
      number
    >;
    for (const group of statuses) {
      statusCounts[group.status] = (group._count as { _all: number })._all;
    }
    const orders = points.reduce((sum, p) => sum + p.orders, 0);
    const revenue = points.reduce((sum, p) => sum + p.revenue, 0);
    return {
      range,
      bucket,
      from: start.toISOString(),
      totals: {
        orders,
        revenue,
        itemsSold: points.reduce((sum, p) => sum + p.itemsSold, 0),
        averageOrder: orders > 0 ? Math.round(revenue / orders) : 0,
        cancelled: statusCounts.CANCELLED,
      },
      series: points,
      statuses: statusCounts,
      topProducts: topProducts.map((p) => ({
        ...p,
        quantity: Number(p.quantity),
        revenue: Number(p.revenue),
      })),
      topBrands: topBrands.map((b) => ({
        ...b,
        quantity: Number(b.quantity),
        revenue: Number(b.revenue),
      })),
      topCustomers: topCustomers.map((c) => ({ ...c, revenue: Number(c.revenue) })),
    };
  }
}
