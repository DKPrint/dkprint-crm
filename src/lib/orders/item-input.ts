import { formatMoney2 } from '@/lib/money';

export type OrderItemClientInput = {
  isManual?: boolean;
  catalogProductId?: string;
  categoryId?: string | null;
  name?: string;
  techParams?: string | null;
  quantity: number;
  unitPrice?: string | number;
};

export type CatalogProductSnapshot = {
  id: string;
  categoryId: string;
  name: string;
  unitPrice: string | number;
};

export type ResolvedOrderItemLine = {
  name: string;
  unitPrice: string;
  quantity: number;
  techParams: string | null;
  categoryId: string | null;
  catalogProductId: string | null;
  isManual: boolean;
};

/** Catalog line: always catalog SoT price; client unitPrice is ignored (TZ §4.4 / §8). */
export function resolveCatalogLineUnitPrice(
  catalogUnitPrice: string | number,
  clientUnitPrice?: string | number,
): string {
  void clientUnitPrice;
  return formatMoney2(catalogUnitPrice);
}

export function resolveOrderItemLine(
  input: OrderItemClientInput,
  catalogProduct?: CatalogProductSnapshot | null,
): ResolvedOrderItemLine {
  const isManual = input.isManual === true;

  if (isManual) {
    if (!input.name?.trim()) throw new Error('validation');
    if (input.unitPrice === undefined) throw new Error('validation');
    if (input.catalogProductId) throw new Error('validation');
    const unit = formatMoney2(input.unitPrice);
    if (Number(unit) < 0) throw new Error('validation');
    return {
      isManual: true,
      catalogProductId: null,
      categoryId: input.categoryId ?? null,
      name: input.name.trim(),
      unitPrice: unit,
      quantity: input.quantity,
      techParams: input.techParams ?? null,
    };
  }

  if (!input.catalogProductId || !catalogProduct) throw new Error('product_not_found');
  if (catalogProduct.id !== input.catalogProductId) throw new Error('product_not_found');

  return {
    isManual: false,
    catalogProductId: catalogProduct.id,
    categoryId: catalogProduct.categoryId,
    name: catalogProduct.name,
    unitPrice: resolveCatalogLineUnitPrice(catalogProduct.unitPrice, input.unitPrice),
    quantity: input.quantity,
    techParams: input.techParams ?? null,
  };
}
