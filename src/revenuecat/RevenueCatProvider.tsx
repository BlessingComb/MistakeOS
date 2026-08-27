import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { trackEvent } from '../analytics';
import { EntitlementsProvider } from '../entitlements';
import { revenueCatClient } from './client';
import { getRevenueCatEnvironment, resolveRevenueCatConfig } from './config';
import { RevenueCatService } from './service';
import type { RevenueCatActionResult, RevenueCatState } from './types';

type RevenueCatContextValue = RevenueCatState & {
  selectPackage: (packageId: string) => void;
  purchaseSelected: () => Promise<RevenueCatActionResult>;
  restorePurchases: () => Promise<RevenueCatActionResult>;
  openCustomerCenter: () => Promise<RevenueCatActionResult>;
  retry: () => Promise<void>;
  recordPaywallImpression: () => Promise<void>;
  dismissNotice: () => void;
};

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => resolveRevenueCatConfig(
    Platform.OS,
    typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production',
    getRevenueCatEnvironment(),
  ), []);
  const [service] = useState(() => new RevenueCatService(revenueCatClient, config));
  const [state, setState] = useState(() => service.getState());
  const previousLevel = useRef<'free' | 'pro' | null>(null);

  useEffect(() => {
    const unsubscribe = service.subscribe((nextState) => {
      setState(nextState);
      if (nextState.status !== 'ready') return;
      const previous = previousLevel.current;
      if (nextState.subscriptionLevel === 'pro' && previous !== 'pro') trackEvent('entitlement_pro_activated', { source: 'customer_info' });
      if (nextState.subscriptionLevel === 'free' && previous === 'pro') trackEvent('entitlement_pro_lost', { source: 'customer_info' });
      previousLevel.current = nextState.subscriptionLevel;
    });
    service.initialize();
    return () => { unsubscribe(); service.destroy(); };
  }, [service]);

  const selectPackage = useCallback((packageId: string) => {
      const selected = service.getState().packages.find((item) => item.id === packageId);
      if (selected) trackEvent('package_selected', { packageType: selected.packageType });
      service.selectPackage(packageId);
  }, [service]);

  const purchaseSelected = useCallback(async () => {
      const selected = service.getState().packages.find((item) => item.id === service.getState().selectedPackageId);
      trackEvent('purchase_started', { packageType: selected?.packageType ?? 'unknown' });
      const result = await service.purchaseSelected();
      if (result === 'success') trackEvent('purchase_succeeded', { packageType: selected?.packageType ?? 'unknown' });
      else if (result === 'cancelled') trackEvent('purchase_cancelled', { packageType: selected?.packageType ?? 'unknown' });
      else if (result !== 'unavailable') trackEvent('purchase_failed', { reason: result });
      return result;
  }, [service]);

  const restorePurchases = useCallback(async () => {
      trackEvent('restore_started', { source: 'user_action' });
      const result = await service.restore();
      if (result === 'success') trackEvent('restore_succeeded', { entitlement: 'pro' });
      else if (result === 'no_entitlement') trackEvent('restore_no_entitlement', { entitlement: 'pro' });
      else if (result !== 'unavailable') trackEvent('restore_failed', { reason: result });
      return result;
  }, [service]);

  const openCustomerCenter = useCallback(async () => {
      const result = await service.openCustomerCenter();
      if (result === 'success') trackEvent('customer_center_opened', { source: 'settings' });
      return result;
  }, [service]);

  const retry = useCallback(() => service.getState().status === 'error' ? service.initialize() : service.refreshOfferings(), [service]);
  const recordPaywallImpression = useCallback(() => service.recordPaywallImpression(), [service]);
  const dismissNotice = useCallback(() => service.dismissNotice(), [service]);

  const value = useMemo<RevenueCatContextValue>(() => ({
    ...state,
    selectPackage,
    purchaseSelected,
    restorePurchases,
    openCustomerCenter,
    retry,
    recordPaywallImpression,
    dismissNotice,
  }), [dismissNotice, openCustomerCenter, purchaseSelected, recordPaywallImpression, restorePurchases, retry, selectPackage, state]);

  return (
    <RevenueCatContext.Provider value={value}>
      <EntitlementsProvider level={state.subscriptionLevel}>{children}</EntitlementsProvider>
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat(): RevenueCatContextValue {
  const context = useContext(RevenueCatContext);
  if (!context) throw new Error('useRevenueCat must be used inside RevenueCatProvider');
  return context;
}
