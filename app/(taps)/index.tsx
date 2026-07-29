import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const BL = "#3D5AFE";
const BLL = "#EEF1FF";
const T0 = "#0F0F0F";
const T1 = "#5C5F6A";
const T2 = "#9EA3AE";
const T3 = "#E4E6EA";
const WH = "#FFFFFF";
const BG = "#F7F8FA";

// 백엔드 API 주소 (나중에 실제 주소로 교체)
const API_URL = "http://localhost:3000";

// 임시 fallback 데이터 — API 연결 전이거나 실패했을 때 이거라도 보여줌
const FALLBACK_MISSIONS = [
  { id: 1, title: "조용한 카페에서 30분 독서", desc: "일상 속 작은 고요함을 찾아봐요", time: "30분", dist: "0.3km", cost: "무료", cat: "독서", star: true },
  { id: 2, title: "공원 산책하며 계절 사진 찍기", desc: "지금 계절의 색을 카메라에 담아봐요", time: "20분", dist: "0.5km", cost: "무료", cat: "산책" },
  { id: 3, title: "처음 가는 빵집에서 새로운 빵 먹기", desc: "낯선 맛과의 작은 만남", time: "15분", dist: "0.7km", cost: "3,000원", cat: "휴식" },
  { id: 4, title: "버스킹 공연 5분 이상 감상하기", desc: "길 위의 음악에 귀 기울여봐요", time: "10분", dist: "1.2km", cost: "무료", cat: "음악" },
];

export default function HomeScreen() {
  const [missions, setMissions] = useState(FALLBACK_MISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/missions`)
      .then((res) => res.json())
      .then((data) => setMissions(data))
      .catch((err) => {
        console.log("미션 API 연결 실패, 임시 데이터 사용:", err.message);
        // 실패해도 FALLBACK_MISSIONS 그대로 유지
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={{ color: T2, fontSize: 12 }}>지도 영역 (추후 연동)</Text>
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>오늘의 추천 미션</Text>
            <Text style={styles.sheetSub}>취향을 반영한 {missions.length}가지 미션</Text>
          </View>
          <Pressable style={styles.conditionBtn}>
            <Text style={{ color: BL, fontSize: 11, fontWeight: "700" }}>조건 설정</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={BL} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
            {missions.map((m, i) => (
              <View key={m.id} style={styles.card}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={styles.thumb} />
                  <View style={{ flex: 1 }}>
                    <View
                      style={[
                        styles.tag,
                        { backgroundColor: m.star ? "#FEF3C7" : BLL },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: m.star ? "#D97706" : BL,
                        }}
                      >
                        {m.star ? "★ 추천" : m.cat}
                      </Text>
                    </View>
                    <Text style={styles.cardTitle}>{m.title}</Text>
                    <Text style={styles.cardDesc}>{m.desc}</Text>
                    <Text style={styles.cardMeta}>
                      {m.time}  {m.dist}  {m.cost}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable
                    style={[styles.selectBtn, i === 0 && { backgroundColor: BL }]}
                  >
                    <Text style={{ color: i === 0 ? WH : T1, fontSize: 12, fontWeight: "700" }}>
                      이 미션 선택
                    </Text>
                  </Pressable>
                  <Pressable style={styles.detailBtn}>
                    <Text style={{ color: T1, fontSize: 12 }}>자세히 보기</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  mapPlaceholder: { height: 300, backgroundColor: "#DFE8F0", alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, backgroundColor: WH, borderTopLeftRadius: 22, borderTopRightRadius: 22, marginTop: -20, paddingTop: 10 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: T0 },
  sheetSub: { fontSize: 12, color: T2, marginTop: 2 },
  conditionBtn: { backgroundColor: BLL, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignSelf: "flex-start" },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: BG, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: T3 },
  tag: { alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 9, borderRadius: 7, marginBottom: 4 },
  cardTitle: { fontSize: 13, fontWeight: "600", color: T0, marginTop: 2 },
  cardDesc: { fontSize: 11, color: T1, marginTop: 3 },
  cardMeta: { fontSize: 11, color: T1, marginTop: 6 },
  selectBtn: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  detailBtn: { flex: 1, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
});