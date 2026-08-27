import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function TasksPage() {
  await requireNavAccess('/tasks');
  return <h1>Задачи</h1>;
}
