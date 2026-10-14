import { Injectable } from '@nestjs/common';
import {
  ACTIVE_ORDER_STATUSES,
  type AdminCustomerDetail,
  type AdminCustomerListItem,
  adminCustomerListQuerySchema,
  type Paginated,
  type z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { toAddressView } from '../../account/addresses.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { SessionsService } from '../../auth/sessions.service.js';
import { escapeLike } from '../../catalog/product-filters.js';
import { ORDER_SUMMARY_SELECT, OrderPresenter } from '../../orders/order.presenter.js';

type ListQuery = z.output<typeof adminCustomerListQuerySchema>;

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  isActive: boolean;
  createdAt: Date;
  ordersCount: number;
  totalSpent: bigint | number;
  lastOrderAt: Date | null;
}

const ORDER_BY: Record<ListQuery['sort'], Prisma.Sql> = {
  recent: Prisma.sql`u.created_at DESC`,
  orders: Prisma.sql`"ordersCount" DESC, u.created_at DESC`,
  spent: Prisma.sql`"totalSpent" DESC, u.created_at DESC`,
  name: Prisma.sql`u.first_name ASC, u.last_name ASC`,
};

function toListItem(row: CustomerRow): AdminCustomerListItem {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    isActive: row.isActive,
    ordersCount: row.ordersCount,
    totalSpent: Number(row.totalSpent),
    lastOrderAt: row.lastOrderAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Qidiruv: telefon raqami qismi (kamida 3 raqam) yoki ism/familiya so'zlari. */
function searchCondition(q: string | undefined): Prisma.Sql {
  if (!q) return Prisma.sql`TRUE`;
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 3 && /^[\d\s+()-]+$/.test(q)) {
    return Prisma.sql`u.phone LIKE ${`%${escapeLike(digits)}%`}`;
  }
  const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
  return Prisma.join(
    words.map((word) => {
      const pattern = `%${escapeLike(word)}%`;
      return Prisma.sql`(u.first_name ILIKE ${pattern} OR u.last_name ILIKE ${pattern})`;
    }),
    ' AND ',
  );
}

/** Admin: mijozlar bazasi — ism, telefon, buyurtmalar soni, umumiy xarid summasi. */
@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: OrderPresenter,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListQuery): Promise<Paginated<AdminCustomerListItem>> {
    const where = Prisma.sql`u.role = 'CUSTOMER'
      AND ${searchCondition(query.q)}
      AND ${
        query.status === 'active'
          ? Prisma.sql`u.is_active`
          : query.status === 'blocked'
            ? Prisma.sql`NOT u.is_active`
            : Prisma.sql`TRUE`
      }`;
    const [rows, counted] = await this.prisma.$transaction([
      this.prisma.$queryRaw<CustomerRow[]>`
        SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.phone,
               u.is_active AS "isActive", u.created_at AS "createdAt",
               COALESCE(o.orders_count, 0)::int AS "ordersCount",
               COALESCE(o.total_spent, 0)::bigint AS "totalSpent",
               o.last_order_at AS "lastOrderAt"
        FROM users u
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS orders_count,
                 SUM(total) FILTER (WHERE status = 'DELIVERED') AS total_spent,
                 MAX(created_at) AS last_order_at
          FROM orders GROUP BY user_id
        ) o ON o.user_id = u.id
        WHERE ${where}
        ORDER BY ${ORDER_BY[query.sort]}
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM users u WHERE ${where}`,
    ]);
    const total = counted[0]?.total ?? 0;
    return {
      items: rows.map(toListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async detail(id: string): Promise<AdminCustomerDetail> {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'CUSTOMER' },
      include: { addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] } },
    });
    if (!user) throw ApiError.notFound('Mijoz topilmadi');
    const [groups, recent] = await this.prisma.$transaction([
      this.prisma.order.groupBy({
        by: ['status'],
        where: { userId: id },
        orderBy: { status: 'asc' },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: ORDER_SUMMARY_SELECT,
      }),
    ]);
    const count = (statuses: readonly string[]) =>
      groups
        .filter((g) => statuses.includes(g.status))
        .reduce((sum, g) => sum + (g._count as { _all: number })._all, 0);
    const delivered = groups.find((g) => g.status === 'DELIVERED');
    const deliveredCount = count(['DELIVERED']);
    const totalSpent = delivered?._sum?.total ?? 0;
    const lastOrderAt = groups
      .map((g) => g._max?.createdAt)
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      ordersCount: groups.reduce((sum, g) => sum + (g._count as { _all: number })._all, 0),
      totalSpent,
      lastOrderAt: lastOrderAt?.toISOString() ?? null,
      deliveredCount,
      activeOrdersCount: count(ACTIVE_ORDER_STATUSES),
      cancelledCount: count(['CANCELLED']),
      averageOrder: deliveredCount > 0 ? Math.round(totalSpent / deliveredCount) : 0,
      addresses: user.addresses.map(toAddressView),
      recentOrders: recent.map((row) => this.presenter.summary(row)),
    };
  }

  /** Bloklash: mijoz kira olmaydi va barcha qurilmalardan chiqariladi. */
  async setActive(
    id: string,
    isActive: boolean,
    actor: ActorContext,
  ): Promise<AdminCustomerDetail> {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'CUSTOMER' },
      select: { isActive: true },
    });
    if (!user) throw ApiError.notFound('Mijoz topilmadi');
    if (user.isActive !== isActive) {
      await this.prisma.user.update({ where: { id }, data: { isActive } });
      if (!isActive) await this.sessions.revokeAllForUser(id);
      await this.audit.log({
        actorId: actor.userId,
        action: isActive ? 'customer.unblock' : 'customer.block',
        entityType: 'user',
        entityId: id,
        changes: { isActive: { from: user.isActive, to: isActive } },
        ipAddress: actor.ipAddress,
      });
    }
    return this.detail(id);
  }
}
