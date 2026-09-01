import { shortTech } from '@/lib/orders/format-tech';
import type { OrderListItem } from '@/lib/orders/list-items';

type Props = {
  items: OrderListItem[];
  emptyLabel?: string;
};

/** Shared order composition list (workshop + orders list expand). */
export function OrderItemsSummary({ items, emptyLabel = 'Позиций нет' }: Props) {
  if (items.length === 0) {
    return <p className="muted workshop-detail-empty">{emptyLabel}</p>;
  }

  return (
    <ul className="workshop-detail-list">
      {items.map((it) => {
        const name = it.name.trim() ? it.name : '—';
        return (
          <li key={it.positionNumber}>
            {it.positionNumber}. {name}, {it.quantity} шт, {shortTech(it.techParams)}, макет:{' '}
            {it.hasLayout ? 'есть' : 'нет'}
          </li>
        );
      })}
    </ul>
  );
}
