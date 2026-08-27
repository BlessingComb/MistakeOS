import assert from 'node:assert/strict';
import test from 'node:test';
import { RevenueCatService } from './service';
import type { RevenueCatClient, RevenueCatCustomerInfo, RevenueCatOffering, RevenueCatPackage, RevenueCatPurchaseResult } from './types';

const FREE: RevenueCatCustomerInfo = { activeEntitlementIds: [] };
const PRO: RevenueCatCustomerInfo = { activeEntitlementIds: ['pro'] };
const CONFIG = { apiKey: 'public_test_key', source: 'test_store' as const };

function packageFixture(packageType: RevenueCatPackage['packageType']): RevenueCatPackage {
  const annual = packageType === 'annual';
  return {
    id: `current:${packageType}:mistakeos_${packageType}`,
    identifier: annual ? '$rc_annual' : '$rc_monthly',
    offeringIdentifier: 'current',
    packageType,
    productIdentifier: `mistakeos_${packageType}`,
    title: annual ? 'MistakeOS Pro Annual' : 'MistakeOS Pro Monthly',
    price: annual ? 99 : 10,
    priceString: annual ? '$99.00' : '$10.00',
    pricePerMonthString: annual ? '$8.25' : '$10.00',
    currencyCode: 'USD',
  };
}

class MockRevenueCatClient implements RevenueCatClient {
  readonly availability = 'native' as const;
  customerInfo = FREE;
  offering: RevenueCatOffering | null = { identifier: 'current', availablePackages: [packageFixture('monthly'), packageFixture('annual')] };
  purchaseResult: RevenueCatPurchaseResult = { cancelled: false, customerInfo: PRO };
  purchaseError = false;
  restoreInfo = PRO;
  restoreError = false;
  configured = 0;
  purchasedPackageId: string | null = null;
  listener: ((info: RevenueCatCustomerInfo) => void) | null = null;

  async configure() { this.configured += 1; }
  async getCustomerInfo() { return this.customerInfo; }
  async getCurrentOffering() { return this.offering; }
  async purchasePackage(aPackage: RevenueCatPackage) {
    this.purchasedPackageId = aPackage.id;
    if (this.purchaseError) throw new Error('purchase_failed');
    return this.purchaseResult;
  }
  async restorePurchases() {
    if (this.restoreError) throw new Error('restore_failed');
    return this.restoreInfo;
  }
  addCustomerInfoUpdateListener(listener: (info: RevenueCatCustomerInfo) => void) { this.listener = listener; return () => { this.listener = null; }; }
  async trackPaywallImpression() {}
  async presentCustomerCenter() {}
  emit(info: RevenueCatCustomerInfo) { this.listener?.(info); }
}

test('not configured leaves the app available as free without initializing the SDK', async () => {
  const client = new MockRevenueCatClient();
  const service = new RevenueCatService(client, null);
  await service.initialize();
  assert.equal(service.getState().status, 'unavailable');
  assert.equal(service.getState().subscriptionLevel, 'free');
  assert.equal(client.configured, 0);
});

test('CustomerInfo without and with pro maps to the entitlement foundation', async () => {
  const freeClient = new MockRevenueCatClient();
  const freeService = new RevenueCatService(freeClient, CONFIG);
  await freeService.initialize();
  assert.equal(freeService.getState().subscriptionLevel, 'free');

  const proClient = new MockRevenueCatClient();
  proClient.customerInfo = PRO;
  const proService = new RevenueCatService(proClient, CONFIG);
  await proService.initialize();
  assert.equal(proService.getState().subscriptionLevel, 'pro');
});

test('CustomerInfo listener updates and can remove pro immediately', async () => {
  const client = new MockRevenueCatClient();
  const service = new RevenueCatService(client, CONFIG);
  await service.initialize();
  client.emit(PRO);
  assert.equal(service.getState().subscriptionLevel, 'pro');
  client.emit(FREE);
  assert.equal(service.getState().subscriptionLevel, 'free');
  service.destroy();
  assert.equal(client.listener, null);
});

test('purchase success activates pro using returned CustomerInfo', async () => {
  const client = new MockRevenueCatClient();
  const service = new RevenueCatService(client, CONFIG);
  await service.initialize();
  const result = await service.purchaseSelected();
  assert.equal(result, 'success');
  assert.equal(service.getState().subscriptionLevel, 'pro');
  assert.equal(service.getState().notice, 'purchase_success');
  assert.match(client.purchasedPackageId ?? '', /annual/);
});

test('purchase cancellation is quiet and purchase errors are recoverable', async () => {
  const cancelledClient = new MockRevenueCatClient();
  cancelledClient.purchaseResult = { cancelled: true };
  const cancelledService = new RevenueCatService(cancelledClient, CONFIG);
  await cancelledService.initialize();
  assert.equal(await cancelledService.purchaseSelected(), 'cancelled');
  assert.equal(cancelledService.getState().notice, null);
  assert.equal(cancelledService.getState().subscriptionLevel, 'free');

  const errorClient = new MockRevenueCatClient();
  errorClient.purchaseError = true;
  const errorService = new RevenueCatService(errorClient, CONFIG);
  await errorService.initialize();
  assert.equal(await errorService.purchaseSelected(), 'error');
  assert.equal(errorService.getState().notice, 'purchase_error');
  assert.equal(errorService.getState().subscriptionLevel, 'free');
});

test('a purchase response without pro never grants access', async () => {
  const client = new MockRevenueCatClient();
  client.purchaseResult = { cancelled: false, customerInfo: FREE };
  const service = new RevenueCatService(client, CONFIG);
  await service.initialize();
  assert.equal(await service.purchaseSelected(), 'no_entitlement');
  assert.equal(service.getState().subscriptionLevel, 'free');
});

test('restore distinguishes active pro, no entitlement and errors', async () => {
  const successClient = new MockRevenueCatClient();
  const success = new RevenueCatService(successClient, CONFIG);
  await success.initialize();
  assert.equal(await success.restore(), 'success');
  assert.equal(success.getState().subscriptionLevel, 'pro');

  const emptyClient = new MockRevenueCatClient();
  emptyClient.restoreInfo = FREE;
  const empty = new RevenueCatService(emptyClient, CONFIG);
  await empty.initialize();
  assert.equal(await empty.restore(), 'no_entitlement');
  assert.equal(empty.getState().subscriptionLevel, 'free');

  const errorClient = new MockRevenueCatClient();
  errorClient.restoreError = true;
  const error = new RevenueCatService(errorClient, CONFIG);
  await error.initialize();
  assert.equal(await error.restore(), 'error');
  assert.equal(error.getState().subscriptionLevel, 'free');
});

test('empty offering is explicit and package selection is controllable', async () => {
  const emptyClient = new MockRevenueCatClient();
  emptyClient.offering = null;
  const empty = new RevenueCatService(emptyClient, CONFIG);
  await empty.initialize();
  assert.equal(empty.getState().offeringStatus, 'empty');

  const client = new MockRevenueCatClient();
  const service = new RevenueCatService(client, CONFIG);
  await service.initialize();
  assert.match(service.getState().selectedPackageId ?? '', /annual/);
  const monthly = service.getState().packages.find((item) => item.packageType === 'monthly');
  assert.ok(monthly);
  service.selectPackage(monthly.id);
  assert.equal(service.getState().selectedPackageId, monthly.id);
});
