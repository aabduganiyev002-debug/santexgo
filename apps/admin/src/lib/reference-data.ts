'use client';

import type {
  AdminAttribute,
  AdminBrand,
  AdminCategory,
  AdminMaterial,
  AdminProductGroup,
  AdminWarehouse,
} from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { useQuery } from '@tanstack/react-query';

/** Formalar va filtrlar uchun ro'yxatlar. O'zgartirilganda ['admin', 'ref'] kalitlari yangilanadi. */
const STALE = 5 * 60_000;

export const REF_KEYS = {
  brands: ['admin', 'ref', 'brands'],
  categories: ['admin', 'ref', 'categories'],
  materials: ['admin', 'ref', 'materials'],
  attributes: ['admin', 'ref', 'attributes'],
  warehouses: ['admin', 'ref', 'warehouses'],
  groups: ['admin', 'ref', 'groups'],
} as const;

export function useBrands() {
  return useQuery({
    queryKey: REF_KEYS.brands,
    staleTime: STALE,
    queryFn: () => api<AdminBrand[]>('/admin/brands'),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: REF_KEYS.categories,
    staleTime: STALE,
    queryFn: () => api<AdminCategory[]>('/admin/categories'),
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: REF_KEYS.materials,
    staleTime: STALE,
    queryFn: () => api<AdminMaterial[]>('/admin/materials'),
  });
}

export function useAttributes() {
  return useQuery({
    queryKey: REF_KEYS.attributes,
    staleTime: STALE,
    queryFn: () => api<AdminAttribute[]>('/admin/attributes'),
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: REF_KEYS.warehouses,
    staleTime: STALE,
    queryFn: () => api<AdminWarehouse[]>('/admin/warehouses'),
  });
}

export function useProductGroups() {
  return useQuery({
    queryKey: REF_KEYS.groups,
    staleTime: STALE,
    queryFn: () => api<AdminProductGroup[]>('/admin/product-groups?pageSize=100'),
  });
}

/** Kategoriya nomi daraxtdagi chuqurligi bilan: "— — Tirsaklar" */
export function categoryOptionLabel(category: AdminCategory): string {
  return `${'— '.repeat(category.depth)}${category.name}`;
}
