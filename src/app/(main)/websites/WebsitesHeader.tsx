import { PageHeader } from '@/components/common/PageHeader';
import { useMessages, useNavigation } from '@/components/hooks';
import { WebsiteAddButton } from './WebsiteAddButton';

export interface WebsitesHeaderProps {
  allowCreate?: boolean;
}

export function WebsitesHeader({ allowCreate = true }: WebsitesHeaderProps) {
  const { t, labels } = useMessages();
  const { teamId } = useNavigation();

  return (
    <PageHeader title={t(labels.websites)}>
      <a
        href="/pulse/overview"
        style={{
          padding: '8px 14px',
          borderRadius: 6,
          border: '1px solid #c7c9d9',
          fontSize: 14,
          fontWeight: 600,
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        Pulse roll-up
      </a>
      <a
        href="/pulse/dashboards"
        style={{
          padding: '8px 14px',
          borderRadius: 6,
          border: '1px solid #c7c9d9',
          fontSize: 14,
          fontWeight: 600,
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        Custom dashboards
      </a>
      {allowCreate && <WebsiteAddButton teamId={teamId} />}
    </PageHeader>
  );
}
