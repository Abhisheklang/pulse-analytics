import { checkPassword, hasDefaultPassword } from '@/lib/password';
import { getAccessibleWebsites } from './accessible-websites';
import { pulseDb } from './stats';

// First-run onboarding ("Getting started") state for a Pulse account.
// Steps are auto-detected from real account data wherever possible:
//   1. passwordChanged — the account no longer uses the default password
//      (seed-hash comparison for the system admin, bcrypt comparison against
//      the well-known default for everyone else; never client-asserted)
//   2. websiteCreated — the account owns/created at least one website
//      (admins administer all websites, so any website counts for them)
//   3. snippetInstalled — confirmed manually, or proven by step 4
//   4. firstData — at least one event exists for the account's websites
//   5. badgeEnabled (optional) — the live badge is on for any of the sites

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  optional?: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  complete: boolean;
  dismissed: boolean;
  websiteId: string | null;
}

export async function getOnboardingState(user: {
  id: string;
  isAdmin?: boolean;
}): Promise<OnboardingState> {
  const db = pulseDb();

  const [record, userRow] = await Promise.all([
    db.pulseOnboarding.findUnique({ where: { userId: user.id } }),
    db.user.findUnique({ where: { id: user.id }, select: { id: true, password: true } }),
  ]);

  // COR-8: include team-shared websites, matching canViewWebsite.
  const websites = await getAccessibleWebsites(user, { id: true });
  const websiteIds = websites.map((w: any) => w.id);
  const websiteId = websiteIds[0] || null;

  // FIN-5: the password step is only ever auto-detected from the real
  // password hash. It previously also trusted a stored flag that the
  // client could set on itself through the onboarding PUT body.
  let passwordChanged = false;
  if (userRow?.password) {
    const stillDefault =
      hasDefaultPassword(userRow as any) || checkPassword('Admin', userRow.password);
    passwordChanged = !stillDefault;
  }

  const websiteCreated = websiteIds.length > 0;

  let firstData = false;
  let badgeEnabled = false;
  if (websiteIds.length) {
    const [eventCount, badgeSetting] = await Promise.all([
      db.websiteEvent.count({ where: { websiteId: { in: websiteIds } } }),
      db.pulseSiteSetting.findFirst({
        where: { websiteId: { in: websiteIds }, badgeEnabled: true },
        select: { websiteId: true },
      }),
    ]);
    firstData = eventCount > 0;
    badgeEnabled = !!badgeSetting;
  }

  const steps: OnboardingStep[] = [
    { key: 'password', label: 'Change the default admin password', done: passwordChanged },
    { key: 'website', label: 'Create your first website', done: websiteCreated },
    {
      key: 'snippet',
      label: 'Add the tracking snippet to your site',
      done: !!record?.snippetConfirmed || firstData,
    },
    { key: 'data', label: 'Receive your first data', done: firstData },
    { key: 'badge', label: 'Enable the public live badge', done: badgeEnabled, optional: true },
  ];

  const required = steps.filter(s => !s.optional);
  const completed = required.filter(s => s.done).length;

  return {
    steps,
    completed,
    total: required.length,
    complete: completed === required.length,
    dismissed: !!record?.dismissed,
    websiteId,
  };
}

export async function updateOnboarding(
  userId: string,
  patch: { dismissed?: boolean; snippetConfirmed?: boolean },
) {
  const db = pulseDb();
  await db.pulseOnboarding.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
  return getOnboardingState({ id: userId });
}
