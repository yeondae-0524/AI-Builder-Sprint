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
import { supabase } from "../../lib/supabase";

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

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_CLOSED_POSITION = SCREEN_HEIGHT;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type CalendarCell = number | null;

type Journey = {
  id: string;
  title: string;
  duration_days: number;
  target_record_count: number;
  start_date: string;
  end_date: string;
  status: string;
};

type CalendarRecord = {
  id: string;
  mission_attempt_id: string | null;
  recorded_at: string;
  emotion: string | null;
  content: string | null;
  missionTitle: string;
  photoUrl: string | null;
};

type StartedMission = {
  id: string;
  started_at: string;
  missionTitle: string;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getLocalDayFromTimestamp(timestamp: string) {
  return new Date(timestamp).getDate();
}

export default function CalendarScreen() {
  const router = useRouter();

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const todayKey = toDateKey(todayStart);

  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [records, setRecords] = useState<CalendarRecord[]>([]);
  const [startedMissions, setStartedMissions] = useState<StartedMission[]>([]);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [journeyRecordCount, setJourneyRecordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const sheetTranslateY = useRef(
    new Animated.Value(SHEET_CLOSED_POSITION),
  ).current;
  const dragStartPosition = useRef(0);
  const isSheetOpen = selectedDay !== null;

  const visibleYear = visibleMonth.getFullYear();
  const visibleMonthIndex = visibleMonth.getMonth();
  const totalDays = new Date(
    visibleYear,
    visibleMonthIndex + 1,
    0,
  ).getDate();
  const startDay = new Date(
    visibleYear,
    visibleMonthIndex,
    1,
  ).getDay();

  const monthStart = new Date(visibleYear, visibleMonthIndex, 1);
  const nextMonthStart = new Date(visibleYear, visibleMonthIndex + 1, 1);
  const monthStartKey = toDateKey(monthStart);
  const nextMonthStartKey = toDateKey(nextMonthStart);

  useEffect(() => {
    let isMounted = true;

    const loadCalendarData = async () => {
      setIsLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError || !user) {
        console.error(
          "사용자 정보 불러오기 실패:",
          userError?.message,
        );
        setIsLoading(false);
        return;
      }

      const [journeyResult, recordsResult, startedResult] =
        await Promise.all([
          supabase
            .from("journeys")
            .select(
              "id, title, duration_days, target_record_count, start_date, end_date, status",
            )
            .eq("user_id", user.id)
            .lte("start_date", todayKey)
            .gte("end_date", todayKey)
            .order("start_date", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("records")
            .select(
              "id, mission_attempt_id, recorded_at, emotion, content",
            )
            .eq("user_id", user.id)
            .gte("recorded_at", monthStartKey)
            .lt("recorded_at", nextMonthStartKey)
            .order("recorded_at", { ascending: true }),

          supabase
            .from("mission_attempts")
            .select("id, mission_id, started_at")
            .eq("user_id", user.id)
            .not("started_at", "is", null)
            .is("completed_at", null)
            .gte("started_at", monthStart.toISOString())
            .lt("started_at", nextMonthStart.toISOString()),
        ]);

      if (!isMounted) {
        return;
      }

      if (journeyResult.error) {
        console.error(
          "진행 중인 여정 조회 실패:",
          journeyResult.error.message,
        );
      }

      if (recordsResult.error) {
        console.error(
          "캘린더 기록 조회 실패:",
          recordsResult.error.message,
        );
      }

      if (startedResult.error) {
        console.error(
          "진행 중인 미션 조회 실패:",
          startedResult.error.message,
        );
      }

      const currentJourney =
        (journeyResult.data as Journey | null) ?? null;
      const rawRecords = recordsResult.data ?? [];
      const rawStartedMissions = startedResult.data ?? [];

      let currentJourneyRecordCount = 0;

      if (currentJourney) {
        const { count, error: countError } = await supabase
          .from("records")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("journey_id", currentJourney.id);

        if (countError) {
          console.error(
            "여정 기록 수 조회 실패:",
            countError.message,
          );
        } else {
          currentJourneyRecordCount = count ?? 0;
        }
      }

      const recordAttemptIds = Array.from(
        new Set(
          rawRecords
            .map((record) => record.mission_attempt_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const attemptIdToMissionId = new Map<string, string>();

      if (recordAttemptIds.length > 0) {
        const { data: attempts, error: attemptsError } =
          await supabase
            .from("mission_attempts")
            .select("id, mission_id")
            .in("id", recordAttemptIds);

        if (attemptsError) {
          console.error(
            "기록 미션 연결 조회 실패:",
            attemptsError.message,
          );
        } else {
          (attempts ?? []).forEach((attempt) => {
            attemptIdToMissionId.set(
              attempt.id,
              attempt.mission_id,
            );
          });
        }
      }

      const missionIds = Array.from(
        new Set([
          ...Array.from(attemptIdToMissionId.values()),
          ...rawStartedMissions
            .map((attempt) => attempt.mission_id)
            .filter((id): id is string => Boolean(id)),
        ]),
      );

      const missionTitleById = new Map<string, string>();

      if (missionIds.length > 0) {
        const { data: missions, error: missionsError } =
          await supabase
            .from("missions")
            .select("id, title")
            .in("id", missionIds);

        if (missionsError) {
          console.error(
            "미션 이름 조회 실패:",
            missionsError.message,
          );
        } else {
          (missions ?? []).forEach((mission) => {
            missionTitleById.set(mission.id, mission.title);
          });
        }
      }

      const recordIds = rawRecords.map((record) => record.id);
      const photoPathByRecordId = new Map<string, string>();
      const signedUrlByPath = new Map<string, string>();

      if (recordIds.length > 0) {
        const { data: photos, error: photosError } =
          await supabase
            .from("record_photos")
            .select("record_id, storage_path, sort_order, is_cover")
            .in("record_id", recordIds)
            .order("sort_order", { ascending: true });

        if (photosError) {
          console.error(
            "기록 사진 정보 조회 실패:",
            photosError.message,
          );
        } else {
          (photos ?? []).forEach((photo) => {
            const currentPath = photoPathByRecordId.get(
              photo.record_id,
            );

            if (!currentPath || photo.is_cover) {
              photoPathByRecordId.set(
                photo.record_id,
                photo.storage_path,
              );
            }
          });

          const photoPaths = Array.from(
            new Set(photoPathByRecordId.values()),
          );

          if (photoPaths.length > 0) {
            const { data: signedPhotos, error: signedError } =
              await supabase.storage
                .from("record-photos")
                .createSignedUrls(photoPaths, 60 * 60);

            if (signedError) {
              console.error(
                "사진 URL 생성 실패:",
                signedError.message,
              );
            } else {
              (signedPhotos ?? []).forEach((photo) => {
                if (photo.signedUrl) {
                  signedUrlByPath.set(
                    photo.path,
                    photo.signedUrl,
                  );
                }
              });
            }
          }
        }
      }

      const normalizedRecords: CalendarRecord[] = rawRecords.map(
        (record) => {
          const missionId = record.mission_attempt_id
            ? attemptIdToMissionId.get(record.mission_attempt_id)
            : undefined;
          const photoPath = photoPathByRecordId.get(record.id);

          return {
            id: record.id,
            mission_attempt_id: record.mission_attempt_id,
            recorded_at: record.recorded_at,
            emotion: record.emotion,
            content: record.content,
            missionTitle:
              (missionId
                ? missionTitleById.get(missionId)
                : undefined) ?? "기록한 경험",
            photoUrl: photoPath
              ? signedUrlByPath.get(photoPath) ?? null
              : null,
          };
        },
      );

      const normalizedStartedMissions: StartedMission[] =
        rawStartedMissions.map((attempt) => ({
          id: attempt.id,
          started_at: attempt.started_at,
          missionTitle:
            missionTitleById.get(attempt.mission_id) ??
            "진행 중인 미션",
        }));

      if (!isMounted) {
        return;
      }

      setJourney(currentJourney);
      setJourneyRecordCount(currentJourneyRecordCount);
      setRecords(normalizedRecords);
      setStartedMissions(normalizedStartedMissions);
      setIsLoading(false);
    };

    loadCalendarData();

    return () => {
      isMounted = false;
    };
  }, [monthStartKey, nextMonthStartKey, todayKey]);

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
      onPanResponderTerminate: restoreSheet,
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const calendarCells: CalendarCell[] = [
    ...Array<null>(startDay).fill(null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  const selectedDateKey =
    selectedDay === null
      ? null
      : toDateKey(
          new Date(visibleYear, visibleMonthIndex, selectedDay),
        );

  const selectedRecord =
    selectedDateKey === null
      ? null
      : records.find(
          (record) => record.recorded_at === selectedDateKey,
        ) ?? null;

  const selectedStartedMission =
    selectedDay === null
      ? null
      : startedMissions.find(
          (mission) =>
            getLocalDayFromTimestamp(mission.started_at) ===
            selectedDay,
        ) ?? null;

  const completedDays = new Set(
    records.map((record) => parseDateKey(record.recorded_at).getDate()),
  );
  const startedDays = new Set(
    startedMissions.map((mission) =>
      getLocalDayFromTimestamp(mission.started_at),
    ),
  );

  const journeyTarget = journey?.target_record_count ?? 0;
  const remainingRecords = Math.max(
    journeyTarget - journeyRecordCount,
    0,
  );
  const progressPercentage = (
    journeyTarget > 0
      ? `${Math.min(
          (journeyRecordCount / journeyTarget) * 100,
          100,
        )}%`
      : "0%"
  ) as `${number}%`;
  const dDay = journey
    ? Math.max(
        0,
        Math.ceil(
          (parseDateKey(journey.end_date).getTime() -
            todayStart.getTime()) /
            DAY_IN_MS,
        ),
      )
    : null;

  const handleDayPress = (day: number) => {
    const date = new Date(visibleYear, visibleMonthIndex, day);

    if (date.getTime() > todayStart.getTime()) {
      return;
    }

    if (selectedDay === day) {
      closeSheet();
      return;
    }

    if (selectedDay === null) {
      sheetTranslateY.setValue(SHEET_CLOSED_POSITION);
    }

    setSelectedDay(day);
  };

  const moveMonth = (offset: number) => {
    setSelectedDay(null);
    sheetTranslateY.setValue(SHEET_CLOSED_POSITION);
    setVisibleMonth(
      new Date(visibleYear, visibleMonthIndex + offset, 1),
    );
  };

  const handleRecordDetail = () => {
    Alert.alert(
      "기록 상세",
      "기록 상세 화면은 상세 페이지를 만든 뒤 연결하면 됩니다.",
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
    router.push("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressCaption}>
                  진행 중인 여정
                </Text>

                <Text style={styles.journeyTitle}>
                  {isLoading
                    ? "불러오는 중..."
                    : journey?.title ?? "진행 중인 여정이 없어요"}
                </Text>
              </View>

              <View style={styles.dDayBox}>
                <Text style={styles.dDayCaption}>종료까지</Text>
                <Text style={styles.dDayText}>
                  {dDay === null ? "--" : `D-${dDay}`}
                </Text>
              </View>
            </View>

            <View style={styles.progressInfoRow}>
              <Text style={styles.progressDescription}>
                {journey
                  ? `${journeyTarget}번 중 ${journeyRecordCount}번의 경험을 기록했어요`
                  : "새 여정을 시작하면 진행 상황이 표시돼요"}
              </Text>

              <Text style={styles.progressCount}>
                {journey
                  ? `${journeyRecordCount}/${journeyTarget}`
                  : "0/0"}
              </Text>
            </View>

            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: progressPercentage },
                ]}
              />
            </View>

            <View style={styles.essayNotice}>
              <Text style={styles.essayNoticeText}>
                {journey ? (
                  <>
                    에세이 완성까지{" "}
                    <Text style={styles.essayNoticeStrong}>
                      {remainingRecords}번
                    </Text>{" "}
                    더 남았어요
                  </>
                ) : (
                  "진행할 여정을 먼저 선택해 주세요"
                )}
              </Text>
            </View>
          </View>

          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>
              {visibleYear}년 {visibleMonthIndex + 1}월
            </Text>

            <View style={styles.monthButtonContainer}>
              <Pressable
                onPress={() => moveMonth(-1)}
                style={({ pressed }) => [
                  styles.monthButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={COLORS.textSub}
                />
              </Pressable>

              <Pressable
                onPress={() => moveMonth(1)}
                style={({ pressed }) => [
                  styles.monthButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.textSub}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.weekRow}>
            {WEEK_DAYS.map((day) => {
              const dayColor =
                day === "일"
                  ? COLORS.sunday
                  : day === "토"
                    ? COLORS.primary
                    : COLORS.textMuted;

              return (
                <View key={day} style={styles.weekCell}>
                  <Text style={[styles.weekText, { color: dayColor }]}>
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>

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

              const date = new Date(
                visibleYear,
                visibleMonthIndex,
                day,
              );
              const dateKey = toDateKey(date);
              const dayRecord = records.find(
                (record) => record.recorded_at === dateKey,
              );
              const isCompleted = completedDays.has(day);
              const isStarted = startedDays.has(day) && !isCompleted;
              const isToday = dateKey === todayKey;
              const isFuture = date.getTime() > todayStart.getTime();
              const isSelected = selectedDay === day;

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
                        !dayRecord?.photoUrl && {
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: COLORS.primaryLight,
                        },
                        isSelected && styles.selectedImageWrapper,
                      ]}
                    >
                      {dayRecord?.photoUrl ? (
                        <Image
                          source={{ uri: dayRecord.photoUrl }}
                          style={styles.completedImage}
                        />
                      ) : (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={COLORS.primary}
                        />
                      )}
                    </View>
                  ) : isStarted ? (
                    <View style={styles.startedDayCircle}>
                      <Text style={styles.startedDayText}>{day}</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.normalDayCircle,
                        isToday && styles.todayCircle,
                        isSelected &&
                          !isToday &&
                          styles.selectedDayCircle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.normalDayText,
                          isToday && styles.todayText,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  )}

                  {isCompleted && <View style={styles.completedDot} />}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.bottomSpace} />
        </ScrollView>

        {selectedDay !== null && (
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View
              style={styles.sheetHandleArea}
              {...panResponder.panHandlers}
            >
              <View style={styles.sheetHandle} />
            </View>

            {selectedRecord ? (
              <View style={styles.recordContent}>
                <Text style={styles.recordDate}>
                  {visibleYear}년 {visibleMonthIndex + 1}월{" "}
                  {selectedDay}일
                </Text>

                <Text style={styles.recordTitle}>
                  {selectedRecord.missionTitle}
                </Text>

                {selectedRecord.photoUrl && (
                  <Image
                    source={{ uri: selectedRecord.photoUrl }}
                    style={styles.recordImage}
                  />
                )}

                {selectedRecord.emotion && (
                  <View style={styles.emotionTag}>
                    <Text style={styles.emotionTagText}>
                      {selectedRecord.emotion}
                    </Text>
                  </View>
                )}

                <Text style={styles.recordDescription}>
                  {selectedRecord.content || "작성한 기록이 없어요."}
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
                    <Text style={styles.editButtonText}>수정</Text>
                  </Pressable>
                </View>
              </View>
            ) : selectedStartedMission ? (
              <View style={styles.emptyContent}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={styles.emptyTitle}>진행 중인 미션</Text>
                <Text style={styles.emptyDescription}>
                  {selectedStartedMission.missionTitle}
                </Text>
                <Pressable
                  onPress={handleGoToMission}
                  style={({ pressed }) => [
                    styles.emptyButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.emptyButtonText}>
                    미션 계속하기
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyContent}>
                <Text style={styles.emptyEmoji}>🌱</Text>
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