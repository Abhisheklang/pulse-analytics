'use client';

import { Row, Text } from '@pulselytics/react-zen';
import { Github } from '@/components/svg';
import { CURRENT_VERSION } from '@/lib/constants';

export function VersionSetting() {
  return (
    <Row alignItems="center" gap>
      <Text>{CURRENT_VERSION}</Text>
      <a
        href="https://github.com/Abhisheklang"
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub profile"
        style={{ display: 'inline-flex', color: 'inherit' }}
      >
        <Github width={18} height={18} />
      </a>
    </Row>
  );
}
