'use client';

import { useEffect } from 'react';
import { Button } from '@santexgo/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="text-2xl font-bold">Nimadir xato ketdi</h1>
      <p className="mt-2 max-w-md text-slate-600">
        Sahifani yuklab bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.
      </p>
      <Button className="mt-8" onClick={reset}>
        Qayta urinish
      </Button>
    </div>
  );
}
