export function isAuthorizedRevenueCatRequest(request: { headers: { get(name: string): string | null } }, expected: string | undefined): boolean {
  if (!expected) return false;
  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${expected}`;
}
