import { Injectable } from '@nestjs/common';
import {
  type ApiFieldError,
  type CheckoutData,
  CHECKOUT_PAYMENT_METHODS,
  deliveryFee,
  type DeliverySettings,
  formatSom,
  MAX_ORDER_TOTAL,
  MAX_PENDING_ORDERS,
  type OrderDetailView,
  PRODUCT_UNIT_LABELS,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import { isUniqueViolation } from '../../common/errors/prisma-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AddressesService } from '../account/addresses.service.js';
import { mergeLines } from '../cart/cart-calculator.js';
import { CartService } from '../cart/cart.service.js';
import { CatalogCacheService } from '../catalog/catalog-cache.service.js';
import { IMAGE_ORDER } from '../catalog/product-card.mapper.js';
import { SettingsService } from '../content/settings.service.js';
import { OrderNotificationsService } from '../notifications/order-notifications.service.js';
import { ORDER_DETAIL_INCLUDE, OrderPresenter } from './order.presenter.js';
import { availableOf, OrderStockService } from './order-stock.service.js';

type Tx = Prisma.TransactionClient;

const PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  unit: true,
  basePrice: true,
  currentPrice: true,
  appliedDiscountId: true,
  minOrderQty: true,
  isActive: true,
  categoryId: true,
  brand: { select: { name: true, isActive: true } },
  images: { select: { thumbUrl: true }, orderBy: IMAGE_ORDER, take: 1 },
} satisfies Prisma.ProductSelect;

type DeliveryAddress = {
  addressId: string | null;
  deliveryRegion: string | null;
  deliveryDistrict: string | null;
  deliveryStreet: string | null;
  deliveryHouse: string | null;
  deliveryApartment: string | null;
  deliveryLandmark: string | null;
};

const NO_ADDRESS: DeliveryAddress = {
  addressId: null,
  deliveryRegion: null,
  deliveryDistrict: null,
  deliveryStreet: null,
  deliveryHouse: null,
  deliveryApartment: null,
  deliveryLandmark: null,
};

export interface CheckoutResult {
  order: OrderDetailView;
  /** false — shu kalit bilan buyurtma avval yaratilgan (tugma ikki marta bosilgan) */
  created: boolean;
}

/**
 * Buyurtma berish. Hammasi bitta tranzaksiyada: qoldiqni qulflab tekshirish, narxlarni
 * muzlatish (keyin narx o'zgarsa ham buyurtmadagisi o'zgarmaydi), mahsulotni band qilish,
 * status tarixi va to'lov yozuvi. Biror qadam o'xshamasa — hech narsa yozilmaydi.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: OrderStockService,
    private readonly cart: CartService,
    private readonly addresses: AddressesService,
    private readonly settings: SettingsService,
    private readonly cache: CatalogCacheService,
    private readonly presenter: OrderPresenter,
    private readonly notifications: OrderNotificationsService,
  ) {}

  async checkout(userId: string, input: CheckoutData): Promise<CheckoutResult> {
    const existing = await this.findExisting(userId, input.idempotencyKey);
    if (existing) return { order: existing, created: false };

    if (!(CHECKOUT_PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) {
      throw ApiError.badRequest(
        'PAYMENT_METHOD_UNAVAILABLE',
        'Bu to‘lov turi hozircha mavjud emas',
        {
          errors: [{ field: 'paymentMethod', message: 'Boshqa to‘lov turini tanlang' }],
        },
      );
    }
    const delivery = await this.settings.delivery();
    if (input.deliveryMethod === 'PICKUP' && !delivery.pickupEnabled) {
      throw ApiError.badRequest('BAD_REQUEST', 'Do‘kondan olib ketish hozircha mavjud emas', {
        errors: [{ field: 'deliveryMethod', message: 'Yetkazib berishni tanlang' }],
      });
    }

    let orderId: string;
    try {
      orderId = await this.prisma.$transaction((tx) => this.create(tx, userId, input, delivery), {
        timeout: 20_000,
      });
    } catch (error) {
      // Ikki so'rov bir vaqtda kelsa, ikkinchisi birinchisi yaratgan buyurtmani oladi
      if (isUniqueViolation(error)) {
        const order = await this.findExisting(userId, input.idempotencyKey);
        if (order) return { order, created: false };
      }
      throw error;
    }

    const row = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: ORDER_DETAIL_INCLUDE,
    });
    this.notifications.orderCreated(row);
    return { order: this.presenter.detail(row), created: true };
  }

  private async create(
    tx: Tx,
    userId: string,
    input: CheckoutData,
    delivery: DeliverySettings,
  ): Promise<string> {
    // Bir mijozning buyurtmalari ketma-ket yaratiladi (limitlar va manzil uchun)
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
    const pending = await tx.order.count({
      where: { userId, status: { in: ['RECEIVED', 'CONFIRMING'] } },
    });
    if (pending >= MAX_PENDING_ORDERS) {
      throw ApiError.conflict(
        'ORDER_LIMIT_REACHED',
        `Sizda ${pending} ta tasdiqlanmagan buyurtma bor. Operator ular bo‘yicha bog‘lanishini kuting ` +
          'yoki keraksizlarini bekor qiling',
      );
    }

    const address = await this.resolveAddress(tx, userId, input);
    const lines = mergeLines(input.items).sort((a, b) => a.productId.localeCompare(b.productId));
    const ids = lines.map((line) => line.productId);
    const tree = await this.cache.categoryTree();
    const products = await tx.product.findMany({
      where: { id: { in: ids } },
      select: PRODUCT_SELECT,
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const stock = await this.stock.lock(tx, ids);

    const errors: ApiFieldError[] = [];
    for (const line of lines) {
      const product = byId.get(line.productId);
      const field = `items.${line.productId}`;
      if (
        !product ||
        !product.isActive ||
        !product.brand.isActive ||
        !tree.isVisible(product.categoryId)
      ) {
        errors.push({ field, message: 'Mahsulot sotuvdan olingan' });
        continue;
      }
      const available = availableOf(stock.get(line.productId) ?? []);
      const unit = PRODUCT_UNIT_LABELS[product.unit];
      if (available <= 0) {
        errors.push({ field, message: `${product.name}: sotuvda qolmadi` });
      } else if (line.quantity > available) {
        errors.push({
          field,
          message: `${product.name}: omborda faqat ${available} ${unit} qoldi`,
        });
      } else if (line.quantity < product.minOrderQty) {
        errors.push({
          field,
          message: `${product.name}: eng kam buyurtma — ${product.minOrderQty} ${unit}`,
        });
      }
    }
    if (errors.length > 0) {
      throw ApiError.conflict(
        'CART_CHANGED',
        'Savatchadagi ayrim mahsulotlar o‘zgardi. Savatchani tekshirib, qayta urinib ko‘ring',
        { errors },
      );
    }

    const items = lines.map((line) => {
      const product = byId.get(line.productId)!;
      return {
        productId: product.id,
        discountId: product.currentPrice < product.basePrice ? product.appliedDiscountId : null,
        sku: product.sku,
        name: product.name,
        brandName: product.brand.name,
        imageUrl: product.images[0]?.thumbUrl ?? null,
        unit: product.unit,
        unitPrice: product.basePrice,
        discountAmount: product.basePrice - product.currentPrice,
        finalUnitPrice: product.currentPrice,
        quantity: line.quantity,
        lineTotal: product.currentPrice * line.quantity,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const itemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const fee = deliveryFee(delivery, itemsTotal, input.deliveryMethod);
    const total = itemsTotal + fee;
    if (subtotal > MAX_ORDER_TOTAL) {
      throw ApiError.badRequest(
        'BAD_REQUEST',
        'Buyurtma summasi juda katta. Ulgurji buyurtma uchun operator bilan bog‘laning',
      );
    }
    if (input.expectedTotal !== undefined && input.expectedTotal !== total) {
      throw ApiError.conflict(
        'PRICE_CHANGED',
        `Narxlar o‘zgardi: yangi jami summa ${formatSom(total)}. Savatchani tekshirib, qayta tasdiqlang`,
      );
    }

    const order = await tx.order.create({
      data: {
        userId,
        customerFirstName: input.firstName,
        customerLastName: input.lastName,
        customerPhone: input.phone,
        deliveryMethod: input.deliveryMethod,
        ...address,
        comment: input.comment ?? null,
        paymentMethod: input.paymentMethod,
        subtotal,
        discountTotal: subtotal - itemsTotal,
        deliveryFee: fee,
        total,
        itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
        idempotencyKey: input.idempotencyKey,
        items: { create: items },
        statusHistory: { create: { toStatus: 'RECEIVED', changedById: userId } },
        payments: { create: { method: input.paymentMethod, amount: total } },
      },
      select: { id: true },
    });

    for (const line of lines) {
      await this.stock.reserve(tx, order.id, stock.get(line.productId)!, line.quantity, userId);
    }
    await this.cart.removeProducts(tx, userId, ids);
    return order.id;
  }

  private async resolveAddress(
    tx: Tx,
    userId: string,
    input: CheckoutData,
  ): Promise<DeliveryAddress> {
    if (input.deliveryMethod === 'PICKUP') return NO_ADDRESS;

    if (input.addressId) {
      const saved = await tx.address.findFirst({ where: { id: input.addressId, userId } });
      if (!saved) {
        throw ApiError.badRequest('INVALID_REFERENCE', 'Manzil topilmadi', {
          errors: [{ field: 'addressId', message: 'Manzilni qayta tanlang' }],
        });
      }
      return {
        addressId: saved.id,
        deliveryRegion: saved.region,
        deliveryDistrict: saved.district,
        deliveryStreet: saved.street,
        deliveryHouse: saved.house,
        deliveryApartment: saved.apartment,
        deliveryLandmark: saved.landmark,
      };
    }

    const address = input.address!;
    const savedId = input.saveAddress
      ? await this.addresses.saveFromCheckout(tx, userId, address)
      : null;
    return {
      addressId: savedId,
      deliveryRegion: address.region,
      deliveryDistrict: address.district,
      deliveryStreet: address.street,
      deliveryHouse: address.house ?? null,
      deliveryApartment: address.apartment ?? null,
      deliveryLandmark: address.landmark ?? null,
    };
  }

  private async findExisting(userId: string, key: string): Promise<OrderDetailView | null> {
    const row = await this.prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      include: ORDER_DETAIL_INCLUDE,
    });
    return row ? this.presenter.detail(row) : null;
  }
}
