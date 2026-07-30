import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { Mission as BackendMission } from "../../services/challenge.service";
import { createJourney, getActiveJourney } from "../../services/journey.service";
import {
  getActiveMissionAttempt,
  selectMission,
  startMission,
} from "../../services/mission-attempt.service";
import { Mission, useMission } from "../_mission-context";
import { KakaoMapView } from "./_kakao-map";
import { RecordModal } from "./_record-modal";

const BL = "#3D5AFE";
const BLL = "#EEF1FF";
const PINK = "#EC4899";
const PINKL = "#FCE7F3";
const T0 = "#0F0F0F";
const T1 = "#5C5F6A";
const T2 = "#9EA3AE";
const T3 = "#E4E6EA";
const WH = "#FFFFFF";
const BG = "#F7F8FA";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT - 90;
const TAB_BAR_SPACE = 105;
const COLLAPSED_HEADER_HEIGHT = 100;
const COLLAPSED_VISIBLE_HEIGHT = TAB_BAR_SPACE + COLLAPSED_HEADER_HEIGHT;
const COLLAPSED_POSITION = SHEET_HEIGHT - COLLAPSED_VISIBLE_HEIGHT;

const DEFAULT_CENTER = { lat: 35.1795543, lng: 129.0756416 };

const FALLBACK_MISSIONS: Mission[] = [
  { id: 1, title: "조용한 카페에서 30분 독서", desc: "일상 속 작은 고요함을 찾아봐요", time: "30분", dist: "0.3km", cost: "무료", cat: "독서", star: true },
  { id: 2, title: "공원 산책하며 계절 사진 찍기", desc: "지금 계절의 색을 카메라에 담아봐요", time: "20분", dist: "0.5km", cost: "무료", cat: "산책" },
  { id: 3, title: "처음 가는 빵집에서 새로운 빵 먹기", desc: "낯선 맛과의 작은 만남", time: "15분", dist: "0.7km", cost: "3,000원", cat: "휴식" },
  { id: 4, title: "버스킹 공연 5분 이상 감상하기", desc: "길 위의 음악에 귀 기울여봐요", time: "10분", dist: "1.2km", cost: "무료", cat: "음악" },
];

function mapBackendMission(bm: BackendMission): Mission {
  return {
    id: bm.id,
    title: bm.title,
    desc: bm.short_description,
    time: bm.estimated_duration_min ? `${bm.estimated_duration_min}분` : "-",
    dist: "-",
    cost:
      bm.estimated_cost == null || bm.estimated_cost === 0
        ? "무료"
        : `${bm.estimated_cost.toLocaleString()}원`,
    cat: bm.category?.name ?? "기타",
    star: false,
    placeLat: bm.place_lat ?? undefined,
    placeLng: bm.place_lng ?? undefined,
    placeName: bm.place_name ?? undefined,
    badgeIds: bm.badge_ids ?? [],
    recommendationReason: bm.recommendation_reason ?? undefined,
    requiredItems: bm.required_items ?? [],
  };
}

function getWalkInfo(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  const minutes = Math.max(1, Math.round((distanceKm / 4) * 60));
  return { distanceKm, minutes };
}

export default function HomeScreen() {
  const [missions, setMissions] = useState<Mission[]>(FALLBACK_MISSIONS);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [expandedMissionId, setExpandedMissionId] = useState<string | number | null>(null);
  const [startingMission, setStartingMission] = useState(false);
  const [recordTarget, setRecordTarget] = useState<{ attemptId: string; title: string } | null>(null);

  const { activeAttempts, addActiveAttempt } = useMission();

  const sheetTranslateY = useRef(new Animated.Value(COLLAPSED_POSITION)).current;
  const dragStartPosition = useRef(COLLAPSED_POSITION);

  useEffect(() => {
    const restoreAttempts = async () => {
      try {
        const attempt = await getActiveMissionAttempt();
        if (attempt && attempt.missions) {
          addActiveAttempt({
            attemptId: attempt.id,
            journeyId: attempt.journey_id,
            missionId: attempt.mission_id,
            title: attempt.missions.title,
            placeName: attempt.places ? attempt.places.name : undefined,
          });
        }
      } catch (error) {
        console.log("진행 중인 미션 복원 실패:", error instanceof Error ? error.message : error);
      }
    };
    restoreAttempts();
  }, []);

  useEffect(() => {
    const fetchMissions = async () => {
      try {
        let latitude: number | undefined;
        let longitude: number | undefined;

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
          setUserLocation({ lat: latitude, lng: longitude });
        }

        const { data, error } = await supabase.functions.invoke("clever-task", {
          body: {
            category: "휴식",
            cost: "무료/유료",
            locationType: "실내/실외",
            latitude,
            longitude,
          },
        });

        if (error) throw error;
        const fetchedMissions: BackendMission[] = data?.missions ?? [];
        if (fetchedMissions.length > 0) {
          setMissions(fetchedMissions.map(mapBackendMission));
        }
      } catch (error) {
        console.log(
          "AI 미션 추천 실패, 임시 데이터 사용:",
          error instanceof Error ? error.message : error
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMissions();
  }, []);

  const moveSheet = (destination: number) => {
    dragStartPosition.current = destination;
    Animated.spring(sheetTranslateY, {
      toValue: destination,
      useNativeDriver: true,
      damping: 24,
      stiffness: 190,
      mass: 0.9,
      overshootClamping: true,
    }).start();
  };

  const toggleSheet = () => {
    sheetTranslateY.stopAnimation((currentPosition) => {
      const isCollapsed = currentPosition > COLLAPSED_POSITION / 2;
      moveSheet(isCollapsed ? 0 : COLLAPSED_POSITION);
    });
  };

  const finishDrag = (currentPosition: number, velocityY: number) => {
    if (velocityY < -0.35) {
      moveSheet(0);
      return;
    }
    if (velocityY > 0.35) {
      moveSheet(COLLAPSED_POSITION);
      return;
    }
    const shouldExpand = currentPosition < COLLAPSED_POSITION / 2;
    moveSheet(shouldExpand ? 0 : COLLAPSED_POSITION);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((currentPosition) => {
          dragStartPosition.current = currentPosition;
        });
      },
      onPanResponderMove: (_e, g) => {
        const nextPosition = dragStartPosition.current + g.dy;
        const limitedPosition = Math.max(0, Math.min(nextPosition, COLLAPSED_POSITION));
        sheetTranslateY.setValue(limitedPosition);
      },
      onPanResponderRelease: (_e, g) => {
        const currentPosition = Math.max(0, Math.min(dragStartPosition.current + g.dy, COLLAPSED_POSITION));
        if (Math.abs(g.dy) < 5) {
          toggleSheet();
          return;
        }
        finishDrag(currentPosition, g.vy);
      },
      onPanResponderTerminate: (_e, g) => {
        const currentPosition = Math.max(0, Math.min(dragStartPosition.current + g.dy, COLLAPSED_POSITION));
        finishDrag(currentPosition, g.vy);
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  const webDragStyle =
    Platform.OS === "web" ? ({ touchAction: "none", userSelect: "none", cursor: "grab" } as any) : undefined;

  const isStarted = (missionId: string | number) => {
    return activeAttempts.some((a) => a.missionId === missionId);
  };

  const handleStartMission = async (mission: Mission) => {
    setStartingMission(true);
    try {
      let journey = await getActiveJourney();
      if (!journey) {
        journey = await createJourney({ durationDays: 14 });
      }
      const attemptId = await selectMission({
        journeyId: journey.id,
        missionId: String(mission.id),
      });
      await startMission(attemptId);
      addActiveAttempt({
        attemptId: attemptId,
        journeyId: journey.id,
        missionId: mission.id,
        title: mission.title,
        placeName: mission.placeName,
      });
      setExpandedMissionId(null);
    } catch (error) {
      Alert.alert("미션 시작 실패", error instanceof Error ? error.message : "오류가 발생했어요.");
    } finally {
      setStartingMission(false);
    }
  };

  const openDirections = (mission: Mission) => {
    if (!mission.placeLat || !mission.placeLng) return;
    const placeLabel = mission.placeName ? mission.placeName : mission.title;
    const url = "https://map.kakao.com/link/to/" + encodeURIComponent(placeLabel) + "," + mission.placeLat + "," + mission.placeLng;
    Linking.openURL(url).catch(() => {
      Alert.alert("길찾기 실패", "지도 앱을 열 수 없어요.");
    });
  };

  const expandedMission = missions.find((m) => m.id === expandedMissionId) || null;

  let mapCenter = userLocation || DEFAULT_CENTER;
  if (expandedMission && expandedMission.placeLat && expandedMission.placeLng) {
    mapCenter = { lat: expandedMission.placeLat, lng: expandedMission.placeLng };
  }

  let walkInfo = null;
  if (expandedMission && expandedMission.placeLat && expandedMission.placeLng && userLocation) {
    walkInfo = getWalkInfo(userLocation.lat, userLocation.lng, expandedMission.placeLat, expandedMission.placeLng);
  }

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        style={styles.mapPlaceholder}
        userLocation={userLocation}
        markers={missions
          .filter((m) => m.placeLat && m.placeLng)
          .map((m) => ({
            id: m.id,
            lat: m.placeLat,
            lng: m.placeLng,
            label: m.title,
            category: m.cat,
          }))}
      />

      {expandedMission && walkInfo && (
        <View style={styles.walkInfoBar}>
          <Text style={styles.walkInfoText}>
            도보 {walkInfo.minutes}분 · {walkInfo.distanceKm.toFixed(1)}km
          </Text>
          <Pressable style={styles.directionsBtn} onPress={() => openDirections(expandedMission)}>
            <Text style={styles.directionsBtnText}>길 찾기</Text>
          </Pressable>
        </View>
      )}

      <Animated.View
        style={[styles.sheet, { height: SHEET_HEIGHT, transform: [{ translateY: sheetTranslateY }] }]}
      >
        <View style={[styles.dragArea, webDragStyle]} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>추천 미션</Text>
            <Text style={styles.sheetSub}>취향을 반영한 {missions.length}가지 미션</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.conditionBtn, pressed && styles.pressed]}>
            <Text style={styles.conditionText}>조건 설정</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator color={BL} size="small" />
          </View>
        ) : (
          <ScrollView
            style={styles.missionScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.missionScrollContent}
          >
            {expandedMission && (
              <View style={styles.expandedCard}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{expandedMission.cat}</Text>
                </View>
                <Text style={styles.expandedTitle}>{expandedMission.title}</Text>
                <Text style={styles.expandedDesc}>{expandedMission.desc}</Text>

                <View style={styles.statRow}>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>예상 시간</Text>
                    <Text style={styles.statValue}>{expandedMission.time}</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>준비물</Text>
                    <Text style={styles.statValue}>
                      {expandedMission.requiredItems && expandedMission.requiredItems.length > 0
                        ? expandedMission.requiredItems.join(", ")
                        : "필요 없음"}
                    </Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>비용</Text>
                    <Text style={styles.statValue}>{expandedMission.cost}</Text>
                  </View>
                </View>

                {expandedMission.recommendationReason && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>추천 이유</Text>
                    <Text style={styles.reasonText}>{expandedMission.recommendationReason}</Text>
                  </View>
                )}

                <Pressable
                  onPress={() => handleStartMission(expandedMission)}
                  disabled={startingMission}
                  style={[styles.startBtn, startingMission && { opacity: 0.6 }]}
                >
                  <Text style={styles.startBtnText}>
                    {startingMission ? "시작하는 중..." : "미션 시작하기"}
                  </Text>
                </Pressable>
              </View>
            )}

            {expandedMission && <Text style={styles.otherLabel}>다른 추천 미션</Text>}

            {missions
              .filter((m) => m.id !== expandedMissionId)
              .map((mission) => {
                const started = isStarted(mission.id);
                return (
                  <View key={mission.id} style={styles.compactCard}>
                    <View style={styles.compactThumb} />
                    <View style={styles.compactContent}>
                      <Text style={styles.compactTitle} numberOfLines={1}>
                        {mission.title}
                      </Text>
                      <Text style={styles.compactMeta}>
                        {mission.time} · {mission.cost}
                        {mission.placeName ? " · 📍 " + mission.placeName : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        if (started) {
                          const attempt = activeAttempts.find((a) => a.missionId === mission.id);
                          if (attempt) setRecordTarget({ attemptId: attempt.attemptId, title: attempt.title });
                        } else {
                          setExpandedMissionId(mission.id);
                        }
                      }}
                      style={[styles.compactBtn, started && styles.compactBtnRecord]}
                    >
                      <Text style={[styles.compactBtnText, started && styles.compactBtnRecordText]}>
                        {started ? "기록하기" : "선택"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
          </ScrollView>
        )}
      </Animated.View>

      <RecordModal
        visible={recordTarget !== null}
        target={recordTarget}
        onClose={() => setRecordTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: BG },
  mapPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingBottom: 180, backgroundColor: "#DFE8F0" },
  walkInfoBar: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  walkInfoText: {
    backgroundColor: WH,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: "600",
    color: T0,
    overflow: "hidden",
  },
  directionsBtn: { backgroundColor: BL, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  directionsBtnText: { color: WH, fontSize: 12, fontWeight: "700" },
  sheet: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    backgroundColor: WH,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 15,
  },
  dragArea: { height: 58, alignItems: "center", justifyContent: "center", backgroundColor: WH },
  dragHandle: { width: 46, height: 5, backgroundColor: "#D7D9DE", borderRadius: 3 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: T0 },
  sheetSub: { marginTop: 2, fontSize: 12, color: T2 },
  conditionBtn: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: BLL, borderRadius: 8 },
  conditionText: { fontSize: 11, fontWeight: "700", color: BL },
  loadingArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  missionScroll: { flex: 1 },
  missionScrollContent: { paddingBottom: 120, paddingHorizontal: 16 },
  expandedCard: {
    backgroundColor: WH,
    borderWidth: 1,
    borderColor: BLL,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  categoryBadge: { alignSelf: "flex-start", backgroundColor: "#FAECE7", borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 10 },
  categoryBadgeText: { fontSize: 11, fontWeight: "700", color: "#993C1D" },
  expandedTitle: { fontSize: 19, fontWeight: "800", color: T0, marginBottom: 8 },
  expandedDesc: { fontSize: 13, color: T1, lineHeight: 20, marginBottom: 16 },
  statRow: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: T3, paddingVertical: 12, marginBottom: 12 },
  statCol: { flex: 1 },
  statLabel: { fontSize: 11, color: T2, marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: "700", color: T0 },
  reasonBox: { backgroundColor: BG, borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonLabel: { fontSize: 12, fontWeight: "700", color: BL },
  reasonText: { fontSize: 12, color: T1, flexShrink: 1 },
  startBtn: { backgroundColor: BL, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  startBtnText: { color: WH, fontSize: 14, fontWeight: "700" },
  otherLabel: { fontSize: 12, fontWeight: "700", color: T2, marginBottom: 8 },
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  compactThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: T3, marginRight: 10 },
  compactContent: { flex: 1 },
  compactTitle: { fontSize: 13, fontWeight: "600", color: T0 },
  compactMeta: { fontSize: 11, color: T1, marginTop: 3 },
  compactBtn: { backgroundColor: BLL, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  compactBtnText: { fontSize: 11, fontWeight: "700", color: BL },
  compactBtnRecord: { backgroundColor: PINKL },
  compactBtnRecordText: { color: PINK },
  pressed: { opacity: 0.72 },
});