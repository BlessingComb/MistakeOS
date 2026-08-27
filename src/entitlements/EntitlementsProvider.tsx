import { createContext, ReactNode, useContext, useMemo } from 'react';
import { AccessLevel, createEntitlements, ProductCapability } from './core';

type EntitlementsValue = {
  level: AccessLevel;
  has: (capability: ProductCapability) => boolean;
};

const EntitlementsContext = createContext<EntitlementsValue | null>(null);

export function EntitlementsProvider({ children, level = 'free' }: { children: ReactNode; level?: AccessLevel }) {
  const value = useMemo(() => createEntitlements(level), [level]);
  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsValue {
  const context = useContext(EntitlementsContext);
  if (!context) throw new Error('useEntitlements must be used inside EntitlementsProvider');
  return context;
}
