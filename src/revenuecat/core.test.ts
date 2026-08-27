import assert from 'node:assert/strict';
import test from 'node:test';
import { annualSavingsPercent, defaultPackageId, purchasablePackages, subscriptionLevelFor } from './core';
import { resolveRevenueCatConfig } from './config';
import { revenueCatClient as webClient } from './client.web';
import type { RevenueCatPackage } from './types';

function aPackage(packageType: RevenueCatPackage['packageType'], price: number, currencyCode = 'USD'): RevenueCatPackage {
  return {
    id: `current:${packageType}:product`,
    identifier: `$rc_${packageType}`,
    offeringIdentifier: 'current',
    packageType,
    productIdentifier: `mistakeos_${packageType}`,
    title: packageType,
    price,
    priceString: `$${price}`,
    pricePerMonthString: packageType === 'annual' ? '$8.33' : `$${price}`,
    currencyCode,
  };
}

test('CustomerInfo is the only input that activates pro', () => {
  assert.equal(subscriptionLevelFor(null), 'free');
  assert.equal(subscriptionLevelFor({ activeEntitlementIds: [] }), 'free');
  assert.equal(subscriptionLevelFor({ activeEntitlementIds: ['another_entitlement'] }), 'free');
  assert.equal(subscriptionLevelFor({ activeEntitlementIds: ['pro'] }), 'pro');
});

test('production ignores Test Store key and uses platform public keys', () => {
  const environment = { iosKey: 'public_ios_key', androidKey: 'public_android_key', testKey: 'public_test_key' };
  assert.deepEqual(resolveRevenueCatConfig('ios', false, environment), { apiKey: 'public_ios_key', source: 'apple' });
  assert.deepEqual(resolveRevenueCatConfig('android', false, environment), { apiKey: 'public_android_key', source: 'google_play' });
  assert.deepEqual(resolveRevenueCatConfig('ios', true, environment), { apiKey: 'public_test_key', source: 'test_store' });
  assert.equal(resolveRevenueCatConfig('web', true, environment), null);
  assert.equal(resolveRevenueCatConfig('ios', false, { iosKey: 'secret_invalid' }), null);
});

test('web client is unavailable and cannot silently enable purchases', async () => {
  assert.equal(webClient.availability, 'web');
  await assert.rejects(() => webClient.getCustomerInfo(), /purchases_unavailable/);
});

test('package selection prefers annual, supports empty offerings and ignores unrelated packages', () => {
  const monthly = aPackage('monthly', 10);
  const annual = aPackage('annual', 100);
  const other = aPackage('other', 5);
  const packages = purchasablePackages({ identifier: 'current', availablePackages: [monthly, other, annual] });
  assert.deepEqual(packages.map((item) => item.packageType), ['annual', 'monthly']);
  assert.equal(defaultPackageId(packages), annual.id);
  assert.deepEqual(purchasablePackages(null), []);
  assert.deepEqual(purchasablePackages({ identifier: 'current', availablePackages: [] }), []);
});

test('annual savings uses real same-currency prices and stays hidden when unsafe', () => {
  assert.equal(annualSavingsPercent([aPackage('annual', 90), aPackage('monthly', 10)]), 25);
  assert.equal(annualSavingsPercent([aPackage('annual', 120), aPackage('monthly', 10)]), null);
  assert.equal(annualSavingsPercent([aPackage('annual', 90, 'BRL'), aPackage('monthly', 10, 'USD')]), null);
  assert.equal(annualSavingsPercent([aPackage('annual', 90)]), null);
});
