import { supabase } from "@/lib/supabase";

export type DiscoverPost = {
  id: string;
  user_id: string;
  place_name: string;
  lat: number;
  lng: number;
  category: string | null;
  content: string;
  emotion: string;
  visibility: "private" | "anonymous";
  likes_count: number;
  created_at: string;
  title?: string | null;
  source_kind?: "independent" | "mission" | null;
  source_mission_id?: string | null;
  share_mode?: "private" | "anonymous" | "nickname" | null;
  photos: {
    storage_path: string;
    sort_order: number;
    is_cover: boolean;
  }[];
};

type CreatePostInput = {
  placeName: string;
  lat: number;
  lng: number;
  category?: string;
  content: string;
  emotion: string;
  visibility: "private" | "anonymous";
  photos: { uri: string; mimeType?: string }[];
};

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createDiscoverPost(
  input: CreatePostInput,
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: post, error: insertError } = await supabase
    .from("discover_posts")
    .insert({
      user_id: user.id,
      place_name: input.placeName,
      lat: input.lat,
      lng: input.lng,
      category: input.category ?? null,
      content: input.content,
      emotion: input.emotion,
      visibility: input.visibility,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  const postId = post.id as string;

  for (let i = 0; i < input.photos.length; i += 1) {
    const photo = input.photos[i];
    const response = await fetch(photo.uri);
    const arrayBuffer = await response.arrayBuffer();
    const extension = (photo.mimeType?.split("/")[1] || "jpg").replace(
      "jpeg",
      "jpg",
    );
    const path = `${user.id}/${postId}/${Date.now()}-${i}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("discover-photos")
      .upload(path, arrayBuffer, {
        contentType: photo.mimeType || "image/jpeg",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: photoRowError } = await supabase
      .from("discover_post_photos")
      .insert({
        post_id: postId,
        user_id: user.id,
        storage_path: path,
        sort_order: i,
        is_cover: i === 0,
      });
    if (photoRowError) throw photoRowError;
  }

  return postId;
}

export async function getNearbyDiscoverPosts(
  lat: number,
  lng: number,
  radiusKm = 5,
  limit = 30,
): Promise<DiscoverPost[]> {
  const { data, error } = await supabase
    .from("discover_posts")
    .select(
      "*, discover_post_photos(storage_path, sort_order, is_cover)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? [])
    .map((row: any) => ({
      ...row,
      photos: row.discover_post_photos ?? [],
    }))
    .filter(
      (row: any) =>
        haversineKm(lat, lng, row.lat, row.lng) <= radiusKm,
    );
}

export async function getDiscoverPhotoUrl(
  storagePath: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("discover-photos")
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  if (!data?.signedUrl) {
    throw new Error("사진 URL을 생성하지 못했습니다.");
  }
  return data.signedUrl;
}

export async function deleteDiscoverPost(
  postId: string,
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: photoRows } = await supabase
    .from("discover_post_photos")
    .select("storage_path")
    .eq("post_id", postId);

  if (photoRows && photoRows.length > 0) {
    await supabase.storage
      .from("discover-photos")
      .remove(photoRows.map((photo) => photo.storage_path));
  }

  const { error } = await supabase
    .from("discover_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export type GeneratedMission = {
  id: string;
  title: string;
  short_description: string;
  instructions: string;
  recommendation_reason: string | null;
  estimated_duration_min: number | null;
  estimated_cost: number;
  category: {
    id: string;
    name: string;
    icon_name: string | null;
  } | null;
  place_id: string | null;
  place_lat: number | null;
  place_lng: number | null;
  place_name: string | null;
  place_address: string | null;
  requires_place: boolean | null;
  badge_ids: string[] | null;
  required_items: string[];
};

function normalizeRelation<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeOriginalMission(row: any): GeneratedMission {
  const category = normalizeRelation(row.category);

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    short_description: String(row.short_description ?? ""),
    instructions: String(
      row.instructions ?? row.short_description ?? "",
    ),
    recommendation_reason: row.recommendation_reason
      ? String(row.recommendation_reason)
      : null,
    estimated_duration_min:
      row.estimated_duration_min == null
        ? null
        : Number(row.estimated_duration_min),
    estimated_cost: Number(row.estimated_cost ?? 0),
    category: category
      ? {
          id: String((category as any).id),
          name: String((category as any).name ?? "기타"),
          icon_name: (category as any).icon_name
            ? String((category as any).icon_name)
            : null,
        }
      : null,
    place_id: row.place_id ? String(row.place_id) : null,
    place_lat:
      row.place_lat == null ? null : Number(row.place_lat),
    place_lng:
      row.place_lng == null ? null : Number(row.place_lng),
    place_name: row.place_name ? String(row.place_name) : null,
    place_address: row.place_address
      ? String(row.place_address)
      : null,
    requires_place:
      typeof row.requires_place === "boolean"
        ? row.requires_place
        : null,
    badge_ids: Array.isArray(row.badge_ids)
      ? row.badge_ids.map(String)
      : null,
    required_items: Array.isArray(row.required_items)
      ? row.required_items.map(String)
      : [],
  };
}

async function getOriginalMissionById(
  missionId: string,
): Promise<GeneratedMission> {
  const extendedSelection = `
    id,
    title,
    short_description,
    instructions,
    recommendation_reason,
    estimated_duration_min,
    estimated_cost,
    required_items,
    requires_place,
    place_id,
    place_lat,
    place_lng,
    place_name,
    place_address,
    badge_ids,
    category:mission_categories ( id, name, icon_name )
  `;
  const basicSelection = `
    id,
    title,
    short_description,
    instructions,
    recommendation_reason,
    estimated_duration_min,
    estimated_cost,
    required_items,
    requires_place,
    place_lat,
    place_lng,
    place_name,
    badge_ids,
    category:mission_categories ( id, name, icon_name )
  `;

  let result = await supabase
    .from("missions")
    .select(extendedSelection)
    .eq("id", missionId)
    .maybeSingle();

  if (result.error) {
    result = await supabase
      .from("missions")
      .select(basicSelection)
      .eq("id", missionId)
      .maybeSingle();
  }

  if (result.error) throw result.error;
  if (!result.data) {
    throw new Error("원본 미션을 찾지 못했어요.");
  }

  return normalizeOriginalMission(result.data);
}

export async function getOriginalMissionFromDiscoverPost(
  discoverPostId: string,
): Promise<GeneratedMission> {
  const { data, error } = await supabase.rpc(
    "get_discover_post_display_metadata",
    { p_post_ids: [discoverPostId] },
  );

  if (error) throw error;

  const metadata = Array.isArray(data) ? data[0] : data;
  const sourceKind = String(metadata?.source_kind ?? "");
  const sourceMissionId = String(
    metadata?.source_mission_id ?? "",
  ).trim();

  if (sourceKind !== "mission" || !sourceMissionId) {
    throw new Error(
      "이 기록에는 연결된 원본 미션이 없어요.",
    );
  }

  return getOriginalMissionById(sourceMissionId);
}

/**
 * 이전 버전 호환용입니다. 발견 탭의 '나도 해볼래요'에서는
 * 더 이상 새 미션을 생성하지 않고 getOriginalMissionFromDiscoverPost를 사용합니다.
 */
export async function generateMissionFromPost(params: {
  content: string;
  emotion: string;
  category?: string;
  placeLat?: number;
  placeLng?: number;
  placeName?: string;
}): Promise<GeneratedMission> {
  const { data, error } = await supabase.functions.invoke(
    "generate-mission-from-post",
    { body: params },
  );
  if (error) throw error;
  if (!data?.mission) {
    throw new Error("미션 생성 결과가 없어요.");
  }
  return normalizeOriginalMission(data.mission);
}