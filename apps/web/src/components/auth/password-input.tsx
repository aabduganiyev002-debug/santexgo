'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, useState } from 'react';
import { Field } from '@/components/ui/field';

interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'prefix'
> {
  label: string;
  error?: string;
  hint?: string;
}

/** Parol maydoni: ko'rsatish/yashirish tugmasi bilan. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Field
        ref={ref}
        type={visible ? 'text' : 'password'}
        suffix={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-700"
            aria-label={visible ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...props}
      />
    );
  },
);
