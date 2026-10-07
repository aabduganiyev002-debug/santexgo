import { Injectable } from '@nestjs/common';
import {
  type CartView,
  type DeliveryMethod,
  MAX_CART_LINES,
  MAX_ORDER_QUANTITY,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import { retryOnUniqueViolation } from '../../common/errors/prisma-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CartCalculator, type CartRequestLine, mergeLines } from './cart-calculator.js';

type Tx = Prisma.TransactionClient;

const CART_FULL = `Savatchada ${MAX_CART_LINES} tadan ortiq mahsulot bo‘lmasligi kerak`;

/**
 * Tizimga kirgan foydalanuvchining savatchasi bazada saqlanadi — telefon va kompyuterda bir xil.
 * Mehmon savatchasi brauzerda turadi va kirgandan keyin shu yerga qo'shiladi (merge).
 */
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: CartCalculator,
  ) {}

  async view(userId: string, method?: DeliveryMethod): Promise<CartView> {
    const view = await this.calculator.view(await this.lines(userId), method);
    // Sotuvdan olingan mahsulotlar savatchadan olib tashlanadi (mijozga bir marta ko'rsatiladi)
    if (view.unavailableProductIds.length > 0) {
      await this.removeProducts(this.prisma, userId, view.unavailableProductIds);
    }
    return view;
  }

  async setQuantity(userId: string, productId: string, quantity: number): Promise<CartView> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true },
    });
    if (!product) throw ApiError.notFound('Mahsulot topilmadi');

    await retryOnUniqueViolation(async () => {
      const cartId = await this.cartId(userId);
      const exists = await this.prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId, productId } },
        select: { id: true },
      });
      if (exists) {
        await this.prisma.cartItem.update({ where: { id: exists.id }, data: { quantity } });
        return;
      }
      if ((await this.prisma.cartItem.count({ where: { cartId } })) >= MAX_CART_LINES) {
        throw ApiError.badRequest('BAD_REQUEST', CART_FULL);
      }
      await this.prisma.cartItem.create({ data: { cartId, productId, quantity } });
    });
    return this.view(userId);
  }

  async remove(userId: string, productId: string): Promise<CartView> {
    await this.removeProducts(this.prisma, userId, [productId]);
    return this.view(userId);
  }

  async clear(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  }

  /**
   * Brauzerdagi savatchani bazadagisiga qo'shadi. Ikkalasida bor mahsulotning kattaroq
   * miqdori olinadi (bir qurilmadagi savatcha qayta yuborilsa, miqdor ikki baravar oshmasligi uchun).
   */
  async merge(userId: string, items: readonly CartRequestLine[]): Promise<CartView> {
    const incoming = mergeLines(items);
    if (incoming.length > 0) {
      const existing = new Set(
        (
          await this.prisma.product.findMany({
            where: { id: { in: incoming.map((line) => line.productId) }, isActive: true },
            select: { id: true },
          })
        ).map((p) => p.id),
      );
      await retryOnUniqueViolation(() =>
        this.prisma.$transaction(async (tx) => {
          const cartId = await this.cartId(userId, tx);
          const current = new Map(
            (await tx.cartItem.findMany({ where: { cartId } })).map((item) => [
              item.productId,
              item,
            ]),
          );
          let lines = current.size;
          for (const line of incoming) {
            if (!existing.has(line.productId)) continue;
            const item = current.get(line.productId);
            if (item) {
              if (line.quantity > item.quantity) {
                await tx.cartItem.update({
                  where: { id: item.id },
                  data: { quantity: Math.min(line.quantity, MAX_ORDER_QUANTITY) },
                });
              }
            } else if (lines < MAX_CART_LINES) {
              await tx.cartItem.create({
                data: { cartId, productId: line.productId, quantity: line.quantity },
              });
              lines += 1;
            }
          }
        }),
      );
    }
    return this.view(userId);
  }

  /** Buyurtma berilgandan keyin: buyurtmaga kirgan mahsulotlar savatchadan olinadi. */
  async removeProducts(tx: Tx, userId: string, productIds: readonly string[]): Promise<void> {
    if (productIds.length === 0) return;
    await tx.cartItem.deleteMany({
      where: { cart: { userId }, productId: { in: [...productIds] } },
    });
  }

  private async lines(userId: string): Promise<CartRequestLine[]> {
    return this.prisma.cartItem.findMany({
      where: { cart: { userId } },
      orderBy: { createdAt: 'asc' },
      select: { productId: true, quantity: true },
    });
  }

  private async cartId(userId: string, tx: Tx = this.prisma): Promise<string> {
    const cart =
      (await tx.cart.findUnique({ where: { userId }, select: { id: true } })) ??
      (await tx.cart.create({ data: { userId }, select: { id: true } }));
    return cart.id;
  }
}
