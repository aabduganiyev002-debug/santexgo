import { Body, type PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import type { ApiFieldError } from '@santexgo/shared';
import { z } from 'zod';
import { ApiError } from '../errors/api-error.js';

export function zodIssuesToFieldErrors(error: z.ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/**
 * So'rov ma'lumotini Zod sxemasi bo'yicha tekshiradi va tozalangan qiymatni qaytaradi.
 * Sxemada yo'q maydonlar tashlab yuboriladi (z.object standarti).
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Ma’lumotlar noto‘g‘ri to‘ldirilgan', {
        errors: zodIssuesToFieldErrors(result.error),
      });
    }
    return result.data;
  }
}

type JsonSchema = Record<string, unknown> & {
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
};

/** Swagger hujjati uchun Zod sxemasini OpenAPI 3.0 sxemasiga o'giradi. */
export function toOpenApiSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
  }) as JsonSchema;
  delete json.$schema;
  return json;
}

function methodDescriptor(target: object, key: string | symbol | undefined): PropertyDescriptor {
  const descriptor = key === undefined ? undefined : Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) throw new Error('Zod dekoratorlari faqat controller metodlarida ishlatiladi');
  return descriptor;
}

/** `@ZodBody(schema) body: Output` — tanani tekshiradi va Swagger'da ko'rsatadi. */
export function ZodBody(schema: z.ZodType): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodValidationPipe(schema))(target, key, index);
    ApiBody({ schema: toOpenApiSchema(schema) })(target, key!, methodDescriptor(target, key));
  };
}

/** `@ZodQuery(schema) query: Output` — query parametrlarni tekshiradi va Swagger'da ko'rsatadi. */
export function ZodQuery(schema: z.ZodType): ParameterDecorator {
  return (target, key, index) => {
    Query(new ZodValidationPipe(schema))(target, key, index);
    const json = toOpenApiSchema(schema);
    const descriptor = methodDescriptor(target, key);
    for (const [name, property] of Object.entries(json.properties ?? {})) {
      ApiQuery({
        name,
        required: json.required?.includes(name) ?? false,
        schema: property,
        description: typeof property.description === 'string' ? property.description : undefined,
      })(target, key!, descriptor);
    }
  };
}
