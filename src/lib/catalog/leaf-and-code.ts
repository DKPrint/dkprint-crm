/**
 * Resolve leaf category for cascading picker (TZ §4.4).
 * Products load only for a true leaf — never while children are expected but not chosen.
 */
export function resolveLeafCategoryId(input: {
  rootCategoryId: string;
  subcategoryId: string;
  rootHasChildren: boolean | undefined;
}): string {
  if (input.subcategoryId) return input.subcategoryId;
  if (!input.rootCategoryId) return '';
  // Unknown / still loading root metadata — do not treat as leaf yet.
  if (input.rootHasChildren === undefined) return '';
  if (input.rootHasChildren) return '';
  return input.rootCategoryId;
}

/** Stable product_code for xlsx when DB external_code is missing (round-trip safe). */
export const CRM_PRODUCT_CODE_PREFIX = 'crm:';

export function exportableProductCode(
  externalCode: string | null | undefined,
  productId: string,
): string {
  const trimmed = externalCode?.trim();
  if (trimmed) return trimmed;
  return `${CRM_PRODUCT_CODE_PREFIX}${productId}`;
}

/** Parse crm:{uuid} export codes back to product id; else null. */
export function parseCrmProductCode(productCode: string): string | null {
  const trimmed = productCode.trim();
  if (!trimmed.startsWith(CRM_PRODUCT_CODE_PREFIX)) return null;
  const id = trimmed.slice(CRM_PRODUCT_CODE_PREFIX.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}
