'use client';
import { Column } from '@pulselytics/react-zen';
import { PageBody } from '@/components/common/PageBody';
import { PageHeader } from '@/components/common/PageHeader';
import { useLoginQuery, useMessages, useNavigation, useTeamMembersQuery } from '@/components/hooks';
import { ROLES } from '@/lib/constants';
import { PulseHomeSections } from '@/components/pulse/PulseHomeSections';
import { PulseOnboardingBanner } from '@/components/pulse/PulseOnboardingBanner';
import { WebsiteAddButton } from './WebsiteAddButton';

export function WebsitesPage() {
  const { user } = useLoginQuery();
  const { teamId } = useNavigation();
  const { t, labels } = useMessages();
  const { data } = useTeamMembersQuery(teamId);

  const showActions =
    (teamId &&
      data?.data.filter(team => team.userId === user.id && team.role !== ROLES.teamViewOnly)
        .length > 0) ||
    (!teamId && user.role !== ROLES.viewOnly);

  return (
    <PageBody>
      <Column gap="6" margin="2">
        <PageHeader title={t(labels.websites)}>
          {showActions && user.role !== ROLES.viewOnly && <WebsiteAddButton teamId={teamId} />}
        </PageHeader>
        <PulseOnboardingBanner />
        <PulseHomeSections teamId={teamId} showActions={showActions} />
      </Column>
    </PageBody>
  );
}
