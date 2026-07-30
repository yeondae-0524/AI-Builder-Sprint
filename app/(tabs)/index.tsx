import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";
import {
  Mission as BackendMission,
  getRecommendedMissions,
} from "../../services/challenge.service";
import { KakaoMapView } from "./_kakao-map";

const BL = "#3D5AFE";
const BLL = "#EEF1FF";
const PINK = "#EC4899";
const PINK_LIGHT = "#FCE7F3";
const T0 = "#0F0F0F";
const T1 = "#5C5F6A";
const T2 = "#9EA3AE";
const T3 = "#E4E6EA";
const WH = "#FFFFFF";
const BG = "#F7F8FA";
const SUCCESS = "#10B981";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT - 90;
const TAB_BAR_SPACE = 105;
const COLLAPSED_HEADER_HEIGHT = 100;
const COLLAPSED_VISIBLE_HEIGHT =
  TAB_BAR_SPACE + COLLAPSED_HEADER_HEIGHT;
const COLLAPSED_POSITION =
  SHEET_HEIGHT - COLLAPSED_VISIBLE_HEIGHT;

const DEFAULT_CENTER = {
  lat: 35.1795543,
  lng: 129.0756416,
};

const CATEGORIES = [
  "음식",
  "카페 및 디저트",
  "산책",
  "배움",
  "감상",
  "활동",
  "휴식",
  "기타",
] as const;

type CategoryName = (typeof CATEGORIES)[number];

type HomeMission = {
  id: string;
  title: string;
  desc: string;
  instructions: string;
  recommendationReason: string;
  time: string;
  dist: string;
  cost: string;
  cat: CategoryName;
  requiredItems: string[];
  placeId?: string;
  placeLat?: number;
  placeLng?: number;
  placeName?: string;
  isFallback?: boolean;
};

type ExtendedBackendMission = BackendMission & {
  place_id?: string | null;
  place_lat?: number | null;
  place_lng?: number | null;
  place_name?: string | null;
  distance_km?: number | null;
  distance?: number | null;
};

type ActiveJourney = {
  id: string;
};

type StartedAttempt = {
  id: string;
  journeyId: string;
  missionId: string;
  placeId: string | null;
};

type RecordVisibility = "private" | "anonymous";
type EmotionValue =
  | "comfortable"
  | "joyful"
  | "new"
  | "uncomfortable"
  | "unsure";

const MAX_RECORD_PHOTOS = 5;

const EMOTIONS: Array<{
  label: string;
  value: EmotionValue;
  emoji: string;
}> = [
  { label: "편안해요", value: "comfortable", emoji: "😌" },
  { label: "즐거워요", value: "joyful", emoji: "😊" },
  { label: "새로워요", value: "new", emoji: "✨" },
  { label: "불편해요", value: "uncomfortable", emoji: "😣" },
  { label: "잘 모르겠어요", value: "unsure", emoji: "🤔" },
];

const FALLBACK_MISSIONS: HomeMission[] = [
  {
    id: "fallback-cafe-reading",
    title: "조용한 카페에서 30분 독서",
    desc: "일상 속 작은 고요함을 찾아봐요.",
    instructions:
      "가까운 카페의 편안한 자리를 골라 30분 동안 책 한 권을 천천히 읽어보세요.",
    recommendationReason:
      "조용한 공간에서 혼자 집중하는 경험을 선호할 가능성이 높아 추천했어요.",
    time: "30분",
    dist: "0.3km",
    cost: "음료비",
    cat: "배움",
    requiredItems: ["책 한 권"],
    placeLat: 35.13656,
    placeLng: 129.05952,
    placeName: "가까운 카페",
    isFallback: true,
  },
  {
    id: "fallback-park-photo",
    title: "공원 산책하며 계절 사진 찍기",
    desc: "지금 계절의 색을 카메라에 담아봐요.",
    instructions:
      "가까운 공원을 천천히 걸으며 지금 가장 눈에 들어오는 풍경을 사진으로 남겨보세요.",
    recommendationReason:
      "가벼운 이동과 관찰을 함께 할 수 있어 부담 없이 시작하기 좋아요.",
    time: "20분",
    dist: "0.5km",
    cost: "무료",
    cat: "산책",
    requiredItems: ["휴대폰"],
    placeLat: 35.16862,
    placeLng: 129.05748,
    placeName: "부산시민공원",
    isFallback: true,
  },
  {
    id: "fallback-bakery",
    title: "처음 가는 빵집에서 새로운 빵 먹기",
    desc: "익숙하지 않은 맛을 하나 골라봐요.",
    instructions:
      "지나가며 궁금했던 빵집에 들어가 평소 고르지 않던 빵 하나를 선택해 맛을 천천히 느껴보세요.",
    recommendationReason:
      "짧은 시간 안에 새로운 감각을 경험할 수 있어 추천했어요.",
    time: "15분",
    dist: "0.7km",
    cost: "3,000원",
    cat: "카페 및 디저트",
    requiredItems: [],
    placeLat: 35.1517,
    placeLng: 129.0612,
    placeName: "근처 빵집",
    isFallback: true,
  },
];

function normalizeCategory(
  value: string | null | undefined,
): CategoryName {
  const category = value?.trim() ?? "";

  if (
    CATEGORIES.includes(category as CategoryName)
  ) {
    return category as CategoryName;
  }

  if (
    category.includes("카페") ||
    category.includes("디저트") ||
    category.includes("빵")
  ) {
    return "카페 및 디저트";
  }

  if (
    category.includes("독서") ||
    category.includes("공부") ||
    category.includes("배움")
  ) {
    return "배움";
  }

  if (
    category.includes("음악") ||
    category.includes("영화") ||
    category.includes("공연") ||
    category.includes("전시")
  ) {
    return "감상";
  }

  if (category.includes("산책")) {
    return "산책";
  }

  if (
    category.includes("운동") ||
    category.includes("체험") ||
    category.includes("활동")
  ) {
    return "활동";
  }

  if (category.includes("휴식")) {
    return "휴식";
  }

  if (
    category.includes("음식") ||
    category.includes("식사") ||
    category.includes("맛집")
  ) {
    return "음식";
  }

  return "기타";
}

function isFiniteNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function isUuid(value: string | undefined) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(date.getDate()).padStart(
    2,
    "0",
  );

  return `${year}-${month}-${day}`;
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = String(
      (error as { message?: unknown }).message ?? "",
    ).trim();

    if (message) {
      return message;
    }
  }

  return fallback;
}

function getPhotoExtension(
  photo: ImagePicker.ImagePickerAsset,
) {
  const fileNameExtension = photo.fileName
    ?.split(".")
    .pop()
    ?.toLowerCase();

  if (fileNameExtension) {
    return fileNameExtension === "jpeg"
      ? "jpg"
      : fileNameExtension;
  }

  const mimeExtension = photo.mimeType
    ?.split("/")[1]
    ?.split("+")[0]
    ?.toLowerCase();

  if (mimeExtension) {
    return mimeExtension === "jpeg"
      ? "jpg"
      : mimeExtension;
  }

  const uriExtension = photo.uri
    .split("?")[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  if (uriExtension && uriExtension.length <= 5) {
    return uriExtension === "jpeg"
      ? "jpg"
      : uriExtension;
  }

  return "jpg";
}

function getPhotoContentType(
  photo: ImagePicker.ImagePickerAsset,
  extension: string,
) {
  if (photo.mimeType) {
    return photo.mimeType;
  }

  return extension === "jpg"
    ? "image/jpeg"
    : `image/${extension}`;
}

function mapBackendMission(
  backendMission: ExtendedBackendMission,
): HomeMission {
  const distance =
    backendMission.distance_km ??
    backendMission.distance;

  return {
    id: String(backendMission.id),
    title: backendMission.title,
    desc:
      backendMission.short_description ||
      "새로운 경험을 시작해보세요.",
    instructions:
      backendMission.instructions ||
      backendMission.short_description ||
      "미션 안내에 따라 경험을 진행해보세요.",
    recommendationReason:
      backendMission.recommendation_reason ||
      "현재 취향과 조건을 고려해 추천했어요.",
    time: backendMission.estimated_duration_min
      ? `${backendMission.estimated_duration_min}분`
      : "-",
    dist: isFiniteNumber(distance)
      ? `${distance.toFixed(1)}km`
      : "-",
    cost:
      backendMission.estimated_cost == null ||
      backendMission.estimated_cost === 0
        ? "무료"
        : `${backendMission.estimated_cost.toLocaleString()}원`,
    cat: normalizeCategory(
      backendMission.category?.name,
    ),
    requiredItems: Array.isArray(
      backendMission.required_items,
    )
      ? backendMission.required_items
      : [],
    placeId:
      backendMission.place_id ?? undefined,
    placeLat: isFiniteNumber(
      backendMission.place_lat,
    )
      ? backendMission.place_lat
      : undefined,
    placeLng: isFiniteNumber(
      backendMission.place_lng,
    )
      ? backendMission.place_lng
      : undefined,
    placeName:
      backendMission.place_name ?? undefined,
  };
}

function getPreparationText(mission: HomeMission) {
  if (mission.requiredItems.length === 0) {
    return "별도 준비물 없음";
  }

  return mission.requiredItems.join(", ");
}

function getCategoryEmoji(category: CategoryName) {
  const emojis: Record<CategoryName, string> = {
    음식: "🍽️",
    "카페 및 디저트": "☕",
    산책: "🌿",
    배움: "📚",
    감상: "🎧",
    활동: "🏃",
    휴식: "🛋️",
    기타: "✨",
  };

  return emojis[category];
}

export default function HomeScreen() {
  const [missions, setMissions] =
    useState<HomeMission[]>(FALLBACK_MISSIONS);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] =
    useState<HomeMission | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [activeJourney, setActiveJourney] =
    useState<ActiveJourney | null>(null);
  const [startedAttempts, setStartedAttempts] =
    useState<Record<string, StartedAttempt>>({});
  const [completedMissionIds, setCompletedMissionIds] =
    useState<Set<string>>(new Set());
  const [startLoadingId, setStartLoadingId] =
    useState<string | null>(null);

  const [recordMission, setRecordMission] =
    useState<HomeMission | null>(null);
  const [recordContent, setRecordContent] =
    useState("");
  const [recordEmotion, setRecordEmotion] =
    useState<EmotionValue | "">("");
  const [recordVisibility, setRecordVisibility] =
    useState<RecordVisibility>("private");
  const [recordPhotos, setRecordPhotos] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [recordSaving, setRecordSaving] =
    useState(false);

  const locationRequested = useRef(false);
  const sheetTranslateY = useRef(
    new Animated.Value(COLLAPSED_POSITION),
  ).current;
  const dragStartPosition = useRef(
    COLLAPSED_POSITION,
  );
  const selectedCardAnimation = useRef(
    new Animated.Value(0),
  ).current;
  const selectedCardClosing = useRef(false);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(
        true,
      );
    }
  }, []);

  const moveSheet = useCallback(
    (destination: number) => {
      dragStartPosition.current = destination;

      Animated.spring(sheetTranslateY, {
        toValue: destination,
        useNativeDriver: true,
        damping: 24,
        stiffness: 190,
        mass: 0.9,
        overshootClamping: true,
      }).start();
    },
    [sheetTranslateY],
  );

  const loadJourneyAndAttempts = useCallback(
    async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setActiveJourney(null);
          setStartedAttempts({});
          setCompletedMissionIds(new Set());
          return;
        }

        const todayKey = toDateKey(new Date());

        const {
          data: journeyData,
          error: journeyError,
        } = await supabase
          .from("journeys")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .lte("start_date", todayKey)
          .gte("end_date", todayKey)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (journeyError) {
          throw journeyError;
        }

        if (!journeyData) {
          setActiveJourney(null);
          setStartedAttempts({});
          setCompletedMissionIds(new Set());
          return;
        }

        const journey = {
          id: String(journeyData.id),
        };

        setActiveJourney(journey);

        const {
          data: attemptRows,
          error: attemptsError,
        } = await supabase
          .from("mission_attempts")
          .select(
            "id, journey_id, mission_id, place_id, status, created_at",
          )
          .eq("user_id", user.id)
          .eq("journey_id", journey.id)
          .in("status", [
            "selected",
            "started",
            "completed",
          ])
          .order("created_at", {
            ascending: false,
          });

        if (attemptsError) {
          throw attemptsError;
        }

        const nextStartedAttempts: Record<
          string,
          StartedAttempt
        > = {};
        const nextCompletedMissionIds =
          new Set<string>();

        for (const row of attemptRows ?? []) {
          const missionId = String(row.mission_id);

          if (row.status === "completed") {
            nextCompletedMissionIds.add(missionId);
            continue;
          }

          if (!nextStartedAttempts[missionId]) {
            nextStartedAttempts[missionId] = {
              id: String(row.id),
              journeyId: String(row.journey_id),
              missionId,
              placeId: row.place_id
                ? String(row.place_id)
                : null,
            };
          }
        }

        setStartedAttempts(nextStartedAttempts);
        setCompletedMissionIds(
          nextCompletedMissionIds,
        );
      } catch (error) {
        console.error(
          "진행 중 미션 조회 실패:",
          error instanceof Error
            ? error.message
            : error,
        );
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void loadJourneyAndAttempts();
    }, [loadJourneyAndAttempts]),
  );

  useEffect(() => {
    const fetchMissions = async () => {
      setLoading(true);

      try {
        let latitude: number | undefined;
        let longitude: number | undefined;

        if (!locationRequested.current) {
          locationRequested.current = true;

          const { status } =
            await Location.requestForegroundPermissionsAsync();

          if (status === "granted") {
            const location =
              await Location.getCurrentPositionAsync({});

            latitude = location.coords.latitude;
            longitude = location.coords.longitude;

            setUserLocation({
              lat: latitude,
              lng: longitude,
            });
          }
        } else if (userLocation) {
          latitude = userLocation.lat;
          longitude = userLocation.lng;
        }

        const {
          data: aiData,
          error: aiError,
        } = await supabase.functions.invoke(
          "clever-task",
          {
            body: {
              category: "전체",
              cost: "무료/유료",
              locationType: "실내/실외",
              latitude,
              longitude,
            },
          },
        );

        if (!aiError) {
          const aiMissions =
            (aiData?.missions ?? []) as ExtendedBackendMission[];

          if (aiMissions.length > 0) {
            setMissions(
              aiMissions.map(mapBackendMission),
            );
            return;
          }
        }

        const databaseMissions =
          await getRecommendedMissions(8, 0);

        if (databaseMissions.length > 0) {
          setMissions(
            databaseMissions.map((mission) =>
              mapBackendMission(
                mission as ExtendedBackendMission,
              ),
            ),
          );
          return;
        }

        setMissions(FALLBACK_MISSIONS);
      } catch (error) {
        console.log(
          "AI 미션 추천 실패, 임시 데이터 사용:",
          error instanceof Error
            ? error.message
            : error,
        );

        try {
          const databaseMissions =
            await getRecommendedMissions(8, 0);

          if (databaseMissions.length > 0) {
            setMissions(
              databaseMissions.map((mission) =>
                mapBackendMission(
                  mission as ExtendedBackendMission,
                ),
              ),
            );
          } else {
            setMissions(FALLBACK_MISSIONS);
          }
        } catch {
          setMissions(FALLBACK_MISSIONS);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchMissions();
  }, []);

  const toggleSheet = () => {
    sheetTranslateY.stopAnimation(
      (currentPosition) => {
        const isCollapsed =
          currentPosition > COLLAPSED_POSITION / 2;

        moveSheet(
          isCollapsed ? 0 : COLLAPSED_POSITION,
        );
      },
    );
  };

  const finishDrag = (
    currentPosition: number,
    velocityY: number,
  ) => {
    if (velocityY < -0.35) {
      moveSheet(0);
      return;
    }

    if (velocityY > 0.35) {
      moveSheet(COLLAPSED_POSITION);
      return;
    }

    const shouldExpand =
      currentPosition < COLLAPSED_POSITION / 2;

    moveSheet(
      shouldExpand ? 0 : COLLAPSED_POSITION,
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () =>
        true,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dy) > 2,
      onMoveShouldSetPanResponderCapture: (
        _event,
        gesture,
      ) => Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation(
          (currentPosition) => {
            dragStartPosition.current =
              currentPosition;
          },
        );
      },
      onPanResponderMove: (_event, gesture) => {
        const nextPosition =
          dragStartPosition.current + gesture.dy;
        const limitedPosition = Math.max(
          0,
          Math.min(
            nextPosition,
            COLLAPSED_POSITION,
          ),
        );

        sheetTranslateY.setValue(limitedPosition);
      },
      onPanResponderRelease: (_event, gesture) => {
        const currentPosition = Math.max(
          0,
          Math.min(
            dragStartPosition.current + gesture.dy,
            COLLAPSED_POSITION,
          ),
        );

        if (Math.abs(gesture.dy) < 5) {
          toggleSheet();
          return;
        }

        finishDrag(currentPosition, gesture.vy);
      },
      onPanResponderTerminate: (
        _event,
        gesture,
      ) => {
        const currentPosition = Math.max(
          0,
          Math.min(
            dragStartPosition.current + gesture.dy,
            COLLAPSED_POSITION,
          ),
        );

        finishDrag(currentPosition, gesture.vy);
      },
      onPanResponderTerminationRequest: () =>
        false,
      onShouldBlockNativeResponder: () => true,
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

  const selectMission = (mission: HomeMission) => {
    if (selectedMission?.id === mission.id) {
      moveSheet(0);
      return;
    }

    LayoutAnimation.configureNext(
      LayoutAnimation.Presets.easeInEaseOut,
    );

    selectedCardClosing.current = false;
    selectedCardAnimation.stopAnimation();
    selectedCardAnimation.setValue(0);
    setSelectedMission(mission);
    moveSheet(0);

    requestAnimationFrame(() => {
      Animated.spring(selectedCardAnimation, {
        toValue: 1,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
        mass: 0.85,
        overshootClamping: true,
      }).start();
    });
  };

  const closeSelectedMission = () => {
    if (
      !selectedMission ||
      selectedCardClosing.current
    ) {
      return;
    }

    selectedCardClosing.current = true;
    selectedCardAnimation.stopAnimation();

    Animated.timing(selectedCardAnimation, {
      toValue: 0,
      duration: 190,
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext(
        LayoutAnimation.Presets.easeInEaseOut,
      );
      setSelectedMission(null);
      selectedCardClosing.current = false;
    });
  };

  const handleMarkerPress = (
    markerId: string | number,
  ) => {
    const mission = missions.find(
      (item) => String(item.id) === String(markerId),
    );

    if (mission) {
      selectMission(mission);
    }
  };

  const handleStartMission = async (
    mission: HomeMission,
  ) => {
    if (startedAttempts[mission.id]) {
      closeSelectedMission();
      return;
    }

    if (!activeJourney) {
      Alert.alert(
        "여정이 필요해요",
        "캘린더에서 여정 기간을 먼저 선택해주세요.",
      );
      return;
    }

    if (
      mission.isFallback ||
      !isUuid(mission.id)
    ) {
      Alert.alert(
        "임시 미션이에요",
        "AI 또는 데이터베이스에서 불러온 실제 미션만 시작할 수 있어요.",
      );
      return;
    }

    try {
      setStartLoadingId(mission.id);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }

      const now = new Date().toISOString();
      const placeId = isUuid(mission.placeId)
        ? mission.placeId
        : null;

      // 같은 미션의 진행 중 시도가 이미 있으면 새 행을 만들지 않고 재사용한다.
      // 빠르게 두 번 누르거나 화면 상태가 늦게 갱신되는 경우의 중복 생성을 막는다.
      const {
        data: existingAttempt,
        error: existingAttemptError,
      } = await supabase
        .from("mission_attempts")
        .select("id, journey_id, mission_id, place_id")
        .eq("user_id", user.id)
        .eq("journey_id", activeJourney.id)
        .eq("mission_id", mission.id)
        .in("status", ["selected", "started"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAttemptError) {
        throw existingAttemptError;
      }

      let attempt = existingAttempt;

      if (!attempt) {
        const {
          data: insertedAttempt,
          error: attemptError,
        } = await supabase
          .from("mission_attempts")
          .insert({
            user_id: user.id,
            journey_id: activeJourney.id,
            mission_id: mission.id,
            place_id: placeId,
            status: "selected",
            selected_at: now,
          })
          .select("id, journey_id, mission_id, place_id")
          .single();

        if (attemptError) {
          throw attemptError;
        }

        attempt = insertedAttempt;
      }

      if (!attempt) {
        throw new Error("생성된 미션 시도를 확인하지 못했습니다.");
      }

      setStartedAttempts((previous) => ({
        ...previous,
        [mission.id]: {
          id: String(attempt.id),
          journeyId: String(attempt.journey_id),
          missionId: String(attempt.mission_id),
          placeId: attempt.place_id
            ? String(attempt.place_id)
            : null,
        },
      }));

      closeSelectedMission();
      moveSheet(0);
    } catch (error) {
      console.error(
        "미션 시작 실패 전체 오류:",
        error,
      );

      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? String(
              (error as { code?: unknown }).code ?? "",
            )
          : "";
      const errorMessage = getErrorMessage(
        error,
        "미션을 시작하지 못했습니다.",
      );

      if (
        errorCode === "23505" &&
        errorMessage.includes(
          "one_active_mission_per_user",
        )
      ) {
        Alert.alert(
          "여러 미션 허용 설정이 필요해요",
          "데이터베이스에 한 사람당 진행 중 미션을 하나만 허용하는 기존 제약조건이 남아 있어요. 안내한 SQL을 Supabase SQL Editor에서 한 번 실행해주세요.",
        );
        return;
      }

      if (errorCode === "23505") {
        await loadJourneyAndAttempts();
        closeSelectedMission();
        return;
      }

      Alert.alert(
        "미션 시작 실패",
        errorMessage,
      );
    } finally {
      setStartLoadingId(null);
    }
  };

  const openRecordModal = (mission: HomeMission) => {
    if (!startedAttempts[mission.id]) {
      Alert.alert(
        "미션을 먼저 시작해주세요",
        "미션 시작 후 기록을 남길 수 있어요.",
      );
      return;
    }

    setRecordMission(mission);
    setRecordContent("");
    setRecordEmotion("");
    setRecordVisibility("private");
    setRecordPhotos([]);
  };

  const closeRecordModal = (force = false) => {
    if (recordSaving && !force) {
      return;
    }

    setRecordMission(null);
    setRecordContent("");
    setRecordEmotion("");
    setRecordVisibility("private");
    setRecordPhotos([]);
  };

  const addRecordPhotos = (
    photos: ImagePicker.ImagePickerAsset[],
  ) => {
    setRecordPhotos((previous) => {
      const combined = [...previous];

      for (const photo of photos) {
        const isDuplicate = combined.some(
          (item) => item.uri === photo.uri,
        );

        if (!isDuplicate) {
          combined.push(photo);
        }
      }

      if (combined.length > MAX_RECORD_PHOTOS) {
        Alert.alert(
          "사진 개수 제한",
          `사진은 최대 ${MAX_RECORD_PHOTOS}장까지 추가할 수 있어요.`,
        );
      }

      return combined.slice(0, MAX_RECORD_PHOTOS);
    });
  };

  const handleTakePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "카메라 권한이 필요해요",
          "직접 촬영하려면 카메라 접근을 허용해주세요.",
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        });

      if (!result.canceled) {
        addRecordPhotos(result.assets);
      }
    } catch (error) {
      Alert.alert(
        "사진 촬영 실패",
        getErrorMessage(
          error,
          "카메라를 실행하지 못했습니다.",
        ),
      );
    }
  };

  const handlePickPhotos = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "사진 권한이 필요해요",
          "갤러리 사진을 추가하려면 사진 접근을 허용해주세요.",
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          quality: 0.85,
        });

      if (!result.canceled) {
        addRecordPhotos(result.assets);
      }
    } catch (error) {
      Alert.alert(
        "사진 선택 실패",
        getErrorMessage(
          error,
          "갤러리를 열지 못했습니다.",
        ),
      );
    }
  };

  const removeRecordPhoto = (uri: string) => {
    setRecordPhotos((previous) =>
      previous.filter((photo) => photo.uri !== uri),
    );
  };

  const uploadRecordPhotos = async ({
    userId,
    recordId,
    photos,
  }: {
    userId: string;
    recordId: string;
    photos: ImagePicker.ImagePickerAsset[];
  }) => {
    if (photos.length === 0) {
      return;
    }

    const uploadedPaths: string[] = [];

    try {
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        const extension = getPhotoExtension(photo);
        const contentType = getPhotoContentType(
          photo,
          extension,
        );
        const uniquePart = `${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const storagePath = `${userId}/${recordId}/${uniquePart}.${extension}`;

        const response = await fetch(photo.uri);

        if (!response.ok) {
          throw new Error(
            "선택한 사진 파일을 읽지 못했습니다.",
          );
        }

        const arrayBuffer = await response.arrayBuffer();

        const { error: uploadError } =
          await supabase.storage
            .from("record-photos")
            .upload(storagePath, arrayBuffer, {
              contentType,
              cacheControl: "3600",
              upsert: false,
            });

        if (uploadError) {
          throw uploadError;
        }

        uploadedPaths.push(storagePath);
      }

      const photoRows = uploadedPaths.map(
        (storagePath, index) => ({
          record_id: recordId,
          storage_path: storagePath,
          sort_order: index,
          is_cover: index === 0,
        }),
      );

      const { error: photoRowsError } =
        await supabase
          .from("record_photos")
          .insert(photoRows);

      if (photoRowsError) {
        throw photoRowsError;
      }
    } catch (error) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } =
          await supabase.storage
            .from("record-photos")
            .remove(uploadedPaths);

        if (cleanupError) {
          console.error(
            "실패한 사진 정리 오류:",
            cleanupError,
          );
        }
      }

      throw error;
    }
  };

  const handleSaveRecord = async () => {
    if (!recordMission) {
      return;
    }

    const attempt =
      startedAttempts[recordMission.id];

    if (!attempt) {
      Alert.alert(
        "진행 중인 미션이 없어요",
        "미션을 다시 시작해주세요.",
      );
      return;
    }

    if (!recordContent.trim()) {
      Alert.alert(
        "기록을 작성해주세요",
        "경험한 내용을 한 문장 이상 남겨주세요.",
      );
      return;
    }

    if (!recordEmotion) {
      Alert.alert(
        "감정을 선택해주세요",
        "이 경험에서 가장 크게 느낀 감정을 골라주세요.",
      );
      return;
    }

    try {
      setRecordSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }

      const {
        data: createdRecordId,
        error: recordError,
      } = await supabase.rpc(
        "complete_mission_with_record",
        {
          p_mission_attempt_id: attempt.id,
          p_emotion: recordEmotion,
          p_content: recordContent.trim(),
          p_visibility: recordVisibility,
          p_place_id: attempt.placeId,
        },
      );

      if (recordError) {
        throw recordError;
      }

      if (!createdRecordId) {
        throw new Error(
          "생성된 기록 ID를 확인하지 못했습니다.",
        );
      }

      const recordId = String(createdRecordId);
      let photoWarning = "";

      if (recordPhotos.length > 0) {
        try {
          await uploadRecordPhotos({
            userId: user.id,
            recordId,
            photos: recordPhotos,
          });
        } catch (photoError) {
          console.error(
            "기록 사진 저장 실패:",
            photoError,
          );

          photoWarning =
            "\n\n기록은 저장됐지만 사진은 업로드하지 못했어요.";
        }
      }

      setStartedAttempts((previous) => {
        const next = { ...previous };
        delete next[recordMission.id];
        return next;
      });

      setCompletedMissionIds((previous) => {
        const next = new Set(previous);
        next.add(recordMission.id);
        return next;
      });

      closeRecordModal(true);

      Alert.alert(
        "기록 완료",
        `오늘의 경험이 여정에 저장됐어요.${photoWarning}`,
      );
    } catch (error) {
      console.error(
        "기록 저장 실패 전체 오류:",
        error,
      );

      Alert.alert(
        "기록 저장 실패",
        getErrorMessage(
          error,
          "기록을 저장하지 못했습니다.",
        ),
      );
    } finally {
      setRecordSaving(false);
    }
  };

  const mapCenter = selectedMission?.placeLat &&
    selectedMission?.placeLng
    ? {
        lat: selectedMission.placeLat,
        lng: selectedMission.placeLng,
      }
    : userLocation ?? DEFAULT_CENTER;

  const selectedStarted = selectedMission
    ? Boolean(startedAttempts[selectedMission.id])
    : false;

  const selectedCompleted = selectedMission
    ? completedMissionIds.has(selectedMission.id)
    : false;

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        style={styles.mapPlaceholder}
        markers={missions
          .filter(
            (mission) =>
              isFiniteNumber(mission.placeLat) &&
              isFiniteNumber(mission.placeLng),
          )
          .map((mission) => ({
            id: mission.id,
            lat: mission.placeLat!,
            lng: mission.placeLng!,
          }))}
        onMarkerPress={handleMarkerPress}
      />

      <Animated.View
        style={[
          styles.sheet,
          {
            height: SHEET_HEIGHT,
            transform: [
              {
                translateY: sheetTranslateY,
              },
            ],
          },
        ]}
      >
        <View
          style={[styles.dragArea, webDragStyle]}
          {...panResponder.panHandlers}
        >
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>
              추천 미션
            </Text>
            <Text style={styles.sheetSub}>
              취향을 반영한 {missions.length}가지 미션
            </Text>
          </View>

          <Pressable
            onPress={() =>
              Alert.alert(
                "조건 설정",
                "미션 조건 설정 화면은 다음 단계에서 연결할 예정입니다.",
              )
            }
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
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              styles.missionScrollContent
            }
          >
            {selectedMission ? (
              <Animated.View
                style={[
                  styles.selectedCard,
                  {
                    opacity: selectedCardAnimation,
                    transform: [
                      {
                        scale: selectedCardAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                        }),
                      },
                      {
                        translateY:
                          selectedCardAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [18, 0],
                          }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.selectedCardHeader}>
                  <View style={styles.categoryTag}>
                    <Text
                      style={styles.categoryTagText}
                    >
                      {selectedMission.cat}
                    </Text>
                  </View>

                  <Pressable
                    onPress={closeSelectedMission}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.closeDetailButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.closeDetailButtonText
                      }
                    >
                      닫기
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.selectedTitle}>
                  {selectedMission.title}
                </Text>

                <Text
                  style={styles.selectedDescription}
                >
                  {selectedMission.desc}
                </Text>

                <View style={styles.instructionBox}>
                  <Text
                    style={styles.instructionLabel}
                  >
                    미션 안내
                  </Text>
                  <Text
                    style={styles.instructionText}
                  >
                    {selectedMission.instructions}
                  </Text>
                </View>

                {selectedMission.placeName ? (
                  <View style={styles.placeRow}>
                    <Text style={styles.placeIcon}>
                      📍
                    </Text>
                    <Text style={styles.placeText}>
                      {selectedMission.placeName}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.metricRow}>
                  <View
                    style={[
                      styles.metricItem,
                      styles.metricItemFirst,
                    ]}
                  >
                    <Text style={styles.metricLabel}>
                      예상 시간
                    </Text>
                    <Text style={styles.metricValue}>
                      {selectedMission.time}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricItem,
                      styles.metricItemMiddle,
                    ]}
                  >
                    <Text style={styles.metricLabel}>
                      준비물
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={styles.metricValue}
                    >
                      {getPreparationText(
                        selectedMission,
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricItem,
                      styles.metricItemLast,
                    ]}
                  >
                    <Text style={styles.metricLabel}>
                      비용
                    </Text>
                    <Text style={styles.metricValue}>
                      {selectedMission.cost}
                    </Text>
                  </View>
                </View>

                <View
                  style={styles.recommendationBox}
                >
                  <Text
                    style={styles.recommendationLabel}
                  >
                    추천 이유
                  </Text>
                  <Text
                    style={styles.recommendationText}
                  >
                    {selectedMission.recommendationReason}
                  </Text>
                </View>

                {selectedCompleted ? (
                  <View
                    style={styles.completedLargeButton}
                  >
                    <Text
                      style={
                        styles.completedLargeButtonText
                      }
                    >
                      기록 완료
                    </Text>
                  </View>
                ) : selectedStarted ? (
                  <Pressable
                    onPress={() =>
                      openRecordModal(selectedMission)
                    }
                    style={({ pressed }) => [
                      styles.recordLargeButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={styles.recordLargeButtonText}
                    >
                      기록하기
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() =>
                      void handleStartMission(
                        selectedMission,
                      )
                    }
                    disabled={
                      startLoadingId ===
                      selectedMission.id
                    }
                    style={({ pressed }) => [
                      styles.startLargeButton,
                      pressed && styles.pressed,
                      startLoadingId ===
                        selectedMission.id &&
                        styles.buttonDisabled,
                    ]}
                  >
                    {startLoadingId ===
                    selectedMission.id ? (
                      <ActivityIndicator color={WH} />
                    ) : (
                      <Text
                        style={
                          styles.startLargeButtonText
                        }
                      >
                        미션 시작하기
                      </Text>
                    )}
                  </Pressable>
                )}
              </Animated.View>
            ) : null}

            {selectedMission ? (
              <Text style={styles.otherMissionTitle}>
                다른 추천 미션
              </Text>
            ) : null}

            {missions
              .filter(
                (mission) =>
                  mission.id !== selectedMission?.id,
              )
              .map((mission) => {
                const isStarted = Boolean(
                  startedAttempts[mission.id],
                );
                const isCompleted =
                  completedMissionIds.has(mission.id);

                return (
                  <Pressable
                    key={mission.id}
                    onPress={() => selectMission(mission)}
                    style={({ pressed }) => [
                      styles.compactCard,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View
                      style={styles.compactThumb}
                    >
                      <Text
                        style={styles.compactThumbEmoji}
                      >
                        {getCategoryEmoji(mission.cat)}
                      </Text>
                    </View>

                    <View
                      style={styles.compactContent}
                    >
                      <Text
                        numberOfLines={2}
                        style={styles.compactTitle}
                      >
                        {mission.title}
                      </Text>

                      <View style={styles.compactMetaRow}>
                        <Text
                          style={styles.compactMeta}
                        >
                          {mission.time}
                        </Text>
                        <Text
                          style={styles.compactMetaDot}
                        >
                          ·
                        </Text>
                        <Text
                          style={styles.compactMeta}
                        >
                          {mission.dist}
                        </Text>
                        <View
                          style={styles.compactCategory}
                        >
                          <Text
                            style={
                              styles.compactCategoryText
                            }
                          >
                            {mission.cat}
                          </Text>
                        </View>
                      </View>

                      {mission.placeName ? (
                        <Text
                          numberOfLines={1}
                          style={styles.compactPlace}
                        >
                          📍 {mission.placeName}
                        </Text>
                      ) : null}
                    </View>

                    {isCompleted ? (
                      <View
                        style={styles.completedButton}
                      >
                        <Text
                          style={
                            styles.completedButtonText
                          }
                        >
                          완료
                        </Text>
                      </View>
                    ) : isStarted ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          openRecordModal(mission);
                        }}
                        style={({ pressed }) => [
                          styles.recordButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={styles.recordButtonText}
                        >
                          기록하기
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          selectMission(mission);
                        }}
                        style={({ pressed }) => [
                          styles.selectButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={styles.selectButtonText}
                        >
                          선택
                        </Text>
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
          </ScrollView>
        )}
      </Animated.View>

      <Modal
        visible={recordMission !== null}
        transparent
        animationType="slide"
        onRequestClose={closeRecordModal}
      >
        <KeyboardAvoidingView
          style={styles.recordModalOverlay}
          behavior={
            Platform.OS === "ios" ? "padding" : undefined
          }
        >
          <Pressable
            style={styles.recordModalBackdrop}
            onPress={closeRecordModal}
          />

          <View style={styles.recordModalCard}>
            <View style={styles.recordModalHandle} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.recordModalContent
              }
            >
              <View style={styles.recordModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordModalCaption}>
                    경험 기록하기
                  </Text>
                  <Text style={styles.recordModalTitle}>
                    {recordMission?.title}
                  </Text>
                </View>

                <Pressable
                  onPress={closeRecordModal}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.recordModalClose,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={styles.recordModalCloseText}
                  >
                    ✕
                  </Text>
                </Pressable>
              </View>

              {recordMission?.placeName ? (
                <View style={styles.recordPlaceBox}>
                  <Text style={styles.recordPlaceLabel}>
                    이 장소에서의 기록
                  </Text>
                  <Text style={styles.recordPlaceName}>
                    📍 {recordMission.placeName}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.recordFieldLabel}>
                어떤 감정이 가장 컸나요?
              </Text>

              <View style={styles.emotionWrap}>
                {EMOTIONS.map((emotion) => {
                  const isSelected =
                    recordEmotion === emotion.value;

                  return (
                    <Pressable
                      key={emotion.value}
                      onPress={() =>
                        setRecordEmotion(
                          emotion.value,
                        )
                      }
                      style={[
                        styles.emotionChip,
                        isSelected &&
                          styles.emotionChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.emotionChipText,
                          isSelected &&
                            styles.emotionChipTextSelected,
                        ]}
                      >
                        {emotion.emoji} {emotion.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.recordFieldLabel}>
                오늘의 경험을 남겨주세요
              </Text>

              <TextInput
                value={recordContent}
                onChangeText={setRecordContent}
                multiline
                maxLength={1200}
                textAlignVertical="top"
                placeholder="무엇을 보고, 듣고, 느꼈는지 자유롭게 적어보세요."
                placeholderTextColor={T2}
                style={styles.recordInput}
              />

              <Text style={styles.characterCount}>
                {recordContent.length}/1200
              </Text>

              <View style={styles.photoSectionHeader}>
                <Text
                  style={[
                    styles.recordFieldLabel,
                    styles.photoFieldLabel,
                  ]}
                >
                  사진 추가
                </Text>
                <Text style={styles.photoCountText}>
                  {recordPhotos.length}/{MAX_RECORD_PHOTOS}
                </Text>
              </View>

              <View style={styles.photoActionRow}>
                <Pressable
                  onPress={() => void handleTakePhoto()}
                  disabled={
                    recordSaving ||
                    recordPhotos.length >=
                      MAX_RECORD_PHOTOS
                  }
                  style={({ pressed }) => [
                    styles.photoActionButton,
                    pressed && styles.pressed,
                    (recordSaving ||
                      recordPhotos.length >=
                        MAX_RECORD_PHOTOS) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.photoActionIcon}>
                    📷
                  </Text>
                  <Text style={styles.photoActionText}>
                    직접 찍기
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void handlePickPhotos()}
                  disabled={
                    recordSaving ||
                    recordPhotos.length >=
                      MAX_RECORD_PHOTOS
                  }
                  style={({ pressed }) => [
                    styles.photoActionButton,
                    styles.photoActionButtonLast,
                    pressed && styles.pressed,
                    (recordSaving ||
                      recordPhotos.length >=
                        MAX_RECORD_PHOTOS) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.photoActionIcon}>
                    🖼️
                  </Text>
                  <Text style={styles.photoActionText}>
                    갤러리에서 선택
                  </Text>
                </Pressable>
              </View>

              {recordPhotos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoPreviewScroll}
                  contentContainerStyle={
                    styles.photoPreviewRow
                  }
                >
                  {recordPhotos.map((photo, index) => (
                    <View
                      key={`${photo.uri}-${index}`}
                      style={styles.photoPreviewWrapper}
                    >
                      <Image
                        source={{ uri: photo.uri }}
                        style={styles.photoPreview}
                      />

                      <Pressable
                        onPress={() =>
                          removeRecordPhoto(photo.uri)
                        }
                        disabled={recordSaving}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.photoRemoveButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={
                            styles.photoRemoveButtonText
                          }
                        >
                          ✕
                        </Text>
                      </Pressable>

                      {index === 0 ? (
                        <View style={styles.coverPhotoBadge}>
                          <Text
                            style={
                              styles.coverPhotoBadgeText
                            }
                          >
                            대표
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.photoHelperText}>
                  첫 번째 사진이 대표 사진으로 사용돼요.
                </Text>
              )}

              <Text style={styles.recordFieldLabel}>
                공개 범위
              </Text>

              <View style={styles.visibilityRow}>
                <Pressable
                  onPress={() =>
                    setRecordVisibility("private")
                  }
                  style={[
                    styles.visibilityOption,
                    recordVisibility === "private" &&
                      styles.visibilityOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.visibilityOptionTitle,
                      recordVisibility === "private" &&
                        styles.visibilityOptionTitleSelected,
                    ]}
                  >
                    나만 보기
                  </Text>
                  <Text
                    style={styles.visibilityOptionDesc}
                  >
                    내 기록에서만 확인해요
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setRecordVisibility("anonymous")
                  }
                  style={[
                    styles.visibilityOption,
                    recordVisibility === "anonymous" &&
                      styles.visibilityOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.visibilityOptionTitle,
                      recordVisibility === "anonymous" &&
                        styles.visibilityOptionTitleSelected,
                    ]}
                  >
                    익명 공유
                  </Text>
                  <Text
                    style={styles.visibilityOptionDesc}
                  >
                    이름 없이 발견 탭에 공유해요
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() =>
                  void handleSaveRecord()
                }
                disabled={recordSaving}
                style={({ pressed }) => [
                  styles.saveRecordButton,
                  pressed && styles.pressed,
                  recordSaving && styles.buttonDisabled,
                ]}
              >
                {recordSaving ? (
                  <ActivityIndicator color={WH} />
                ) : (
                  <Text
                    style={styles.saveRecordButtonText}
                  >
                    기록 저장하기
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    backgroundColor: "#DFE8F0",
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
    height: 52,

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
    paddingHorizontal: 16,
    paddingBottom: 130,
  },

  selectedCard: {
    marginBottom: 18,
    padding: 18,

    backgroundColor: WH,

    borderWidth: 1,
    borderColor: "rgba(61, 90, 254, 0.16)",
    borderRadius: 18,
  },

  selectedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: 12,
  },

  categoryTag: {
    alignSelf: "flex-start",

    paddingHorizontal: 10,
    paddingVertical: 5,

    backgroundColor: BLL,
    borderRadius: 8,
  },

  categoryTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: BL,
  },

  closeDetailButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  closeDetailButtonText: {
    fontSize: 12,
    color: T2,
  },

  selectedTitle: {
    marginBottom: 8,

    fontSize: 21,
    lineHeight: 29,
    fontWeight: "800",
    color: T0,
  },

  selectedDescription: {
    marginBottom: 14,

    fontSize: 14,
    lineHeight: 22,
    color: T1,
  },

  instructionBox: {
    marginBottom: 12,
    padding: 13,

    backgroundColor: BG,
    borderRadius: 12,
  },

  instructionLabel: {
    marginBottom: 5,

    fontSize: 11,
    fontWeight: "700",
    color: T2,
  },

  instructionText: {
    fontSize: 13,
    lineHeight: 20,
    color: T1,
  },

  placeRow: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 15,
  },

  placeIcon: {
    marginRight: 5,

    fontSize: 13,
  },

  placeText: {
    flex: 1,

    fontSize: 12,
    color: T1,
  },

  metricRow: {
    flexDirection: "row",
    alignItems: "flex-start",

    marginBottom: 14,
    paddingLeft: 12,
    paddingRight: 2,
  },

  metricItem: {
    flex: 1,
    minWidth: 0,
  },

  metricItemFirst: {
    paddingRight: 8,
  },

  metricItemMiddle: {
    paddingHorizontal: 8,
  },

  metricItemLast: {
    paddingLeft: 8,
  },

  metricLabel: {
    marginBottom: 5,

    fontSize: 11,
    color: T2,
  },

  metricValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: T0,
  },

  recommendationBox: {
    flexDirection: "row",
    alignItems: "flex-start",

    marginBottom: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,

    backgroundColor: "#F4F6F8",
    borderRadius: 12,
  },

  recommendationLabel: {
    marginRight: 7,

    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: BL,
    includeFontPadding: false,
  },

  recommendationText: {
    flex: 1,

    fontSize: 12,
    lineHeight: 18,
    color: T1,
    includeFontPadding: false,
  },

  startLargeButton: {
    minHeight: 52,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: BL,
    borderRadius: 14,
  },

  startLargeButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: WH,
  },

  recordLargeButton: {
    minHeight: 52,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: PINK,
    borderRadius: 14,
  },

  recordLargeButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: WH,
  },

  completedLargeButton: {
    minHeight: 52,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#ECFDF5",
    borderRadius: 14,
  },

  completedLargeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: SUCCESS,
  },

  otherMissionTitle: {
    marginBottom: 10,

    fontSize: 14,
    fontWeight: "700",
    color: T1,
  },

  compactCard: {
    minHeight: 96,

    marginBottom: 10,
    padding: 12,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: WH,

    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    borderRadius: 15,
  },

  compactThumb: {
    width: 58,
    height: 58,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: BLL,
    borderRadius: 11,
  },

  compactThumbEmoji: {
    fontSize: 25,
  },

  compactContent: {
    flex: 1,
    marginRight: 10,
  },

  compactTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: T0,
  },

  compactMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",

    marginTop: 5,
  },

  compactMeta: {
    fontSize: 11,
    color: T2,
  },

  compactMetaDot: {
    marginHorizontal: 4,

    fontSize: 11,
    color: T2,
  },

  compactCategory: {
    marginLeft: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,

    backgroundColor: BG,
    borderRadius: 6,
  },

  compactCategoryText: {
    fontSize: 10,
    color: T1,
  },

  compactPlace: {
    marginTop: 4,

    fontSize: 10,
    color: T2,
  },

  selectButton: {
    minWidth: 54,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 10,
    paddingVertical: 11,

    backgroundColor: BLL,
    borderRadius: 11,
  },

  selectButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: BL,
  },

  recordButton: {
    minWidth: 68,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 10,
    paddingVertical: 11,

    backgroundColor: PINK_LIGHT,

    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.22)",
    borderRadius: 11,
  },

  recordButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: PINK,
  },

  completedButton: {
    minWidth: 54,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 10,
    paddingVertical: 11,

    backgroundColor: "#ECFDF5",
    borderRadius: 11,
  },

  completedButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: SUCCESS,
  },

  recordModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  recordModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.44)",
  },

  recordModalCard: {
    maxHeight: "88%",

    backgroundColor: WH,

    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  recordModalHandle: {
    alignSelf: "center",

    width: 42,
    height: 5,

    marginTop: 10,

    backgroundColor: "#D7D9DE",
    borderRadius: 3,
  },

  recordModalContent: {
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 34,
  },

  recordModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",

    marginBottom: 16,
  },

  recordModalCaption: {
    marginBottom: 5,

    fontSize: 12,
    fontWeight: "700",
    color: PINK,
  },

  recordModalTitle: {
    paddingRight: 10,

    fontSize: 19,
    lineHeight: 26,
    fontWeight: "800",
    color: T0,
  },

  recordModalClose: {
    width: 36,
    height: 36,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: BG,
    borderRadius: 18,
  },

  recordModalCloseText: {
    fontSize: 14,
    color: T1,
  },

  recordPlaceBox: {
    marginBottom: 18,
    padding: 13,

    backgroundColor: PINK_LIGHT,
    borderRadius: 12,
  },

  recordPlaceLabel: {
    marginBottom: 4,

    fontSize: 10,
    fontWeight: "700",
    color: PINK,
  },

  recordPlaceName: {
    fontSize: 13,
    fontWeight: "700",
    color: T0,
  },

  recordFieldLabel: {
    marginBottom: 9,

    fontSize: 13,
    fontWeight: "700",
    color: T0,
  },

  emotionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",

    marginBottom: 18,
  },

  emotionChip: {
    marginRight: 8,
    marginBottom: 8,

    paddingHorizontal: 13,
    paddingVertical: 8,

    backgroundColor: BG,

    borderWidth: 1,
    borderColor: T3,
    borderRadius: 18,
  },

  emotionChipSelected: {
    backgroundColor: PINK_LIGHT,
    borderColor: PINK,
  },

  emotionChipText: {
    fontSize: 12,
    color: T1,
  },

  emotionChipTextSelected: {
    fontWeight: "700",
    color: PINK,
  },

  recordInput: {
    minHeight: 150,

    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,

    fontSize: 14,
    lineHeight: 22,
    color: T0,

    backgroundColor: BG,

    borderWidth: 1,
    borderColor: T3,
    borderRadius: 14,
  },

  characterCount: {
    marginTop: 6,
    marginBottom: 18,

    textAlign: "right",

    fontSize: 10,
    color: T2,
  },

  photoSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  photoFieldLabel: {
    marginBottom: 0,
  },

  photoCountText: {
    fontSize: 11,
    color: T2,
  },

  photoActionRow: {
    flexDirection: "row",

    marginTop: 9,
    marginBottom: 10,
  },

  photoActionButton: {
    flex: 1,
    minHeight: 48,

    marginRight: 8,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    backgroundColor: BG,

    borderWidth: 1,
    borderColor: T3,
    borderRadius: 12,
  },

  photoActionButtonLast: {
    marginRight: 0,
  },

  photoActionIcon: {
    marginRight: 6,
    fontSize: 16,
  },

  photoActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: T1,
  },

  photoPreviewScroll: {
    marginBottom: 17,
  },

  photoPreviewRow: {
    paddingRight: 8,
  },

  photoPreviewWrapper: {
    position: "relative",

    width: 92,
    height: 92,

    marginRight: 9,
  },

  photoPreview: {
    width: "100%",
    height: "100%",

    backgroundColor: T3,
    borderRadius: 12,
  },

  photoRemoveButton: {
    position: "absolute",
    top: 5,
    right: 5,

    width: 24,
    height: 24,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(15, 15, 15, 0.70)",
    borderRadius: 12,
  },

  photoRemoveButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: WH,
  },

  coverPhotoBadge: {
    position: "absolute",
    right: 5,
    bottom: 5,

    paddingHorizontal: 7,
    paddingVertical: 3,

    backgroundColor: PINK,
    borderRadius: 7,
  },

  coverPhotoBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: WH,
  },

  photoHelperText: {
    marginBottom: 18,

    fontSize: 10,
    color: T2,
  },

  visibilityRow: {
    flexDirection: "row",

    marginBottom: 20,
  },

  visibilityOption: {
    flex: 1,
    minHeight: 76,

    marginRight: 8,
    padding: 12,

    backgroundColor: WH,

    borderWidth: 1,
    borderColor: T3,
    borderRadius: 12,
  },

  visibilityOptionSelected: {
    backgroundColor: BLL,
    borderColor: BL,
  },

  visibilityOptionTitle: {
    marginBottom: 4,

    fontSize: 12,
    fontWeight: "700",
    color: T1,
  },

  visibilityOptionTitleSelected: {
    color: BL,
  },

  visibilityOptionDesc: {
    fontSize: 10,
    lineHeight: 15,
    color: T2,
  },

  saveRecordButton: {
    minHeight: 52,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: PINK,
    borderRadius: 14,
  },

  saveRecordButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: WH,
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.72,
  },

  cardPressed: {
    opacity: 0.82,
  },
});