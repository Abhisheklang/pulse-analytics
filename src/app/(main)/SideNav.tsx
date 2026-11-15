import {
  Button,
  type ButtonProps,
  Column,
  Icon,
  Row,
  Tooltip,
  TooltipTrigger,
} from '@pulselytics/react-zen';
import { AdminNav } from '@/app/(main)/admin/AdminNav';
import { SettingsNav } from '@/app/(main)/settings/SettingsNav';
import { WebsiteNav } from '@/app/(main)/websites/[websiteId]/WebsiteNav';
import { IconLabel } from '@/components/common/IconLabel';
import Link from '@/components/common/Link';
import { OverlayScrollArea } from '@/components/common/OverlayScrollArea';
import styles from '@/components/common/OverlayScrollArea.module.css';
import { useGlobalState, useMessages, useNavigation } from '@/components/hooks';
import { Logo } from '@/components/svg';
import {
  Globe,
  Grid2x2,
  LayoutDashboard,
  LinkIcon,
  PanelLeft,
  PanelsLeftBottom,
} from '@/components/icons';
export function SideNav(props: any) {
  const { t, labels } = useMessages();
  const { pathname, renderUrl, websiteId, teamId } = useNavigation();
  const [isCollapsed] = useGlobalState('sidenav-collapsed', false);

  const links = [
    ...(!teamId
      ? [
          {
            id: 'dashboard',
            label: t(labels.dashboard),
            path: '/dashboard',
            icon: <PanelsLeftBottom />,
          },
        ]
      : []),
    {
      id: 'boards',
      label: t(labels.boards),
      path: '/boards',
      icon: <LayoutDashboard />,
    },
    {
      id: 'websites',
      label: t(labels.websites),
      path: '/websites',
      icon: <Globe />,
    },
    {
      id: 'links',
      label: t(labels.links),
      path: '/links',
      icon: <LinkIcon />,
    },
    {
      id: 'pixels',
      label: t(labels.pixels),
      path: '/pixels',
      icon: <Grid2x2 />,
    },
  ];

  return (
    <Column
      {...props}
      className="pulse-sidenav"
      backgroundColor="surface"
      border
      borderRadius
      padding="2"
      flexGrow="1"
      minHeight="0"
      margin="2"
      style={{
        width: isCollapsed ? '60px' : '240px',
        transition: 'width 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Brand lockup at the top of the sidebar: the same badge +
          wordmark the header used to carry (the header brand is gone —
          on phone widths MobileNav carries the brand instead). The
          tagline is omitted here: at the header's sizes it is wider
          than the 240px sidebar. Collapsed, only the badge shows. */}
      <Row
        alignItems="center"
        justifyContent={isCollapsed ? 'center' : undefined}
        minHeight="12"
        paddingX={isCollapsed ? '0' : '3'}
        style={{ flexShrink: 0 }}
      >
        <Link
          href={renderUrl('/')}
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
        >
          <Row alignItems="center" style={{ gap: 10 }}>
            <Logo width={30} height={30} />
            {!isCollapsed && (
              <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>
                pulse
              </span>
            )}
          </Row>
        </Link>
      </Row>
      {/* Slim utility row with only the collapse toggle. */}
      <Row
        alignItems="center"
        justifyContent={isCollapsed ? 'center' : 'flex-end'}
        minHeight="9"
        paddingX="3"
        style={{ flexShrink: 0 }}
      >
        <PanelButton />
      </Row>
      <OverlayScrollArea
        showScrollIndicators
        className={isCollapsed ? styles.collapsed : undefined}
        style={{ flexGrow: 1, minHeight: 0 }}
      >
        {websiteId ? (
          <WebsiteNav websiteId={websiteId} isCollapsed={isCollapsed} />
        ) : pathname.includes('/settings') ? (
          <SettingsNav isCollapsed={isCollapsed} />
        ) : pathname.includes('/admin') ? (
          <AdminNav />
        ) : (
          <Column gap="2">
            {links.map(({ id, path, label, icon }) => {
              const isSelected = pathname.startsWith(renderUrl(path, false));
              const content = (
                <Row
                  tabIndex={0}
                  alignItems="center"
                  justifyContent={isCollapsed ? 'center' : undefined}
                  hover={{ backgroundColor: 'surface-sunken' }}
                  backgroundColor={isSelected ? 'surface-sunken' : undefined}
                  borderRadius
                  minHeight="9"
                >
                  <IconLabel
                    icon={icon}
                    label={isCollapsed ? '' : label}
                    weight={isSelected ? 'bold' : undefined}
                    padding
                  />
                </Row>
              );
              return (
                <Link key={id} href={renderUrl(path, false)} role="button">
                  {isCollapsed ? (
                    <TooltipTrigger delay={0}>
                      {content}
                      <Tooltip placement="right">{label}</Tooltip>
                    </TooltipTrigger>
                  ) : (
                    content
                  )}
                </Link>
              );
            })}
          </Column>
        )}
      </OverlayScrollArea>
    </Column>
  );
}

const PanelButton = (props: ButtonProps) => {
  const [isCollapsed, setIsCollapsed] = useGlobalState('sidenav-collapsed', false);
  return (
    <Button
      onPress={() => setIsCollapsed(!isCollapsed)}
      variant="zero"
      {...props}
      style={{ padding: 0 }}
    >
      <Icon strokeColor="muted">
        <PanelLeft />
      </Icon>
    </Button>
  );
};
