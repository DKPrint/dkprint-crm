import { formatMoney2 } from '@/lib/money';

export type CatalogLineSnapshot = {
  catalogProductId: string;
  name: string;
  unitPrice: string;
};

export type FetchedCatalogProduct = {
  id: string;
  name: string;
  unitPrice: number;
};

/** Returns patch fields when fetch should update parent state; null = skip (unchanged or stale). */
export function catalogProductFetchPatch(
  productId: string,
  fetched: FetchedCatalogProduct,
  current: CatalogLineSnapshot,
): Pick<CatalogLineSnapshot, 'name' | 'unitPrice'> | null {
  if (fetched.id !== productId) return null;
  if (current.catalogProductId !== productId) return null;
  const nextPrice = formatMoney2(fetched.unitPrice);
  if (current.name === fetched.name && current.unitPrice === nextPrice) return null;
  return { name: fetched.name, unitPrice: nextPrice };
}
