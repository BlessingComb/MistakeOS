export type CircleSubject = 'Mathematics' | 'Physics' | 'Chemistry' | 'Biology' | 'Languages' | 'Other';
export type Circle = { id: string; ownerId: string; name: string; subject: string; goal: string | null; inviteCode: string; createdAt: string };
export type CirclePreview = Pick<Circle, 'id' | 'name' | 'subject'> & { memberCount: number };
export type CirclePost = { id: string; circleId: string; authorId: string; subject: string; mistakeType: string | null; problemSummary: string | null; whatWentWrong: string | null; lesson: string | null; preventionRule: string | null; createdAt: string };

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function hasCollectiveEvidence(posts: readonly CirclePost[], distinctAuthors: number) {
  return posts.length >= 3 && distinctAuthors >= 2;
}

export function mostCommonSharedSubject(posts: readonly CirclePost[]): { subject: string; count: number } | null {
  const counts = new Map<string, number>();
  posts.forEach((post) => counts.set(post.subject, (counts.get(post.subject) ?? 0) + 1));
  let result: { subject: string; count: number } | null = null;
  counts.forEach((count, subject) => { if (!result || count > result.count) result = { subject, count }; });
  return result;
}
