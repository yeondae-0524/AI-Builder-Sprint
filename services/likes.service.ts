import { supabase } from "../lib/supabase";

export type LikedPost = {
  id: string;
  title: string | null;
  content: string | null;
  place_name: string | null;
  emotion: string | null;
  category: string | null;
  likes_count: number;
  created_at: string;
  liked_at: string;
};

export type ReceivedLikePost = {
  id: string;
  title: string | null;
  content: string | null;
  place_name: string | null;
  emotion: string | null;
  category: string | null;
  likes_count: number;
  created_at: string;
};

// 내가 누른 좋아요 목록
export async function getMyLikedPosts(): Promise<LikedPost[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
    .from("discover_post_likes")
    .select(`
      created_at,
      discover_posts (
        id, title, content, place_name, emotion, category, likes_count, created_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => row.discover_posts)
    .map((row: any) => ({
      ...row.discover_posts,
      liked_at: row.created_at,
    }));
}

// 내가 받은 좋아요 (내 게시물들 중 좋아요가 눌린 것, 많은 순)
export async function getReceivedLikePosts(): Promise<ReceivedLikePost[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase
    .from("discover_posts")
    .select("id, title, content, place_name, emotion, category, likes_count, created_at")
    .eq("user_id", user.id)
    .gt("likes_count", 0)
    .order("likes_count", { ascending: false });

  if (error) throw error;
  return data ?? [];
}