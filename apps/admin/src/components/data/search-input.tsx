'use client';

import { inputClass } from '@santexgo/ui/field';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Qidiruv maydoni: yozish to'xtagandan 350 ms keyin natija yangilanadi. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // URL tashqaridan o'zgarsa (masalan, "Tozalash") — maydon ham yangilanadi
  if (synced !== value) {
    setSynced(value);
    setText(value);
  }
  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onChange(text.trim()), 350);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div className={`relative ${className ?? ''}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={inputClass(false, 'h-10 pl-9 text-sm')}
      />
    </div>
  );
}
