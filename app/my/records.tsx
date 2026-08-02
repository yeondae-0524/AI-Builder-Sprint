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

type RecordItem = {
  id: string;
  content: string | null;
  emotion: string | null;
  recorded_at: string;
  mission_title: string | null; // 임시: 미션 이름
  keywords: string[]; // 임시: 키워드 배열
  image_url: string | null; // 임시: 사진
  likes_count: number; // 임시: 받은 좋아요
};

export default function RecordsScreen() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null); // 👈 더보기(펼침) 상태 관리

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인 정보를 확인할 수 없습니다.");

      // TODO: 실제 테이블 구조에 맞게 조인(join)을 수정해야 할 수 있습니다. 
      // 일단 records 기준으로 가져옵니다.
      const { data, error } = await supabase
        .from("records")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      // 백엔드 구조가 아직 완벽히 연결 안 된 데이터(키워드, 사진 등)는 가짜 데이터로 매핑
      const formattedData = (data || []).map(item => ({
        id: item.id,
        content: item.content,
        emotion: item.emotion,
        recorded_at: item.recorded_at,
        mission_title: "테스트 미션 이름", // 연결 필요
        keywords: ["comfortable", "new", "unsure"], // 연결 필요
        image_url: null, // 연결 필요
        likes_count: 5, // 연결 필요
      }));

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

  // 더보기 버튼 누르면 열리고 닫히는 함수
  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const renderItem = ({ item }: { item: RecordItem }) => {
    const isExpanded = expandedId === item.id; // 현재 이 카드가 열려있는지 확인

    return (
      <View style={styles.recordCard}>
        {/* 🟢 항상 보이는 요약 영역 */}
        <Pressable onPress={() => toggleExpand(item.id)} style={styles.summaryArea}>
          <View style={styles.summaryHeader}>
            <Text style={styles.dateText}>{formatDate(item.recorded_at)}</Text>
            {/* 더보기 화살표 아이콘 */}
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
          </View>
          
          <Text style={styles.missionTitle}>{item.mission_title}</Text>
          
          <View style={styles.keywordContainer}>
            {item.keywords.map((kw, index) => (
              <View key={index} style={styles.keywordChip}>
                <Text style={styles.keywordText}>{kw}</Text>
              </View>
            ))}
          </View>
        </Pressable>

        {/* 🟢 더보기(화살표) 눌렀을 때만 펼쳐지는 상세 영역 */}
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
  
  // 카드 스타일
  recordCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  summaryArea: {},
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  dateText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  missionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textMain, marginBottom: 10 },
  keywordContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  keywordChip: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  keywordText: { fontSize: 11, fontWeight: "600", color: COLORS.primary },
  
  // 펼침(상세) 영역 스타일
  detailArea: { marginTop: 12 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 12 },
  recordImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12, backgroundColor: "#E5E7EB" },
  contentText: { fontSize: 14, lineHeight: 22, color: COLORS.textMain, marginBottom: 16 },
  likesRow: { flexDirection: "row", alignItems: "center" },
  likesText: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#EF4444" },
});