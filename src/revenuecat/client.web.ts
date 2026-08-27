import type { RevenueCatClient } from './types';

const unavailable = async (): Promise<never> => { throw new Error('purchases_unavailable'); };

export const revenueCatClient: RevenueCatClient = {
  availability: 'web',
  configure: unavailable,
  getCustomerInfo: unavailable,
  getCurrentOffering: unavailable,
  purchasePackage: unavailable,
  restorePurchases: unavailable,
  addCustomerInfoUpdateListener: () => () => undefined,
  trackPaywallImpression: async () => undefined,
  presentCustomerCenter: unavailable,
};
