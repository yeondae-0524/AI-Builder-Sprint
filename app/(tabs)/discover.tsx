import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useMission } from "../_mission-context";

const BL = "#3D5AFE";
const BLL = "#EEF1FF";
const T0 = "#0F0F0F";
const T1 = "#5C5F6A";
const T2 = "#9EA3AE";
const T3 = "#E4E6EA";
const WH = "#FFFFFF";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_CLOSE_POSITION = SCREEN_HEIGHT * 0.6;

const FILTERS = ["가까운 기록", "최근 기록", "내 취향", "새로운 분야", "산책"];

const BUBBLES = [
  { id: 1, x: "26%", y: "22%", place: "연남동 카페 봄날", mission: "조용한 카페에서 30분 독서", time: "2일 전", nick: "소리의 탐험가", emotion: "차분함", note: "창가 자리에서 책 읽으니 딴 세상 같았어요.", likes: 12 },
  { id: 2, x: "58%", y: "35%", place: "경의선 숲길", mission: "공원 산책하며 계절 사진 찍기", time: "1일 전", nick: "산책러", emotion: "상쾌함", note: "노을 질 때가 진짜 예뻐요.", likes: 8 },
  { id: 3, x: "40%", y: "55%", place: "망원동 책방", mission: "동네 책방에서 한 페이지 읽기", time: "3시간 전", nick: "책방순례자", emotion: "설렘", note: "사장님이 추천해주신 책이 취향저격.", likes: 21, multi: true, count: 3 },
  { id: 4, x: "70%", y: "62%", place: "홍대 거리", mission: "버스킹 공연 5분 이상 감상하기", time: "5시간 전", nick: "귀호강", emotion: "즐거움", note: "우연히 들은 버스킹인데 목소리가 좋았어요.", likes: 15 },
];

const MAP_BLOCKS = [
  [8, 8, 63, 90, 0], [80, 8, 88, 90, 1], [177, 8, 94, 90, 2], [280, 8, 58, 90, 0], [346, 8, 44, 90, 1],
  [8, 108, 63, 80, 1], [80, 108, 88, 80, 2], [177, 108, 94, 80, 0], [280, 108, 58, 80, 1], [346, 108, 44, 80, 2],
  [8, 198, 63, 70, 2], [80, 198, 88, 70, 0], [177, 198, 50, 70, 1], [237, 198, 134, 70, 0], [280, 198, 110, 70, 2],
  [8, 278, 63, 90, 0], [80, 278, 88, 90, 1], [177, 278, 94, 90, 2], [280, 278, 58, 90, 0], [346, 278, 44, 90, 1],
  [8, 358, 63, 90, 0], [80, 358, 88, 90, 1], [177, 358, 94, 90, 2], [280, 358, 58, 90, 0], [346, 358, 44, 90, 1],
];
const MAP_COLORS = ["#D6DFE9", "#DAEACF", "#D8E2EE"];

export default function DiscoverScreen() {
  const [activeFilter, setActiveFilter] = useState("가까운 기록");
  const [activeBubble, setActiveBubble] = useState(null);
  const [sheetBubble, setSheetBubble] = useState(null);
  const [liked, setLiked] = useState([]);

  const { mainMission, setMainMission } = useMission();

  const sheetTranslateY = useRef(new Animated.Value(SHEET_CLOSE_POSITION)).current;
  const dragStart = useRef(0);

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

  const webDragStyle =
    Platform.OS === "web" ? { touchAction: "none", cursor: "grab" } : undefined;

  const handleTryMission = () => {
    if (!sheetBubble) return;
    setMainMission({
      id: `bubble-${sheetBubble.id}`,
      title: sheetBubble.mission,
      desc: sheetBubble.note,
      time: "20분",
      dist: "-",
      cost: "-",
      cat: sheetBubble.emotion,
    });
    Alert.alert("메인 미션으로 설정했어요", "홈 탭에서 확인할 수 있어요.");
    closeSheet();
  };

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 400 450" preserveAspectRatio="xMidYMid slice">
          <Rect width="400" height="450" fill="#E4EBF3" />
          {MAP_BLOCKS.map(([x, y, w, h, ci], i) => (
            <Rect key={i} x={x} y={y} width={w} height={h} rx={4} fill={MAP_COLORS[ci]} />
          ))}
        </Svg>
      </View>

      {BUBBLES.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => setActiveBubble(activeBubble?.id === b.id ? null : b)}
          style={[styles.bubble, { left: b.x, top: b.y }, activeBubble?.id === b.id && styles.bubbleActive]}
        >
          {b.multi && <Text style={{ fontSize: 10, color: T1 }}>+{b.count}</Text>}
        </Pressable>
      ))}

      <View style={styles.topBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <Text style={{ fontSize: 13, color: T2 }}>장소나 지역 검색</Text>
          </View>
          <Pressable style={styles.filterIconBtn}>
            <Text style={{ fontSize: 14 }}>≡</Text>
          </Pressable>
        </View>
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

            {mainMission?.id === `bubble-${sheetBubble.id}` ? (
              <View style={styles.pinnedBadge}>
                <Text style={{ color: BL, fontSize: 12, fontWeight: "700" }}>✓ 메인 미션으로 설정됨</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Pressable style={styles.primaryBtn} onPress={handleTryMission}>
                  <Text style={{ color: WH, fontSize: 13, fontWeight: "700" }}>나도 해볼래요</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn}>
                  <Text style={{ color: T1, fontSize: 13 }}>저장</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", backgroundColor: "#DFE8F0" },
  bubble: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: T3,
    borderWidth: 3,
    borderColor: WH,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleActive: { borderColor: BL },
  topBar: { position: "absolute", top: 52, left: 16, right: 16 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, backgroundColor: WH, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  filterIconBtn: { width: 44, backgroundColor: WH, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chip: { backgroundColor: WH, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  chipActive: { backgroundColor: BL },
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
  pinnedBadge: { marginTop: 8, backgroundColor: BLL, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
});