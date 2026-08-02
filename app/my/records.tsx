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

// my.tsx에서 쓰던 컬러 파레트 통일
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

type RecordItem = {
  id: string;
  content: string | null;
  emotion: string | null;
  recorded_at: string;
  location_type: string | null;
};

export default function RecordsScreen() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 화면이 켜지면 데이터를 불러옵니다.
  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      
      // 1. 현재 로그인한 내 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인 정보를 확인할 수 없습니다.");

      // 2. records 테이블에서 내 기록만 최신순(내림차순)으로 가져오기
      const { data, error } = await supabase
        .from("records")
        .select("id, content, emotion, recorded_at, location_type")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      setRecords(data || []);
    } catch (error) {
      console.error("기록을 불러오는 중 오류 발생:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 날짜 예쁘게 포맷팅 해주는 함수 (예: 2026. 08. 02)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}. ${month}. ${day}`;
  };

  // 각각의 카드(기록)를 어떻게 그릴지 정의
  const renderItem = ({ item }: { item: RecordItem }) => (
    <View style={styles.recordCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.dateText}>{formatDate(item.recorded_at)}</Text>
        
        {/* 감정(emotion) 데이터가 있으면 뱃지로 띄워줌 */}
        {item.emotion && (
          <View style={styles.emotionBadge}>
            <Text style={styles.emotionText}>{item.emotion}</Text>
          </View>
        )}
      </View>
      <Text style={styles.contentText} numberOfLines={4}>
        {item.content || "작성된 내용이 없습니다."}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* 🟢 상단 헤더 영역 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()} // 누르면 이전 화면(MY탭)으로 돌아감
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>기록 경험</Text>
        <View style={{ width: 24 }} /> {/* 타이틀을 정가운데로 맞추기 위한 빈 공간 */}
      </View>

      {/* 🟢 메인 리스트 영역 */}
      {isLoading ? (
        // 로딩 중일 때 뱅글뱅글 아이콘 표시
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        // 로딩 끝났을 때 FlatList로 카드 리스트 주루룩 뿌려주기
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // 데이터가 0개일 때 보여줄 화면
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>아직 작성된 기록이 없어요.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: 4,
  },
  pressed: {
    opacity: 0.6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  recordCard: {
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
    marginBottom: 12,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  emotionBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emotionText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textMain,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
});