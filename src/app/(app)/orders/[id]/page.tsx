type Props = { params: Promise<{ id: string }> };

export default async function OrderCardStubPage({ params }: Props) {
  const { id } = await params;

  return (
    <div>
      <h1>Карточка заказа</h1>
      <p className="lede mono">{id}</p>
      <p className="muted">скоро</p>
    </div>
  );
}
