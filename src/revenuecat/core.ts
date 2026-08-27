import type { AccessLevel } from '../entitlements';
import { PRO_ENTITLEMENT_IDENTIFIER, type RevenueCatCustomerInfo, type RevenueCatOffering, type RevenueCatPackage, type RevenueCatState } from './types';

export function hasProEntitlement(customerInfo: RevenueCatCustomerInfo | null): boolean {
  return customerInfo?.activeEntitlementIds.includes(PRO_ENTITLEMENT_IDENTIFIER) ?? false;
}

export function subscriptionLevelFor(customerInfo: RevenueCatCustomerInfo | null): AccessLevel {
  return hasProEntitlement(customerInfo) ? 'pro' : 'free';
}

export function purchasablePackages(offering: RevenueCatOffering | null): RevenueCatPackage[] {
  if (!offering) return [];
  return offering.availablePackages
    .filter((item) => item.packageType === 'annual' || item.packageType === 'monthly')
    .sort((a, b) => (a.packageType === b.packageType ? 0 : a.packageType === 'annual' ? -1 : 1));
}

export function defaultPackageId(packages: readonly RevenueCatPackage[]): string | null {
  return packages.find((item) => item.packageType === 'annual')?.id ?? packages[0]?.id ?? null;
}

export function annualSavingsPercent(packages: readonly RevenueCatPackage[]): number | null {
  const annual = packages.find((item) => item.packageType === 'annual');
  const monthly = packages.find((item) => item.packageType === 'monthly');
  if (!annual || !monthly || annual.currencyCode !== monthly.currencyCode || annual.price <= 0 || monthly.price <= 0) return null;
  const yearlyAtMonthlyRate = monthly.price * 12;
  if (annual.price >= yearlyAtMonthlyRate) return null;
  const percentage = Math.round(((yearlyAtMonthlyRate - annual.price) / yearlyAtMonthlyRate) * 100);
  return percentage > 0 && percentage < 100 ? percentage : null;
}

export const INITIAL_REVENUECAT_STATE: RevenueCatState = {
  status: 'loading',
  offeringStatus: 'idle',
  subscriptionLevel: 'free',
  customerInfo: null,
  packages: [],
  selectedPackageId: null,
  operation: 'idle',
  notice: null,
};
