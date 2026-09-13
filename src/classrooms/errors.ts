export type ClassroomLoadFailure = 'backend_unavailable' | 'network' | 'unexpected';

export function isMissingClassroomSchema(error: unknown) {
  const value = error as { code?: string; message?: string };
  const message = value?.message?.toLowerCase() ?? '';
  return value?.code === '42P01' || value?.code === 'PGRST202' || value?.message === 'CLASSROOMS_UNAVAILABLE' || (message.includes('classroom') && (message.includes('does not exist') || message.includes('could not find')));
}

/** Maps transport and schema failures to safe user-facing states. */
export function classifyClassroomLoadFailure(error: unknown): ClassroomLoadFailure {
  if (isMissingClassroomSchema(error)) return 'backend_unavailable';
  const value = error as { code?: string; message?: string; name?: string };
  const message = `${value?.name ?? ''} ${value?.message ?? ''}`.toLowerCase();
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('offline') || value?.code === 'ECONNABORTED') return 'network';
  return 'unexpected';
}
