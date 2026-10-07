import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiRequestError, errorMessage } from './api/errors';

/**
 * API xatosini formaga qo'yadi: maydon xatolari — maydonlar ostida, qolgani — umumiy xabar.
 * Umumiy xabarni qaytaradi (maydonga tegishli bo'lmasa).
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
): string | null {
  if (error instanceof ApiRequestError && error.errors.length > 0) {
    let unmatched = false;
    for (const fieldError of error.errors) {
      const field = fieldError.field.split('.')[0] ?? '';
      if (knownFields.includes(field)) {
        setError(field as Path<T>, { type: 'server', message: fieldError.message });
      } else {
        unmatched = true;
      }
    }
    if (unmatched) return error.message;
    // Umumiy matn maydon ostidagi bilan bir xil bo'lsa — ikki marta ko'rsatilmaydi
    const duplicate = error.errors.some((fieldError) => fieldError.message === error.message);
    return error.code === 'VALIDATION_ERROR' || duplicate ? null : error.message;
  }
  return errorMessage(error);
}
