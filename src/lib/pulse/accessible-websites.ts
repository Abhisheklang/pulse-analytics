import { pulseDb } from './stats';

// COR-8: one website-scoping rule for Pulse surfaces that list "the
// websites this user can see". Rollup and onboarding previously scoped
// to owned/created websites only, so websites shared through a team
// (which canViewWebsite grants) never appeared there. Admins see all
// websites, matching canViewWebsite.
export async function getAccessibleWebsites(
  user: { id: string; isAdmin?: boolean },
  select: Record<string, boolean> = { id: true },
  orderBy: Record<string, string> = { createdAt: 'asc' },
) {
  const db = pulseDb();

  return db.website.findMany({
    where: {
      deletedAt: null,
      ...(user?.isAdmin
        ? {}
        : {
            OR: [
              { userId: user.id },
              { createdBy: user.id },
              {
                team: {
                  deletedAt: null,
                  members: { some: { userId: user.id } },
                },
              },
            ],
          }),
    },
    select,
    orderBy,
  });
}
