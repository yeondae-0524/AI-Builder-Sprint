import { supabase } from "../lib/supabase";

export type FriendProfile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
};

export type FriendPublicProfile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  selected_title: string | null;
  badgeCount: number;
  completedMissionCount: number;
  essayCount: number;
};

export async function searchUserByNickname(query: string): Promise<FriendProfile[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  if (!query.trim()) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .ilike("nickname", `%${query.trim()}%`)
    .neq("id", user.id)
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function getFriendStatusMap(
  userIds: string[],
): Promise<Record<string, "none" | "pending_sent" | "pending_received" | "accepted">> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || userIds.length === 0) return {};

  const { data, error } = await supabase
    .from("friends")
    .select("requester_id, addressee_id, status")
    .or(
      userIds
        .map(
          (id) =>
            `and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`,
        )
        .join(","),
    );

  if (error) throw error;

  const map: Record<string, "none" | "pending_sent" | "pending_received" | "accepted"> = {};

  for (const row of data ?? []) {
    const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id;

    if (row.status === "accepted") {
      map[otherId] = "accepted";
    } else if (row.requester_id === user.id) {
      map[otherId] = "pending_sent";
    } else {
      map[otherId] = "pending_received";
    }
  }

  return map;
}

export async function sendFriendRequest(addresseeId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { error } = await supabase.from("friends").insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    status: "pending",
  });

  if (error) throw error;
}

// 🚀 수정: profiles와 friends 간 자동 관계 인식이 안 되어 수동으로 2단계 조회
export async function getIncomingRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
    .from("friends")
    .select("id, requester_id")
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  if (error) throw error;

  const requesterIds = (data ?? []).map((row) => row.requester_id);

  if (requesterIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", requesterIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (data ?? []).map((row) => ({
    id: row.id,
    requester_id: row.requester_id,
    profiles: profileMap.get(row.requester_id) ?? null,
  }));
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from("friends")
    .update({ status: "accepted" })
    .eq("id", requestId);

  if (error) throw error;
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from("friends").delete().eq("id", requestId);
  if (error) throw error;
}

// 🚀 수정: profiles와 friends 간 자동 관계 인식이 안 되어 수동으로 2단계 조회
export async function getFriendList() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
    .from("friends")
    .select("id, requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) throw error;

  const otherIds = (data ?? []).map((row) =>
    row.requester_id === user.id ? row.addressee_id : row.requester_id,
  );

  if (otherIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", otherIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (data ?? []).map((row) => {
    const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id;
    const profile = profileMap.get(otherId);

    return {
      relationId: row.id,
      id: otherId,
      nickname: profile?.nickname ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

export async function removeFriend(relationId: string): Promise<void> {
  const { error } = await supabase.from("friends").delete().eq("id", relationId);
  if (error) throw error;
}

export async function getFriendPublicProfile(userId: string): Promise<FriendPublicProfile> {
  const [profileResult, badgesResult, missionsResult, essaysResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, avatar_url, selected_title")
      .eq("id", userId)
      .single(),

    supabase
      .from("user_badges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("tier", "LOCKED"),

    supabase
      .from("mission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("completed_at", "is", null),

    supabase
      .from("essays")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed"),
  ]);

  if (profileResult.error) throw profileResult.error;

  return {
    id: profileResult.data.id,
    nickname: profileResult.data.nickname,
    avatar_url: profileResult.data.avatar_url,
    selected_title: profileResult.data.selected_title,
    badgeCount: badgesResult.count ?? 0,
    completedMissionCount: missionsResult.count ?? 0,
    essayCount: essaysResult.count ?? 0,
  };
}