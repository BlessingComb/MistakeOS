import type { SupabaseClient } from '@supabase/supabase-js';
import { trackEvent } from '../analytics';
export type RecoveryEvidence={clientId:string;mistakeClientId:string;topic:string;targetedErrorType:string;answers:{questionId:string;selectedOption:number;answeredAt:string}[];startedAt:string;completedAt:string};

/** Cloud ranking evidence is evaluated by a SECURITY DEFINER RPC. The client
 * sends choices only; it never writes correctness or completion fields. */
export class RecoveryRepository {
  constructor(private readonly cloud: SupabaseClient | null) {}

  async sync(evidence: RecoveryEvidence) {
    if (!this.cloud) return false;
    const session = (await this.cloud.auth.getSession()).data.session;
    if (!session) return false;
    const { data: mistake, error: mistakeError } = await this.cloud
      .from('mistakes')
      .select('id')
      .eq('client_id', evidence.mistakeClientId)
      .maybeSingle();
    if (mistakeError || !mistake || evidence.answers.length !== 3) {
      trackEvent('sync_failed', { entity: 'recovery', operation: 'write' });
      return false;
    }

    const { error } = await this.cloud.rpc('submit_verified_recovery', {
      p_mistake_id: mistake.id,
      p_client_id: evidence.clientId,
      p_topic: evidence.topic,
      p_targeted_error_type: evidence.targetedErrorType,
      p_selected_options: evidence.answers.map(({ questionId, selectedOption }) => ({ questionId, selectedOption })),
    });
    if (error) {
      trackEvent('sync_failed', { entity: 'recovery', operation: 'write' });
      return false;
    }
    return true;
  }
}
