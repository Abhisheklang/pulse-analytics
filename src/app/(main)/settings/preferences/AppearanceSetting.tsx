'use client';
import { Button, Column, Row, Text } from '@pulselytics/react-zen';
import { usePulseMotion } from '@/components/hooks/usePulseMotion';
import { usePulseTheme, type PulseThemeMode } from '@/components/hooks/usePulseTheme';
import { ThemeModeSelector } from '@/components/input/ThemeModeSelector';
import { PULSE_THEMES, PULSE_THEME_IDS } from '@/lib/pulse/themes';

/** Appearance: light/dark/system mode, the animations on/off switch and
 *  the Pulse colour preset. All persist per user in localStorage
 *  (pulse.theme-mode / pulse.animations / pulse.color-theme) and apply
 *  app-wide via the token layer. */
export function AppearanceSetting() {
  const { colorTheme, mode, saveColorTheme, saveThemeMode } = usePulseTheme();
  const { animations, saveAnimations } = usePulseMotion();

  return (
    <Column gap="5">
      <Column gap="2">
        <Text weight="semibold">Mode</Text>
        <ThemeModeSelector
          value={mode}
          includeSystem
          onChange={value => saveThemeMode(value as PulseThemeMode)}
        />
        <Text size="sm" color="muted">
          System follows your operating system&apos;s light or dark setting.
        </Text>
      </Column>
      <Column gap="2">
        <Text weight="semibold">Animations</Text>
        <Row gap>
          <Button
            variant={animations === 'on' ? 'primary' : undefined}
            onPress={() => saveAnimations('on')}
            aria-pressed={animations === 'on'}
          >
            On
          </Button>
          <Button
            variant={animations === 'off' ? 'primary' : undefined}
            onPress={() => saveAnimations('off')}
            aria-pressed={animations === 'off'}
          >
            Off
          </Button>
        </Row>
        <Text size="sm" color="muted">
          Page entrances, hover effects, scroll reveals and chart animation. Off makes the
          interface respond instantly. Saved on this device for your account.
        </Text>
      </Column>
      <Column gap="2">
        <Text weight="semibold">Color theme</Text>
        <Column gap="2">
          {PULSE_THEME_IDS.map(id => {
            const preset = PULSE_THEMES[id];
            const selected = id === colorTheme;
            return (
              <button
                key={id}
                type="button"
                className="pulse-theme-option"
                onClick={() => saveColorTheme(id)}
                aria-pressed={selected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  padding: '10px 14px',
                  borderRadius: 'var(--pulse-radius-card)',
                  border: selected
                    ? '2px solid var(--zen-primary)'
                    : '1px solid var(--zen-border)',
                  background: selected ? 'var(--pulse-accent-softer)' : 'var(--zen-surface)',
                  cursor: 'pointer',
                  color: 'inherit',
                  width: '100%',
                  maxWidth: 520,
                }}
              >
                <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {preset.swatches.map(color => (
                    <span
                      key={color}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: color,
                        border: '1px solid var(--zen-border)',
                      }}
                    />
                  ))}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>
                    {preset.name}
                    {selected ? ' · Active' : ''}
                  </span>
                  <span
                    style={{ display: 'block', fontSize: 13, color: 'var(--zen-fg-muted)' }}
                  >
                    {preset.description}
                  </span>
                </span>
              </button>
            );
          })}
        </Column>
        <Text size="sm" color="muted">
          Applies across the whole app, including chart colours. Saved on this device for your
          account.
        </Text>
      </Column>
    </Column>
  );
}
