import Link from 'next/link';
import { buttonClass } from '@santexgo/ui/button';

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold">Sahifa topilmadi</h1>
      <p className="mt-2 max-w-md text-slate-600">
        Bu sahifa o‘chirilgan yoki manzil noto‘g‘ri yozilgan bo‘lishi mumkin.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClass('primary')}>
          Bosh sahifa
        </Link>
        <Link href="/catalog" className={buttonClass('outline')}>
          Katalog
        </Link>
      </div>
    </div>
  );
}
