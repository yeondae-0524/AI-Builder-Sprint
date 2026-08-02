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
import { getReceivedLikePosts, ReceivedLikePost } from "../../services/likes.service";

const COLORS = {
  primary: "#315C4A",
  primaryLight: "#E5EEE8",
  textMain: "#26372E",
  textSub: "#65766D",
  textMuted: "#9AA49F",
  border: "#E2E3DC",
  background: "#F5F2E9",
  white: "#FFFFFF",
  heart: "#E07A5F",
};

const EMOTION_LABEL: Record<string, string> = {
  comfortable: "편안해요",
  joyful: "즐거워요",
  new: "새로워요",
  uncomfortable: "불편해요",
  unsure: "잘 모르겠어요",
};

export default function ReceivedLikesScreen() {
  const [posts, setPosts] = useState<ReceivedLikePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getReceivedLikePosts();
        setPosts(data);
      } catch (error) {
        console.error("받은 좋아요 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatDate = (value: string) => {
    const date = new Date(value);
    return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}`;
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>내가 받은 좋아요</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="heart-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>아직 받은 좋아요가 없어요.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id;
            return (
              <Pressable onPress={() => toggleExpand(item.id)} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                  <View style={styles.headerRight}>
                    <View style={styles.likeBadge}>
                      <Ionicons name="heart" size={12} color={COLORS.heart} />
                      <Text style={styles.likeBadgeText}>{item.likes_count}</Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={COLORS.textMuted}
                    />
                  </View>
                </View>
                <Text style={styles.title}>{item.title ?? "제목 없는 기록"}</Text>
                {item.place_name && (
                  <Text style={styles.placeText}>📍 {item.place_name}</Text>
                )}
                {item.emotion && (
                  <View style={styles.emotionChip}>
                    <Text style={styles.emotionChipText}>
                      {EMOTION_LABEL[item.emotion] ?? item.emotion}
                    </Text>
                  </View>
                )}
                {isExpanded && item.content && (
                  <Text style={styles.contentText}>{item.content}</Text>
                )}
              </Pressable>
            );
          }}
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
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textMain },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyText: { fontSize: 13, color: COLORS.textMuted },
  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { fontSize: 12, color: COLORS.textMuted },
  likeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FDECE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  likeBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.heart },
  title: { fontSize: 16, fontWeight: "700", color: COLORS.textMain, marginBottom: 6 },
  placeText: { fontSize: 12, color: COLORS.textSub, marginBottom: 6 },
  emotionChip: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  emotionChipText: { fontSize: 11, fontWeight: "600", color: COLORS.primary },
  contentText: { fontSize: 13, lineHeight: 19, color: COLORS.textSub, marginTop: 4 },
});