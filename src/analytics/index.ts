export type AnalyticsEventMap = {
  app_unexpected_error: { source: 'app_boundary' };
  local_storage_unavailable: { source: 'app_boot' | 'resume' };
  onboarding_started: { source: 'first_launch' | 'settings_reset' };
  onboarding_completed: { subjectCount: number; causeCount: number; goal: string };
  onboarding_skipped: { stage: string };
  initial_profile_created: { primaryRisk: string; secondaryRisk?: string };
  first_mistake_cta_clicked: { source: 'onboarding' | 'home' };
  mistake_created: { subject: string; cause?: string; source: 'onboarding' | 'home' };
  photo_analysis_started: { source: 'mistake_form' };
  photo_analysis_succeeded: { status: 'identified' | 'insufficient'; confidence: 'low' | 'medium' | 'high' };
  photo_analysis_failed: { reason: string };
  ai_analysis_started: { feature: 'mistake_photo_analysis' };
  ai_analysis_completed: { feature: 'mistake_photo_analysis'; model: string };
  ai_analysis_failed: { feature: 'mistake_photo_analysis'; errorCode: string };
  ai_limit_reached: { feature: 'mistake_photo_analysis'; tier: 'free' | 'pro' | 'unknown' };
  mistake_synced: { source: 'manual' | 'ai_photo' };
  sync_failed: { entity: 'mistake' | 'exam' | 'recovery'; operation: 'read' | 'write' | 'delete' };
  exam_created: { subject: string; daysUntil: number };
  exam_deleted: { subject: string };
  exam_prep_map_opened: { examSubject: string; priorityCount: number };
  exam_prep_map_item_started: { subject: string; cause: string; riskScore: number };
  exam_prep_map_item_completed: { subject: string; reviewedCount: number };
  exam_prep_map_completed: { examSubject: string };
  never_again_started: { subject: string; errorType: string; source: 'topic' };
  recovery_question_answered: { subject: string; correct: boolean; errorType: string };
  mistake_pattern_resisted: { subject: string; errorType: string };
  mistake_pattern_repeated: { subject: string; errorType: string };
  never_again_completed: { subject: string; questionsCorrect: number; generator: 'local' };
  pro_screen_viewed: { source: 'settings' };
  paywall_viewed: { source: 'settings' };
  package_selected: { packageType: string };
  purchase_started: { packageType: string };
  purchase_cancelled: { packageType: string };
  purchase_succeeded: { packageType: string };
  purchase_failed: { reason: string };
  restore_started: { source: 'user_action' };
  restore_succeeded: { entitlement: 'pro' };
  restore_no_entitlement: { entitlement: 'pro' };
  restore_failed: { reason: string };
  entitlement_pro_activated: { source: 'customer_info' };
  entitlement_pro_lost: { source: 'customer_info' };
  customer_center_opened: { source: 'settings' };
  account_screen_viewed: { source: 'settings' };
  account_signup_started: { source: 'account_screen' };
  account_signup_succeeded: { source: 'account_screen'; confirmationRequired: boolean };
  account_signup_failed: { source: 'account_screen' };
  account_signin_started: { source: 'account_screen' };
  account_signin_succeeded: { source: 'account_screen' };
  account_signin_failed: { source: 'account_screen' };
  account_signed_out: { source: 'account_screen' };
  account_delete_completed: { source: 'account_screen' };
  account_password_reset_requested: { source: 'account_screen' };
  account_password_reset_completed: { source: 'recovery_link' };
  circles_viewed: Record<string, never>;
  circle_create_started: Record<string, never>;
  circle_created: { subject: string };
  circle_invite_shared: { source: 'native_share' };
  circle_join_started: Record<string, never>;
  circle_joined: { source: 'invite_code' };
  mistake_shared: { source: 'circle_preview' };
  group_ranking_viewed: { period: 'week' | 'month' | 'total' };
  group_ranking_period_changed: { period: 'week' | 'month' | 'total' };
  group_rank_position_changed: { delta: number };
  group_rank_top3_reached: Record<string, never>;
  group_rank_first_place_reached: Record<string, never>;
  group_milestone_unlocked: { milestone: number };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

export interface AnalyticsProvider {
  track<Name extends AnalyticsEventName>(name: Name, properties: AnalyticsEventMap[Name]): void;
}

const noOpProvider: AnalyticsProvider = {
  track: () => undefined,
};

let provider: AnalyticsProvider = noOpProvider;

export function configureAnalytics(nextProvider: AnalyticsProvider | null) {
  provider = nextProvider ?? noOpProvider;
}

export function trackEvent<Name extends AnalyticsEventName>(name: Name, properties: AnalyticsEventMap[Name]) {
  provider.track(name, properties);
}
