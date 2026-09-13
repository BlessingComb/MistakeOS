import Purchases, {
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import type {
  RevenueCatClient,
  RevenueCatCustomerInfo,
  RevenueCatOffering,
  RevenueCatPackage,
  RevenueCatPackageType,
  RevenueCatResolvedConfig,
} from './types';

const packageHandles = new Map<string, PurchasesPackage>();
let currentOffering: PurchasesOffering | null = null;
let configured = false;

function customerInfoSnapshot(info: CustomerInfo): RevenueCatCustomerInfo {
  return { activeEntitlementIds: Object.keys(info.entitlements.active) };
}

function packageType(value: PACKAGE_TYPE): RevenueCatPackageType {
  if (value === PACKAGE_TYPE.ANNUAL) return 'annual';
  if (value === PACKAGE_TYPE.MONTHLY) return 'monthly';
  return 'other';
}

function packageSnapshot(aPackage: PurchasesPackage, offeringIdentifier: string): RevenueCatPackage {
  const id = `${offeringIdentifier}:${aPackage.identifier}:${aPackage.product.identifier}`;
  packageHandles.set(id, aPackage);
  return {
    id,
    identifier: aPackage.identifier,
    offeringIdentifier,
    packageType: packageType(aPackage.packageType),
    productIdentifier: aPackage.product.identifier,
    title: aPackage.product.title,
    price: aPackage.product.price,
    priceString: aPackage.product.priceString,
    pricePerMonthString: aPackage.product.pricePerMonthString,
    currencyCode: aPackage.product.currencyCode,
  };
}

function offeringSnapshot(offering: PurchasesOffering | null): RevenueCatOffering | null {
  packageHandles.clear();
  currentOffering = offering;
  if (!offering) return null;
  return {
    identifier: offering.identifier,
    availablePackages: offering.availablePackages.map((item) => packageSnapshot(item, offering.identifier)),
  };
}

function isCancellation(error: unknown): boolean {
  const purchasesError = error as Partial<PurchasesError>;
  return purchasesError.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || purchasesError.userCancelled === true;
}

export const revenueCatClient: RevenueCatClient = {
  availability: 'native',
  async configure(config: RevenueCatResolvedConfig) {
    if (configured || await Purchases.isConfigured()) {
      configured = true;
      return;
    }
    Purchases.configure({ apiKey: config.apiKey });
    configured = true;
  },
  async logIn(appUserId: string) { await Purchases.logIn(appUserId); },
  async logOut() { await Purchases.logOut(); },
  async getCustomerInfo() {
    return customerInfoSnapshot(await Purchases.getCustomerInfo());
  },
  async getCurrentOffering() {
    return offeringSnapshot((await Purchases.getOfferings()).current);
  },
  async purchasePackage(aPackage) {
    const nativePackage = packageHandles.get(aPackage.id);
    if (!nativePackage) throw new Error('package_unavailable');
    try {
      const result = await Purchases.purchasePackage(nativePackage);
      return { cancelled: false, customerInfo: customerInfoSnapshot(result.customerInfo) };
    } catch (error) {
      if (isCancellation(error)) return { cancelled: true };
      throw new Error('purchase_failed');
    }
  },
  async restorePurchases() {
    return customerInfoSnapshot(await Purchases.restorePurchases());
  },
  addCustomerInfoUpdateListener(listener) {
    const nativeListener = (info: CustomerInfo) => listener(customerInfoSnapshot(info));
    Purchases.addCustomerInfoUpdateListener(nativeListener);
    return () => { Purchases.removeCustomerInfoUpdateListener(nativeListener); };
  },
  async trackPaywallImpression(offeringIdentifier) {
    await Purchases.trackCustomPaywallImpression({
      offering: currentOffering?.identifier === offeringIdentifier ? currentOffering : null,
      offeringId: offeringIdentifier,
    });
  },
  async presentCustomerCenter() {
    await RevenueCatUI.presentCustomerCenter();
  },
};
