import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const BL = "#3D5AFE";
const BLL = "#EEF1FF";
const T0 = "#0F0F0F";
const T1 = "#5C5F6A";
const T2 = "#9EA3AE";
const T3 = "#E4E6EA";
const WH = "#FFFFFF";
const BG = "#F7F8FA";

const API_URL = "http://localhost:3000";

const SCREEN_HEIGHT = Dimensions.get("window").height;

// 펼친 상태의 시트 전체 높이
const SHEET_HEIGHT = SCREEN_HEIGHT - 90;

// 접었을 때 보일 영역
// 하단 탭 바가 겹치는 공간 + 손잡이 및 제목 영역
const TAB_BAR_SPACE = 105;
const COLLAPSED_HEADER_HEIGHT = 100;
const COLLAPSED_VISIBLE_HEIGHT =
  TAB_BAR_SPACE + COLLAPSED_HEADER_HEIGHT;

// 시트 전체에서 접힌 상태로 보일 높이를 뺀 만큼 아래로 이동
const COLLAPSED_POSITION =
  SHEET_HEIGHT - COLLAPSED_VISIBLE_HEIGHT;

type Mission = {
  id: number;
  title: string;
  desc: string;
  time: string;
  dist: string;
  cost: string;
  cat: string;
  star?: boolean;
};

const FALLBACK_MISSIONS: Mission[] = [
  {
    id: 1,
    title: "조용한 카페에서 30분 독서",
    desc: "일상 속 작은 고요함을 찾아봐요",
    time: "30분",
    dist: "0.3km",
    cost: "무료",
    cat: "독서",
    star: true,
  },
  {
    id: 2,
    title: "공원 산책하며 계절 사진 찍기",
    desc: "지금 계절의 색을 카메라에 담아봐요",
    time: "20분",
    dist: "0.5km",
    cost: "무료",
    cat: "산책",
  },
  {
    id: 3,
    title: "처음 가는 빵집에서 새로운 빵 먹기",
    desc: "낯선 맛과의 작은 만남",
    time: "15분",
    dist: "0.7km",
    cost: "3,000원",
    cat: "휴식",
  },
  {
    id: 4,
    title: "버스킹 공연 5분 이상 감상하기",
    desc: "길 위의 음악에 귀 기울여봐요",
    time: "10분",
    dist: "1.2km",
    cost: "무료",
    cat: "음악",
  },
];

export default function HomeScreen() {
  const [missions, setMissions] =
    useState<Mission[]>(FALLBACK_MISSIONS);

  const [loading, setLoading] = useState(true);

  const [selectedMission, setSelectedMission] =
  useState<Mission | null>(null);

  /*
   * translateY가 0이면 펼쳐진 상태
   * COLLAPSED_POSITION이면 접힌 상태
   */
  const sheetTranslateY = useRef(
    new Animated.Value(COLLAPSED_POSITION),
  ).current;

  // 드래그를 시작한 순간의 시트 위치
  const dragStartPosition = useRef(
    COLLAPSED_POSITION,
  );

  useEffect(() => {
    fetch(`${API_URL}/missions`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `HTTP 오류: ${response.status}`,
          );
        }

        return response.json();
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setMissions(data as Mission[]);
        }
      })
      .catch((error: Error) => {
        console.log(
          "미션 API 연결 실패, 임시 데이터 사용:",
          error.message,
        );
      })
      .finally(() => {
        setLoading(false);
      });
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
    sheetTranslateY.stopAnimation(
      (currentPosition) => {
        const isCollapsed =
          currentPosition >
          COLLAPSED_POSITION / 2;

        moveSheet(
          isCollapsed
            ? 0
            : COLLAPSED_POSITION,
        );
      },
    );
  };

  const finishDrag = (
    currentPosition: number,
    velocityY: number,
  ) => {
    // 빠르게 위로 올렸을 때
    if (velocityY < -0.35) {
      moveSheet(0);
      return;
    }

    // 빠르게 아래로 내렸을 때
    if (velocityY > 0.35) {
      moveSheet(COLLAPSED_POSITION);
      return;
    }

    // 천천히 움직였을 때는 중간 지점을 기준으로 스냅
    const shouldExpand =
      currentPosition <
      COLLAPSED_POSITION / 2;

    moveSheet(
      shouldExpand
        ? 0
        : COLLAPSED_POSITION,
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      // 손잡이 영역을 누르는 순간 제스처 권한 요청
      onStartShouldSetPanResponder: () => true,

      onStartShouldSetPanResponderCapture:
        () => true,

      // 2px 이상 움직이면 드래그로 판단
      onMoveShouldSetPanResponder: (
        _event,
        gestureState,
      ) => Math.abs(gestureState.dy) > 2,

      onMoveShouldSetPanResponderCapture: (
        _event,
        gestureState,
      ) => Math.abs(gestureState.dy) > 2,

      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation(
          (currentPosition) => {
            dragStartPosition.current =
              currentPosition;
          },
        );
      },

      onPanResponderMove: (
        _event,
        gestureState,
      ) => {
        const nextPosition =
          dragStartPosition.current +
          gestureState.dy;

        // 위 또는 아래 한계를 넘어가지 않도록 제한
        const limitedPosition = Math.max(
          0,
          Math.min(
            nextPosition,
            COLLAPSED_POSITION,
          ),
        );

        sheetTranslateY.setValue(
          limitedPosition,
        );
      },

      onPanResponderRelease: (
        _event,
        gestureState,
      ) => {
        const currentPosition = Math.max(
          0,
          Math.min(
            dragStartPosition.current +
              gestureState.dy,
            COLLAPSED_POSITION,
          ),
        );

        // 거의 움직이지 않았다면 클릭으로 보고 열기/닫기
        if (Math.abs(gestureState.dy) < 5) {
          toggleSheet();
          return;
        }

        finishDrag(
          currentPosition,
          gestureState.vy,
        );
      },

      onPanResponderTerminate: (
        _event,
        gestureState,
      ) => {
        const currentPosition = Math.max(
          0,
          Math.min(
            dragStartPosition.current +
              gestureState.dy,
            COLLAPSED_POSITION,
          ),
        );

        finishDrag(
          currentPosition,
          gestureState.vy,
        );
      },

      // 다른 컴포넌트가 제스처 권한을 가져가지 못하도록 설정
      onPanResponderTerminationRequest:
        () => false,

      onShouldBlockNativeResponder:
        () => true,
    }),
  ).current;

  const webDragStyle =
    Platform.OS === "web"
      ? ({
          touchAction: "none",
          userSelect: "none",
          cursor: "grab",
        } as any)
      : undefined;

  return (
    <View style={styles.container}>
      {/* 지도 영역 */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>
          지도 영역 (추후 연동)
        </Text>
      </View>

      {/* 드래그 가능한 추천 미션 바텀 시트 */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: SHEET_HEIGHT,
            transform: [
              {
                translateY:
                  sheetTranslateY,
              },
            ],
          },
        ]}
      >
        {/* 손잡이 영역 */}
        <View
          style={[
            styles.dragArea,
            webDragStyle,
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.dragHandle} />

        </View>

        {/* 제목 영역 */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>
              추천 미션
            </Text>

            <Text style={styles.sheetSub}>
              취향을 반영한{" "}
              {missions.length}가지 미션
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.conditionBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.conditionText}>
              조건 설정
            </Text>
          </Pressable>
        </View>

        {/* 목록 영역 */}
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator
              color={BL}
              size="small"
            />
          </View>
        ) : (
          <ScrollView
            style={styles.missionScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={
              styles.missionScrollContent
            }
          >
            {missions.map(
              (mission, index) => (
                <View
                  key={mission.id}
                  style={styles.card}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.thumb} />

                    <View
                      style={styles.cardContent}
                    >
                      <View
                        style={[
                          styles.tag,
                          {
                            backgroundColor:
                              mission.star
                                ? "#FEF3C7"
                                : BLL,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagText,
                            {
                              color:
                                mission.star
                                  ? "#D97706"
                                  : BL,
                            },
                          ]}
                        >
                          {mission.star
                            ? "★ 추천"
                            : mission.cat}
                        </Text>
                      </View>

                      <Text
                        style={styles.cardTitle}
                      >
                        {mission.title}
                      </Text>

                      <Text
                        style={styles.cardDesc}
                      >
                        {mission.desc}
                      </Text>

                      <Text
                        style={styles.cardMeta}
                      >
                        {mission.time} ·{" "}
                        {mission.dist} ·{" "}
                        {mission.cost}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => setSelectedMission(mission)}
                      style={({ pressed }) => [
                        styles.selectBtn,

                        // 선택되지 않았을 때 파란색
                        selectedMission?.id !== mission.id &&
                          styles.selectedButton,

                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectButtonText,

                          // 선택되지 않았을 때 흰색 글씨
                          selectedMission?.id !== mission.id &&
                            styles.selectedButtonText,
                        ]}
                      >
                        {selectedMission?.id === mission.id
                          ? "선택됨"
                          : "이 미션 선택"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.detailBtn,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Text
                        style={
                          styles.detailButtonText
                        }
                      >
                        자세히 보기
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ),
            )}
          </ScrollView>
        )}
      </Animated.View>
      <Modal
        visible={selectedMission !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMission(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Text style={styles.modalIconText}>✓</Text>
            </View>

            <Text style={styles.modalTitle}>
              이 미션을 선택할까요?
            </Text>

            <Text style={styles.modalMissionTitle}>
              {selectedMission?.title}
            </Text>

            <Text style={styles.modalDescription}>
              미션을 선택하면 오늘의 여정이 시작돼요.
            </Text>

            <View style={styles.modalButtonRow}>
              <Pressable
                onPress={() => setSelectedMission(null)}
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalCancelText}>
                  취소
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  console.log(
                    "선택한 미션:",
                    selectedMission,
                  );

                  setSelectedMission(null);
                }}
                style={({ pressed }) => [
                  styles.modalConfirmButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalConfirmText}>
                  미션 시작하기
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: BG,
  },

  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,

    alignItems: "center",
    justifyContent: "center",

    paddingBottom: 180,

    backgroundColor: "#DFE8F0",
  },

  mapText: {
    fontSize: 12,
    color: T2,
  },

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
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.12,
    shadowRadius: 14,

    elevation: 15,
  },

  dragArea: {
    height: 58,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: WH,
  },

  dragHandle: {
    width: 46,
    height: 5,

    backgroundColor: "#D7D9DE",
    borderRadius: 3,
  },

  dragGuideText: {
    marginTop: 7,

    fontSize: 10,
    fontWeight: "500",
    color: T2,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",

    paddingHorizontal: 20,
    paddingBottom: 14,
  },

  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: T0,
  },

  sheetSub: {
    marginTop: 2,

    fontSize: 12,
    color: T2,
  },

  conditionBtn: {
    alignSelf: "flex-start",

    paddingHorizontal: 12,
    paddingVertical: 6,

    backgroundColor: BLL,
    borderRadius: 8,
  },

  conditionText: {
    fontSize: 11,
    fontWeight: "700",
    color: BL,
  },

  loadingArea: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",
  },

  missionScroll: {
    flex: 1,
  },

  missionScrollContent: {
    paddingBottom: 120,
  },

  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,

    backgroundColor: BG,

    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderRadius: 14,
  },

  cardTop: {
    flexDirection: "row",
  },

  thumb: {
    width: 56,
    height: 56,

    marginRight: 12,

    backgroundColor: T3,
    borderRadius: 10,
  },

  cardContent: {
    flex: 1,
  },

  tag: {
    alignSelf: "flex-start",

    marginBottom: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,

    borderRadius: 7,
  },

  tagText: {
    fontSize: 11,
    fontWeight: "700",
  },

  cardTitle: {
    marginTop: 2,

    fontSize: 13,
    fontWeight: "600",
    color: T0,
  },

  cardDesc: {
    marginTop: 3,

    fontSize: 11,
    color: T1,
  },

  cardMeta: {
    marginTop: 6,

    fontSize: 11,
    color: T1,
  },

  buttonRow: {
    flexDirection: "row",

    marginTop: 12,
  },

  selectBtn: {
    flex: 1,

    alignItems: "center",

    marginRight: 8,
    paddingVertical: 10,

    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },

  selectedButton: {
    backgroundColor: BL,
  },

  selectButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: T1,
  },

  selectedButtonText: {
    color: WH,
  },

  detailBtn: {
    flex: 1,

    alignItems: "center",

    paddingVertical: 10,

    backgroundColor: WH,

    borderWidth: 1,
    borderColor: T3,
    borderRadius: 10,
  },

  detailButtonText: {
    fontSize: 12,
    color: T1,
  },

  pressed: {
    opacity: 0.72,
  },

  modalOverlay: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 24,

    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },

  modalCard: {
    width: "100%",
    maxWidth: 360,

    alignItems: "center",

    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,

    backgroundColor: WH,
    borderRadius: 22,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.16,
    shadowRadius: 20,

    elevation: 20,
  },

  modalIcon: {
    width: 48,
    height: 48,

    marginBottom: 14,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: BLL,
    borderRadius: 24,
  },

  modalIconText: {
    fontSize: 22,
    fontWeight: "800",
    color: BL,
  },

  modalTitle: {
    marginBottom: 8,

    fontSize: 18,
    fontWeight: "800",
    color: T0,
  },

  modalMissionTitle: {
    marginBottom: 7,

    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    color: BL,
  },

  modalDescription: {
    marginBottom: 22,

    fontSize: 12,
    textAlign: "center",
    color: T2,
  },

  modalButtonRow: {
    width: "100%",

    flexDirection: "row",
  },

  modalCancelButton: {
    flex: 1,

    alignItems: "center",

    marginRight: 8,
    paddingVertical: 13,

    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },

  modalCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: T1,
  },

  modalConfirmButton: {
    flex: 1,

    alignItems: "center",

    paddingVertical: 13,

    backgroundColor: BL,
    borderRadius: 12,
  },

  modalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: WH,
  },
});