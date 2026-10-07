import { Injectable } from '@nestjs/common';
import type { InventoryAdjustInput } from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import type { InventoryMovementType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

export interface WarehouseStock {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  isDefault: boolean;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

interface LockedRow {
  quantity: number;
  reserved: number;
}

/**
 * Ombor: qoldiqni o'zgartirishning yagona joyi. Har bir o'zgarish qatorni qulflab
 * (bir vaqtdagi o'zgarishlar bir-birini yo'qotmasligi uchun) bajariladi va tarixga yoziladi.
 * Mahsulotning "sotuvda mavjud" qiymati bazadagi trigger orqali avtomatik yangilanadi.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async defaultWarehouse(tx: Tx = this.prisma) {
    const warehouse = await tx.warehouse.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!warehouse) {
      throw ApiError.badRequest('INVALID_REFERENCE', 'Faol ombor topilmadi. Avval ombor yarating');
    }
    return warehouse;
  }

  async resolveWarehouse(tx: Tx, warehouseId?: string) {
    if (!warehouseId) return this.defaultWarehouse(tx);
    const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, isActive: true } });
    if (!warehouse) throw ApiError.badRequest('INVALID_REFERENCE', 'Ombor topilmadi');
    return warehouse;
  }

  /** Qoldiq qatorini yaratadi (yo'q bo'lsa) va tranzaksiya oxirigacha qulflaydi. */
  async lockRow(tx: Tx, productId: string, warehouseId: string): Promise<LockedRow> {
    await tx.$executeRaw`
      INSERT INTO inventory (product_id, warehouse_id, quantity, reserved, updated_at)
      VALUES (${productId}::uuid, ${warehouseId}::uuid, 0, 0, NOW())
      ON CONFLICT (product_id, warehouse_id) DO NOTHING`;
    const rows = await tx.$queryRaw<LockedRow[]>`
      SELECT quantity, reserved FROM inventory
      WHERE product_id = ${productId}::uuid AND warehouse_id = ${warehouseId}::uuid
      FOR UPDATE`;
    return rows[0]!;
  }

  /** Admin: kirim, chiqim yoki inventarizatsiya (aniq son). */
  async adjust(
    productId: string,
    input: InventoryAdjustInput & { quantity: number },
    actorId: string | null,
  ): Promise<WarehouseStock> {
    const warehouseId = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) throw ApiError.notFound('Mahsulot topilmadi');
      const warehouse = await this.resolveWarehouse(tx, input.warehouseId);
      const current = await this.lockRow(tx, productId, warehouse.id);

      let quantity: number;
      let type: InventoryMovementType;
      switch (input.operation) {
        case 'add':
          quantity = current.quantity + input.quantity;
          type = 'RESTOCK';
          break;
        case 'remove':
          quantity = current.quantity - input.quantity;
          type = 'ADJUSTMENT';
          break;
        case 'set':
          quantity = input.quantity;
          type = 'ADJUSTMENT';
          break;
      }
      if (quantity < current.reserved) {
        throw ApiError.badRequest(
          'STOCK_INSUFFICIENT',
          `Qoldiq band qilingan miqdordan (${current.reserved}) kam bo‘lishi mumkin emas — ` +
            'bu mahsulot jo‘natilmagan buyurtmalarda bor',
          { errors: [{ field: 'quantity', message: 'Band qilingan miqdordan kam' }] },
        );
      }
      if (quantity === current.quantity) return warehouse.id;

      await this.applyMovement(tx, {
        productId,
        warehouseId: warehouse.id,
        type,
        quantityChange: quantity - current.quantity,
        reservedChange: 0,
        before: current,
        note: input.note ?? null,
        createdById: actorId,
      });
      return warehouse.id;
    });
    const stock = await this.productStock(productId);
    return stock.find((s) => s.warehouseId === warehouseId)!;
  }

  /** Qoldiqni o'zgartiradi va harakat tarixiga yozadi (qator oldindan qulflangan bo'lishi kerak). */
  async applyMovement(
    tx: Tx,
    movement: {
      productId: string;
      warehouseId: string;
      type: InventoryMovementType;
      quantityChange: number;
      reservedChange: number;
      before: LockedRow;
      orderId?: string | null;
      note?: string | null;
      createdById?: string | null;
    },
  ): Promise<void> {
    const quantityAfter = movement.before.quantity + movement.quantityChange;
    const reservedAfter = movement.before.reserved + movement.reservedChange;
    await tx.inventory.update({
      where: {
        productId_warehouseId: { productId: movement.productId, warehouseId: movement.warehouseId },
      },
      data: { quantity: quantityAfter, reserved: reservedAfter },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        type: movement.type,
        quantityChange: movement.quantityChange,
        reservedChange: movement.reservedChange,
        quantityAfter,
        reservedAfter,
        orderId: movement.orderId ?? null,
        note: movement.note ?? null,
        createdById: movement.createdById ?? null,
      },
    });
  }

  /** Mahsulot qoldig'i barcha faol omborlar kesimida (qatori yo'q omborlar — 0). */
  async productStock(productId: string): Promise<WarehouseStock[]> {
    const [warehouses, rows] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.inventory.findMany({ where: { productId } }),
    ]);
    return warehouses.map((warehouse) => {
      const row = rows.find((r) => r.warehouseId === warehouse.id);
      const quantity = row?.quantity ?? 0;
      const reserved = row?.reserved ?? 0;
      return {
        warehouseId: warehouse.id,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        isDefault: warehouse.isDefault,
        quantity,
        reserved,
        available: Math.max(0, quantity - reserved),
        lowStockThreshold: row?.lowStockThreshold ?? 10,
      };
    });
  }

  async setLowStockThreshold(productId: string, threshold: number, warehouseId?: string) {
    await this.prisma.$transaction(async (tx) => {
      const warehouse = await this.resolveWarehouse(tx, warehouseId);
      await this.lockRow(tx, productId, warehouse.id);
      await tx.inventory.update({
        where: { productId_warehouseId: { productId, warehouseId: warehouse.id } },
        data: { lowStockThreshold: threshold },
      });
    });
    return this.productStock(productId);
  }

  movements(productId: string, page: number, pageSize: number) {
    return this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          warehouse: { select: { code: true, name: true } },
          order: { select: { orderNumber: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where: { productId } }),
    ]);
  }
}
