'use client';

import { useRef, useState } from 'react';
import type { Role } from '@/lib/auth/permissions';
import { canUploadBlock } from '@/lib/files/permissions';
import type { FileBlock } from '@/lib/files/constants';
import {
  ALLOWED_FORMATS_LABEL,
  FILE_INPUT_ACCEPT,
  MAX_FILE_BYTES,
  resolveUploadMimeType,
} from '@/lib/files/constants';
import { apiErrorMessage, type OrderDetail, type OrderFile } from '../order-card';

type Props = {
  order: OrderDetail;
  role: Role;
  onError: (msg: string | null) => void;
  onSuccess: () => Promise<void>;
};

const BLOCK_LABELS: Record<FileBlock, string> = {
  client: 'Файлы точки (client)',
  designer: 'Файлы дизайнера',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: OrderFile['uploadStatus']): string {
  if (status === 'pending') return 'ожидает подтверждения';
  if (status === 'failed') return 'ошибка загрузки';
  return '';
}

function orderAllowsUpload(order: OrderDetail): boolean {
  return !order.deletedAt && order.status !== 'cancelled';
}

export function OrderFiles({ order, role, onError, onSuccess }: Props) {
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    itemId: string;
    block: FileBlock;
  } | null>(null);

  const files = order.files ?? [];

  function filesFor(itemId: string, block: FileBlock): OrderFile[] {
    return files.filter((f) => f.orderItemId === itemId && f.block === block);
  }

  async function downloadFile(fileId: string) {
    onError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/download`, {
        credentials: 'same-origin',
      });
      const data = (await res.json()) as {
        downloadUrl?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.downloadUrl) {
        onError(apiErrorMessage(data, 'Не удалось скачать файл'));
        return;
      }
      window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      onError('Не удалось скачать файл');
    }
  }

  async function uploadFile(itemId: string, block: FileBlock, file: File) {
    const mimeType = resolveUploadMimeType(file);
    if (!mimeType) {
      onError(`Недопустимый тип файла (${ALLOWED_FORMATS_LABEL})`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      onError('Файл больше 100 МБ');
      return;
    }

    onError(null);
    setPending(true);
    try {
      const presignRes = await fetch('/api/files/presign', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          itemId,
          block,
          filename: file.name,
          mimeType,
          sizeBytes: file.size,
        }),
      });
      const presignData = (await presignRes.json()) as {
        fileId?: string;
        uploadUrl?: string;
        error?: string;
        message?: string;
      };
      if (!presignRes.ok || !presignData.uploadUrl || !presignData.fileId) {
        onError(apiErrorMessage(presignData, 'Не удалось подготовить загрузку'));
        return;
      }

      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: file,
      });
      if (!putRes.ok) {
        onError('Ошибка загрузки в хранилище');
        return;
      }

      const confirmRes = await fetch('/api/files/confirm', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: presignData.fileId }),
      });
      const confirmData = (await confirmRes.json()) as {
        uploadStatus?: string;
        error?: string;
        message?: string;
      };
      if (!confirmRes.ok) {
        onError(apiErrorMessage(confirmData, 'Не удалось подтвердить загрузку'));
        return;
      }
      if (confirmData.uploadStatus === 'failed') {
        onError('Файл не найден в хранилище после загрузки');
        return;
      }

      await onSuccess();
    } catch {
      onError('Ошибка загрузки файла');
    } finally {
      setPending(false);
      setUploadTarget(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function triggerUpload(itemId: string, block: FileBlock) {
    if (pending) return;
    setUploadTarget({ itemId, block });
    inputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    void uploadFile(uploadTarget.itemId, uploadTarget.block, file);
  }

  const canUpload = orderAllowsUpload(order);

  return (
    <section className="card">
      <h2>Файлы</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Разрешено: {ALLOWED_FORMATS_LABEL}. До {Math.round(MAX_FILE_BYTES / (1024 * 1024))} МБ.
      </p>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={FILE_INPUT_ACCEPT}
        onChange={onFileSelected}
      />

      {order.items.length === 0 ? (
        <p className="muted">Нет позиций — добавьте позицию для загрузки файлов.</p>
      ) : (
        <div className="stack">
          {order.items.map((item) => (
            <div key={item.id} className="stack">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                Позиция {item.positionNumber}
                {item.categoryName ? ` — ${item.categoryName}` : ''}
              </h3>
              {(['client', 'designer'] as const).map((block) => {
                const blockFiles = filesFor(item.id, block);
                const showUpload =
                  canUpload && canUploadBlock({ role, id: '', clientId: null }, block);
                return (
                  <div key={block}>
                    <div
                      className="toolbar"
                      style={{ justifyContent: 'space-between', marginBottom: 8 }}
                    >
                      <strong>{BLOCK_LABELS[block]}</strong>
                      {showUpload ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={pending}
                          onClick={() => triggerUpload(item.id, block)}
                        >
                          Загрузить
                        </button>
                      ) : null}
                    </div>
                    {blockFiles.length === 0 ? (
                      <p className="muted">Нет файлов</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {blockFiles.map((f) => (
                          <li
                            key={f.id}
                            className="toolbar"
                            style={{ justifyContent: 'space-between', marginBottom: 4 }}
                          >
                            <span>
                              {f.originalName}{' '}
                              <span className="muted">
                                ({formatBytes(f.sizeBytes)}
                                {f.uploadStatus !== 'confirmed'
                                  ? ` — ${statusLabel(f.uploadStatus)}`
                                  : ''}
                                )
                              </span>
                            </span>
                            {f.uploadStatus === 'confirmed' ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => void downloadFile(f.id)}
                              >
                                Скачать
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
