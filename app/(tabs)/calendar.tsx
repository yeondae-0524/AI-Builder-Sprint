import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

// 🌿 에세이 탭과 일치시킨 감성 파스텔 컬러 팔레트
const COLORS = {
  primary: "#315C4A",        // 메인 다크 그린
  primaryLight: "#E5EEE8",   // 연한 그린 칩/뱃지 배경
  primaryDark: "#26372E",    // 진한 텍스트용 그린
  accent: "#F2C96D",         // 노란 포인트 버튼
  pink: "#EC4899",
  pinkLight: "#FCE7F3",

  textMain: "#26372E",
  textSub: "#65766D",
  textMuted: "#9AA49F",

  border: "#E2E3DC",
  white: "#FFFFFF",
  background: "#F5F2E9",     // 따뜻한 베이지 배경

  sunday: "#D43B30",
};

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SHEET_CLOSED_POSITION = SCREEN_HEIGHT;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const RECOMMENDED_GOALS = [
  "☕ 새로운 동네 카페 탐험",
  "🏃‍♂️ 머릿속 잡생각 비우기",
  "🎨 일상 속 작은 영감 찾기",
  "🌿 오롯이 나에게 집중하는 시간",
];

type CalendarCell = number | null;

type Journey = {
  id: string;
  title: string;
  duration_days: number;
  target_record_count: number;
  start_date: string;
  end_date: string;
  status: string;
  goal?: string | null;
};

type CalendarRecord = {
  id: string;
  mission_attempt_id: string | null;
  recorded_at: string;
  emotion: string | null;
  content: string | null;
  visibility: "private" | "anonymous" | "nickname" | null;
  missionTitle: string;
  photoUrl: string | null;
  photoUrls: string[];
};

type StartedMission = {
  id: string;
  started_at: string;
  missionTitle: string;
};

type JourneyOption = {
  label: string;
  title: string;
  durationDays: number;
  targetRecordCount: number;
  description: string;
};

const JOURNEY_OPTIONS: JourneyOption[] = [
  {
    label: "1주",
    title: "1주의 여정",
    durationDays: 7,
    targetRecordCount: 4,
    description: "7일 동안 4일 기록",
  },
  {
    label: "2주",
    title: "2주의 여정",
    durationDays: 14,
    targetRecordCount: 7,
    description: "14일 동안 7일 기록",
  },
  {
    label: "한 달",
    title: "한 달의 여정",
    durationDays: 30,
    targetRecordCount: 15,
    description: "30일 동안 15일 기록",
  },
];

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

function addDays(date: Date, days: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  );
}

function formatKoreanDate(dateKey: string) {
  const date = parseDateKey(dateKey);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function getRecordDateKey(recordedAt: string | null | undefined) {
  if (!recordedAt) return "";
  return recordedAt.slice(0, 10);
}

function getCompletedDayCount(records: Array<{ recorded_at?: string | null }>) {
  return new Set(
    records.map((record) => getRecordDateKey(record.recorded_at)).filter(Boolean),
  ).size;
}

function getLocalDayFromTimestamp(timestamp: string) {
  return new Date(timestamp).getDate();
}

const EMOTION_INFO: Record<string, { emoji: string; label: string }> = {
  comfortable: { emoji: "😌", label: "편안해요" },
  joyful: { emoji: "😊", label: "즐거워요" },
  new: { emoji: "✨", label: "새로워요" },
  uncomfortable: { emoji: "😣", label: "불편해요" },
  unsure: { emoji: "🤔", label: "잘 모르겠어요" },
};

function getEmotionInfo(value: string | null) {
  if (!value) return null;
  return (
    EMOTION_INFO[value] ?? {
      emoji: "🙂",
      label: value,
    }
  );
}

function getVisibilityLabel(value: CalendarRecord["visibility"]) {
  if (value === "anonymous") return "익명 공유";
  if (value === "nickname") return "닉네임 공유";
  return "나만 보기";
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
  const [journeyCompletedDayCount, setJourneyCompletedDayCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingJourney, setIsCreatingJourney] = useState(false);
  const [isStoppingJourney, setIsStoppingJourney] = useState(false);
  const [journeyStartPickerVisible, setJourneyStartPickerVisible] =
    useState(false);
  const [pendingJourneyOption, setPendingJourneyOption] =
    useState<JourneyOption | null>(null);
  const [selectedJourneyStartKey, setSelectedJourneyStartKey] =
    useState(todayKey);
  const [journeyStartMonth, setJourneyStartMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [journeyGoal, setJourneyGoal] = useState("");

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

  const journeyStartPickerYear = journeyStartMonth.getFullYear();
  const journeyStartPickerMonthIndex = journeyStartMonth.getMonth();
  const journeyStartPickerTotalDays = new Date(
    journeyStartPickerYear,
    journeyStartPickerMonthIndex + 1,
    0,
  ).getDate();
  const journeyStartPickerStartDay = new Date(
    journeyStartPickerYear,
    journeyStartPickerMonthIndex,
    1,
  ).getDay();
  const journeyStartPickerCells: CalendarCell[] = [
    ...Array<null>(journeyStartPickerStartDay).fill(null),
    ...Array.from(
      { length: journeyStartPickerTotalDays },
      (_, index) => index + 1,
    ),
  ];
  const earliestJourneyStartDate = pendingJourneyOption
    ? addDays(todayStart, -(pendingJourneyOption.durationDays - 1))
    : todayStart;
  const earliestJourneyStartKey = toDateKey(earliestJourneyStartDate);
  const selectedJourneyEndKey = pendingJourneyOption
    ? toDateKey(
        addDays(
          parseDateKey(selectedJourneyStartKey),
          pendingJourneyOption.durationDays - 1,
        ),
      )
    : selectedJourneyStartKey;
  const earliestJourneyStartMonth = new Date(
    earliestJourneyStartDate.getFullYear(),
    earliestJourneyStartDate.getMonth(),
    1,
  );
  const latestJourneyStartMonth = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth(),
    1,
  );
  const canMoveJourneyStartMonthBackward =
    journeyStartMonth.getTime() > earliestJourneyStartMonth.getTime();
  const canMoveJourneyStartMonthForward =
    journeyStartMonth.getTime() < latestJourneyStartMonth.getTime();

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadCalendarData = async () => {
        setIsLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (userError || !user) {
          console.error("사용자 정보 불러오기 실패:", userError?.message);
          setIsLoading(false);
          return;
        }

        const [journeyResult, recordsResult, startedResult] = await Promise.all([
          supabase
            .from("journeys")
            .select("id, title, duration_days, target_record_count, start_date, end_date, status, goal")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("start_date", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("records")
            .select("id, mission_attempt_id, recorded_at, created_at, emotion, content, visibility")
            .eq("user_id", user.id)
            .gte("recorded_at", monthStartKey)
            .lt("recorded_at", nextMonthStartKey)
            .order("recorded_at", { ascending: true })
            .order("created_at", { ascending: true }),

          supabase
            .from("mission_attempts")
            .select("id, mission_id, started_at")
            .eq("user_id", user.id)
            .not("started_at", "is", null)
            .is("completed_at", null)
            .gte("started_at", monthStart.toISOString())
            .lt("started_at", nextMonthStart.toISOString()),
        ]);

        if (!isMounted) return;

        const currentJourney = (journeyResult.data as Journey | null) ?? null;
        const rawRecords = recordsResult.data ?? [];
        const rawStartedMissions = startedResult.data ?? [];

        let currentJourneyCompletedDayCount = 0;

        if (currentJourney) {
          const { data: journeyRecords } = await supabase
            .from("records")
            .select("recorded_at")
            .eq("user_id", user.id)
            .eq("journey_id", currentJourney.id)
            .order("recorded_at", { ascending: true });

          currentJourneyCompletedDayCount = getCompletedDayCount(journeyRecords ?? []);
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
          const { data: attempts } = await supabase
            .from("mission_attempts")
            .select("id, mission_id")
            .in("id", recordAttemptIds);

          (attempts ?? []).forEach((attempt) => {
            attemptIdToMissionId.set(attempt.id, attempt.mission_id);
          });
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
          const { data: missions } = await supabase
            .from("missions")
            .select("id, title")
            .in("id", missionIds);

          (missions ?? []).forEach((mission) => {
            missionTitleById.set(mission.id, mission.title);
          });
        }

        const recordIds = rawRecords.map((record) => record.id);
        const photoPathsByRecordId = new Map<string, string[]>();
        const signedUrlByPath = new Map<string, string>();

        if (recordIds.length > 0) {
          const { data: photos } = await supabase
            .from("record_photos")
            .select("record_id, storage_path, sort_order, is_cover")
            .in("record_id", recordIds)
            .order("is_cover", { ascending: false })
            .order("sort_order", { ascending: true });

          (photos ?? []).forEach((photo) => {
            const recordId = String(photo.record_id);
            const storagePath = String(photo.storage_path ?? "");
            if (!storagePath) return;

            const currentPaths = photoPathsByRecordId.get(recordId) ?? [];
            if (!currentPaths.includes(storagePath)) {
              photoPathsByRecordId.set(recordId, [...currentPaths, storagePath]);
            }
          });

          const photoPaths = Array.from(
            new Set(Array.from(photoPathsByRecordId.values()).flat()),
          );

          if (photoPaths.length > 0) {
            const { data: signedPhotos } = await supabase.storage
              .from("record-photos")
              .createSignedUrls(photoPaths, 60 * 60);

            (signedPhotos ?? []).forEach((photo) => {
              if (photo.path && photo.signedUrl) {
                signedUrlByPath.set(photo.path, photo.signedUrl);
              }
            });
          }
        }

        const normalizedRecords: CalendarRecord[] = rawRecords.map((record) => {
          const missionId = record.mission_attempt_id
            ? attemptIdToMissionId.get(record.mission_attempt_id)
            : undefined;
          const photoPaths = photoPathsByRecordId.get(String(record.id)) ?? [];
          const photoUrls = photoPaths
            .map((path) => signedUrlByPath.get(path))
            .filter((url): url is string => Boolean(url));

          return {
            id: record.id,
            mission_attempt_id: record.mission_attempt_id,
            recorded_at: record.recorded_at,
            emotion: record.emotion,
            content: record.content,
            visibility: record.visibility as any,
            missionTitle:
              (missionId ? missionTitleById.get(missionId) : undefined) ?? "기록한 경험",
            photoUrl: photoUrls[0] ?? null,
            photoUrls,
          };
        });

        const normalizedStartedMissions: StartedMission[] = rawStartedMissions.map((attempt) => ({
          id: attempt.id,
          started_at: attempt.started_at,
          missionTitle: missionTitleById.get(attempt.mission_id) ?? "진행 중인 미션",
        }));

        if (!isMounted) return;

        setJourney(currentJourney);
        setJourneyCompletedDayCount(currentJourneyCompletedDayCount);
        setRecords(normalizedRecords);
        setStartedMissions(normalizedStartedMissions);
        setIsLoading(false);
      };

      void loadCalendarData();

      return () => {
        isMounted = false;
      };
    }, [monthStartKey, nextMonthStartKey, todayKey]),
  );

  useEffect(() => {
    if (!isSheetOpen) return;

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
        const nextPosition = dragStartPosition.current + gestureState.dy;
        const limitedPosition = Math.max(0, Math.min(nextPosition, SHEET_CLOSED_POSITION));
        sheetTranslateY.setValue(limitedPosition);
      },
      onPanResponderRelease: (_event, gestureState) => {
        const currentPosition = Math.max(0, dragStartPosition.current + gestureState.dy);
        const shouldClose = currentPosition > 110 || gestureState.vy > 0.7;

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
      : toDateKey(new Date(visibleYear, visibleMonthIndex, selectedDay));

  const selectedRecords =
    selectedDateKey === null
      ? []
      : records.filter((record) => getRecordDateKey(record.recorded_at) === selectedDateKey);

  const selectedStartedMission =
    selectedDay === null
      ? null
      : startedMissions.find(
          (mission) => getLocalDayFromTimestamp(mission.started_at) === selectedDay,
        ) ?? null;

  const completedDateKeys = new Set(
    records.map((record) => getRecordDateKey(record.recorded_at)).filter(Boolean),
  );
  const startedDays = new Set(
    startedMissions.map((mission) => getLocalDayFromTimestamp(mission.started_at)),
  );

  const journeyTarget = journey?.target_record_count ?? 0;
  const hasJourneyGoal = journeyGoal.trim().length > 0;
  const remainingDays = Math.max(journeyTarget - journeyCompletedDayCount, 0);
  const progressPercentage = (
    journeyTarget > 0
      ? `${Math.min((journeyCompletedDayCount / journeyTarget) * 100, 100)}%`
      : "0%"
  ) as `${number}%`;
  const isJourneyGoalReached =
    journey !== null && journeyTarget > 0 && journeyCompletedDayCount >= journeyTarget;
  const isJourneyPeriodEnded =
    journey !== null && parseDateKey(journey.end_date).getTime() < todayStart.getTime();
  const dDay =
    journey && !isJourneyPeriodEnded
      ? Math.max(
          0,
          Math.ceil(
            (parseDateKey(journey.end_date).getTime() - todayStart.getTime()) / DAY_IN_MS,
          ),
        )
      : null;

  const handleStartJourney = (option: JourneyOption) => {
    if (!journeyGoal.trim()) {
      Alert.alert("목표 설정", "이번 여정의 목표를 입력하거나 선택해 주세요!");
      return;
    }

    setPendingJourneyOption(option);
    setSelectedJourneyStartKey(todayKey);
    setJourneyStartMonth(new Date(todayStart.getFullYear(), todayStart.getMonth(), 1));
    setJourneyStartPickerVisible(true);
  };

  const closeJourneyStartPicker = () => {
    if (isCreatingJourney) return;
    setJourneyStartPickerVisible(false);
    setPendingJourneyOption(null);
  };

  const moveJourneyStartMonth = (offset: number) => {
    const nextMonth = new Date(
      journeyStartPickerYear,
      journeyStartPickerMonthIndex + offset,
      1,
    );

    if (
      nextMonth.getTime() < earliestJourneyStartMonth.getTime() ||
      nextMonth.getTime() > latestJourneyStartMonth.getTime()
    ) {
      return;
    }

    setJourneyStartMonth(nextMonth);
  };

  const confirmJourneyStart = async () => {
    if (!pendingJourneyOption || isCreatingJourney) return;

    const selectedStartDate = parseDateKey(selectedJourneyStartKey);

    if (
      selectedStartDate.getTime() < earliestJourneyStartDate.getTime() ||
      selectedStartDate.getTime() > todayStart.getTime()
    ) {
      Alert.alert(
        "시작일을 다시 선택해 주세요",
        "오늘이 여정 기간 안에 포함되도록 표시된 날짜 중에서 골라주세요.",
      );
      return;
    }

    setIsCreatingJourney(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("여정 시작 실패", userError?.message ?? "로그인 정보를 확인해 주세요.");
        return;
      }

      const endDate = addDays(selectedStartDate, pendingJourneyOption.durationDays - 1);

      const { data, error } = await supabase
        .from("journeys")
        .insert({
          user_id: user.id,
          title: pendingJourneyOption.title,
          duration_days: pendingJourneyOption.durationDays,
          target_record_count: pendingJourneyOption.targetRecordCount,
          start_date: selectedJourneyStartKey,
          end_date: toDateKey(endDate),
          status: "active",
          goal: journeyGoal.trim(),
        })
        .select("id, title, duration_days, target_record_count, start_date, end_date, status, goal")
        .single();

      if (error || !data) {
        Alert.alert("여정 시작 실패", error?.message ?? "여정 정보를 저장하지 못했습니다.");
        return;
      }

      setJourney(data as Journey);
      setJourneyCompletedDayCount(0);
      setVisibleMonth(
        new Date(selectedStartDate.getFullYear(), selectedStartDate.getMonth(), 1),
      );
      setJourneyStartPickerVisible(false);
      setPendingJourneyOption(null);
      setJourneyGoal("");

      Alert.alert(
        "여정 시작",
        `${pendingJourneyOption.title}이 ${formatKoreanDate(selectedJourneyStartKey)}부터 시작됐어요.`,
      );
    } finally {
      setIsCreatingJourney(false);
    }
  };

  const handleStopJourney = () => {
    if (!journey || isStoppingJourney) return;

    Alert.alert(
      "여정 중단하기",
      "여정을 중단하면 이 여정으로 에세이를 만드는 과정만 멈춰요. 지금까지 남긴 기록과 사진은 그대로 보관돼요.",
      [
        { text: "계속하기", style: "cancel" },
        {
          text: "여정 중단",
          style: "destructive",
          onPress: async () => {
            setIsStoppingJourney(true);
            try {
              const { error } = await supabase
                .from("journeys")
                .update({ status: "cancelled" })
                .eq("id", journey.id)
                .eq("status", "active");

              if (error) {
                Alert.alert("여정 중단 실패", error.message);
                return;
              }

              setJourney(null);
              setJourneyCompletedDayCount(0);

              Alert.alert(
                "여정이 중단됐어요",
                "기존 기록은 캘린더에 그대로 남아 있어요. 새 여정은 바로 다시 시작할 수 있어요.",
              );
            } finally {
              setIsStoppingJourney(false);
            }
          },
        },
      ],
    );
  };

  const handleDayPress = (day: number) => {
    const date = new Date(visibleYear, visibleMonthIndex, day);
    if (date.getTime() > todayStart.getTime()) return;

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
    setVisibleMonth(new Date(visibleYear, visibleMonthIndex + offset, 1));
  };

  const handleGoToMission = () => {
    setSelectedDay(null);
    router.push("/(tabs)");
  };

  const handleGoToEssay = () => {
    setSelectedDay(null);
    router.push("/(tabs)/essay");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 🌿 헤더 타이틀 영역 (에세이 탭 스타일 적용) */}
          <View style={styles.header}>
            <View style={styles.headerTextArea}>
              <Text style={styles.eyebrow}>CALENDAR & JOURNEY</Text>
              <Text style={styles.headerTitle}>기록 캘린더</Text>
              <Text style={styles.headerDescription}>
                나만의 여정과 일상의 기록들을 차곡차곡 확인해보세요.
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="calendar-outline" size={28} color="#315C4A" />
            </View>
          </View>

          {/* 🌿 여정 카드 (에세이 탭의 journeyCard 다크그린 스타일 적용) */}
          <View style={journey ? styles.journeyCard : styles.emptyJourneyCard}>
            {isLoading ? (
              <View style={styles.journeyLoadingArea}>
                <Text style={styles.journeyLoadingText}>
                  여정 정보를 불러오는 중...
                </Text>
              </View>
            ) : journey ? (
              <>
                <View style={styles.progressHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.journeyLabel}>
                      {isJourneyGoalReached ? "에세이 작성 대기 중" : "진행 중인 여정"}
                    </Text>
                    <Text style={styles.journeyTitleText}>{journey.title}</Text>

                    {/* 목표 뱃지 */}
                    {journey.goal ? (
                      <View style={styles.activeGoalBadge}>
                        <Text style={styles.activeGoalText}>🎯 {journey.goal}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.dDayBox}>
                    <Text style={styles.dDayCaption}>
                      {isJourneyGoalReached
                        ? "에세이"
                        : isJourneyPeriodEnded
                          ? "여정 기간"
                          : "종료일까지"}
                    </Text>
                    <Text style={styles.dDayText}>
                      {isJourneyGoalReached
                        ? "작성 가능"
                        : isJourneyPeriodEnded
                          ? "기간 지남"
                          : dDay === null
                            ? "--"
                            : `D-${dDay}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressInfoRow}>
                  <Text style={styles.progressDescription}>
                    {journeyTarget}일 중 {journeyCompletedDayCount}일 기록
                  </Text>
                  <Text style={styles.progressCount}>
                    {journeyCompletedDayCount}/{journeyTarget}
                  </Text>
                </View>

                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBarFill, { width: progressPercentage }]} />
                </View>

                <View
                  style={[
                    styles.essayNotice,
                    isJourneyGoalReached && styles.essayReadyNotice,
                  ]}
                >
                  <Text style={styles.essayNoticeText}>
                    {isJourneyGoalReached ? (
                      "목표를 모두 채웠어요. 에세이를 만들면 이 여정이 종료돼요."
                    ) : (
                      <>
                        에세이 작성까지{" "}
                        <Text style={styles.essayNoticeStrong}>{remainingDays}일</Text> 더 기록하면 돼요.
                      </>
                    )}
                  </Text>
                </View>

                {isJourneyGoalReached && (
                  <Pressable
                    onPress={handleGoToEssay}
                    style={({ pressed }) => [
                      styles.goToEssayButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons name="sparkles" size={17} color="#26372E" />
                    <Text style={styles.goToEssayButtonText}>에세이 만들러 가기</Text>
                  </Pressable>
                )}

                <Pressable
                  disabled={isStoppingJourney}
                  onPress={handleStopJourney}
                  style={({ pressed }) => [
                    styles.stopJourneyButton,
                    pressed && styles.buttonPressed,
                    isStoppingJourney && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.stopJourneyButtonText}>
                    {isStoppingJourney ? "여정을 중단하는 중..." : "여정 중단하기"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <View>
                <Text style={styles.journeyPickerCaption}>새 여정 시작하기</Text>

                {/* 🌟 목표 입력 영역 */}
                <View style={styles.goalContainer}>
                  <Text style={styles.journeyPickerTitle}>어떤 목표로 떠나볼까요?</Text>

                  <TextInput
                    style={styles.goalInput}
                    value={journeyGoal}
                    onChangeText={setJourneyGoal}
                    placeholder="나만의 목표를 입력해 보세요 (예: 동네 빵지순례)"
                    placeholderTextColor="#9AA49F"
                    maxLength={30}
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.goalChipScroll}
                  >
                    {RECOMMENDED_GOALS.map((goal) => (
                      <Pressable
                        key={goal}
                        onPress={() => setJourneyGoal(goal)}
                        style={[
                          styles.goalChip,
                          journeyGoal === goal && styles.goalChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.goalChipText,
                            journeyGoal === goal && styles.goalChipTextSelected,
                          ]}
                        >
                          {goal}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <Text style={[styles.journeyPickerTitle, { marginTop: 18 }]}>
                  어느 속도로 시작해볼까요?
                </Text>

                <View
                  style={[
                    styles.journeyOrderNotice,
                    hasJourneyGoal && styles.journeyOrderNoticeReady,
                  ]}
                >
                  <Ionicons
                    name={hasJourneyGoal ? "checkmark-circle" : "lock-closed"}
                    size={16}
                    color={hasJourneyGoal ? COLORS.primary : COLORS.textMuted}
                  />
                  <Text
                    style={[
                      styles.journeyOrderNoticeText,
                      hasJourneyGoal && styles.journeyOrderNoticeTextReady,
                    ]}
                  >
                    {hasJourneyGoal
                      ? "목표가 정해졌어요. 이제 기간과 시작일을 선택할 수 있어요."
                      : "먼저 위에서 목표를 입력하거나 추천 목표를 선택해주세요."}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.journeyPickerDescription,
                    !hasJourneyGoal && styles.journeyPickerDescriptionDisabled,
                  ]}
                >
                  기간을 고른 뒤 여정 시작일을 직접 선택할 수 있어요.
                </Text>

                <View style={styles.journeyOptionList}>
                  {JOURNEY_OPTIONS.map((option) => (
                    <Pressable
                      key={option.label}
                      disabled={isCreatingJourney || !hasJourneyGoal}
                      accessibilityState={{ disabled: isCreatingJourney || !hasJourneyGoal }}
                      onPress={() => handleStartJourney(option)}
                      style={({ pressed }) => [
                        styles.journeyOptionButton,
                        !hasJourneyGoal && styles.journeyOptionButtonLocked,
                        pressed && hasJourneyGoal && styles.buttonPressed,
                        isCreatingJourney && styles.disabledButton,
                      ]}
                    >
                      <View>
                        <Text
                          style={[
                            styles.journeyOptionLabel,
                            !hasJourneyGoal && styles.journeyOptionLabelLocked,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.journeyOptionDescription,
                            !hasJourneyGoal && styles.journeyOptionDescriptionLocked,
                          ]}
                        >
                          {option.description}
                        </Text>
                      </View>

                      <Ionicons
                        name={hasJourneyGoal ? "arrow-forward-circle" : "lock-closed"}
                        size={hasJourneyGoal ? 25 : 20}
                        color={hasJourneyGoal ? COLORS.primary : COLORS.textMuted}
                      />
                    </Pressable>
                  ))}
                </View>

                {isCreatingJourney && (
                  <Text style={styles.journeyCreatingText}>여정을 시작하는 중...</Text>
                )}
              </View>
            )}
          </View>

          {/* 🌿 월 선택 헤더 */}
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
                <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
              </Pressable>

              <Pressable
                onPress={() => moveMonth(1)}
                style={({ pressed }) => [
                  styles.monthButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
              </Pressable>
            </View>
          </View>

          {/* 🌿 요일 헤더 */}
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
                  <Text style={[styles.weekText, { color: dayColor }]}>{day}</Text>
                </View>
              );
            })}
          </View>

          {/* 🌿 캘린더 날짜 그리드 */}
          <View style={styles.calendarGrid}>
            {calendarCells.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.calendarCell} />;
              }

              const date = new Date(visibleYear, visibleMonthIndex, day);
              const dateKey = toDateKey(date);
              const dayRecords = records.filter(
                (record) => getRecordDateKey(record.recorded_at) === dateKey,
              );
              const dayPhotoUrl =
                dayRecords.find((record) => record.photoUrl)?.photoUrl ?? null;
              const isCompleted = completedDateKeys.has(dateKey);
              const isStarted = startedDays.has(day) && !isCompleted;
              const isToday = dateKey === todayKey;
              const isFuture = date.getTime() > todayStart.getTime();
              const isSelected = selectedDay === day;

              const isJourneyDay =
                journey !== null &&
                dateKey >= journey.start_date &&
                dateKey <= journey.end_date;

              const isJourneyStart = journey !== null && dateKey === journey.start_date;
              const isJourneyEnd = journey !== null && dateKey === journey.end_date;

              const isJourneySegmentStart =
                isJourneyDay && (isJourneyStart || index % 7 === 0 || day === 1);

              const isJourneySegmentEnd =
                isJourneyDay && (isJourneyEnd || index % 7 === 6 || day === totalDays);

              return (
                <Pressable
                  key={day}
                  disabled={isFuture}
                  onPress={() => handleDayPress(day)}
                  style={[
                    styles.calendarCell,
                    isFuture && !isJourneyDay && styles.futureCell,
                  ]}
                >
                  {isJourneyDay && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.journeyTrack,
                        isJourneySegmentStart && styles.journeyTrackStart,
                        isJourneySegmentEnd && styles.journeyTrackEnd,
                      ]}
                    />
                  )}

                  {isCompleted ? (
                    <View
                      style={[
                        styles.completedImageWrapper,
                        !dayPhotoUrl && styles.completedCheckWrapper,
                        isToday && styles.todayCompletedWrapper,
                        isSelected && styles.selectedImageWrapper,
                      ]}
                    >
                      {dayPhotoUrl ? (
                        <Image source={{ uri: dayPhotoUrl }} style={styles.completedImage} />
                      ) : (
                        <Ionicons name="checkmark" size={18} color={COLORS.primary} />
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
                        isSelected && !isToday && styles.selectedDayCircle,
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

        {/* 🌿 여정 시작일 선택 모달 */}
        <Modal
          visible={journeyStartPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={closeJourneyStartPicker}
        >
          <View style={styles.journeyStartModalOverlay}>
            <Pressable
              style={styles.journeyStartModalBackdrop}
              onPress={closeJourneyStartPicker}
            />

            <View style={styles.journeyStartModalCard}>
              <View style={styles.journeyStartModalHeader}>
                <View style={styles.journeyStartModalHeaderText}>
                  <Text style={styles.journeyStartModalCaption}>
                    {pendingJourneyOption?.label ?? "여정"} 시작일
                  </Text>
                  <Text style={styles.journeyStartModalTitle}>언제부터 시작할까요?</Text>
                  <Text style={styles.journeyStartModalDescription}>
                    오늘이 여정 기간 안에 포함되도록 표시된 날짜 중에서 시작일을 선택해 주세요.
                  </Text>
                </View>

                <Pressable
                  disabled={isCreatingJourney}
                  onPress={closeJourneyStartPicker}
                  style={({ pressed }) => [
                    styles.journeyStartModalClose,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="close" size={18} color={COLORS.textSub} />
                </Pressable>
              </View>

              <View style={styles.journeyStartPeriodBox}>
                <View style={styles.journeyStartPeriodItem}>
                  <Text style={styles.journeyStartPeriodLabel}>시작일</Text>
                  <Text style={styles.journeyStartPeriodValue}>
                    {formatKoreanDate(selectedJourneyStartKey)}
                  </Text>
                </View>

                <Ionicons name="arrow-forward" size={16} color={COLORS.textMuted} />

                <View style={styles.journeyStartPeriodItem}>
                  <Text style={styles.journeyStartPeriodLabel}>종료일</Text>
                  <Text style={styles.journeyStartPeriodValue}>
                    {formatKoreanDate(selectedJourneyEndKey)}
                  </Text>
                </View>
              </View>

              <View style={styles.journeyStartMonthHeader}>
                <Text style={styles.journeyStartMonthTitle}>
                  {journeyStartPickerYear}년 {journeyStartPickerMonthIndex + 1}월
                </Text>

                <View style={styles.journeyStartMonthButtons}>
                  <Pressable
                    disabled={!canMoveJourneyStartMonthBackward}
                    onPress={() => moveJourneyStartMonth(-1)}
                    style={({ pressed }) => [
                      styles.journeyStartMonthButton,
                      !canMoveJourneyStartMonthBackward && styles.disabledButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons name="chevron-back" size={17} color={COLORS.primary} />
                  </Pressable>

                  <Pressable
                    disabled={!canMoveJourneyStartMonthForward}
                    onPress={() => moveJourneyStartMonth(1)}
                    style={({ pressed }) => [
                      styles.journeyStartMonthButton,
                      !canMoveJourneyStartMonthForward && styles.disabledButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons name="chevron-forward" size={17} color={COLORS.primary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.journeyStartWeekRow}>
                {WEEK_DAYS.map((day) => (
                  <View key={`journey-start-${day}`} style={styles.journeyStartWeekCell}>
                    <Text
                      style={[
                        styles.journeyStartWeekText,
                        day === "일" && { color: COLORS.sunday },
                        day === "토" && { color: COLORS.primary },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.journeyStartCalendarGrid}>
                {journeyStartPickerCells.map((day, index) => {
                  if (day === null) {
                    return (
                      <View
                        key={`journey-start-empty-${index}`}
                        style={styles.journeyStartCalendarCell}
                      />
                    );
                  }

                  const date = new Date(
                    journeyStartPickerYear,
                    journeyStartPickerMonthIndex,
                    day,
                  );
                  const dateKey = toDateKey(date);
                  const disabled =
                    date.getTime() < earliestJourneyStartDate.getTime() ||
                    date.getTime() > todayStart.getTime();
                  const selected = dateKey === selectedJourneyStartKey;
                  const isToday = dateKey === todayKey;

                  return (
                    <Pressable
                      key={`journey-start-${dateKey}`}
                      disabled={disabled || isCreatingJourney}
                      onPress={() => setSelectedJourneyStartKey(dateKey)}
                      style={styles.journeyStartCalendarCell}
                    >
                      <View
                        style={[
                          styles.journeyStartDayCircle,
                          selected && styles.journeyStartDayCircleSelected,
                          !selected && isToday && styles.journeyStartTodayCircle,
                          disabled && styles.journeyStartDayCircleDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.journeyStartDayText,
                            selected && styles.journeyStartDayTextSelected,
                            disabled && styles.journeyStartDayTextDisabled,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.journeyStartRangeHelp}>
                선택 가능: {formatKoreanDate(earliestJourneyStartKey)} ~{" "}
                {formatKoreanDate(todayKey)}
              </Text>

              <Pressable
                disabled={isCreatingJourney}
                onPress={() => void confirmJourneyStart()}
                style={({ pressed }) => [
                  styles.journeyStartConfirmButton,
                  isCreatingJourney && styles.disabledButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.journeyStartConfirmButtonText}>
                  {isCreatingJourney ? "여정을 시작하는 중..." : "이 날짜로 여정 시작하기"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* 🌿 하단 기록 시트 */}
        {selectedDay !== null && (
          <Animated.View
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            <View style={styles.sheetHandleArea} {...panResponder.panHandlers}>
              <View style={styles.sheetHandle} />
            </View>

            {selectedRecords.length > 0 ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.dailyRecordsContent}
              >
                <View style={styles.dailyRecordsHeader}>
                  <View style={styles.dailyRecordsHeaderText}>
                    <Text style={styles.recordDate}>
                      {visibleYear}년 {visibleMonthIndex + 1}월 {selectedDay}일
                    </Text>
                    <Text style={styles.dailyRecordsTitle}>이날의 기록</Text>
                    <Text style={styles.dailyRecordsCount}>
                      {selectedRecords.length}개의 경험을 남겼어요
                    </Text>
                  </View>

                  <Pressable
                    onPress={closeSheet}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.sheetCloseButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons name="close" size={18} color={COLORS.textSub} />
                  </Pressable>
                </View>

                {selectedRecords.map((record, index) => {
                  const emotionInfo = getEmotionInfo(record.emotion);

                  return (
                    <View key={record.id} style={styles.dailyRecordCard}>
                      <Text style={styles.recordOrderCaption}>
                        내가 쓴 기록 {index + 1}
                      </Text>

                      <Text style={styles.recordTitle}>{record.missionTitle}</Text>

                      <View style={styles.recordMetaRow}>
                        {emotionInfo ? (
                          <View style={styles.emotionTag}>
                            <Text style={styles.emotionTagText}>
                              {emotionInfo.emoji} {emotionInfo.label}
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.visibilityTag}>
                          <Text style={styles.visibilityTagText}>
                            {getVisibilityLabel(record.visibility)}
                          </Text>
                        </View>
                      </View>

                      {record.photoUrls.length > 0 ? (
                        <ScrollView
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          style={styles.recordPhotoScroll}
                        >
                          {record.photoUrls.map((url) => (
                            <Image
                              key={url}
                              source={{ uri: url }}
                              style={styles.recordImage}
                              resizeMode="cover"
                            />
                          ))}
                        </ScrollView>
                      ) : null}

                      <View style={styles.recordTextBox}>
                        <Text style={styles.recordDescription}>
                          {record.content || "작성한 기록이 없어요."}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
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
                  <Text style={styles.emptyButtonText}>미션 계속하기</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyContent}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={styles.emptyTitle}>아직 채워진 하루가 없어요</Text>
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
                  <Text style={styles.emptyButtonText}>오늘의 미션 보러 가기</Text>
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
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  // 🌿 상단 헤더
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  headerTextArea: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
  },
  eyebrow: {
    color: "#789083",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  headerTitle: {
    color: COLORS.primaryDark,
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  headerDescription: {
    flexShrink: 1,
    color: "#65766D",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  headerIcon: {
    width: 54,
    height: 54,
    marginLeft: 10,
    flexShrink: 0,
    borderRadius: 18,
    backgroundColor: "#E1E9E3",
    alignItems: "center",
    justifyContent: "center",
  },

  // 🌿 여정 카드 (에세이 탭 다크그린 #315C4A 톤앤매너)
  journeyCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },
  emptyJourneyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  journeyLoadingArea: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyLoadingText: {
    fontSize: 13,
    color: "#BFD0C7",
  },
  journeyLabel: {
    color: "#BFD0C7",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  journeyTitleText: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: "800",
  },
  activeGoalBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeGoalText: {
    color: "#E1E9E3",
    fontSize: 12,
    fontWeight: "700",
  },
  dDayBox: {
    minWidth: 70,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 10,
  },
  dDayCaption: {
    fontSize: 10,
    color: "#D8E2DC",
    marginBottom: 2,
  },
  dDayText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.accent,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  progressInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressDescription: {
    fontSize: 13,
    color: "#D8E2DC",
  },
  progressCount: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accent,
  },
  progressBarBackground: {
    height: 6,
    marginBottom: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 3,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  essayNotice: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
  },
  essayNoticeText: {
    fontSize: 12,
    color: "#D8E2DC",
  },
  essayNoticeStrong: {
    fontWeight: "800",
    color: COLORS.accent,
  },
  essayReadyNotice: {
    backgroundColor: "rgba(242, 201, 109, 0.2)",
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  goToEssayButton: {
    minHeight: 48,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
  },
  goToEssayButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  stopJourneyButton: {
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stopJourneyButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#BFD0C7",
    textDecorationLine: "underline",
  },

  // 🌿 목표 설정 UI 스타일
  journeyPickerCaption: {
    marginBottom: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  journeyPickerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 6,
  },
  journeyPickerDescription: {
    marginBottom: 14,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSub,
  },
  journeyPickerDescriptionDisabled: {
    color: COLORS.textMuted,
  },
  journeyOrderNotice: {
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F2F1EC",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  journeyOrderNoticeReady: {
    backgroundColor: COLORS.primaryLight,
    borderColor: "#C8D8CF",
  },
  journeyOrderNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textMuted,
  },
  journeyOrderNoticeTextReady: {
    fontWeight: "700",
    color: COLORS.primary,
  },
  goalContainer: {
    marginBottom: 10,
    marginTop: 6,
  },
  goalInput: {
    height: 48,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.textMain,
    marginBottom: 10,
  },
  goalChipScroll: {
    flexDirection: "row",
  },
  goalChip: {
    marginRight: 8,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  goalChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  goalChipText: {
    fontSize: 12,
    color: COLORS.textSub,
  },
  goalChipTextSelected: {
    fontWeight: "800",
    color: COLORS.primary,
  },
  journeyOptionList: {
    gap: 8,
  },
  journeyOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "#C8D8CF",
    borderRadius: 14,
  },
  journeyOptionButtonLocked: {
    backgroundColor: "#F1F0EB",
    borderColor: "#E4E2DA",
  },
  journeyOptionLabel: {
    marginBottom: 2,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },
  journeyOptionLabelLocked: {
    color: COLORS.textMuted,
  },
  journeyOptionDescription: {
    fontSize: 11,
    color: COLORS.textSub,
  },
  journeyOptionDescriptionLocked: {
    color: "#B5BBB7",
  },
  journeyCreatingText: {
    marginTop: 10,
    fontSize: 11,
    textAlign: "center",
    color: COLORS.textMuted,
  },
  disabledButton: {
    opacity: 0.55,
  },

  // 🌿 월 선택 헤더
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  monthButtonContainer: {
    flexDirection: "row",
    gap: 6,
  },
  monthButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },

  // 🌿 요일
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekCell: {
    width: "14.285714%",
    alignItems: "center",
    paddingBottom: 4,
  },
  weekText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // 🌿 날짜 및 캘린더 그리드
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -2,
  },
  calendarCell: {
    position: "relative",
    width: "14.2%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
  },
  journeyTrack: {
    position: "absolute",
    top: 4,
    right: 0,
    left: 0,
    height: 34,
    backgroundColor: COLORS.primaryLight,
  },
  journeyTrackStart: {
    borderTopLeftRadius: 17,
    borderBottomLeftRadius: 17,
  },
  journeyTrackEnd: {
    borderTopRightRadius: 17,
    borderBottomRightRadius: 17,
  },
  futureCell: {
    opacity: 0.3,
  },
  normalDayCircle: {
    zIndex: 1,
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
    fontWeight: "500",
    color: COLORS.textMain,
  },
  todayCircle: {
    backgroundColor: COLORS.primary,
  },
  todayText: {
    fontWeight: "800",
    color: COLORS.white,
  },
  startedDayCircle: {
    position: "relative",
    zIndex: 1,
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
    fontWeight: "700",
    color: COLORS.primary,
  },
  completedImageWrapper: {
    position: "relative",
    zIndex: 1,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
    borderRadius: 18,
  },
  completedCheckWrapper: {
    backgroundColor: COLORS.primaryLight,
  },
  todayCompletedWrapper: {
    borderWidth: 3.5,
    borderColor: COLORS.primary,
  },
  selectedImageWrapper: {
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  completedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    borderRadius: 18,
  },
  completedDot: {
    position: "relative",
    zIndex: 1,
    width: 4,
    height: 4,
    marginTop: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  bottomSpace: {
    height: 120,
  },

  // 🌿 여정 시작일 모달
  journeyStartModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  journeyStartModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24, 35, 29, 0.52)",
  },
  journeyStartModalCard: {
    width: "100%",
    maxWidth: 430,
    padding: 20,
    backgroundColor: "#F9F7F1",
    borderRadius: 24,
  },
  journeyStartModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  journeyStartModalHeaderText: {
    flex: 1,
    paddingRight: 10,
  },
  journeyStartModalCaption: {
    marginBottom: 4,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  journeyStartModalTitle: {
    marginBottom: 5,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  journeyStartModalDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSub,
  },
  journeyStartModalClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderRadius: 18,
  },
  journeyStartPeriodBox: {
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
  },
  journeyStartPeriodItem: {
    flex: 1,
  },
  journeyStartPeriodLabel: {
    marginBottom: 3,
    fontSize: 10,
    color: COLORS.textSub,
  },
  journeyStartPeriodValue: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  journeyStartMonthHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  journeyStartMonthTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  journeyStartMonthButtons: {
    flexDirection: "row",
    gap: 5,
  },
  journeyStartMonthButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
  },
  journeyStartWeekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  journeyStartWeekCell: {
    width: "14.285714%",
    alignItems: "center",
    paddingVertical: 4,
  },
  journeyStartWeekText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  journeyStartCalendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  journeyStartCalendarCell: {
    width: "14.285714%",
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyStartDayCircle: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  journeyStartDayCircleSelected: {
    backgroundColor: COLORS.primary,
  },
  journeyStartTodayCircle: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  journeyStartDayCircleDisabled: {
    opacity: 0.25,
  },
  journeyStartDayText: {
    fontSize: 13,
    color: COLORS.textMain,
  },
  journeyStartDayTextSelected: {
    fontWeight: "800",
    color: COLORS.white,
  },
  journeyStartDayTextDisabled: {
    color: COLORS.textMuted,
  },
  journeyStartRangeHelp: {
    marginTop: 8,
    marginBottom: 14,
    textAlign: "center",
    fontSize: 11,
    color: COLORS.textSub,
  },
  journeyStartConfirmButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  journeyStartConfirmButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
  },

  // 🌿 하단 기록 바텀시트
  bottomSheet: {
    position: "absolute",
    maxHeight: "82%",
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    paddingBottom: 104,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -8 },
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
  dailyRecordsContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  dailyRecordsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  dailyRecordsHeaderText: {
    flex: 1,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderRadius: 18,
  },
  recordDate: {
    marginBottom: 4,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  dailyRecordsTitle: {
    marginBottom: 3,
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  dailyRecordsCount: {
    fontSize: 11,
    color: COLORS.textSub,
  },
  dailyRecordCard: {
    marginBottom: 14,
    padding: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  recordOrderCaption: {
    marginBottom: 5,
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  recordTitle: {
    marginBottom: 10,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  recordMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 13,
  },
  emotionTag: {
    alignSelf: "flex-start",
    marginRight: 7,
    marginBottom: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.pinkLight,
    borderRadius: 8,
  },
  emotionTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.pink,
  },
  visibilityTag: {
    alignSelf: "flex-start",
    marginBottom: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  visibilityTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  recordPhotoScroll: {
    marginBottom: 13,
  },
  recordImage: {
    width: SCREEN_WIDTH - 72,
    height: 220,
    marginRight: 8,
    backgroundColor: COLORS.border,
    borderRadius: 14,
  },
  recordTextBox: {
    padding: 15,
    backgroundColor: COLORS.background,
    borderRadius: 13,
  },
  recordDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: COLORS.textMain,
  },
  buttonPressed: {
    opacity: 0.76,
  },

  // 🌿 기록 없는 날짜 UI
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
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  emptyDescription: {
    marginBottom: 20,
    fontSize: 13,
    color: COLORS.textSub,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
  },
});