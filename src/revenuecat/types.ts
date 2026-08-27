import type { AccessLevel } from '../entitlements';

export const PRO_ENTITLEMENT_IDENTIFIER = 'pro';

export type RevenueCatStatus = 'loading' | 'ready' | 'unavailable' | 'error';
export type OfferingStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';
export type RevenueCatOperation = 'idle' | 'purchasing' | 'restoring' | 'managing';
export type RevenueCatPackageType = 'annual' | 'monthly' | 'other';
export type RevenueCatNotice = 'purchase_success' | 'purchase_error' | 'restore_success' | 'restore_empty' | 'restore_error' | 'manage_error';
export type RevenueCatActionResult = 'success' | 'cancelled' | 'no_entitlement' | 'error' | 'unavailable';

export type RevenueCatCustomerInfo = {
  activeEntitlementIds: string[];
};

export type RevenueCatPackage = {
  id: string;
  identifier: string;
  offeringIdentifier: string;
  packageType: RevenueCatPackageType;
  productIdentifier: string;
  title: string;
  price: number;
  priceString: string;
  pricePerMonthString: string | null;
  currencyCode: string;
};

export type RevenueCatOffering = {
  identifier: string;
  availablePackages: RevenueCatPackage[];
};

export type RevenueCatResolvedConfig = {
  apiKey: string;
  source: 'test_store' | 'apple' | 'google_play';
};

export type RevenueCatPurchaseResult = {
  cancelled: boolean;
  customerInfo?: RevenueCatCustomerInfo;
};

export interface RevenueCatClient {
  readonly availability: 'native' | 'web';
  configure(config: RevenueCatResolvedConfig): Promise<void>;
  getCustomerInfo(): Promise<RevenueCatCustomerInfo>;
  getCurrentOffering(): Promise<RevenueCatOffering | null>;
  purchasePackage(aPackage: RevenueCatPackage): Promise<RevenueCatPurchaseResult>;
  restorePurchases(): Promise<RevenueCatCustomerInfo>;
  addCustomerInfoUpdateListener(listener: (customerInfo: RevenueCatCustomerInfo) => void): () => void;
  trackPaywallImpression(offeringIdentifier: string): Promise<void>;
  presentCustomerCenter(): Promise<void>;
}

export type RevenueCatState = {
  status: RevenueCatStatus;
  offeringStatus: OfferingStatus;
  subscriptionLevel: AccessLevel;
  customerInfo: RevenueCatCustomerInfo | null;
  packages: RevenueCatPackage[];
  selectedPackageId: string | null;
  operation: RevenueCatOperation;
  notice: RevenueCatNotice | null;
};
