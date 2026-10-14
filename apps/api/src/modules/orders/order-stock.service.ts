import { Injectable } from '@nestjs/common';
import type { InventoryMovementType, Prisma } from '../../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';

type Tx = Prisma.TransactionClient;

/** Qulflangan qoldiq qatori (faol ombor). */
export interface StockRow {
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
}

/** Buyurtmaning bitta ombordagi holati — harakatlar tarixidan hisoblanadi. */
interface OrderPosition {
  productId: string;
  warehouseId: string;
  /** Hali band turgan miqdor */
  reserved: number;
  /** Ombordan chiqib ketgan miqdor */
  shipped: number;
}

export function availableOf(rows: readonly StockRow[]): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.quantity - row.reserved), 0);
}

/**
 * Buyurtma va ombor: band qilish → jo'natish yoki bandni bo'shatish → (kerak bo'lsa) qaytarish.
 *
 * Mijoz 450 donadan 10 tasini buyurtma qilsa, darhol "sotuvda 440" bo'ladi (band qilinadi);
 * jismoniy qoldiq buyurtma yo'lga chiqqanda kamayadi; bekor qilinsa — band bo'shaydi.
 * Buyurtma qaysi omborda qancha band qilgani alohida saqlanmaydi: u ombor harakatlari
 * tarixidan (inventory_movements.order_id) hisoblanadi — shuning uchun hech qachon farq qilmaydi.
 *
 * Qulflar doim (product_id, warehouse_id) tartibida olinadi — parallel buyurtmalarda deadlock bo'lmaydi.
 */
@Injectable()
export class OrderStockService {
  constructor(private readonly inventory: InventoryService) {}

  /** Mahsulotlarning faol omborlardagi qoldig'ini qulflaydi. Natija: mahsulot → omborlar (asosiy ombor birinchi). */
  async lock(tx: Tx, productIds: readonly string[]): Promise<Map<string, StockRow[]>> {
    const rows = await tx.$queryRaw<(StockRow & { isDefault: boolean; createdAt: Date })[]>`
      SELECT i.product_id AS "productId", i.warehouse_id AS "warehouseId",
             i.quantity, i.reserved, w.is_default AS "isDefault", w.created_at AS "createdAt"
      FROM inventory i
      JOIN warehouses w ON w.id = i.warehouse_id
      WHERE i.product_id = ANY(${[...productIds]}::uuid[]) AND w.is_active
      ORDER BY i.product_id, i.warehouse_id
      FOR UPDATE OF i`;
    rows.sort(
      (a, b) =>
        Number(b.isDefault) - Number(a.isDefault) || a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const byProduct = new Map<string, StockRow[]>();
    for (const { productId, warehouseId, quantity, reserved } of rows) {
      const list = byProduct.get(productId) ?? [];
      list.push({ productId, warehouseId, quantity, reserved });
      byProduct.set(productId, list);
    }
    return byProduct;
  }

  /** Buyurtma uchun band qiladi: avval asosiy ombordan, yetmasa — boshqalaridan. */
  async reserve(
    tx: Tx,
    orderId: string,
    rows: StockRow[],
    quantity: number,
    actorId: string,
  ): Promise<void> {
    let remaining = quantity;
    for (const row of rows) {
      if (remaining === 0) break;
      const take = Math.min(remaining, row.quantity - row.reserved);
      if (take <= 0) continue;
      await this.inventory.applyMovement(tx, {
        productId: row.productId,
        warehouseId: row.warehouseId,
        type: 'ORDER_RESERVE',
        quantityChange: 0,
        reservedChange: take,
        before: row,
        orderId,
        createdById: actorId,
      });
      row.reserved += take;
      remaining -= take;
    }
    if (remaining > 0) {
      // Chaqiruvchi oldindan tekshiradi; bu yerga kelinsa — dasturdagi xato
      throw new Error(`Qoldiq yetarli emas: ${rows[0]?.productId ?? '?'}`);
    }
  }

  /** Yo'lga chiqdi: band qilingan miqdor ombordan chiqadi. */
  async ship(tx: Tx, orderId: string, actorId: string | null): Promise<void> {
    await this.settle(tx, orderId, 'ORDER_SHIP', actorId);
  }

  /** Bekor qilindi: band bo'shatiladi. */
  async release(tx: Tx, orderId: string, actorId: string | null): Promise<void> {
    await this.settle(tx, orderId, 'ORDER_RELEASE', actorId);
  }

  /** Yo'lga chiqqan buyurtma bekor qilindi (mijoz qabul qilmadi): mahsulot omborga qaytadi. */
  async returnShipped(tx: Tx, orderId: string, actorId: string | null): Promise<void> {
    for (const position of await this.positions(tx, orderId)) {
      if (position.shipped <= 0) continue;
      const before = await this.inventory.lockRow(tx, position.productId, position.warehouseId);
      await this.inventory.applyMovement(tx, {
        productId: position.productId,
        warehouseId: position.warehouseId,
        type: 'RETURN',
        quantityChange: position.shipped,
        reservedChange: 0,
        before,
        orderId,
        note: 'Bekor qilingan buyurtma qaytdi',
        createdById: actorId,
      });
    }
  }

  private async settle(
    tx: Tx,
    orderId: string,
    type: Extract<InventoryMovementType, 'ORDER_SHIP' | 'ORDER_RELEASE'>,
    actorId: string | null,
  ): Promise<void> {
    for (const position of await this.positions(tx, orderId)) {
      if (position.reserved <= 0) continue;
      const before = await this.inventory.lockRow(tx, position.productId, position.warehouseId);
      await this.inventory.applyMovement(tx, {
        productId: position.productId,
        warehouseId: position.warehouseId,
        type,
        quantityChange: type === 'ORDER_SHIP' ? -position.reserved : 0,
        reservedChange: -position.reserved,
        before,
        orderId,
        createdById: actorId,
      });
    }
  }

  private positions(tx: Tx, orderId: string): Promise<OrderPosition[]> {
    return tx.$queryRaw<OrderPosition[]>`
      SELECT product_id AS "productId", warehouse_id AS "warehouseId",
             SUM(reserved_change)::int AS reserved, (-SUM(quantity_change))::int AS shipped
      FROM inventory_movements
      WHERE order_id = ${orderId}::uuid
      GROUP BY product_id, warehouse_id
      ORDER BY product_id, warehouse_id`;
  }
}
