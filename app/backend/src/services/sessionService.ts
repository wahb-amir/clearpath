// src/services/sessionService.ts
import { supabase } from "../lib/supabase";

export const createSession = async (
  userId: string,
  refreshToken: string,
  deviceMeta: string,
  ipAddress: string,
) => {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      refresh_token: refreshToken,
      device_meta: deviceMeta,
      ip_address: ipAddress,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return { sid: data.id };
};

export const refreshSession = async (
  sid: string,
  oldRefreshToken: string,
  newRefreshToken: string,
) => {
  try {
    // 1. Fetch the existing session row first to inspect the current state
    const { data: currentSession, error: fetchError } = await supabase
      .from("sessions")
      .select("id, user_id, refresh_token")
      .eq("id", sid)
      .maybeSingle();

    if (fetchError || !currentSession) {
      console.error(
        ` Security Alert: Session ${sid} not found. Denying refresh.`,
      );
      throw new Error("Session has expired or been terminated.");
    }

    if (currentSession.refresh_token !== oldRefreshToken) {
      console.error(
        ` Security Violation: Reuse of old refresh token detected for session ${sid}!`,
      );

      await supabase.from("sessions").delete().eq("id", sid);

      throw new Error("Invalid refresh token token chain. Session revoked.");
    }

    // 2. Perform the update securely since validation checks passed
    const { data: updatedSession, error: updateError } = await supabase
      .from("sessions")
      .update({
        refresh_token: newRefreshToken,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sid)
      .select("id, user_id")
      .single();

    if (updateError) {
      throw new Error("Failed to synchronize updated session tokens.");
    }

    return { newSid: updatedSession.id, userId: updatedSession.user_id };
  } catch (error) {
    console.error("Session refresh validation failed:", error);
    throw error;
  }
};
export const revokeSession = async (sid: string) => {
  await supabase.from("sessions").update({ is_revoked: true }).eq("id", sid);
};
