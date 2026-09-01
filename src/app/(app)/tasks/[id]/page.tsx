import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { TaskDetail } from './task-detail';

type Props = { params: Promise<{ id: string }> };

export default async function TaskDetailPage({ params }: Props) {
  await requireNavAccess('/tasks');
  const { id } = await params;
  return <TaskDetail taskId={id} />;
}
