import { formatMoney2 } from '@/lib/money';
import { computeSlaBadge } from '@/lib/orders/sla-badge';
import { statusBadgeClass, statusLabel } from '@/lib/orders/status-labels';
import type { OrderDetail } from '../order-card';

type Props = { order: OrderDetail };

export function OrderHeader({ order }: Props) {
  const sla = computeSlaBadge({
    slaStartedAt: order.slaStartedAt,
    slaStoppedAt: order.slaStoppedAt,
    status: order.status,
  });

  return (
    <div className="page-head">
      <div>
        <h1>
          Заказ <span className="mono">{order.orderNumber}</span>
        </h1>
        <div className="meta-row">
          <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
          <span className={sla.badgeClass}>{sla.label}</span>
          {order.deletedAt ? <span className="badge st-cancelled">Удалён</span> : null}
        </div>
        <p className="lede" style={{ marginTop: 8 }}>
          {order.clientName ?? '—'}
        </p>
      </div>
      <div className="amount mono">{formatMoney2(order.totalAmount)}</div>
    </div>
  );
}
