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

type PlaceRecord = {
  id: string;
  content: string | null;
  recorded_at: string;
  location_type: string | null;
};

export default function PlacesScreen() {
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      setIsLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("로그인 에러");

      // 장소 기록만 가져오는 쿼리 (location_type이 place거나 place_id가 null이 아닐 때)
      const { data, error } = await supabase
        .from("records")
        .select("id, content, recorded_at, location_type")
        .eq("user_id", user.id)
        .or("location_type.eq.place,place_id.not.is.null")
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      setPlaces(data || []);
    } catch (error) {
      console.error("발견 장소 불러오기 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}`;
  };

  const renderItem = ({ item }: { item: PlaceRecord }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.pinBadge}>
          <Ionicons name="location-sharp" size={14} color={COLORS.white} />
          <Text style={styles.pinText}>방문 완료</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(item.recorded_at)}</Text>
      </View>
      <Text style={styles.contentText} numberOfLines={3}>
        {item.content || "장소에 남긴 내용이 없습니다."}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>발견 장소</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>아직 발견한 장소가 없어요.</Text>
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  pinBadge: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pinText: { marginLeft: 4, fontSize: 11, fontWeight: "700", color: COLORS.white },
  dateText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  contentText: { fontSize: 14, lineHeight: 22, color: COLORS.textMain },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },
});