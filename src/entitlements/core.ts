export type AccessLevel = 'free' | 'pro';

export type ProductCapability =
  | 'log_mistakes'
  | 'basic_mistake_dna'
  | 'essential_reviews'
  | 'deeper_mistake_dna'
  | 'advanced_risk_score'
  | 'unlimited_never_again'
  | 'advanced_exam_prep_map'
  | 'long_term_trends'
  | 'prevention_insights'
  | 'create_friends_leagues'
  | 'multiple_friends_leagues'
  | 'league_challenges'
  | 'advanced_league_statistics';

const accessMatrix: Record<AccessLevel, ReadonlySet<ProductCapability>> = {
  free: new Set<ProductCapability>([
    'log_mistakes',
    'basic_mistake_dna',
    'essential_reviews',
  ]),
  pro: new Set<ProductCapability>([
    'log_mistakes',
    'basic_mistake_dna',
    'essential_reviews',
    'deeper_mistake_dna',
    'advanced_risk_score',
    'unlimited_never_again',
    'advanced_exam_prep_map',
    'long_term_trends',
    'prevention_insights',
    'create_friends_leagues',
    'multiple_friends_leagues',
    'league_challenges',
    'advanced_league_statistics',
  ]),
};

export function hasCapability(level: AccessLevel, capability: ProductCapability): boolean {
  return accessMatrix[level].has(capability);
}

export function createEntitlements(level: AccessLevel = 'free') {
  return {
    level,
    has: (capability: ProductCapability) => hasCapability(level, capability),
  } as const;
}
