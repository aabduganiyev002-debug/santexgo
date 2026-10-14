'use client';

import type { SalesPoint } from '@santexgo/shared';
import { formatSom } from '@santexgo/ui/format';
import { type KeyboardEvent, type PointerEvent, useState } from 'react';
import { compactSom, niceTicks, periodLabel } from './format';
import { useWidth } from './use-width';

const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };

/**
 * Savdo dinamikasi: bitta seriya (summa) — 2px chiziq va 10% area. Crosshair eng yaqin
 * davrga yopishadi; tooltip: summa (asosiy), buyurtmalar va dona. Klaviatura: ← →.
 */
export function SalesChart({ points }: { points: SalesPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(...points.map((p) => p.revenue), 0);
  const ticks = niceTicks(max);
  const top = ticks.at(-1) ?? 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.revenue)}`).join('');
  const area = points.length > 0 ? `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : '';
  // X o'qi: kenglikka qarab (har ~80px ga bitta, 6 tagacha), oxirgi davr doim ko'rsatiladi
  const maxLabels = Math.max(2, Math.min(6, Math.floor(plotW / 80)));
  const every = Math.max(1, Math.ceil(points.length / maxLabels));
  const xLabels = points
    .map((p, i) => ({ i, label: periodLabel(p.period) }))
    .filter(({ i }) => (points.length - 1 - i) % every === 0);

  const nearest = (clientX: number, rect: DOMRect) => {
    if (points.length === 0) return null;
    const relative = clientX - rect.left - PAD.left;
    const index = Math.round((relative / Math.max(plotW, 1)) * (points.length - 1));
    return Math.min(points.length - 1, Math.max(0, index));
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) =>
    setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' ? -1 : 1;
    setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? points.length - 1) + delta)));
  };

  const point = active !== null ? points[active] : undefined;
  const last = points.at(-1);
  const tooltipLeft =
    active !== null ? Math.min(Math.max(x(active) - 80, 0), Math.max(width - 168, 0)) : 0;

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }}>
      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Savdo dinamikasi grafigi. Qiymatlarni ko‘rish uchun chap va o‘ng tugmalar"
          tabIndex={0}
          className="touch-none outline-none focus-visible:outline-2 focus-visible:outline-brand-600"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          {/* Gorizontal hairline grid va Y o'qi belgilari */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="tabular"
                fontSize={11}
                fill="var(--viz-text-muted)"
              >
                {compactSom(tick)}
              </text>
            </g>
          ))}
          {xLabels.map(({ i, label }) => (
            <text
              key={i}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill="var(--viz-text-muted)"
            >
              {label}
            </text>
          ))}

          <path d={area} fill="var(--viz-series-1)" fillOpacity={0.1} />
          <path
            d={line}
            fill="none"
            stroke="var(--viz-series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Oxirgi davr: nuqta (yuzaga 2px halqa bilan) */}
          {last && active === null ? (
            <circle
              cx={x(points.length - 1)}
              cy={y(last.revenue)}
              r={4}
              fill="var(--viz-series-1)"
              stroke="var(--viz-surface)"
              strokeWidth={2}
            />
          ) : null}

          {point && active !== null ? (
            <g pointerEvents="none">
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--viz-axis)"
                strokeWidth={1}
              />
              <circle
                cx={x(active)}
                cy={y(point.revenue)}
                r={5}
                fill="var(--viz-series-1)"
                stroke="var(--viz-surface)"
                strokeWidth={2}
              />
            </g>
          ) : null}
        </svg>
      ) : null}

      {point && active !== null ? (
        <div
          role="status"
          className="pointer-events-none absolute top-0 w-[168px] rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
          style={{ left: tooltipLeft }}
        >
          <p className="text-[var(--viz-text-secondary)]">{periodLabel(point.period)}</p>
          <p className="mt-0.5 flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-[var(--viz-series-1)]" aria-hidden="true" />
            <span className="text-sm font-semibold text-[var(--viz-text-primary)]">
              {formatSom(point.revenue)}
            </span>
          </p>
          <p className="text-[var(--viz-text-secondary)]">
            {point.orders} ta buyurtma · {point.itemsSold} dona
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Grafikning jadval ko'rinishi (tooltip'siz ham barcha qiymatlar o'qiladi). */
export function SalesTable({ points }: { points: SalesPoint[] }) {
  return (
    <div className="max-h-[240px] overflow-y-auto">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Davr</th>
            <th className="text-right">Buyurtmalar</th>
            <th className="text-right">Dona</th>
            <th className="text-right">Savdo</th>
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((p) => (
            <tr key={p.period}>
              <td>{periodLabel(p.period)}</td>
              <td className="tabular text-right">{p.orders}</td>
              <td className="tabular text-right">{p.itemsSold}</td>
              <td className="tabular text-right font-medium">{formatSom(p.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
