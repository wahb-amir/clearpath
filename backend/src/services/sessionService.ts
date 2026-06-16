// src/services/sessionService.ts
import {supabase} from '../lib/supabase'

export const createSession = async (
  userId: string,
  refreshToken: string,
  deviceMeta: string,
  ipAddress: string
) => {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      refresh_token: refreshToken,
      device_meta: deviceMeta,
      ip_address: ipAddress,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return { sid: data.id };
};

export const refreshSession = async (
  sid: string,
  oldRefreshToken: string,
  newRefreshToken: string
) => {
  try{
    // 1. Fetch current active session
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('user_id, is_revoked')
      .eq('id', sid)
      .eq('refresh_token', oldRefreshToken)
      .single();
  
    // Token reuse detection / Breach protection
    if (fetchError || !session || session.is_revoked) {
      if (session) {
        // Hard revoke everything belonging to this user if a leaked token attempt occurs
        await supabase
          .from('sessions')
          .update({ is_revoked: true })
          .eq('user_id', session.user_id);
      }
      throw new Error('Token reuse detected or invalid session');
    }
  
    // 2. Cycle the refresh token and maintain session records
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        refresh_token: newRefreshToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sid)
      .select('id, user_id')
      .single();
  
    if (updateError || !updatedSession) {
      throw new Error('Failed to cycle session tokens');
    }
  
    return { newSid: updatedSession.id, userId: updatedSession.user_id };

  }
  catch(error) {
    console.error('Error in refreshSession:', error);
    throw new Error('Session refresh failed');
  }
};

export const revokeSession = async (sid: string) => {
  await supabase
    .from('sessions')
    .update({ is_revoked: true })
    .eq('id', sid);
};