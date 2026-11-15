import { ReactNode } from 'react';
import '@pulselytics/react-zen';

declare module '@pulselytics/react-zen' {
  interface SelectProps {
    children?: ReactNode;
  }

  interface TooltipProps {
    children?: ReactNode;
  }
}
