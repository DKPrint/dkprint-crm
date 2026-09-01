'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatMoney2, lineTotal } from '@/lib/money';
import { catalogProductFetchPatch } from '@/lib/catalog/catalog-order-line-fetch';
import { resolveLeafCategoryId } from '@/lib/catalog/leaf-and-code';

type CatalogCategory = {
  id: string;
  name: string;
  hasChildren: boolean;
};

type CatalogProduct = {
  id: string;
  name: string;
  unitPrice: number;
};

export type CatalogOrderLineState = {
  isManual: boolean;
  rootCategoryId: string;
  subcategoryId: string;
  catalogProductId: string;
  name: string;
  unitPrice: string;
  quantity: string;
  techParams: string;
};

export function emptyCatalogLine(): CatalogOrderLineState {
  return {
    isManual: false,
    rootCategoryId: '',
    subcategoryId: '',
    catalogProductId: '',
    name: '',
    unitPrice: '0.00',
    quantity: '1',
    techParams: '',
  };
}

function linePreview(qty: string, price: string): string {
  const q = Number.parseInt(qty, 10);
  if (!Number.isInteger(q) || q <= 0) return '—';
  try {
    return formatMoney2(lineTotal(q, price || 0));
  } catch {
    return '—';
  }
}

type Props = {
  value: CatalogOrderLineState;
  onChange: (next: CatalogOrderLineState) => void;
  disabled?: boolean;
};

export function CatalogOrderLineFields({ value, onChange, disabled }: Props) {
  const [roots, setRoots] = useState<CatalogCategory[]>([]);
  const [subs, setSubs] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const patch = useCallback(
    (partial: Partial<CatalogOrderLineState>) => {
      onChange({ ...value, ...partial });
    },
    [onChange, value],
  );
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  });

  const loadRoots = useCallback(async () => {
    const res = await fetch('/api/catalog/categories', { credentials: 'same-origin' });
    const data = (await res.json()) as { categories?: CatalogCategory[]; message?: string };
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить категории');
    setRoots(data.categories ?? []);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadRoots().catch(() => setLoadError('Не удалось загрузить категории'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadRoots]);

  const selectedRoot = roots.find((r) => r.id === value.rootCategoryId);
  const leafCategoryId = resolveLeafCategoryId({
    rootCategoryId: value.rootCategoryId,
    subcategoryId: value.subcategoryId,
    rootHasChildren: selectedRoot ? selectedRoot.hasChildren : undefined,
  });
  const needsSub = !value.isManual && selectedRoot?.hasChildren === true;

  useEffect(() => {
    if (value.isManual || !value.rootCategoryId) {
      const t = window.setTimeout(() => setSubs([]), 0);
      return () => window.clearTimeout(t);
    }
    const root = roots.find((r) => r.id === value.rootCategoryId);
    if (!root?.hasChildren) {
      const t = window.setTimeout(() => setSubs([]), 0);
      return () => window.clearTimeout(t);
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(`/api/catalog/categories?parentId=${encodeURIComponent(value.rootCategoryId)}`, {
        credentials: 'same-origin',
        signal: ac.signal,
      })
        .then((res) => res.json())
        .then((data: { categories?: CatalogCategory[] }) => {
          if (!ac.signal.aborted) setSubs(data.categories ?? []);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setLoadError('Не удалось загрузить подкатегории');
        });
    }, 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [value.isManual, value.rootCategoryId, roots]);

  useEffect(() => {
    if (value.isManual || !leafCategoryId) {
      const t = window.setTimeout(() => setProducts([]), 0);
      return () => window.clearTimeout(t);
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(`/api/catalog/products?categoryId=${encodeURIComponent(leafCategoryId)}`, {
        credentials: 'same-origin',
        signal: ac.signal,
      })
        .then((res) => res.json())
        .then((data: { products?: CatalogProduct[] }) => {
          if (!ac.signal.aborted) setProducts(data.products ?? []);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setLoadError('Не удалось загрузить позиции');
        });
    }, 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [value.isManual, leafCategoryId]);

  useEffect(() => {
    if (value.isManual || !value.catalogProductId) return;
    const productId = value.catalogProductId;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void fetch(`/api/catalog/products/${encodeURIComponent(productId)}`, {
        credentials: 'same-origin',
        signal: ac.signal,
      })
        .then((res) => res.json())
        .then((data: { product?: CatalogProduct }) => {
          if (ac.signal.aborted) return;
          const p = data.product;
          if (!p) return;
          const patchFields = catalogProductFetchPatch(productId, p, valueRef.current);
          if (!patchFields) return;
          onChangeRef.current({ ...valueRef.current, ...patchFields });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setLoadError('Не удалось загрузить цену');
        });
    }, 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [value.isManual, value.catalogProductId]);

  return (
    <div className="stack">
      {loadError ? <p className="form-error">{loadError}</p> : null}

      <label className="muted catalog-check">
        <input
          type="checkbox"
          checked={value.isManual}
          disabled={disabled}
          onChange={(e) => {
            const isManual = e.target.checked;
            onChange({
              ...emptyCatalogLine(),
              isManual,
              quantity: value.quantity,
              techParams: value.techParams,
            });
          }}
        />
        Ручная позиция
      </label>

      {value.isManual ? (
        <label className="field">
          Наименование
          <input
            className="input"
            value={value.name}
            disabled={disabled}
            onChange={(e) => patch({ name: e.target.value })}
            required
          />
        </label>
      ) : (
        <>
          <label className="field">
            Категория
            <select
              className="input"
              value={value.rootCategoryId}
              disabled={disabled || roots.length === 0}
              onChange={(e) =>
                patch({
                  rootCategoryId: e.target.value,
                  subcategoryId: '',
                  catalogProductId: '',
                  name: '',
                  unitPrice: '0.00',
                })
              }
              required
            >
              <option value="">— выберите —</option>
              {roots.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {needsSub ? (
            <label className="field">
              Подкатегория
              <select
                className="input"
                value={value.subcategoryId}
                disabled={disabled || subs.length === 0}
                onChange={(e) =>
                  patch({
                    subcategoryId: e.target.value,
                    catalogProductId: '',
                    name: '',
                    unitPrice: '0.00',
                  })
                }
                required
              >
                <option value="">— выберите —</option>
                {subs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            Позиция
            <select
              className="input"
              value={value.catalogProductId}
              disabled={disabled || !leafCategoryId || products.length === 0}
              onChange={(e) => patch({ catalogProductId: e.target.value })}
              required
            >
              <option value="">— выберите —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <div className="form-grid-3">
        <label className="field">
          Кол-во
          <input
            className="input"
            type="number"
            min={1}
            step={1}
            value={value.quantity}
            disabled={disabled}
            onChange={(e) => patch({ quantity: e.target.value })}
            required
          />
        </label>
        <label className="field">
          Цена
          <input
            className="input mono"
            type={value.isManual ? 'number' : 'text'}
            min={value.isManual ? 0 : undefined}
            step={value.isManual ? '0.01' : undefined}
            value={value.unitPrice}
            readOnly={!value.isManual}
            disabled={disabled}
            onChange={(e) => patch({ unitPrice: e.target.value })}
            required
          />
        </label>
        <label className="field">
          Сумма
          <input
            className="input mono"
            readOnly
            value={linePreview(value.quantity, value.unitPrice)}
            tabIndex={-1}
          />
        </label>
      </div>

      <label className="field">
        Тех. параметры
        <textarea
          className="input"
          value={value.techParams}
          disabled={disabled}
          onChange={(e) => patch({ techParams: e.target.value })}
          rows={2}
        />
      </label>
    </div>
  );
}

export function catalogLineToPayload(line: CatalogOrderLineState): Record<string, unknown> {
  const quantity = Number.parseInt(line.quantity, 10);
  const techParams = line.techParams.trim() ? line.techParams.trim() : null;
  if (line.isManual) {
    return {
      isManual: true,
      name: line.name.trim(),
      quantity,
      unitPrice: Number(line.unitPrice),
      techParams,
    };
  }
  return {
    isManual: false,
    catalogProductId: line.catalogProductId,
    quantity,
    techParams,
    unitPrice: 0,
    name: 'ignored-by-server',
  };
}

export function validateCatalogLine(line: CatalogOrderLineState): string | null {
  const quantity = Number.parseInt(line.quantity, 10);
  if (!Number.isInteger(quantity) || quantity <= 0) return 'Проверьте количество';
  if (line.isManual) {
    if (!line.name.trim()) return 'Укажите наименование';
    const price = Number(line.unitPrice);
    if (!Number.isFinite(price) || price < 0) return 'Цена должна быть числом ≥ 0';
    return null;
  }
  if (!line.rootCategoryId) return 'Выберите категорию';
  if (!line.catalogProductId) return 'Выберите позицию каталога';
  return null;
}
