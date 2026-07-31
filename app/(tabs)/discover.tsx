import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KakaoMapView } from "../../components/KakaoMapView";
import { useMission } from "../../contexts/mission-context";

const BL = "#3D5AFE";
const BLL = "#EEF1FF";
const PINK = "#EC4899";
const T0 = "#0F0F0F";
const T1 = "#5C5F6A";
const T2 = "#9EA3AE";
const T3 = "#E4E6EA";
const WH = "#FFFFFF";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_CLOSE_POSITION = SCREEN_HEIGHT * 0.6;

const DEFAULT_CENTER = { lat: 35.1795543, lng: 129.0756416 };

const FILTERS = ["가까운 기록", "최근 기록", "내 취향", "새로운 분야", "산책"];

// TODO: place.service.ts 완성되면 이 하드코딩 데이터를 실제 기록 조회로 교체
const BUBBLES = [
  {
    id: "bubble-1",
    place: "연남동 카페 봄날",
    lat: 35.1795543,
    lng: 129.0806416,
    mission: "조용한 카페에서 30분 독서",
    time: "2일 전",
    nick: "소리의 탐험가",
    emotion: "차분함",
    note: "창가 자리에서 책 읽으니 딴 세상 같았어요.",
    likes: 12,
    category: "휴식",
    photo: "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=200&h=200&fit=crop",
  },
  {
    id: "bubble-2",
    place: "경의선 숲길",
    lat: 35.1825543,
    lng: 129.0756416,
    mission: "공원 산책하며 계절 사진 찍기",
    time: "1일 전",
    nick: "산책러",
    emotion: "상쾌함",
    note: "노을 질 때가 진짜 예뻐요.",
    likes: 8,
    category: "산책",
    photo: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&h=200&fit=crop",
  },
  {
    id: "bubble-3",
    place: "망원동 책방",
    lat: 35.1765543,
    lng: 129.0716416,
    mission: "동네 책방에서 한 페이지 읽기",
    time: "3시간 전",
    nick: "책방순례자",
    emotion: "설렘",
    note: "사장님이 추천해주신 책이 취향저격.",
    likes: 21,
    multi: true,
    count: 3,
    category: "배움",
    photo: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=200&h=200&fit=crop",
  },
  {
    id: "bubble-4",
    place: "홍대 거리",
    lat: 35.1815543,
    lng: 129.0806416,
    mission: "버스킹 공연 5분 이상 감상하기",
    time: "5시간 전",
    nick: "귀호강",
    emotion: "즐거움",
    note: "우연히 들은 버스킹인데 목소리가 좋았어요.",
    likes: 15,
    category: "감상",
    photo: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop",
  },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const { shareMissionToHome } = useMission();

  const [activeFilter, setActiveFilter] = useState("가까운 기록");
  const [activeBubble, setActiveBubble] = useState(null);
  const [sheetBubble, setSheetBubble] = useState(null);
  const [liked, setLiked] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareContent, setShareContent] = useState("");

  const sheetTranslateY = useRef(new Animated.Value(SHEET_CLOSE_POSITION)).current;
  const dragStart = useRef(0);

  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const btnScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return BUBBLES.filter((b) => b.place.includes(searchQuery.trim()));
  }, [searchQuery]);

  useEffect(() => {
    if (activeBubble) {
      setSheetBubble(activeBubble);
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
      }).start();
    }
  }, [activeBubble]);

  const closeSheet = () => {
    Animated.timing(sheetTranslateY, {
      toValue: SHEET_CLOSE_POSITION,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setActiveBubble(null);
      setSheetBubble(null);
    });
  };

  const openSheet = () => {
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((v) => {
          dragStart.current = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        const next = Math.max(0, dragStart.current + g.dy);
        sheetTranslateY.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(0, dragStart.current + g.dy);
        if (current > 120 || g.vy > 0.6) {
          closeSheet();
        } else {
          openSheet();
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const webDragStyle = Platform.OS === "web" ? { touchAction: "none", cursor: "grab" } : undefined;

  const handleTryMission = () => {
    if (!sheetBubble) return;

    shareMissionToHome({
      id: sheetBubble.id,
      title: sheetBubble.mission,
      desc: sheetBubble.note,
      instructions: sheetBubble.note,
      recommendationReason: `${sheetBubble.nick}님이 "${sheetBubble.emotion}"을 느낀 곳이에요`,
      time: "20분",
      dist: "-",
      cost: "-",
      cat: sheetBubble.category,
      requiredItems: [],
      placeLat: sheetBubble.lat,
      placeLng: sheetBubble.lng,
      placeName: sheetBubble.place,
    });

    closeSheet();
    router.push("/");
  };

  const handleSelectSearchResult = (bubble) => {
    setMapCenter({ lat: bubble.lat, lng: bubble.lng });
    setActiveBubble(bubble);
    setSearchQuery("");
    Keyboard.dismiss();
  };

  const handleShareSubmit = () => {
    // TODO: place.service / records.service 연동 후 실제 저장 로직 연결
    Alert.alert("준비 중이에요", "장소 공유 기능은 백엔드 연동 후 활성화돼요.");
    setShareContent("");
    setShareModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        markers={BUBBLES.map((b) => ({
          id: b.id,
          lat: b.lat,
          lng: b.lng,
          photo: b.photo,
          count: b.multi ? b.count : undefined,
        }))}
        onMarkerPress={(id) => {
          const bubble = BUBBLES.find((b) => b.id === id);
          if (bubble) setActiveBubble(bubble);
        }}
      />

      <View style={styles.topBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="장소나 지역 검색"
              placeholderTextColor={T2}
              style={styles.searchTextInput}
              returnKeyType="search"
            />
          </View>
          <Pressable style={styles.filterIconBtn}>
            <Text style={{ fontSize: 14 }}>≡</Text>
          </Pressable>
        </View>

        {searchQuery.trim().length > 0 && (
          <View style={styles.searchDropdown}>
            {searchResults.length > 0 ? (
              searchResults.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => handleSelectSearchResult(b)}
                  style={({ pressed }) => [styles.searchResultRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.searchResultThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultPlace}>{b.place}</Text>
                    <Text style={styles.searchResultMission}>{b.mission}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.searchEmptyText}>"{searchQuery}"에 대한 검색 결과가 없어요</Text>
            )}
          </View>
        )}

        {searchQuery.trim().length === 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[styles.chip, activeFilter === f && styles.chipActive]}
              >
                <Text style={{ fontSize: 11, color: activeFilter === f ? WH : T1, fontWeight: activeFilter === f ? "700" : "400" }}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {sheetBubble && (
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={[styles.dragArea, webDragStyle]} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <View style={styles.sheetPhoto} />
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{sheetBubble.mission}</Text>
                <Text style={styles.sheetMeta}>
                  {sheetBubble.place} · {sheetBubble.time} · {sheetBubble.nick}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  setLiked((l) => (l.includes(sheetBubble.id) ? l.filter((x) => x !== sheetBubble.id) : [...l, sheetBubble.id]))
                }
                style={{ alignItems: "center" }}
              >
                <Text style={{ fontSize: 16 }}>{liked.includes(sheetBubble.id) ? "♥" : "♡"}</Text>
                <Text style={{ fontSize: 11, color: T2 }}>
                  {sheetBubble.likes + (liked.includes(sheetBubble.id) ? 1 : 0)}
                </Text>
              </Pressable>
            </View>
            <View style={styles.emotionTag}>
              <Text style={{ fontSize: 11, color: BL, fontWeight: "700" }}>{sheetBubble.emotion}</Text>
            </View>
            <Text style={styles.note}>"{sheetBubble.note}"</Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable style={styles.primaryBtn} onPress={handleTryMission}>
                <Text style={{ color: WH, fontSize: 13, fontWeight: "700" }}>나도 해볼래요</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn}>
                <Text style={{ color: T1, fontSize: 13 }}>저장</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Animated.View
          style={[styles.fabGlow, { transform: [{ scale: glowScale }], opacity: glowOpacity }]}
        />
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable style={styles.fabBtn} onPress={() => setShareModalVisible(true)}>
            <Ionicons name="search" size={17} color={WH} />
          </Pressable>
        </Animated.View>
      </View>

      <Modal visible={shareModalVisible} transparent animationType="slide" onRequestClose={() => setShareModalVisible(false)}>
        <View style={styles.shareOverlay}>
          <View style={styles.shareSheet}>
            <Text style={styles.shareTitle}>이 장소를 공유해요</Text>
            <TextInput
              value={shareContent}
              onChangeText={setShareContent}
              placeholder="어떤 경험이었는지 적어보세요"
              placeholderTextColor={T2}
              multiline
              style={styles.shareInput}
            />
            <Pressable style={styles.shareSubmitBtn} onPress={handleShareSubmit}>
              <Text style={styles.shareSubmitText}>공유하기</Text>
            </Pressable>
            <Pressable onPress={() => setShareModalVisible(false)} style={{ alignItems: "center", marginTop: 10 }}>
              <Text style={{ color: T2, fontSize: 12 }}>취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", backgroundColor: "#DFE8F0" },
  topBar: { position: "absolute", top: 52, left: 16, right: 16, zIndex: 10, elevation: 10 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, backgroundColor: WH, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" },
  searchTextInput: { fontSize: 13, color: T0, paddingVertical: 10 },
  filterIconBtn: { width: 44, backgroundColor: WH, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chip: { backgroundColor: WH, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  chipActive: { backgroundColor: BL },
  searchDropdown: {
    backgroundColor: WH,
    borderRadius: 12,
    paddingVertical: 4,
    maxHeight: 260,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  searchResultRow: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  searchResultThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: T3 },
  searchResultPlace: { fontSize: 13, fontWeight: "600", color: T0 },
  searchResultMission: { fontSize: 11, color: T1, marginTop: 2 },
  searchEmptyText: { padding: 14, fontSize: 12, color: T2, textAlign: "center" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WH,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 100,
  },
  dragArea: { height: 40, alignItems: "center", justifyContent: "center" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T3 },
  sheetPhoto: { width: "100%", height: 176, borderRadius: 14, backgroundColor: T3, marginBottom: 14 },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: T0, marginBottom: 3 },
  sheetMeta: { fontSize: 11, color: T2 },
  emotionTag: { alignSelf: "flex-start", backgroundColor: BLL, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 9, marginBottom: 10 },
  note: { fontSize: 13, color: T1, lineHeight: 20, marginBottom: 16 },
  primaryBtn: { flex: 1, backgroundColor: BL, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  secondaryBtn: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },

  fabWrap: {
    position: "absolute",
    right: 30,
    bottom: 66,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  fabGlow: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PINK,
  },
  fabBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: WH,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },

  shareOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  shareSheet: { backgroundColor: WH, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  shareTitle: { fontSize: 16, fontWeight: "700", color: T0, marginBottom: 14 },
  shareInput: { minHeight: 90, backgroundColor: "#F7F8FA", borderRadius: 12, padding: 12, fontSize: 13, color: T0, textAlignVertical: "top", marginBottom: 16 },
  shareSubmitBtn: { backgroundColor: PINK, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  shareSubmitText: { color: WH, fontSize: 14, fontWeight: "700" },
});