'use client';
import { Column, Loading } from '@pulselytics/react-zen';
import { useRouter } from 'next/navigation';
import { useEffect, type PropsWithChildren } from 'react';
import { useLoginQuery } from '@/components/hooks';
import { LanguageButton } from '@/components/input/LanguageButton';
import { LoginForm } from './LoginForm';

export function LoginPageWrapper({ children }: PropsWithChildren) {
  const { user, isLoading } = useLoginQuery();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  if (isLoading || user) {
    return <Loading placement="absolute" />;
  }

  return (
    <div className="pulse-login-bg" style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Language picker: visible before sign-in; the choice persists via the
          shared locale mechanism (pulse.locale) so the app opens in the
          same language after login. */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <LanguageButton />
      </div>
      <Column
        alignItems="center"
        justifyContent="flex-start"
        style={{ paddingTop: '12vh', paddingInline: 16 }}
      >
        <div className="pulse-login-card">{children}</div>
      </Column>
    </div>
  );
}

export function LoginPage() {
  return (
    <LoginPageWrapper>
      <LoginForm />
    </LoginPageWrapper>
  );
}
