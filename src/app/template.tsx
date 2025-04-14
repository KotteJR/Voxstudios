'use client';

import LayoutClient from './layout-client';

export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutClient>{children}</LayoutClient>;
} 