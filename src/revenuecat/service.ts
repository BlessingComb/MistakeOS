import { defaultPackageId, INITIAL_REVENUECAT_STATE, purchasablePackages, subscriptionLevelFor } from './core';
import type {
  RevenueCatActionResult,
  RevenueCatClient,
  RevenueCatCustomerInfo,
  RevenueCatResolvedConfig,
  RevenueCatState,
} from './types';

type Listener = (state: RevenueCatState) => void;

export class RevenueCatService {
  private state: RevenueCatState = INITIAL_REVENUECAT_STATE;
  private listeners = new Set<Listener>();
  private removeCustomerInfoListener: (() => void) | null = null;
  private lifecycleVersion = 0;
  private recordedOffering: string | null = null;

  constructor(
    private readonly client: RevenueCatClient,
    private readonly config: RevenueCatResolvedConfig | null,
  ) {}

  getState(): RevenueCatState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async initialize(): Promise<void> {
    const version = ++this.lifecycleVersion;
    this.removeCustomerInfoListener?.();
    this.removeCustomerInfoListener = null;

    if (!this.config || this.client.availability !== 'native') {
      this.update({ status: 'unavailable', offeringStatus: 'unavailable', operation: 'idle' });
      return;
    }

    this.update({ status: 'loading', offeringStatus: 'loading', notice: null });
    try {
      await this.client.configure(this.config);
      if (version !== this.lifecycleVersion) return;
      this.removeCustomerInfoListener = this.client.addCustomerInfoUpdateListener((info) => this.applyCustomerInfo(info));
      const [customerInfoResult, offeringResult] = await Promise.allSettled([
        this.client.getCustomerInfo(),
        this.client.getCurrentOffering(),
      ]);
      if (version !== this.lifecycleVersion) return;
      if (customerInfoResult.status === 'rejected') throw new Error('customer_info_unavailable');
      this.applyCustomerInfo(customerInfoResult.value);
      if (offeringResult.status === 'fulfilled') this.applyOffering(offeringResult.value);
      else this.update({ offeringStatus: 'error' });
    } catch {
      if (version !== this.lifecycleVersion) return;
      this.update({ status: 'error', offeringStatus: 'error', operation: 'idle' });
    }
  }

  async syncIdentity(appUserId: string | null): Promise<void> {
    if (!this.config || this.client.availability !== 'native') return;
    try {
      if (appUserId) await this.client.logIn?.(appUserId);
      else await this.client.logOut?.();
      this.applyCustomerInfo(await this.client.getCustomerInfo());
    } catch {
      // Identity sync must never take down the app; CustomerInfo remains the source of truth.
    }
  }

  async refreshOfferings(): Promise<void> {
    if (!this.config || this.client.availability !== 'native') {
      this.update({ offeringStatus: 'unavailable' });
      return;
    }
    this.update({ offeringStatus: 'loading' });
    try {
      this.applyOffering(await this.client.getCurrentOffering());
    } catch {
      this.update({ offeringStatus: 'error' });
    }
  }

  selectPackage(packageId: string): void {
    if (!this.state.packages.some((item) => item.id === packageId)) return;
    this.update({ selectedPackageId: packageId });
  }

  async purchaseSelected(): Promise<RevenueCatActionResult> {
    if (this.state.status !== 'ready' || this.state.operation !== 'idle') return 'unavailable';
    const selected = this.state.packages.find((item) => item.id === this.state.selectedPackageId);
    if (!selected) return 'unavailable';
    this.update({ operation: 'purchasing', notice: null });
    try {
      const result = await this.client.purchasePackage(selected);
      if (result.cancelled) {
        this.update({ operation: 'idle' });
        return 'cancelled';
      }
      if (!result.customerInfo) throw new Error('missing_customer_info');
      this.applyCustomerInfo(result.customerInfo);
      if (subscriptionLevelFor(result.customerInfo) !== 'pro') {
        this.update({ operation: 'idle', notice: 'purchase_error' });
        return 'no_entitlement';
      }
      this.update({ operation: 'idle', notice: 'purchase_success' });
      return 'success';
    } catch {
      this.update({ operation: 'idle', notice: 'purchase_error' });
      return 'error';
    }
  }

  async restore(): Promise<RevenueCatActionResult> {
    if (this.state.status !== 'ready' || this.state.operation !== 'idle') return 'unavailable';
    this.update({ operation: 'restoring', notice: null });
    try {
      const info = await this.client.restorePurchases();
      this.applyCustomerInfo(info);
      if (subscriptionLevelFor(info) !== 'pro') {
        this.update({ operation: 'idle', notice: 'restore_empty' });
        return 'no_entitlement';
      }
      this.update({ operation: 'idle', notice: 'restore_success' });
      return 'success';
    } catch {
      this.update({ operation: 'idle', notice: 'restore_error' });
      return 'error';
    }
  }

  async openCustomerCenter(): Promise<RevenueCatActionResult> {
    if (this.state.status !== 'ready' || this.state.subscriptionLevel !== 'pro' || this.state.operation !== 'idle') return 'unavailable';
    this.update({ operation: 'managing', notice: null });
    try {
      await this.client.presentCustomerCenter();
      this.update({ operation: 'idle' });
      return 'success';
    } catch {
      this.update({ operation: 'idle', notice: 'manage_error' });
      return 'error';
    }
  }

  async recordPaywallImpression(): Promise<void> {
    const offeringIdentifier = this.state.packages[0]?.offeringIdentifier;
    if (!offeringIdentifier || offeringIdentifier === this.recordedOffering) return;
    this.recordedOffering = offeringIdentifier;
    try {
      await this.client.trackPaywallImpression(offeringIdentifier);
    } catch {
      this.recordedOffering = null;
    }
  }

  dismissNotice(): void {
    this.update({ notice: null });
  }

  destroy(): void {
    this.lifecycleVersion += 1;
    this.removeCustomerInfoListener?.();
    this.removeCustomerInfoListener = null;
  }

  private applyCustomerInfo(customerInfo: RevenueCatCustomerInfo): void {
    this.update({
      customerInfo,
      status: 'ready',
      subscriptionLevel: subscriptionLevelFor(customerInfo),
    });
  }

  private applyOffering(offering: Awaited<ReturnType<RevenueCatClient['getCurrentOffering']>>): void {
    const packages = purchasablePackages(offering);
    const selectedPackageId = this.state.selectedPackageId && packages.some((item) => item.id === this.state.selectedPackageId)
      ? this.state.selectedPackageId
      : defaultPackageId(packages);
    this.update({ packages, selectedPackageId, offeringStatus: packages.length > 0 ? 'ready' : 'empty' });
  }

  private update(partial: Partial<RevenueCatState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
