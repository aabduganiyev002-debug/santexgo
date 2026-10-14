import {
  FolderTree,
  ImageIcon,
  LayoutDashboard,
  Package,
  Percent,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Tags,
  Users,
} from 'lucide-react';

export const NAV_SECTIONS = [
  {
    title: null,
    items: [
      { href: '/', label: 'Bosh sahifa', icon: LayoutDashboard, exact: true },
      { href: '/orders', label: 'Buyurtmalar', icon: ShoppingBag, badge: 'newOrders' as const },
      { href: '/customers', label: 'Mijozlar', icon: Users },
    ],
  },
  {
    title: 'Katalog',
    items: [
      { href: '/products', label: 'Mahsulotlar', icon: Package },
      { href: '/categories', label: 'Kategoriyalar', icon: FolderTree },
      { href: '/brands', label: 'Brendlar', icon: Tags },
      { href: '/taxonomy', label: 'Materiallar va xususiyatlar', icon: SlidersHorizontal },
      { href: '/discounts', label: 'Chegirmalar', icon: Percent },
    ],
  },
  {
    title: 'Sayt',
    items: [
      { href: '/content', label: 'Bannerlar va bosh sahifa', icon: ImageIcon },
      { href: '/settings', label: 'Sozlamalar', icon: Settings },
    ],
  },
];
