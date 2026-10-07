import type { PipeTransform } from '@nestjs/common';
import { parseOrderNumber } from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';

/** URL'dagi buyurtma raqami: "ORDER-10254" yoki "10254". Noto'g'ri bo'lsa — 404. */
export const OrderNumberParam: PipeTransform<string, number> = {
  transform(value: string): number {
    const orderNumber = parseOrderNumber(value);
    if (orderNumber === null || orderNumber > 2_147_483_647) {
      throw ApiError.notFound('Buyurtma topilmadi');
    }
    return orderNumber;
  },
};
