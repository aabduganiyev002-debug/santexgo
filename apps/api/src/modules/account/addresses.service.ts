import { Injectable } from '@nestjs/common';
import { type AddressSaveInput, type AddressView, MAX_ADDRESSES } from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import type { Address, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;
type AddressData = Omit<AddressSaveInput, 'isDefault'>;

export function toAddressView(address: Address): AddressView {
  return {
    id: address.id,
    label: address.label,
    region: address.region,
    district: address.district,
    street: address.street,
    house: address.house,
    apartment: address.apartment,
    landmark: address.landmark,
    isDefault: address.isDefault,
  };
}

function addressFields(input: AddressData) {
  return {
    label: input.label ?? null,
    region: input.region,
    district: input.district,
    street: input.street,
    house: input.house ?? null,
    apartment: input.apartment ?? null,
    landmark: input.landmark ?? null,
  };
}

/** Mijozning saqlangan manzillari. Birinchi manzil avtomatik asosiy bo'ladi. */
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AddressView[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toAddressView);
  }

  async create(userId: string, input: AddressSaveInput): Promise<AddressView> {
    return this.prisma.$transaction((tx) => this.createIn(tx, userId, input));
  }

  /** Checkout ichida ham ishlatiladi ("manzilni saqlash" belgilansa). */
  async createIn(tx: Tx, userId: string, input: AddressSaveInput): Promise<AddressView> {
    await this.lockUser(tx, userId);
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      throw ApiError.badRequest(
        'BAD_REQUEST',
        `${MAX_ADDRESSES} tadan ortiq manzil saqlab bo‘lmaydi. Eskisini o‘chiring`,
      );
    }
    const isDefault = count === 0 || input.isDefault === true;
    if (isDefault) await this.unsetDefault(tx, userId);
    const address = await tx.address.create({
      data: { userId, ...addressFields(input), isDefault },
    });
    return toAddressView(address);
  }

  /**
   * Checkout'da "manzilni saqlash" belgilansa: xuddi shunday manzil bo'lsa — o'sha qaytadi,
   * limit to'lgan bo'lsa — saqlanmaydi (buyurtma baribir beriladi).
   */
  async saveFromCheckout(tx: Tx, userId: string, input: AddressData): Promise<string | null> {
    await this.lockUser(tx, userId);
    const fields = addressFields(input);
    const same = await tx.address.findFirst({
      where: {
        userId,
        region: fields.region,
        district: fields.district,
        street: fields.street,
        house: fields.house,
        apartment: fields.apartment,
      },
      select: { id: true },
    });
    if (same) return same.id;
    if ((await tx.address.count({ where: { userId } })) >= MAX_ADDRESSES) return null;
    return (await this.createIn(tx, userId, input)).id;
  }

  async update(userId: string, id: string, input: AddressSaveInput): Promise<AddressView> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const current = await tx.address.findFirst({ where: { id, userId } });
      if (!current) throw ApiError.notFound('Manzil topilmadi');
      // Asosiy manzilni "asosiy emas" qilib bo'lmaydi — boshqasini asosiy qilish kerak
      const isDefault = current.isDefault || input.isDefault === true;
      if (isDefault && !current.isDefault) await this.unsetDefault(tx, userId);
      return toAddressView(
        await tx.address.update({ where: { id }, data: { ...addressFields(input), isDefault } }),
      );
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const current = await tx.address.findFirst({ where: { id, userId } });
      if (!current) throw ApiError.notFound('Manzil topilmadi');
      await tx.address.delete({ where: { id } });
      if (current.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }

  private async unsetDefault(tx: Tx, userId: string): Promise<void> {
    await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }

  /** Bir foydalanuvchining manzil amallari ketma-ket bajariladi (limit va asosiy manzil buzilmasligi uchun). */
  private async lockUser(tx: Tx, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
  }
}
