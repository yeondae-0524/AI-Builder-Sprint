import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const BL = "#3D5AFE";
const BLL = "#EEF1FF";
const T0 = "#0F0F0F";
const T1 = "#5C5F6A";
const T2 = "#9EA3AE";
const T3 = "#E4E6EA";
const WH = "#FFFFFF";

const FILTERS = ["가까운 기록", "최근 기록", "내 취향", "새로운 분야", "산책"];

// 임시 fallback 데이터 — 실제로는 백엔드에서 위치 기반으로 받아와야 함
const BUBBLES = [
  { id: 1, x: "26%", y: "22%", place: "연남동 카페 봄날", mission: "조용한 카페에서 30분 독서", time: "2일 전", nick: "소리의 탐험가", emotion: "차분함", note: "창가 자리에서 책 읽으니 딴 세상 같았어요.", likes: 12 },
  { id: 2, x: "58%", y: "35%", place: "경의선 숲길", mission: "공원 산책하며 계절 사진 찍기", time: "1일 전", nick: "산책러", emotion: "상쾌함", note: "노을 질 때가 진짜 예뻐요.", likes: 8 },
  { id: 3, x: "40%", y: "55%", place: "망원동 책방", mission: "동네 책방에서 한 페이지 읽기", time: "3시간 전", nick: "책방순례자", emotion: "설렘", note: "사장님이 추천해주신 책이 취향저격.", likes: 21, multi: true, count: 3 },
  { id: 4, x: "70%", y: "62%", place: "홍대 거리", mission: "버스킹 공연 5분 이상 감상하기", time: "5시간 전", nick: "귀호강", emotion: "즐거움", note: "우연히 들은 버스킹인데 목소리가 좋았어요.", likes: 15 },
];

export default function DiscoverScreen() {
  const [activeFilter, setActiveFilter] = useState("가까운 기록");
  const [activeBubble, setActiveBubble] = useState(null);
  const [liked, setLiked] = useState([]);

  return (
    <View style={styles.container}>
      {/* 지도 영역 (추후 react-native-maps 연동) */}
      <View style={styles.mapPlaceholder}>
        {BUBBLES.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => setActiveBubble(activeBubble?.id === b.id ? null : b)}
            style={[
              styles.bubble,
              { left: b.x, top: b.y },
              activeBubble?.id === b.id && styles.bubbleActive,
            ]}
          >
            <Text style={{ fontSize: 10, color: T1 }}>{b.multi ? `+${b.count}` : ""}</Text>
          </Pressable>
        ))}
      </View>

      {/* 검색 + 필터 (지도 위에 얹힘) */}
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

      {/* 버블 눌렀을 때 하단 상세 시트 */}
      {activeBubble && (
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <View style={styles.sheetPhoto} />
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{activeBubble.mission}</Text>
                <Text style={styles.sheetMeta}>
                  {activeBubble.place} · {activeBubble.time} · {activeBubble.nick}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  setLiked((l) =>
                    l.includes(activeBubble.id) ? l.filter((x) => x !== activeBubble.id) : [...l, activeBubble.id]
                  )
                }
                style={{ alignItems: "center" }}
              >
                <Text style={{ fontSize: 16 }}>{liked.includes(activeBubble.id) ? "♥" : "♡"}</Text>
                <Text style={{ fontSize: 11, color: T2 }}>
                  {activeBubble.likes + (liked.includes(activeBubble.id) ? 1 : 0)}
                </Text>
              </Pressable>
            </View>
            <View style={styles.emotionTag}>
              <Text style={{ fontSize: 11, color: BL, fontWeight: "700" }}>{activeBubble.emotion}</Text>
            </View>
            <Text style={styles.note}>"{activeBubble.note}"</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable style={styles.primaryBtn}>
                <Text style={{ color: WH, fontSize: 13, fontWeight: "700" }}>나도 해볼래요</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn}>
                <Text style={{ color: T1, fontSize: 13 }}>저장</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#DFE8F0" },
  mapPlaceholder: { flex: 1, position: "relative" },
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
  searchInput: {
    flex: 1,
    backgroundColor: WH,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  filterIconBtn: {
    width: 44,
    backgroundColor: WH,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    backgroundColor: WH,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
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
  handle: { alignSelf: "center", width: 32, height: 4, borderRadius: 2, backgroundColor: T3, marginTop: 10, marginBottom: 6 },
  sheetPhoto: { width: "100%", height: 176, borderRadius: 14, backgroundColor: T3, marginBottom: 14 },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: T0, marginBottom: 3 },
  sheetMeta: { fontSize: 11, color: T2 },
  emotionTag: { alignSelf: "flex-start", backgroundColor: BLL, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 9, marginBottom: 10 },
  note: { fontSize: 13, color: T1, lineHeight: 20, marginBottom: 16 },
  primaryBtn: { flex: 1, backgroundColor: BL, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  secondaryBtn: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
});