import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const COLORS = {
  primary: "#315C4A",
  primaryLight: "#E5EEE8",
  textMain: "#26372E",
  textSub: "#65766D",
  textMuted: "#9AA49F",
  border: "#E2E3DC",
  background: "#F5F2E9",
  white: "#FFFFFF",
};

type LikedPost = {
  post_id: string;
  discover_posts: {
    id: string;
    content: string;
    likes_count: number;
  } | null;
};

export default function LikesScreen() {
  const [likedPosts, setLikedPosts] = useState<LikedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLikedPosts();
  }, []);

  const fetchLikedPosts = async () => {
  try {
    setIsLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error("로그인 에러");

    // 1. 내가 좋아요 누른 게시글 id만 가져오기
    const { data: likes, error: likesError } = await supabase
      .from("discover_post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (likesError) throw likesError;

    if (!likes || likes.length === 0) {
      setLikedPosts([]);
      return;
    }

    // post_id 배열 만들기
    const postIds = likes.map((item) => item.post_id);

    // 2. 게시글 가져오기
    const { data: posts, error: postsError } = await supabase
      .from("discover_posts")
      .select("id, content, likes_count")
      .in("id", postIds);

    if (postsError) throw postsError;

    // 3. 원래 좋아요 순서대로 정렬
    const formatted: LikedPost[] = likes
      .map((like) => ({
        post_id: like.post_id,
        discover_posts:
          posts?.find((post) => post.id === like.post_id) ?? null,
      }))
      .filter((item) => item.discover_posts !== null);

    setLikedPosts(formatted);
  } catch (error) {
    console.error("좋아요 목록 불러오기 실패:", error);
  } finally {
    setIsLoading(false);
  }
};

  const renderItem = ({ item }: { item: LikedPost }) => {
    const post = item.discover_posts;
    if (!post) return null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="heart" size={16} color="#EF4444" />
          <Text style={styles.likesCount}>좋아요 {post.likes_count ?? 0}개</Text>
        </View>
        <Text style={styles.contentText} numberOfLines={3}>
          {post.content || "내용이 없습니다."}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>내가 누른 좋아요</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={likedPosts}
          keyExtractor={(item) => item.post_id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>아직 좋아요를 누른 글이 없어요.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textMain },
  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  likesCount: { marginLeft: 6, fontSize: 12, fontWeight: "700", color: "#EF4444" },
  contentText: { fontSize: 14, lineHeight: 22, color: COLORS.textMain },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },
});