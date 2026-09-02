import { notFound } from 'next/navigation';
import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { loadGuideForRole } from '@/lib/help/load-guide';
import { markdownToSafeHtml } from '@/lib/help/markdown';

export default async function HelpPage() {
  const session = await requireNavAccess('/help');

  let guide;
  try {
    guide = await loadGuideForRole(session.user.role);
  } catch {
    notFound();
  }

  const html = markdownToSafeHtml(guide.markdown);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Справка</h1>
          <p className="lede">Руководство · {guide.title}</p>
        </div>
      </div>
      <article className="card help-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
