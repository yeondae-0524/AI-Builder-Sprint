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
  primary: "#3D5AFE",
  primaryLight: "#EEF1FF",
  textMain: "#171719",
  textSub: "#5C5F6A",
  textMuted: "#9EA3AE",
  border: "#E4E6EA",
  background: "#F7F8FA",
  white: "#FFFFFF",
};

// 백엔드 구조에 맞춰 타입 정의
type LikedPost = {
  id: string;
  discover_posts: {
    id: string;
    content: string;
    likes_count: number;
  };
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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인 에러");

      // 좋아요(discover_post_likes) 테이블과 실제 글(discover_posts) 테이블을 조인해서 가져옴
      const { data, error } = await supabase
        .from("discover_post_likes")
        .select(`
          id,
          discover_posts (
            id,
            content,
            likes_count
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }); // 최신순

      if (error) throw error;
      setLikedPosts((data as any) || []);
    } catch (error) {
      console.error("좋아요 목록 불러오기 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }: { item: LikedPost }) => {
    const post = item.discover_posts;
    if (!post) return null; // 삭제된 글일 경우 패스

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="heart" size={16} color="#EF4444" />
          <Text style={styles.likesCount}>좋아요 {post.likes_count}개</Text>
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
          keyExtractor={(item) => item.id}
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.background },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textMain },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  likesCount: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#EF4444" },
  contentText: { fontSize: 14, lineHeight: 22, color: COLORS.textMain },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },
}); 