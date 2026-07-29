import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─────────────────────────────────────────────
// 디자인 색상
// 피그마 ZIP에 들어 있던 색상을 그대로 사용
// ─────────────────────────────────────────────

const COLORS = {
  primary: "#3D5AFE",
  primaryLight: "#EEF1FF",

  textMain: "#0F0F0F",
  textSub: "#5C5F6A",
  textMuted: "#9EA3AE",

  border: "#E4E6EA",
  white: "#FFFFFF",
  background: "#F7F8FA",

  sunday: "#EF4444",
};

// ─────────────────────────────────────────────
// 임시 캘린더 데이터
// 나중에 백엔드 API 데이터로 교체
// ─────────────────────────────────────────────

// 2026년 7월 1일은 수요일이므로 빈칸 3개
const CALENDAR_DATA = {
  startDay: 3,
  totalDays: 31,
  today: 29,

  // 경험 기록 완료 날짜
  completedDays: [5, 9, 12, 16, 19, 23],

  // 미션은 시작했지만 기록하지 않은 날짜
  startedDays: [26],
};

// 피그마 디자인에 사용된 사진
// 현재는 온라인 이미지이며 나중에 실제 사용자 사진 URL로 교체
const CALENDAR_PHOTOS = [
  "https://images.unsplash.com/photo-1414124488080-0188dcbb8834?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1774356148397-d5dfe91253c2?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1558210834-473f430c09ac?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1780342745241-c4bb07a0a198?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1583236753515-7e06aae56395?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1771857607729-181ea40ca5c5?w=400&h=400&fit=crop&auto=format",
];

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_CLOSED_POSITION = SCREEN_HEIGHT;

type CalendarCell = number | null;

export default function CalendarScreen() {
  const router = useRouter();

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const sheetTranslateY = useRef(
    new Animated.Value(SHEET_CLOSED_POSITION),
  ).current;

  const dragStartPosition = useRef(0);

  const isSheetOpen = selectedDay !== null;

  useEffect(() => {
    if (!isSheetOpen) {
      return;
    }

    Animated.spring(sheetTranslateY, {
      toValue: 0,
      damping: 22,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [isSheetOpen, sheetTranslateY]);

  const closeSheet = () => {
    Animated.timing(sheetTranslateY, {
      toValue: SHEET_CLOSED_POSITION,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setSelectedDay(null);
      }
    });
  };

  const restoreSheet = () => {
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      damping: 22,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onMoveShouldSetPanResponder: (_event, gestureState) =>
        Math.abs(gestureState.dy) > 3,

      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((currentPosition) => {
          dragStartPosition.current = currentPosition;
        });
      },

      onPanResponderMove: (_event, gestureState) => {
        const nextPosition =
          dragStartPosition.current + gestureState.dy;

        // 위쪽으로는 더 올라가지 않고 아래쪽으로만 움직이게 제한
        const limitedPosition = Math.max(
          0,
          Math.min(nextPosition, SHEET_CLOSED_POSITION),
        );

        sheetTranslateY.setValue(limitedPosition);
      },

      onPanResponderRelease: (_event, gestureState) => {
        const currentPosition = Math.max(
          0,
          dragStartPosition.current + gestureState.dy,
        );

        const shouldClose =
          currentPosition > 110 || gestureState.vy > 0.7;

        if (shouldClose) {
          closeSheet();
        } else {
          restoreSheet();
        }
      },

      onPanResponderTerminate: () => {
        restoreSheet();
      },

      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  // 시작 요일 앞에 빈칸을 넣고, 그 뒤에 1~31일을 배치
  const calendarCells: CalendarCell[] = [
    ...Array<null>(CALENDAR_DATA.startDay).fill(null),
    ...Array.from(
      { length: CALENDAR_DATA.totalDays },
      (_, index) => index + 1,
    ),
  ];

  const selectedDayIsCompleted =
    selectedDay !== null &&
    CALENDAR_DATA.completedDays.includes(selectedDay);

  const selectedPhotoIndex =
    selectedDay === null
      ? -1
      : CALENDAR_DATA.completedDays.indexOf(selectedDay);

  const handleDayPress = (day: number) => {
    const isFuture = day > CALENDAR_DATA.today;

    if (isFuture) {
      return;
    }

    // 현재 선택된 날짜를 다시 누르면 시트를 아래로 내려 닫기
    if (selectedDay === day) {
      closeSheet();
      return;
    }

    // 닫혀 있던 시트를 다시 아래쪽에서 시작하게 설정
    if (selectedDay === null) {
      sheetTranslateY.setValue(SHEET_CLOSED_POSITION);
    }

    setSelectedDay(day);
  };

  const handleRecordDetail = () => {
    Alert.alert(
      "기록 상세",
      "기록 상세 화면은 백엔드와 상세 페이지를 연결한 뒤 구현할 예정입니다.",
    );
  };

  const handleEditRecord = () => {
    Alert.alert(
      "기록 수정",
      "기록 수정 화면은 추후 연결할 예정입니다.",
    );
  };

  const handleGoToMission = () => {
    setSelectedDay(null);

    // 홈 탭으로 이동
    router.push("/");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 진행 현황 카드 */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressCaption}>
                  진행 중인 여정
                </Text>

                <Text style={styles.journeyTitle}>
                  14일의 여정
                </Text>
              </View>

              <View style={styles.dDayBox}>
                <Text style={styles.dDayCaption}>
                  종료까지
                </Text>

                <Text style={styles.dDayText}>
                  D-5
                </Text>
              </View>
            </View>

            <View style={styles.progressInfoRow}>
              <Text style={styles.progressDescription}>
                7번 중 4번의 경험을 기록했어요
              </Text>

              <Text style={styles.progressCount}>
                4/7
              </Text>
            </View>

            <View style={styles.progressBarBackground}>
              <View style={styles.progressBarFill} />
            </View>

            <View style={styles.essayNotice}>
              <Text style={styles.essayNoticeText}>
                에세이 완성까지{" "}
                <Text style={styles.essayNoticeStrong}>
                  3번
                </Text>
                {" "}더 남았어요
              </Text>
            </View>
          </View>

          {/* 월 표시 영역 */}
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>
              2026년 7월
            </Text>

            <View style={styles.monthButtonContainer}>
              <Pressable
                disabled
                style={styles.monthButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={COLORS.textSub}
                />
              </Pressable>

              <Pressable
                disabled
                style={styles.monthButton}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.textSub}
                />
              </Pressable>
            </View>
          </View>

          {/* 요일 */}
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((day) => {
              const dayColor =
                day === "일"
                  ? COLORS.sunday
                  : day === "토"
                    ? COLORS.primary
                    : COLORS.textMuted;

              return (
                <View
                  key={day}
                  style={styles.weekCell}
                >
                  <Text
                    style={[
                      styles.weekText,
                      { color: dayColor },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* 날짜 */}
          <View style={styles.calendarGrid}>
            {calendarCells.map((day, index) => {
              if (day === null) {
                return (
                  <View
                    key={`empty-${index}`}
                    style={styles.calendarCell}
                  />
                );
              }

              const isCompleted =
                CALENDAR_DATA.completedDays.includes(day);

              const isStarted =
                CALENDAR_DATA.startedDays.includes(day);

              const isToday =
                day === CALENDAR_DATA.today;

              const isFuture =
                day > CALENDAR_DATA.today;

              const isSelected =
                selectedDay === day;

              const photoIndex =
                CALENDAR_DATA.completedDays.indexOf(day);

              return (
                <Pressable
                  key={day}
                  disabled={isFuture}
                  onPress={() => handleDayPress(day)}
                  style={[
                    styles.calendarCell,
                    isFuture && styles.futureCell,
                  ]}
                >
                  {isCompleted ? (
                    <View
                      style={[
                        styles.completedImageWrapper,
                        isSelected &&
                          styles.selectedImageWrapper,
                      ]}
                    >
                      <Image
                        source={{
                          uri: CALENDAR_PHOTOS[photoIndex],
                        }}
                        style={styles.completedImage}
                      />
                    </View>
                  ) : isStarted ? (
                    <View style={styles.startedDayCircle}>
                      <Text style={styles.startedDayText}>
                        {day}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.normalDayCircle,

                        isToday &&
                          styles.todayCircle,

                        isSelected &&
                          !isToday &&
                          styles.selectedDayCircle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.normalDayText,

                          isToday &&
                            styles.todayText,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  )}

                  {isCompleted && (
                    <View style={styles.completedDot} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* 플로팅 탭 바에 가리지 않도록 여백 확보 */}
          <View style={styles.bottomSpace} />
        </ScrollView>

        {/* 날짜 선택 시 나타나는 하단 시트 */}
        {selectedDay !== null && (
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [
                  {
                    translateY: sheetTranslateY,
                  },
                ],
              },
            ]}
          >
          <View
            style={styles.sheetHandleArea}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
          </View>

            {selectedDayIsCompleted ? (
              <View style={styles.recordContent}>
                <Text style={styles.recordDate}>
                  2026년 7월 {selectedDay}일
                </Text>

                <Text style={styles.recordTitle}>
                  조용한 카페에서 30분 독서
                </Text>

                {selectedPhotoIndex >= 0 && (
                  <Image
                    source={{
                      uri: CALENDAR_PHOTOS[
                        selectedPhotoIndex
                      ],
                    }}
                    style={styles.recordImage}
                  />
                )}

                <View style={styles.emotionTag}>
                  <Text style={styles.emotionTagText}>
                    편안했어요
                  </Text>
                </View>

                <Text style={styles.recordDescription}>
                  카페 창가 자리가 비어 있었다. 30분 동안
                  읽기만 했는데 이상하게 마음이 가벼워졌다.
                </Text>

                <View style={styles.recordButtonRow}>
                  <Pressable
                    onPress={handleRecordDetail}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      기록 자세히 보기
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleEditRecord}
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.editButtonText}>
                      수정
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.emptyContent}>
                <Text style={styles.emptyEmoji}>
                  🌱
                </Text>

                <Text style={styles.emptyTitle}>
                  아직 채워진 하루가 없어요
                </Text>

                <Text style={styles.emptyDescription}>
                  오늘 작은 경험 하나를 시작해볼까요?
                </Text>

                <Pressable
                  onPress={handleGoToMission}
                  style={({ pressed }) => [
                    styles.emptyButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.emptyButtonText}>
                    오늘의 미션 보러 가기
                  </Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        )}  
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screen: {
    flex: 1,
    position: "relative",
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  // ─────────────────────────────────────────
  // 진행 카드
  // ─────────────────────────────────────────

  progressCard: {
    padding: 18,
    marginBottom: 20,

    backgroundColor: COLORS.white,
    borderRadius: 18,

    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },

  progressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",

    marginBottom: 14,
  },

  progressCaption: {
    marginBottom: 3,

    fontSize: 12,
    color: COLORS.textMuted,
  },

  journeyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  dDayBox: {
    minWidth: 70,
    paddingHorizontal: 14,
    paddingVertical: 7,

    alignItems: "center",

    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },

  dDayCaption: {
    marginBottom: 2,

    fontSize: 10,
    color: COLORS.textSub,
  },

  dDayText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primary,
  },

  progressInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",

    marginBottom: 6,
  },

  progressDescription: {
    fontSize: 12,
    color: COLORS.textSub,
  },

  progressCount: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },

  progressBarBackground: {
    height: 5,
    marginBottom: 8,

    overflow: "hidden",

    backgroundColor: "#ECEEF2",
    borderRadius: 3,
  },

  progressBarFill: {
    width: "57.14%",
    height: "100%",

    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },

  essayNotice: {
    paddingHorizontal: 12,
    paddingVertical: 8,

    backgroundColor: COLORS.background,
    borderRadius: 8,
  },

  essayNoticeText: {
    fontSize: 12,
    color: COLORS.textSub,
  },

  essayNoticeStrong: {
    fontWeight: "700",
    color: COLORS.primary,
  },

  // ─────────────────────────────────────────
  // 월 선택 영역
  // ─────────────────────────────────────────

  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: 14,
  },

  monthTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  monthButtonContainer: {
    flexDirection: "row",
    gap: 4,
  },

  monthButton: {
    width: 28,
    height: 28,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },

  // ─────────────────────────────────────────
  // 요일
  // ─────────────────────────────────────────

  weekRow: {
    flexDirection: "row",

    marginBottom: 6,
  },

  weekCell: {
    width: "14.285714%",

    alignItems: "center",

    paddingBottom: 4,
  },

  weekText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // ─────────────────────────────────────────
  // 날짜
  // ─────────────────────────────────────────

  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  calendarCell: {
    width: "14.285714%",
    minHeight: 50,

    alignItems: "center",

    paddingVertical: 3,
  },

  futureCell: {
    opacity: 0.28,
  },

  normalDayCircle: {
    width: 34,
    height: 34,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 17,
  },

  selectedDayCircle: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },

  normalDayText: {
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.textMain,
  },

  todayCircle: {
    backgroundColor: COLORS.primary,
  },

  todayText: {
    fontWeight: "700",
    color: COLORS.white,
  },

  startedDayCircle: {
    width: 34,
    height: 34,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 17,
  },

  startedDayText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.primary,
  },

  completedImageWrapper: {
    width: 34,
    height: 34,

    overflow: "hidden",

    borderWidth: 2.5,
    borderColor: "transparent",
    borderRadius: 17,
  },

  selectedImageWrapper: {
    borderColor: COLORS.primary,
  },

  completedImage: {
    width: "100%",
    height: "100%",

    backgroundColor: COLORS.border,
  },

  completedDot: {
    width: 4,
    height: 4,

    marginTop: 3,

    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  bottomSpace: {
    height: 120,
  },

  // ─────────────────────────────────────────
  // 하단 기록 시트
  // ─────────────────────────────────────────

  bottomSheet: {
    position: "absolute",

    right: 0,
    bottom: 0,
    left: 0,

    overflow: "hidden",

    paddingBottom: 104,

    backgroundColor: COLORS.white,

    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,

    elevation: 16,
  },

  sheetHandleArea: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: "#D7D9DE",
    borderRadius: 2,
  },

  recordContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  recordDate: {
    marginBottom: 4,

    fontSize: 11,
    color: COLORS.textMuted,
  },

  recordTitle: {
    marginBottom: 14,

    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  recordImage: {
    width: "100%",
    height: 156,

    marginBottom: 12,

    backgroundColor: COLORS.border,
    borderRadius: 14,
  },

  emotionTag: {
    alignSelf: "flex-start",

    marginBottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,

    backgroundColor: COLORS.primaryLight,
    borderRadius: 7,
  },

  emotionTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },

  recordDescription: {
    marginBottom: 16,

    fontSize: 13,
    lineHeight: 21,
    color: COLORS.textSub,
  },

  recordButtonRow: {
    flexDirection: "row",
    gap: 8,
  },

  primaryButton: {
    flex: 1,

    alignItems: "center",

    paddingVertical: 12,

    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },

  primaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },

  editButton: {
    alignItems: "center",

    paddingHorizontal: 18,
    paddingVertical: 12,

    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },

  editButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSub,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  // ─────────────────────────────────────────
  // 기록 없는 날짜
  // ─────────────────────────────────────────

  emptyContent: {
    alignItems: "center",

    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  emptyEmoji: {
    marginBottom: 10,

    fontSize: 40,
  },

  emptyTitle: {
    marginBottom: 4,

    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMain,
  },

  emptyDescription: {
    marginBottom: 22,

    fontSize: 13,
    color: COLORS.textSub,
  },

  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 13,

    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },

  emptyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
});