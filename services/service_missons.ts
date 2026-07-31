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
  photos: { storage_path: string; sort_order: number; is_cover: boolean }[];
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createDiscoverPost(input: CreatePostInput): Promise<string> {
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

  for (let i = 0; i < input.photos.length; i++) {
    const photo = input.photos[i];
    const response = await fetch(photo.uri);
    const arrayBuffer = await response.arrayBuffer();
    const extension = (photo.mimeType?.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${user.id}/${postId}/${Date.now()}-${i}.${extension}`;

    console.log("업로드 경로:", path, "user.id:", user.id);
    const { error: uploadError } = await supabase.storage
      .from("discover-photos")
      .upload(path, arrayBuffer, { contentType: photo.mimeType || "image/jpeg", upsert: false });
    if (uploadError) {
      console.log("❌ 업로드 에러 상세:", JSON.stringify(uploadError));
      throw uploadError;
    }
    console.log("✅ 업로드 성공");

    const { error: photoRowError } = await supabase.from("discover_post_photos").insert({
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
  limit = 30
): Promise<DiscoverPost[]> {
  const { data, error } = await supabase
    .from("discover_posts")
    .select("*, discover_post_photos(storage_path, sort_order, is_cover)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? [])
    .map((row: any) => ({
      ...row,
      photos: row.discover_post_photos ?? [],
    }))
    .filter((row: any) => haversineKm(lat, lng, row.lat, row.lng) <= radiusKm);
}

export async function getDiscoverPhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("discover-photos").createSignedUrl(storagePath, 3600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("사진 URL을 생성하지 못했습니다.");
  return data.signedUrl;
}

export async function deleteDiscoverPost(postId: string): Promise<void> {
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
    await supabase.storage.from("discover-photos").remove(photoRows.map((p) => p.storage_path));
  }

  const { error } = await supabase.from("discover_posts").delete().eq("id", postId).eq("user_id", user.id);
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
  category: { id: string; name: string; icon_name: string | null } | null;
  place_lat: number | null;
  place_lng: number | null;
  place_name: string | null;
  badge_ids: string[] | null;
  required_items: string[];
};

export async function generateMissionFromPost(params: {
  content: string;
  emotion: string;
  category?: string;
  placeLat?: number;
  placeLng?: number;
  placeName?: string;
}): Promise<GeneratedMission> {
  const { data, error } = await supabase.functions.invoke("generate-mission-from-post", {
    body: params,
  });
  if (error) throw error;
  if (!data?.mission) throw new Error("미션 생성 결과가 없어요.");
  return data.mission as GeneratedMission;
}
