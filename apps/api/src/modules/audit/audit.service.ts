import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

export interface AuditEntry {
  actorId: string | null;
  /** Masalan: product.update, order.status_change */
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

type Comparable = Record<string, unknown>;

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Faqat o'zgargan maydonlar: { price: { from: 100, to: 90 } }.
 * Parol xeshi kabi maxfiy maydonlar jurnalga yozilmaydi.
 */
export function diffChanges(
  before: Comparable,
  after: Comparable,
  ignore: readonly string[] = ['updatedAt', 'passwordHash', 'searchText'],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (ignore.includes(key)) continue;
    const from = normalize(before[key]);
    const to = normalize(after[key]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

/** Admin amallari jurnali: kim, qachon, nimani o'zgartirdi. Yozish xatosi asosiy amalni to'xtatmaydi. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Audit yozilmadi (${entry.action}): ${(error as Error).message}`);
    }
  }
}
