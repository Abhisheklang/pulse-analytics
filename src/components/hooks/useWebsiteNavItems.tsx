import {
  Activity,
  AlignEndHorizontal,
  Bug,
  ChartPie,
  CircleDollarSign,
  Clock,
  Database,
  Eye,
  FlaskConical,
  Flame,
  Globe,
  HeartPulse,
  LayoutDashboard,
  Megaphone,
  Search,
  Settings,
  Sheet,
  Tag,
  Terminal,
  User,
  UserPlus,
  Video,
} from '@/components/icons';
import { Funnel, Gauge, Lightning, Magnet, Money, Network, Path, Target } from '@/components/svg';
import { useConfig } from './useConfig';
import { useMessages } from './useMessages';
import { useNavigation } from './useNavigation';

export function useWebsiteNavItems(websiteId: string) {
  const { t, labels } = useMessages();
  const { pathname, renderUrl } = useNavigation();
  const config = useConfig();
  const resetParams = {
    search: undefined,
    page: undefined,
  };

  const renderPath = (path: string) =>
    renderUrl(`/websites/${websiteId}${path}`, {
      ...resetParams,
      event: undefined,
      compare: undefined,
      view: undefined,
      unit: undefined,
      excludeBounce: undefined,
    });

  // Pulse-first grouping: the Pulse feature set leads, then traffic,
  // behaviour and audience analysis, growth, site health, and finally the
  // configuration-style Pulse tools under Settings. Every page that existed
  // before the redesign is still reachable from here.
  const items = [
    {
      label: 'Pulse',
      items: [
        {
          id: 'pulse-rollup',
          label: 'Roll-up',
          icon: <Globe />,
          path: renderUrl('/pulse/overview', false),
        },
        {
          id: 'pulse-dashboards',
          label: 'Dashboards',
          icon: <LayoutDashboard />,
          path: renderUrl('/pulse/dashboards', false),
        },
        {
          id: 'pulse-insights',
          label: 'Insights',
          icon: <ChartPie />,
          path: renderPath('/pulse/insights'),
        },
        {
          id: 'pulse-alerts',
          label: 'Alerts',
          icon: <Megaphone />,
          path: renderPath('/pulse/alerts'),
        },
        {
          id: 'pulse-reports',
          label: 'Scheduled Reports',
          icon: <Sheet />,
          path: renderPath('/pulse/reports'),
        },
      ],
    },
    {
      label: t(labels.traffic),
      items: [
        {
          id: 'overview',
          label: t(labels.overview),
          icon: <Eye />,
          path: renderPath(''),
        },
        {
          id: 'events',
          label: t(labels.events),
          icon: <Lightning />,
          path: renderPath('/events'),
        },
        {
          id: 'sessions',
          label: t(labels.sessions),
          icon: <User />,
          path: renderPath('/sessions'),
        },
        {
          id: 'realtime',
          label: t(labels.realtime),
          icon: <Clock />,
          path: renderPath('/realtime'),
        },
        {
          id: 'pulse-debugger',
          label: 'Live Debugger',
          icon: <Terminal />,
          path: renderPath('/pulse/debugger'),
        },
        {
          id: 'compare',
          label: t(labels.compare),
          icon: <AlignEndHorizontal />,
          path: renderPath('/compare'),
        },
        {
          id: 'breakdown',
          label: t(labels.breakdown),
          icon: <Sheet />,
          path: renderPath('/breakdown'),
        },
        // Google Search Console is a Cloud integration.
        ...(config?.cloudMode
          ? [
              {
                id: 'search-console',
                label: t('searchConsole.searches'),
                icon: <Search />,
                path: renderPath('/search-console'),
              },
            ]
          : []),
      ],
    },
    {
      label: t(labels.behavior),
      items: [
        {
          id: 'goals',
          label: t(labels.goals),
          icon: <Target />,
          path: renderPath('/goals'),
        },
        {
          id: 'funnel',
          label: t(labels.funnels),
          icon: <Funnel />,
          path: renderPath('/funnels'),
        },
        {
          id: 'journeys',
          label: t(labels.journeys),
          icon: <Path />,
          path: renderPath('/journeys'),
        },
        {
          id: 'retention',
          label: t(labels.retention),
          icon: <Magnet />,
          path: renderPath('/retention'),
        },
        {
          id: 'replays',
          label: t(labels.replays),
          icon: <Video />,
          path: renderPath('/replays'),
        },
        {
          id: 'heatmaps',
          label: t(labels.heatmaps),
          icon: <Flame />,
          path: renderPath('/heatmaps'),
        },
      ],
    },
    {
      label: t(labels.audience),
      items: [
        {
          id: 'segments',
          label: t(labels.segments),
          icon: <ChartPie />,
          path: renderPath('/segments'),
        },
        {
          id: 'cohorts',
          label: t(labels.cohorts),
          icon: <UserPlus />,
          path: renderPath('/cohorts'),
        },
      ],
    },
    {
      label: t(labels.growth),
      items: [
        // Google Ads is a Cloud integration.
        ...(config?.cloudMode
          ? [
              {
                id: 'google-ads',
                label: t('googleAds.ads'),
                icon: <Megaphone />,
                path: renderPath('/google-ads'),
              },
            ]
          : []),
        {
          id: 'utm',
          label: t(labels.utm),
          icon: <Tag />,
          path: renderPath('/utm'),
        },
        {
          id: 'pulse-experiments',
          label: 'Experiments',
          icon: <FlaskConical />,
          path: renderPath('/pulse/experiments'),
        },
        {
          id: 'pulse-revenue',
          label: 'Revenue tracking',
          icon: <CircleDollarSign />,
          path: renderPath('/pulse/revenue'),
        },
        {
          id: 'revenue',
          label: t(labels.revenue),
          icon: <Money />,
          path: renderPath('/revenue'),
        },
        {
          id: 'attribution',
          label: t(labels.attribution),
          icon: <Network />,
          path: renderPath('/attribution'),
        },
      ],
    },
    {
      label: t(labels.monitoring),
      items: [
        {
          id: 'pulse-uptime',
          label: 'Uptime',
          icon: <Activity />,
          path: renderPath('/pulse/uptime'),
        },
        {
          id: 'pulse-vitals',
          label: 'Web Vitals',
          icon: <HeartPulse />,
          path: renderPath('/pulse/vitals'),
        },
        {
          id: 'performance',
          label: t(labels.performance),
          icon: <Gauge />,
          path: renderPath('/performance'),
        },
        {
          id: 'errors',
          label: t('errorTracking.title'),
          icon: <Bug />,
          path: renderPath('/errors'),
        },
        {
          id: 'pulse-quality',
          label: 'Data Quality',
          icon: <Bug />,
          path: renderPath('/pulse/quality'),
        },
      ],
    },
    {
      label: 'Settings',
      items: [
        {
          id: 'pulse-privacy',
          label: 'Privacy & Retention',
          icon: <Eye />,
          path: renderPath('/pulse/privacy'),
        },
        {
          id: 'pulse-import',
          label: 'CSV Importer',
          icon: <Database />,
          path: renderPath('/pulse/import'),
        },
        {
          id: 'pulse-badge',
          label: 'Badge & Webhooks',
          icon: <Flame />,
          path: renderPath('/pulse/badge'),
        },
        {
          id: 'pulse-exports',
          label: 'Warehouse Export',
          icon: <Database />,
          path: renderPath('/pulse/exports'),
        },
        {
          id: 'site-settings',
          label: 'Site settings',
          icon: <Settings />,
          path: renderUrl(`/settings/websites/${websiteId}`, false),
        },
      ],
    },
  ];

  const selectedKey = items
    .flatMap(e => e.items)
    .find(
      ({ path }) =>
        path &&
        (pathname.endsWith(path.split('?')[0]) ||
          (path.split('?')[0].endsWith('/errors') && pathname.includes('/errors/'))),
    )?.id;

  return { items, selectedKey, renderPath };
}
