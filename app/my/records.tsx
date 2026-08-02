import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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

const EMOTION_LABEL: Record<string, string> = {
  comfortable: "편안해요",
  joyful: "즐거워요",
  new: "새로워요",
  uncomfortable: "불편해요",
  unsure: "잘 모르겠어요",
};

type RecordItem = {
  id: string;
  content: string | null;
  emotion: string | null;
  recorded_at: string;
  mission_title: string;
  image_url: string | null;
  likes_count: number;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function RecordsScreen() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인 정보를 확인할 수 없습니다.");

      const { data, error } = await supabase
        .from("records")
        .select(`
          id,
          content,
          emotion,
          recorded_at,
          mission_attempts (
            missions ( title )
          ),
          record_photos (
            storage_path,
            sort_order,
            is_cover
          )
        `)
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      const recordIds = (data ?? []).map((item: any) => item.id);
      const likesCountMap: Record<string, number> = {};

      if (recordIds.length > 0) {
        const { data: likeRows } = await supabase
          .from("record_likes")
          .select("record_id")
          .in("record_id", recordIds);

        for (const row of likeRows ?? []) {
          likesCountMap[row.record_id] = (likesCountMap[row.record_id] ?? 0) + 1;
        }
      }

      const formattedData: RecordItem[] = await Promise.all(
        (data ?? []).map(async (item: any) => {
          const attempt = normalizeRelation(item.mission_attempts);
          const mission = normalizeRelation(attempt?.missions);

          const photos = (Array.isArray(item.record_photos) ? item.record_photos : [])
            .slice()
            .sort((a: any, b: any) => {
              if (Boolean(a.is_cover) !== Boolean(b.is_cover)) return a.is_cover ? -1 : 1;
              return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
            });

          let imageUrl: string | null = null;
          const coverPath = photos[0]?.storage_path;

          if (coverPath) {
            const { data: signedUrlData } = await supabase.storage
              .from("record-photos")
              .createSignedUrl(coverPath, 3600);
            imageUrl = signedUrlData?.signedUrl ?? null;
          }

          return {
            id: item.id,
            content: item.content,
            emotion: item.emotion,
            recorded_at: item.recorded_at,
            mission_title: mission?.title ?? "기록",
            image_url: imageUrl,
            likes_count: likesCountMap[item.id] ?? 0,
          };
        }),
      );

      setRecords(formattedData);
    } catch (error) {
      console.error("기록 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}`;
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderItem = ({ item }: { item: RecordItem }) => {
    const isExpanded = expandedId === item.id;
    const emotionLabel = item.emotion ? EMOTION_LABEL[item.emotion] ?? item.emotion : null;

    return (
      <View style={styles.recordCard}>
        <Pressable onPress={() => toggleExpand(item.id)} style={styles.summaryArea}>
          <View style={styles.summaryHeader}>
            <Text style={styles.dateText}>{formatDate(item.recorded_at)}</Text>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
          </View>

          <Text style={styles.missionTitle}>{item.mission_title}</Text>

          {emotionLabel && (
            <View style={styles.keywordContainer}>
              <View style={styles.keywordChip}>
                <Text style={styles.keywordText}>{emotionLabel}</Text>
              </View>
            </View>
          )}
        </Pressable>

        {isExpanded && (
          <View style={styles.detailArea}>
            <View style={styles.divider} />

            {item.image_url && (
              <Image source={{ uri: item.image_url }} style={styles.recordImage} />
            )}

            <Text style={styles.contentText}>
              {item.content || "작성된 내용이 없습니다."}
            </Text>

            <View style={styles.likesRow}>
              <Ionicons name="heart" size={16} color="#EF4444" />
              <Text style={styles.likesText}>받은 좋아요 {item.likes_count}개</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>기록 경험</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : records.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>아직 남긴 기록이 없어요.</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  recordCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  summaryArea: {},
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  dateText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  missionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textMain, marginBottom: 10 },
  keywordContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  keywordChip: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  keywordText: { fontSize: 11, fontWeight: "600", color: COLORS.primary },
  detailArea: { marginTop: 12 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 12 },
  recordImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12, backgroundColor: "#E5E7EB" },
  contentText: { fontSize: 14, lineHeight: 22, color: COLORS.textMain, marginBottom: 16 },
  likesRow: { flexDirection: "row", alignItems: "center" },
  likesText: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#EF4444" },
});