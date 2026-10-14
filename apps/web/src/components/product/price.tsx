import type { PriceInfo, ProductUnit } from '@santexgo/shared';
import { Badge } from '@santexgo/ui/badge';
import { cn } from '@santexgo/ui/cn';
import { formatSom, unitLabel } from '@santexgo/ui/format';

/**
 * Narx: chegirma bo'lsa eski narx ustidan chiziq, yangi narx katta va qizil, foiz belgisi.
 * ~~100 000 so'm~~  **85 000 so'm**  −15%
 */
export function Price({
  price,
  unit,
  size = 'card',
  className,
}: {
  price: PriceInfo;
  unit?: ProductUnit;
  size?: 'card' | 'page';
  className?: string;
}) {
  const discounted = price.discountPercent > 0;
  return (
    <div className={cn('flex flex-col', className)}>
      {discounted ? (
        <div className="flex items-center gap-2">
          <s className={cn('tabular text-slate-400', size === 'page' ? 'text-base' : 'text-sm')}>
            {formatSom(price.base)}
          </s>
          <Badge tone="sale">−{price.discountPercent}%</Badge>
        </div>
      ) : null}
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'tabular font-extrabold tracking-tight',
            discounted ? 'text-sale' : 'text-slate-900',
            size === 'page' ? 'text-3xl sm:text-4xl' : 'text-lg',
          )}
        >
          {formatSom(price.current)}
        </span>
        {unit && unit !== 'PIECE' ? (
          <span className="text-sm text-slate-500">/ {unitLabel(unit)}</span>
        ) : null}
      </div>
    </div>
  );
}
