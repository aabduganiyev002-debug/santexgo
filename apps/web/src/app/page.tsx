import type { HomePageData } from '@santexgo/shared';
import { BrandStrip } from '@/components/home/brand-strip';
import { BannerSlider } from '@/components/home/banner-slider';
import { CategoryTiles } from '@/components/home/category-tiles';
import { CollectionStrip } from '@/components/home/collection-strip';
import { ProductRail } from '@/components/product/product-rail';
import { serverGet } from '@/lib/api/server';

export default async function HomePage() {
  const home = await serverGet<HomePageData>('/catalog/home', { revalidate: 60 });
  const featured = home.brands.filter((b) => b.productCount > 0);
  return (
    <div className="container-page space-y-10 py-4 sm:space-y-12 sm:py-6">
      {home.banners.length > 0 ? <BannerSlider banners={home.banners} /> : <Hero />}

      <BrandStrip title="Mashhur brendlar" brands={featured.slice(0, 10)} />

      <CollectionStrip title="Material bo‘yicha" collections={home.collections} />

      <ProductRail
        title="Chegirmalar"
        href="/catalog?onSale=1&sort=discount"
        products={home.sale}
      />

      <ProductRail title="Yangi mahsulotlar" href="/catalog?sort=new" products={home.newArrivals} />

      <ProductRail
        title="Eng ko‘p sotilganlar"
        href="/catalog?sort=popular"
        products={home.bestSellers}
      />

      <section className="space-y-3" aria-label="Kategoriyalar">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Kategoriyalar</h2>
        <CategoryTiles categories={home.categories} />
      </section>
    </div>
  );
}

/** Banner qo'shilmagan bo'lsa — oddiy salomlashuv bloki. */
function Hero() {
  return (
    <section className="overflow-hidden rounded-2xl bg-brand-900 px-6 py-10 text-white sm:px-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">
        Santexnika mahsulotlari
      </p>
      <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
        Trubalar, fittinglar, kranlar — bir joyda
      </h1>
      <p className="mt-4 max-w-xl text-brand-100">
        PPR, PVC va PP trubalar, kanalizatsiya va armatura. Ishonchli brendlar, aniq narxlar va tez
        yetkazib berish.
      </p>
    </section>
  );
}
