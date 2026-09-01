'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminSubNav } from '@/components/admin-subnav';
import { SectionBack } from '@/components/section-back';
import { editablePermissionKeys } from '@/lib/admin-users/permissions';
import { ADMIN_USER_ROLES, PERMISSION_LABELS, ROLE_LABELS } from '@/lib/admin-users/labels';
import {
  can,
  DENY_FLAG_BY_GRANT,
  emptyPermissionFlags,
  type Action,
  type PermissionFlags,
  type PermissionGrantFlags,
  type Role,
} from '@/lib/auth/permissions';

type PermissionsApi = {
  canAccessReports: boolean;
  canEditPrice: boolean;
  canCancelOrder: boolean;
  canSoftDeleteOrder: boolean;
  canManageSla: boolean;
  denyAccessReports: boolean;
  denyEditPrice: boolean;
  denyCancelOrder: boolean;
  denySoftDeleteOrder: boolean;
  denyManageSla: boolean;
};

type Props = {
  mode: 'create' | 'edit';
  userId?: string;
  initial?: {
    email: string;
    displayName: string;
    role: Role;
    clientName: string | null;
    isActive: boolean;
    permissions: PermissionsApi;
  };
};

function apiToFlags(p: PermissionsApi): PermissionFlags {
  return {
    can_access_reports: p.canAccessReports,
    can_edit_price: p.canEditPrice,
    can_cancel_order: p.canCancelOrder,
    can_soft_delete_order: p.canSoftDeleteOrder,
    can_manage_sla: p.canManageSla,
    deny_access_reports: p.denyAccessReports,
    deny_edit_price: p.denyEditPrice,
    deny_cancel_order: p.denyCancelOrder,
    deny_soft_delete_order: p.denySoftDeleteOrder,
    deny_manage_sla: p.denyManageSla,
  };
}

function flagsToApi(p: PermissionFlags): PermissionsApi {
  return {
    canAccessReports: p.can_access_reports,
    canEditPrice: p.can_edit_price,
    canCancelOrder: p.can_cancel_order,
    canSoftDeleteOrder: p.can_soft_delete_order,
    canManageSla: p.can_manage_sla,
    denyAccessReports: p.deny_access_reports,
    denyEditPrice: p.deny_edit_price,
    denyCancelOrder: p.deny_cancel_order,
    denySoftDeleteOrder: p.deny_soft_delete_order,
    denyManageSla: p.deny_manage_sla,
  };
}

const PERMISSION_FLAG_ACTION: Record<keyof PermissionGrantFlags, Action> = {
  can_access_reports: 'access_reports',
  can_edit_price: 'edit_price',
  can_cancel_order: 'cancel_order',
  can_soft_delete_order: 'soft_delete_order',
  can_manage_sla: 'manage_sla',
};

export function UserForm({ mode, userId, initial }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initial?.email ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(initial?.role ?? 'production');
  const [clientName, setClientName] = useState(initial?.clientName ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [permissions, setPermissions] = useState<PermissionFlags>(
    initial ? apiToFlags(initial.permissions) : { ...emptyPermissionFlags },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permKeys = editablePermissionKeys(role);

  function onRoleChange(next: Role) {
    setRole(next);
    if (next === 'designer') {
      setPermissions((prev) => ({
        ...prev,
        can_cancel_order: false,
        can_soft_delete_order: false,
      }));
    }
  }

  function setEffectivePerm(key: keyof PermissionGrantFlags, wantOn: boolean) {
    const action = PERMISSION_FLAG_ACTION[key];
    const roleGranted = can(role, action, emptyPermissionFlags);
    const denyKey = DENY_FLAG_BY_GRANT[key];
    setPermissions((prev) => {
      const next = { ...prev };
      if (wantOn) {
        next[denyKey] = false;
        if (!roleGranted) next[key] = true;
      } else if (roleGranted) {
        next[denyKey] = true;
      } else {
        next[key] = false;
      }
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const permPayload = flagsToApi(permissions);
    const body =
      mode === 'create'
        ? {
            email: email.trim(),
            password,
            displayName: displayName.trim(),
            role,
            clientName: role === 'photo_center' ? clientName.trim() : undefined,
            permissions: permPayload,
          }
        : {
            email: email.trim(),
            displayName: displayName.trim(),
            role,
            isActive,
            ...(password ? { password } : {}),
            ...(role === 'photo_center' && !initial?.clientName && clientName.trim()
              ? { clientName: clientName.trim() }
              : {}),
            permissions: permPayload,
          };

    try {
      const url =
        mode === 'create' ? '/api/admin/users' : `/api/admin/users/${encodeURIComponent(userId!)}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { user?: { id: string }; message?: string };
      if (!res.ok) {
        setError(data.message || 'Не удалось сохранить');
        return;
      }
      if (mode === 'create' && data.user?.id) {
        router.push(`/admin/users/${data.user.id}`);
      } else {
        router.refresh();
        setError(null);
      }
    } catch {
      setError('Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <AdminSubNav current="/admin/users" />
      <SectionBack href="/admin/users" label="К списку пользователей" />

      <div className="page-head">
        <div>
          <h1>{mode === 'create' ? 'Новый пользователь' : 'Пользователь'}</h1>
          <p className="lede">
            {mode === 'create'
              ? 'photo_center создаёт точку сети автоматически (§19.3)'
              : initial?.email}
          </p>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <form className="card stack" onSubmit={onSubmit}>
        <label className="field">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={320}
          />
        </label>

        <label className="field">
          Отображаемое имя
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={200}
          />
        </label>

        <label className="field">
          {mode === 'create' ? 'Пароль' : 'Новый пароль (оставьте пустым, чтобы не менять)'}
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={mode === 'create'}
            minLength={6}
            maxLength={128}
            autoComplete={mode === 'create' ? 'new-password' : 'off'}
          />
        </label>

        <label className="field">
          Роль
          <select
            className="input"
            value={role}
            onChange={(e) => onRoleChange(e.target.value as Role)}
          >
            {ADMIN_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        {role === 'photo_center' ? (
          <label className="field">
            Название точки (clients)
            <input
              className="input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required={mode === 'create' || !initial?.clientName}
              maxLength={200}
              disabled={mode === 'edit' && Boolean(initial?.clientName)}
            />
            {mode === 'edit' && initial?.clientName ? (
              <span className="muted" style={{ fontSize: 13 }}>
                Точка уже привязана; смена роли не ломает связь (§13).
              </span>
            ) : null}
          </label>
        ) : null}

        {mode === 'edit' ? (
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Активен
          </label>
        ) : null}

        <fieldset className="permission-flags-list">
          <legend style={{ fontWeight: 600, marginBottom: 8 }}>Флаги прав</legend>
          {permKeys.map((key) => {
            const grantKey = key as keyof PermissionGrantFlags;
            const action = PERMISSION_FLAG_ACTION[grantKey];
            const effective = can(role, action, permissions);
            const roleGranted = can(role, action, emptyPermissionFlags);
            const denied = permissions[DENY_FLAG_BY_GRANT[grantKey]];
            return (
              <div key={key} className="permission-flag-row">
                <input
                  type="checkbox"
                  checked={effective}
                  onChange={(e) => setEffectivePerm(grantKey, e.target.checked)}
                />
                <span>
                  {PERMISSION_LABELS[key]}
                  {denied ? <span className="muted"> — снято администратором</span> : null}
                  {!denied && roleGranted && effective ? (
                    <span className="muted"> (от роли)</span>
                  ) : null}
                </span>
              </div>
            );
          })}
          {role === 'designer' ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Для дизайнера отмена и soft-delete недоступны (§3.2).
            </p>
          ) : null}
        </fieldset>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сохранение…' : mode === 'create' ? 'Создать' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}
