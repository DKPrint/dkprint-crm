'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatMoney2 } from '@/lib/money';
import type { CatalogCategoryNode } from '@/lib/catalog/categories';
import type { CatalogProduct } from '@/lib/catalog/products';
import type { CatalogBomLine } from '@/lib/catalog/bom';

function apiError(data: { message?: string; error?: string }, fallback: string): string {
  return data.message || data.error || fallback;
}

export function CatalogAdmin() {
  const [tree, setTree] = useState<CatalogCategoryNode[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [catName, setCatName] = useState('');
  const [catAsChild, setCatAsChild] = useState(true);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('0');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [replacePrices, setReplacePrices] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bomProductId, setBomProductId] = useState<string | null>(null);
  const [bomLines, setBomLines] = useState<CatalogBomLine[]>([]);
  const [bomName, setBomName] = useState('');
  const [bomUnit, setBomUnit] = useState('');
  const [bomQty, setBomQty] = useState('1');
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  const loadTree = useCallback(async () => {
    const res = await fetch('/api/admin/catalog/categories', { credentials: 'same-origin' });
    const data = (await res.json()) as {
      categories?: CatalogCategoryNode[];
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(apiError(data, 'Не удалось загрузить дерево'));
      return;
    }
    setTree(data.categories ?? []);
  }, []);

  const loadProducts = useCallback(async (categoryId: string) => {
    const res = await fetch(
      `/api/admin/catalog/products?categoryId=${encodeURIComponent(categoryId)}&includeInactive=true`,
      { credentials: 'same-origin' },
    );
    const data = (await res.json()) as {
      products?: CatalogProduct[];
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(apiError(data, 'Не удалось загрузить позиции'));
      return;
    }
    const list = data.products ?? [];
    setProducts(list);
    const drafts: Record<string, string> = {};
    for (const p of list) drafts[p.id] = formatMoney2(p.unitPrice);
    setPriceDrafts(drafts);
  }, []);

  const loadBom = useCallback(async (productId: string) => {
    const res = await fetch(`/api/admin/catalog/products/${productId}/consumables`, {
      credentials: 'same-origin',
    });
    const data = (await res.json()) as {
      consumables?: CatalogBomLine[];
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(apiError(data, 'Не удалось загрузить BOM'));
      return;
    }
    const list = data.consumables ?? [];
    setBomLines(list);
    const drafts: Record<string, string> = {};
    for (const line of list) drafts[line.id] = String(line.qtyPerUnit);
    setQtyDrafts(drafts);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadTree().catch(() => setError('Не удалось загрузить дерево'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadTree]);

  useEffect(() => {
    if (!selectedId) return;
    const t = window.setTimeout(() => {
      void loadProducts(selectedId).catch(() => setError('Не удалось загрузить позиции'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [selectedId, loadProducts]);

  useEffect(() => {
    if (!bomProductId) {
      const t = window.setTimeout(() => {
        setBomLines([]);
        setQtyDrafts({});
      }, 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      void loadBom(bomProductId).catch(() => setError('Не удалось загрузить BOM'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [bomProductId, loadBom]);

  async function addCategory() {
    const name = catName.trim();
    if (!name) {
      setError('Укажите название категории');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/catalog/categories', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parentId: catAsChild && selectedId ? selectedId : null,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось создать категорию'));
        return;
      }
      setCatName('');
      await loadTree();
    } catch {
      setError('Не удалось создать категорию');
    } finally {
      setBusy(false);
    }
  }

  async function addProduct() {
    if (!selectedId) {
      setError('Выберите категорию слева');
      return;
    }
    const name = prodName.trim();
    if (!name) {
      setError('Укажите наименование позиции');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/catalog/products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedId,
          name,
          unitPrice: prodPrice,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось создать позицию'));
        return;
      }
      setProdName('');
      setProdPrice('0');
      await loadProducts(selectedId);
    } catch {
      setError('Не удалось создать позицию');
    } finally {
      setBusy(false);
    }
  }

  async function savePrice(productId: string) {
    const draft = priceDrafts[productId];
    if (draft == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog/products/${productId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitPrice: draft }),
      });
      const data = (await res.json()) as {
        product?: CatalogProduct;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось сохранить цену'));
        return;
      }
      if (data.product) {
        setProducts((prev) => prev.map((p) => (p.id === productId ? data.product! : p)));
        setPriceDrafts((d) => ({ ...d, [productId]: formatMoney2(data.product!.unitPrice) }));
      }
    } catch {
      setError('Не удалось сохранить цену');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(product: CatalogProduct) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog/products/${product.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const data = (await res.json()) as {
        product?: CatalogProduct;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось обновить статус'));
        return;
      }
      if (data.product && selectedId) await loadProducts(selectedId);
    } catch {
      setError('Не удалось обновить статус');
    } finally {
      setBusy(false);
    }
  }

  async function addBomLine() {
    if (!bomProductId) return;
    const name = bomName.trim();
    if (!name) {
      setError('Укажите название расходника');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog/products/${bomProductId}/consumables`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          unit: bomUnit.trim() || null,
          qtyPerUnit: bomQty,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось добавить расходник'));
        return;
      }
      setBomName('');
      setBomUnit('');
      setBomQty('1');
      await loadBom(bomProductId);
    } catch {
      setError('Не удалось добавить расходник');
    } finally {
      setBusy(false);
    }
  }

  async function saveBomQty(lineId: string) {
    if (!bomProductId) return;
    const draft = qtyDrafts[lineId];
    if (draft == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog/products/${bomProductId}/consumables/${lineId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtyPerUnit: draft }),
      });
      const data = (await res.json()) as {
        line?: CatalogBomLine;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось сохранить qty'));
        return;
      }
      if (data.line) {
        setBomLines((prev) => prev.map((l) => (l.id === lineId ? data.line! : l)));
        setQtyDrafts((d) => ({ ...d, [lineId]: String(data.line!.qtyPerUnit) }));
      }
    } catch {
      setError('Не удалось сохранить qty');
    } finally {
      setBusy(false);
    }
  }

  async function removeBomLine(lineId: string) {
    if (!bomProductId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog/products/${bomProductId}/consumables/${lineId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось удалить строку BOM'));
        return;
      }
      await loadBom(bomProductId);
    } catch {
      setError('Не удалось удалить строку BOM');
    } finally {
      setBusy(false);
    }
  }

  const bomProduct = products.find((p) => p.id === bomProductId) ?? null;

  async function runImport(file: File) {
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('replacePrices', replacePrices ? 'true' : 'false');
      const res = await fetch('/api/admin/catalog/import', {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      const data = (await res.json()) as {
        import?: {
          createdCount: number;
          updatedPriceCount: number;
          skippedCount: number;
        };
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(apiError(data, 'Импорт не удался'));
        return;
      }
      const stats = data.import;
      if (stats) {
        setImportMessage(
          `Импорт: создано ${stats.createdCount}, цен обновлено ${stats.updatedPriceCount}, пропущено ${stats.skippedCount}`,
        );
      }
      await loadTree();
      if (selectedId) await loadProducts(selectedId);
    } catch {
      setError('Импорт не удался');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function runExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/catalog/export', { credentials: 'same-origin' });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string; error?: string };
        setError(apiError(data, 'Экспорт не удался'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalog-export.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Экспорт не удался');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Каталог продукции</h1>
          <p className="lede">Дерево категорий и позиции с ценами (только admin)</p>
        </div>
        <div className="toolbar catalog-import-toolbar">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void runImport(file);
            }}
          />
          <label className="muted catalog-check">
            <input
              type="checkbox"
              checked={replacePrices}
              onChange={(e) => setReplacePrices(e.target.checked)}
              disabled={busy}
            />
            Заменить цены
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Импорт xlsx
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void runExport()}
          >
            Экспорт xlsx
          </button>
        </div>
      </div>

      {importMessage ? <p className="form-success">{importMessage}</p> : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="catalog-admin">
        <section className="catalog-pane card">
          <h2>Категории</h2>
          <div className="catalog-tree">
            {tree.length === 0 ? (
              <p className="muted">Пока пусто — создайте корневую категорию</p>
            ) : (
              tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setBomProductId(null);
                  }}
                />
              ))
            )}
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <input
              className="input grow"
              placeholder="Новая категория"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
            <label
              className="muted"
              style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
            >
              <input
                type="checkbox"
                checked={catAsChild}
                onChange={(e) => setCatAsChild(e.target.checked)}
                disabled={!selectedId}
              />
              как подкатегория
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void addCategory()}
            >
              Добавить
            </button>
          </div>
        </section>

        <section className="catalog-pane card">
          <h2>Позиции</h2>
          {!selectedId ? (
            <p className="muted">Выберите категорию слева</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Наименование</th>
                      <th>Код</th>
                      <th>Цена</th>
                      <th>Активна</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          Нет позиций
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => (
                        <tr key={p.id} className={bomProductId === p.id ? 'is-selected-row' : ''}>
                          <td>{p.name}</td>
                          <td className="mono muted">{p.externalCode ?? '—'}</td>
                          <td>
                            <input
                              className="input mono"
                              style={{ width: 100 }}
                              value={priceDrafts[p.id] ?? formatMoney2(p.unitPrice)}
                              onChange={(e) =>
                                setPriceDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={p.isActive}
                              disabled={busy}
                              onChange={() => void toggleActive(p)}
                              aria-label={`Активна ${p.name}`}
                            />
                          </td>
                          <td>
                            <div className="toolbar" style={{ margin: 0, gap: 4 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={busy}
                                onClick={() => void savePrice(p.id)}
                              >
                                Сохранить цену
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={busy}
                                onClick={() => setBomProductId(p.id)}
                              >
                                BOM
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="toolbar" style={{ marginTop: 12 }}>
                <input
                  className="input grow"
                  placeholder="Наименование"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                />
                <input
                  className="input mono"
                  style={{ width: 100 }}
                  placeholder="Цена"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  aria-label="Цена"
                />
                <button
                  type="button"
                  className="btn btn-cta"
                  disabled={busy}
                  onClick={() => void addProduct()}
                >
                  Добавить позицию
                </button>
              </div>

              {bomProductId ? (
                <div className="catalog-bom" style={{ marginTop: 20 }}>
                  <h3 style={{ margin: '0 0 8px' }}>
                    BOM: {bomProduct?.name ?? bomProductId}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: 8 }}
                      onClick={() => setBomProductId(null)}
                    >
                      Закрыть
                    </button>
                  </h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Расходники на единицу позиции (складское списание — позже)
                  </p>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Расходник</th>
                          <th>Ед.</th>
                          <th>qty / ед.</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {bomLines.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="muted">
                              Нет расходников
                            </td>
                          </tr>
                        ) : (
                          bomLines.map((line) => (
                            <tr key={line.id}>
                              <td>{line.name}</td>
                              <td className="muted">{line.unit ?? '—'}</td>
                              <td>
                                <input
                                  className="input mono"
                                  style={{ width: 100 }}
                                  value={qtyDrafts[line.id] ?? String(line.qtyPerUnit)}
                                  onChange={(e) =>
                                    setQtyDrafts((d) => ({ ...d, [line.id]: e.target.value }))
                                  }
                                />
                              </td>
                              <td>
                                <div className="toolbar" style={{ margin: 0, gap: 4 }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={busy}
                                    onClick={() => void saveBomQty(line.id)}
                                  >
                                    Сохранить
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    disabled={busy}
                                    onClick={() => void removeBomLine(line.id)}
                                  >
                                    Удалить
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="toolbar" style={{ marginTop: 12 }}>
                    <input
                      className="input grow"
                      placeholder="Название расходника"
                      value={bomName}
                      onChange={(e) => setBomName(e.target.value)}
                    />
                    <input
                      className="input"
                      style={{ width: 80 }}
                      placeholder="Ед."
                      value={bomUnit}
                      onChange={(e) => setBomUnit(e.target.value)}
                    />
                    <input
                      className="input mono"
                      style={{ width: 100 }}
                      placeholder="qty"
                      value={bomQty}
                      onChange={(e) => setBomQty(e.target.value)}
                      aria-label="qty_per_unit"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => void addBomLine()}
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: CatalogCategoryNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = selectedId === node.id;
  return (
    <div>
      <button
        type="button"
        className={`catalog-tree-item${selected ? ' is-selected' : ''}${node.isActive ? '' : ' is-inactive'}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(node.id)}
      >
        {node.name}
        {!node.isActive ? <span className="muted"> (выкл.)</span> : null}
      </button>
      {node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
