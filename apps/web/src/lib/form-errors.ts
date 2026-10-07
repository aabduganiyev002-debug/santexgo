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
    return unmatched || error.code !== 'VALIDATION_ERROR' ? error.message : null;
  }
  return errorMessage(error);
}
