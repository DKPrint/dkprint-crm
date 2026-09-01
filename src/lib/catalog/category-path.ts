/** Display path for catalog category snapshot (root / leaf). */
export function formatCatalogCategoryPath(
  categoryName: string,
  parentName: string | null | undefined,
): string {
  const leaf = categoryName.trim();
  if (!leaf) return '';
  const parent = parentName?.trim();
  return parent ? `${parent} / ${leaf}` : leaf;
}
