import { OUT_OF_STOCK_LABEL, type ProductUnit, type StockInfo } from '@santexgo/shared';
import { cn } from '@/lib/cn';
import { unitLabel } from '@/lib/format';

/** "Sotuvda: 450 dona" / "Kam qoldi: 5 dona" / "SOTUVDA YO'Q" */
export function StockLabel({
  stock,
  unit,
  className,
}: {
  stock: StockInfo;
  unit: ProductUnit;
  className?: string;
}) {
  if (!stock.inStock) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-semibold uppercase text-slate-500',
          className,
        )}
      >
        <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
        {OUT_OF_STOCK_LABEL}
      </span>
    );
  }
  const quantity = `${stock.available.toLocaleString('ru-RU')} ${unitLabel(unit)}`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm',
        stock.low ? 'text-warning' : 'text-success',
        className,
      )}
    >
      <span
        className={cn('h-2 w-2 rounded-full', stock.low ? 'bg-warning' : 'bg-success')}
        aria-hidden="true"
      />
      {stock.low ? `Kam qoldi: ${quantity}` : `Sotuvda: ${quantity}`}
    </span>
  );
}
