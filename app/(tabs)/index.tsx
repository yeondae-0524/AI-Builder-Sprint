import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import {
  useCallback,
  useEffect,
  useMemo,
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
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";

import { KakaoMapView } from "../../components/KakaoMapView";

// 🌿 파스텔 톤앤매너 컬러 팔레트
const BL = "#315C4A";            // 메인 다크 그린
const BLL = "#E5EEE8";           // 연한 그린
const ACCENT = "#F2C96D";        // 노란 포인트
const PINK = "#E07A5F";          // 코랄 핑크 / 포인트
const PINK_LIGHT = "#F4EAE1";    // 연한 피치/코랄
const T0 = "#26372E";            // 텍스트 메인
const T1 = "#65766D";            // 서브 텍스트
const T2 = "#9AA49F";            // 뮤트 텍스트
const T3 = "#E2E3DC";            // 테두리
const WH = "#FFFFFF";
const BG = "#F5F2E9";            // 따뜻한 베이지 배경

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SHEET_HEIGHT = SCREEN_HEIGHT - 90;
const TAB_BAR_SPACE = 105;
const COLLAPSED_HEADER_HEIGHT = 148;
const COLLAPSED_VISIBLE_HEIGHT = TAB_BAR_SPACE + COLLAPSED_HEADER_HEIGHT;
const COLLAPSED_POSITION = Math.max(SHEET_HEIGHT - COLLAPSED_VISIBLE_HEIGHT, 0);
const SECTION_HORIZONTAL_MARGIN = 16;
const SECTION_INDICATOR_WIDTH = (SCREEN_WIDTH - SECTION_HORIZONTAL_MARGIN * 2) / 3;

const DEFAULT_ANY_RADIUS_KM = 3;
const MAX_RECORD_PHOTOS = 5;

const DEFAULT_CENTER = {
  lat: 35.1795543,
  lng: 129.0756416,
};

const CATEGORIES = [
  "음식", "카페 및 디저트", "산책", "배움", "감상", "활동", "휴식", "기타",
] as const;

type CategoryName = (typeof CATEGORIES)[number];
type CostStatus = "무료" | "유료" | "유료/무료";
type SheetSection = "active" | "recommended" | "records";
type ListKind = "active" | "recommended" | "record";
type RecordVisibility = "private" | "nickname";
type EmotionValue = "comfortable" | "joyful" | "new" | "uncomfortable" | "unsure";
type TimeFilter = "any" | "under15" | "under30" | "under60" | "over60";
type CostFilter = "any" | "free" | "paid";
type LocationMode = "any" | "radius" | "district";
type RadiusKm = 1 | 3 | 5;
type BusanDistrict =
  | "강서구" | "금정구" | "기장군" | "남구" | "동구" | "동래구" | "부산진구" | "북구"
  | "사상구" | "사하구" | "서구" | "수영구" | "연제구" | "영도구" | "중구" | "해운대구";

type Coordinate = {
  lat: number;
  lng: number;
};

type HomeMission = {
  id: string;
  title: string;
  desc: string;
  instructions: string;
  recommendationReason: string;
  durationMinutes: number | null;
  time: string;
  dist: string;
  cost: CostStatus;
  cat: CategoryName;
  requiredItems: string[];
  placeId?: string;
  placeLat?: number;
  placeLng?: number;
  placeName?: string;
  isAtHome?: boolean;
};

type StartedAttempt = {
  id: string;
  journeyId: string;
  missionId: string;
  createdAt: string;
};

type CompletedRecord = {
  id: string;
  attemptId: string;
  missionId: string;
  content: string;
  emotion: EmotionValue;
  visibility: RecordVisibility | "nickname";
  recordedAt: string;
  photoUrls: string[];
  locationLat: number | null;
  locationLng: number | null;
  locationName: string;
};

type MissionListItem = {
  key: string;
  kind: ListKind;
  mission: HomeMission;
  attempt?: StartedAttempt;
  record?: CompletedRecord;
};

type RecommendationFilters = {
  categories: CategoryName[];
  time: TimeFilter;
  cost: CostFilter;
};

const DEFAULT_FILTERS: RecommendationFilters = {
  categories: [],
  time: "any",
  cost: "any",
};

const EMOTIONS: Array<{ label: string; value: EmotionValue; emoji: string }> = [
  { label: "편안해요", value: "comfortable", emoji: "😌" },
  { label: "즐거워요", value: "joyful", emoji: "😊" },
  { label: "새로워요", value: "new", emoji: "✨" },
  { label: "불편해요", value: "uncomfortable", emoji: "😣" },
  { label: "잘 모르겠어요", value: "unsure", emoji: "🤔" },
];

const TIME_OPTIONS: Array<{ value: TimeFilter; label: string }> = [
  { value: "any", label: "상관없음" },
  { value: "under15", label: "15분 이내" },
  { value: "under30", label: "30분 이내" },
  { value: "under60", label: "1시간 이내" },
  { value: "over60", label: "1시간 이상" },
];

const COST_OPTIONS: Array<{ value: CostFilter; label: string }> = [
  { value: "any", label: "상관없음" },
  { value: "free", label: "무료" },
  { value: "paid", label: "유료" },
];

const RADIUS_OPTIONS: RadiusKm[] = [1, 3, 5];

const BUSAN_DISTRICTS: BusanDistrict[] = [
  "중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군",
];

const SECTION_LABELS: Array<{ key: SheetSection; label: string }> = [
  { key: "active", label: "현재 진행중" },
  { key: "recommended", label: "추천 미션" },
  { key: "records", label: "내가 쓴 기록" },
];

const SECTION_INDEX: Record<SheetSection, number> = {
  active: 0,
  recommended: 1,
  records: 2,
};

const INITIAL_RECOMMENDED_DATABASE: HomeMission[] = [
  {
    id: "cafe-1",
    title: "아늑한 동네 카페에서 아메리카노 마시기",
    desc: "창가 자리에 앉아 여유로운 30분을 만끽해요.",
    instructions: "가까운 분위기 좋은 카페에서 따뜻한 음료 한 잔과 함께 나만의 시간을 가져보세요.",
    recommendationReason: "카페 분위기에서 마음을 정리하기 좋아 추천드려요.",
    durationMinutes: 30,
    time: "30분",
    dist: "0.3km",
    cost: "유료",
    cat: "카페 및 디저트",
    requiredItems: [],
    placeLat: 35.1795543,
    placeLng: 129.0756416,
    placeName: "동네 아늑한 카페",
  },
  {
    id: "walk-1",
    title: "공원 산책로 천천히 걸어보기",
    desc: "계절의 바람을 느끼며 느리게 걸어보세요.",
    instructions: "근처 공원이나 산책로를 걸으며 발걸음의 감각에 집중해 보세요.",
    recommendationReason: "가벼운 운동과 프레시한 공기가 머리를 비워줘요.",
    durationMinutes: 25,
    time: "25분",
    dist: "0.2km",
    cost: "무료",
    cat: "산책",
    requiredItems: ["편한 신발"],
    placeLat: 35.1825543,
    placeLng: 129.0756416,
    placeName: "근처 공원 산책로",
  },
  {
    id: "rest-1",
    title: "방 안에서 잔잔한 음악 들으며 휴식",
    desc: "오롯이 내 방에서 조용하게 휴식해요.",
    instructions: "조명을 낮추고 마음이 편안해지는 음악을 틀어놓고 깊게 호흡해 보세요.",
    recommendationReason: "가장 편안한 내 방에서 깊은 휴식을 취할 수 있어요.",
    durationMinutes: 15,
    time: "15분",
    dist: "내 방",
    cost: "무료",
    cat: "휴식",
    requiredItems: [],
    isAtHome: true,
  },
];

function getCategoryEmoji(category: CategoryName) {
  const emojis: Record<CategoryName, string> = {
    음식: "🍽️", "카페 및 디저트": "☕", 산책: "🌿", 배움: "📚", 감상: "🎧", 활동: "🏃", 휴식: "🛋️", 기타: "✨",
  };
  return emojis[category] ?? "✨";
}

function getConditionSummary(filters: RecommendationFilters, locationMode: LocationMode, center: Coordinate | null, radiusKm: RadiusKm, district: BusanDistrict | null) {
  const parts: string[] = [];
  if (locationMode === "radius" && center) parts.push(`선택 지역 ${radiusKm}km`);
  if (locationMode === "district" && district) parts.push(district);
  if (filters.categories.length > 0) parts.push(filters.categories.length === 1 ? filters.categories[0] : `카테고리 ${filters.categories.length}개`);

  const timeLabel = TIME_OPTIONS.find((item) => item.value === filters.time)?.label;
  if (timeLabel && filters.time !== "any") parts.push(timeLabel);

  const costLabel = COST_OPTIONS.find((item) => item.value === filters.cost)?.label;
  if (costLabel && filters.cost !== "any") parts.push(costLabel);

  if (parts.length > 0) return parts.join(" · ");
  return locationMode === "any" ? `현재 위치 ${DEFAULT_ANY_RADIUS_KM}km · 취향 추천` : "취향 추천";
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function HomeScreen() {
  const [missions, setMissions] = useState<HomeMission[]>(INITIAL_RECOMMENDED_DATABASE);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);

  // 진행 중 / 완료 상태
  const [startedAttempts, setStartedAttempts] = useState<Record<string, StartedAttempt>>({});
  const [completedRecords, setCompletedRecords] = useState<CompletedRecord[]>([]);

  const [sheetSection, setSheetSection] = useState<SheetSection>("recommended");
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [detailModalMission, setDetailModalMission] = useState<HomeMission | null>(null);

  // 🌿 조건 설정 관련
  const [appliedFilters, setAppliedFilters] = useState<RecommendationFilters>(DEFAULT_FILTERS);
  const [recommendationCenter, setRecommendationCenter] = useState<Coordinate | null>(null);
  const [recommendationLocationMode, setRecommendationLocationMode] = useState<LocationMode>("any");
  const [recommendationRadiusKm, setRecommendationRadiusKm] = useState<RadiusKm>(1);
  const [recommendationDistrict, setRecommendationDistrict] = useState<BusanDistrict | null>(null);

  const [conditionVisible, setConditionVisible] = useState(false);
  const [conditionStep, setConditionStep] = useState(0);
  const [draftCategories, setDraftCategories] = useState<CategoryName[]>([]);
  const [draftTime, setDraftTime] = useState<TimeFilter>("any");
  const [draftCost, setDraftCost] = useState<CostFilter>("any");
  const [draftCenter, setDraftCenter] = useState<Coordinate | null>(null);
  const [draftLocationMode, setDraftLocationMode] = useState<LocationMode>("any");
  const [draftRadiusKm, setDraftRadiusKm] = useState<RadiusKm>(1);
  const [draftDistrict, setDraftDistrict] = useState<BusanDistrict | null>(null);

  // 🌿 기록 작성 모달 관련 상태
  const [recordModalMission, setRecordModalMission] = useState<HomeMission | null>(null);
  const [recordContent, setRecordContent] = useState("");
  const [recordEmotion, setRecordEmotion] = useState<EmotionValue | "">("joyful");
  const [recordVisibility, setRecordVisibility] = useState<RecordVisibility>("nickname");
  const [recordPhotos, setRecordPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [selectedRecordDate, setSelectedRecordDate] = useState<string>(toDateKey(new Date()));

  // 🌟 예시 여정 기간 (여정 시작일부터 오늘까지만 날짜 선택 가능하도록 생성)
  // 예: 오늘이 2026-08-02이면 2026-07-27 ~ 2026-08-02
  const journeyDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    // 7일 전 여정 시작일 설정
    const startDate = new Date();
    startDate.setDate(today.getDate() - 6);

    const cur = new Date(startDate);
    while (cur <= today) {
      const year = cur.getFullYear();
      const month = cur.getMonth() + 1;
      const date = cur.getDate();
      const dateKey = toDateKey(cur);

      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const dayName = dayNames[cur.getDay()];
      const isToday = dateKey === toDateKey(today);

      dates.push({
        dateKey,
        month,
        date,
        dayName,
        isToday,
      });

      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, []);

  const sheetTranslateY = useRef(new Animated.Value(COLLAPSED_POSITION)).current;
  const dragStartPosition = useRef(COLLAPSED_POSITION);
  const sectionIndicator = useRef(new Animated.Value(SECTION_INDEX.recommended)).current;
  const sectionContentAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const fetchRecommendations = useCallback(async (params: {
    filters: RecommendationFilters;
    center: Coordinate | null;
    locationMode: LocationMode;
    radiusKm: RadiusKm;
    district: BusanDistrict | null;
  }) => {
    setLoading(true);
    try {
      let filtered = [...INITIAL_RECOMMENDED_DATABASE];

      if (params.filters.categories.length > 0) {
        filtered = filtered.filter((m) => params.filters.categories.includes(m.cat));
      }

      if (params.filters.time !== "any") {
        if (params.filters.time === "under15") filtered = filtered.filter((m) => (m.durationMinutes ?? 0) <= 15);
        else if (params.filters.time === "under30") filtered = filtered.filter((m) => (m.durationMinutes ?? 0) <= 30);
        else if (params.filters.time === "under60") filtered = filtered.filter((m) => (m.durationMinutes ?? 0) <= 60);
      }

      if (params.filters.cost !== "any") {
        if (params.filters.cost === "free") filtered = filtered.filter((m) => m.cost === "무료" || m.cost === "유료/무료");
        else if (params.filters.cost === "paid") filtered = filtered.filter((m) => m.cost === "유료" || m.cost === "유료/무료");
      }

      setMissions(filtered);
    } catch (error) {
      console.error("추천 미션 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const moveSheet = useCallback((destination: number) => {
    dragStartPosition.current = destination;
    Animated.spring(sheetTranslateY, {
      toValue: destination, useNativeDriver: true, damping: 24, stiffness: 190, mass: 0.9, overshootClamping: true,
    }).start();
  }, [sheetTranslateY]);

  const openConditionModal = (step = 0) => {
    setDraftCategories(appliedFilters.categories);
    setDraftTime(appliedFilters.time);
    setDraftCost(appliedFilters.cost);
    setDraftCenter(recommendationCenter);
    setDraftLocationMode(recommendationLocationMode);
    setDraftRadiusKm(recommendationRadiusKm);
    setDraftDistrict(recommendationDistrict);
    setConditionStep(step);
    setConditionVisible(true);
  };

  const applyConditions = async () => {
    const nextFilters: RecommendationFilters = {
      categories: draftCategories,
      time: draftTime,
      cost: draftCost,
    };

    const nextCenter = draftLocationMode === "radius" ? draftCenter : null;
    const nextDistrict = draftLocationMode === "district" ? draftDistrict : null;

    setAppliedFilters(nextFilters);
    setRecommendationCenter(nextCenter);
    setRecommendationLocationMode(draftLocationMode);
    setRecommendationRadiusKm(draftRadiusKm);
    setRecommendationDistrict(nextDistrict);
    setConditionVisible(false);
    setSelectedItemKey(null);
    changeSection("recommended");

    await fetchRecommendations({
      filters: nextFilters,
      center: nextCenter,
      locationMode: draftLocationMode,
      radiusKm: draftRadiusKm,
      district: nextDistrict,
    });
  };

  // 🚀 미션 시작
  const handleStartMission = (mission: HomeMission) => {
    const attemptId = `attempt-${Date.now()}`;
    const newAttempt: StartedAttempt = {
      id: attemptId,
      journeyId: "active-journey-1",
      missionId: mission.id,
      createdAt: new Date().toISOString(),
    };

    setStartedAttempts((prev) => ({ ...prev, [mission.id]: newAttempt }));
    setDetailModalMission(null);
    changeSection("active");
    Alert.alert("미션 시작!", `"${mission.title}" 미션을 시작했어요.`);
  };

  // 🚀 사진 첨부 함수 (카메라 / 갤러리)
  const addRecordPhotos = (newPhotos: ImagePicker.ImagePickerAsset[]) => {
    setRecordPhotos((prev) => {
      const combined = [...prev];
      for (const p of newPhotos) {
        if (!combined.some((x) => x.uri === p.uri)) combined.push(p);
      }
      if (combined.length > MAX_RECORD_PHOTOS) {
        Alert.alert("사진 제한", `사진은 최대 ${MAX_RECORD_PHOTOS}장까지 첨부할 수 있습니다.`);
      }
      return combined.slice(0, MAX_RECORD_PHOTOS);
    });
  };

  // 📸 직접 촬영할 때 (동영상도 촬영 가능하게 설정)
  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("권한 필요", "촬영을 위해 카메라 접근 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // 👈 ["images"] 대신 All 또는 ["images", "videos"] 사용
      quality: 0.85,
    });
    if (!result.canceled) addRecordPhotos(result.assets);
  };

  // 🖼️ 갤러리에서 선택할 때 (사진 + 동영상 함께 선택 가능)
  const handlePickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("권한 필요", "파일을 선택하기 위해 갤러리 접근 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // 👈 사진 + 동영상 모두 멀티 선택 가능
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) addRecordPhotos(result.assets);
  };

  const removeRecordPhoto = (uri: string) => {
    setRecordPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  // 🚀 기록 저장 완료
  const handleSaveRecord = () => {
    if (!recordModalMission || !recordContent.trim()) {
      Alert.alert("내용 입력", "미션 경험 내용을 작성해 주세요.");
      return;
    }

    const newRecord: CompletedRecord = {
      id: `record-${Date.now()}`,
      attemptId: startedAttempts[recordModalMission.id]?.id ?? `attempt-${Date.now()}`,
      missionId: recordModalMission.id,
      content: recordContent,
      emotion: (recordEmotion || "joyful") as EmotionValue,
      visibility: recordVisibility,
      recordedAt: selectedRecordDate,
      photoUrls: recordPhotos.map((p) => p.uri),
      locationLat: recordModalMission.placeLat ?? null,
      locationLng: recordModalMission.placeLng ?? null,
      locationName: recordModalMission.placeName ?? "장소",
    };

    setCompletedRecords((prev) => [newRecord, ...prev]);

    setStartedAttempts((prev) => {
      const next = { ...prev };
      delete next[recordModalMission.id];
      return next;
    });

    setRecordModalMission(null);
    setRecordContent("");
    setRecordPhotos([]);

    changeSection("records");
    Alert.alert("기록 완료!", "경험 기록을 성공적으로 저장했어요.");
  };

  const activeItems = useMemo<MissionListItem[]>(() => {
    return Object.values(startedAttempts).flatMap((attempt) => {
      const m = INITIAL_RECOMMENDED_DATABASE.find((item) => item.id === attempt.missionId);
      if (!m) return [];
      return [{ key: `active:${attempt.id}`, kind: "active" as const, mission: m, attempt }];
    });
  }, [startedAttempts]);

  const recommendedItems = useMemo<MissionListItem[]>(() => {
    return missions
      .filter((m) => !startedAttempts[m.id])
      .map((m) => ({ key: `recommended:${m.id}`, kind: "recommended" as const, mission: m }));
  }, [missions, startedAttempts]);

  const recordItems = useMemo<MissionListItem[]>(() => {
    return completedRecords.flatMap((rec) => {
      const m = INITIAL_RECOMMENDED_DATABASE.find((item) => item.id === rec.missionId);
      if (!m) return [];
      return [{ key: `record:${rec.id}`, kind: "record" as const, mission: m, record: rec }];
    });
  }, [completedRecords]);

  const currentItems = sheetSection === "active" ? activeItems : sheetSection === "recommended" ? recommendedItems : recordItems;
  const currentSectionTitle = sheetSection === "active" ? "현재 진행중인 미션" : sheetSection === "recommended" ? "추천 미션" : "내가 쓴 기록";
  const currentSectionSub = sheetSection === "recommended"
    ? `${getConditionSummary(appliedFilters, recommendationLocationMode, recommendationCenter, recommendationRadiusKm, recommendationDistrict)} · ${recommendedItems.length}개`
    : sheetSection === "active" ? `${activeItems.length}개의 미션을 진행하고 있어요` : `${recordItems.length}개의 기록을 남겼어요`;

  const changeSection = (next: SheetSection) => {
    if (next === sheetSection) return;
    Animated.spring(sectionIndicator, { toValue: SECTION_INDEX[next], useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.8 }).start();
    Animated.timing(sectionContentAnimation, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setSelectedItemKey(null); setSheetSection(next);
      sectionContentAnimation.setValue(0);
      Animated.timing(sectionContentAnimation, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => { sheetTranslateY.stopAnimation((v) => (dragStartPosition.current = v)); },
      onPanResponderMove: (_e, g) => {
        const next = dragStartPosition.current + g.dy;
        sheetTranslateY.setValue(Math.max(0, Math.min(next, COLLAPSED_POSITION)));
      },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(0, Math.min(dragStartPosition.current + g.dy, COLLAPSED_POSITION));
        moveSheet(current < COLLAPSED_POSITION / 2 || g.vy < -0.35 ? 0 : COLLAPSED_POSITION);
      },
    })
  ).current;

  const mapCenter = recommendationCenter ?? userLocation ?? DEFAULT_CENTER;

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        userLocation={userLocation}
        selectedMarkerId={selectedItemKey ? selectedItemKey.split(":")[1] : null}
        markers={currentItems.filter((i) => i.mission.placeLat && i.mission.placeLng).map((i) => ({
          id: i.mission.id,
          lat: i.mission.placeLat!,
          lng: i.mission.placeLng!,
          category: i.mission.cat,
          title: i.mission.title,
          description: i.mission.desc,
          recommendationReason: i.mission.recommendationReason,
          placeName: i.mission.placeName,
          time: i.mission.time,
          cost: i.mission.cost,
          actionLabel: i.kind === "recommended" ? "미션 시작하기" : i.kind === "active" ? "기록하기" : "내 기록 보기",
          actionVariant: i.kind === "recommended" ? "primary" : i.kind === "active" ? "pink" : "green",
        }))}
      />

      {/* 🌿 하단 슬라이딩 시트 */}
      <Animated.View style={[styles.sheet, { height: SHEET_HEIGHT, transform: [{ translateY: sheetTranslateY }] }]}>
        <View style={styles.dragArea} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeadingText}>
            <Text style={styles.sheetTitle}>{currentSectionTitle}</Text>
            <Text numberOfLines={1} style={styles.sheetSub}>{currentSectionSub}</Text>
          </View>

          {sheetSection === "recommended" ? (
            <View style={styles.headerActionRow}>
              <Pressable onPress={() => openConditionModal(0)} hitSlop={10} style={({ pressed }) => [styles.conditionBtn, pressed && styles.pressed]}>
                <Text style={styles.conditionText}>조건 설정</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* 🌿 상단 탭 3개 */}
        <View style={styles.sectionTabs}>
          <Animated.View style={[styles.sectionIndicator, { width: SECTION_INDICATOR_WIDTH, transform: [{ translateX: sectionIndicator.interpolate({ inputRange: [0, 1, 2], outputRange: [0, SECTION_INDICATOR_WIDTH, SECTION_INDICATOR_WIDTH * 2] }) }] }]} />
          {SECTION_LABELS.map((section) => {
            const count = section.key === "active" ? activeItems.length : section.key === "recommended" ? recommendedItems.length : recordItems.length;
            const selected = sheetSection === section.key;
            return (
              <Pressable key={section.key} onPress={() => changeSection(section.key)} style={styles.sectionTab}>
                <Text style={[styles.sectionTabText, selected && styles.sectionTabTextSelected]}>{section.label}</Text>
                <Text style={[styles.sectionCount, selected && styles.sectionCountSelected]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 🌿 미션 카드 목록 */}
        <Animated.View style={[styles.sectionContent, { opacity: sectionContentAnimation }]}>
          <ScrollView style={styles.missionScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.missionScrollContent}>
            {loading ? (
              <ActivityIndicator size="large" color={BL} style={{ marginTop: 40 }} />
            ) : currentItems.length > 0 ? (
              currentItems.map((item) => (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [styles.compactCard, selectedItemKey === item.key && styles.compactCardSelected, pressed && styles.pressed]}
                  onPress={() => {
                    setSelectedItemKey(item.key);
                    if (item.kind === "recommended") setDetailModalMission(item.mission);
                    else if (item.kind === "active") setRecordModalMission(item.mission);
                  }}
                >
                  <View style={styles.compactThumb}>
                    <Text style={styles.compactThumbEmoji}>{getCategoryEmoji(item.mission.cat)}</Text>
                  </View>
                  <View style={styles.compactContent}>
                    <Text numberOfLines={2} style={styles.compactTitle}>{item.mission.title}</Text>
                    <View style={styles.compactMetaRow}>
                      <Text style={styles.compactMeta}>{item.mission.time}</Text>
                      <Text style={styles.compactMetaDot}>·</Text>
                      <Text style={styles.compactMeta}>{item.mission.dist}</Text>
                      <View style={styles.compactCategory}><Text style={styles.compactCategoryText}>{item.mission.cat}</Text></View>
                    </View>
                  </View>

                  {item.kind === "recommended" ? (
                    <Pressable
                      style={styles.selectButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setDetailModalMission(item.mission);
                      }}
                    >
                      <Text style={styles.selectButtonText}>상세보기</Text>
                    </Pressable>
                  ) : item.kind === "active" ? (
                    <Pressable
                      style={styles.recordButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setRecordModalMission(item.mission);
                      }}
                    >
                      <Text style={styles.recordButtonText}>기록하기</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.completedButton}><Text style={styles.completedButtonText}>완료됨</Text></View>
                  )}
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🌱</Text>
                <Text style={styles.emptyStateTitle}>
                  {sheetSection === "active" ? "진행 중인 미션이 없어요" : sheetSection === "records" ? "아직 기록이 없어요" : "조건에 맞는 미션이 없어요"}
                </Text>
                <Text style={styles.emptyStateDescription}>
                  {sheetSection === "recommended" ? "우측 상단 [조건 설정]을 눌러 다른 조건을 골라보세요." : "추천 미션 탭에서 마음에 드는 경험을 시작해보세요!"}
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>

      {/* 🌿 미션 상세정보 팝업 모달 */}
      <Modal visible={detailModalMission !== null} transparent animationType="slide" onRequestClose={() => setDetailModalMission(null)}>
        <View style={styles.conditionModalOverlay}>
          <Pressable style={styles.conditionBackdrop} onPress={() => setDetailModalMission(null)} />
          <View style={[styles.conditionModalCard, { height: "68%" }]}>
            <View style={styles.conditionHandle} />
            {detailModalMission && (
              <ScrollView style={{ padding: 20 }}>
                <View style={styles.compactCategory}><Text style={styles.compactCategoryText}>{detailModalMission.cat}</Text></View>
                <Text style={[styles.conditionTitle, { marginTop: 10 }]}>{detailModalMission.title}</Text>
                <Text style={[styles.conditionHelp, { marginTop: 8 }]}>{detailModalMission.desc}</Text>

                <View style={styles.detailBox}>
                  <Text style={styles.detailBoxTitle}>💡 이렇게 해보세요</Text>
                  <Text style={styles.detailBoxText}>{detailModalMission.instructions}</Text>
                </View>

                <View style={[styles.detailBox, { backgroundColor: BLL }]}>
                  <Text style={[styles.detailBoxTitle, { color: BL }]}>🎯 추천 이유</Text>
                  <Text style={[styles.detailBoxText, { color: BL }]}>{detailModalMission.recommendationReason}</Text>
                </View>

                <Pressable
                  style={styles.startLargeButton}
                  onPress={() => handleStartMission(detailModalMission)}
                >
                  <Text style={styles.startLargeButtonText}>이 미션 시작하기</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 🌟 🌿 이미지 스크린샷 원본 그대로의 '기록 작성하기' 모달 */}
      <Modal visible={recordModalMission !== null} transparent animationType="slide" onRequestClose={() => setRecordModalMission(null)}>
        <KeyboardAvoidingView style={styles.conditionModalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.conditionBackdrop} onPress={() => setRecordModalMission(null)} />
          <View style={[styles.conditionModalCard, { height: "88%" }]}>
            <View style={styles.conditionHandle} />
            {recordModalMission && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                
                {/* 1. 여정 날짜 선택 칩 스크롤 (미래 선택 불가) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {journeyDates.map((item) => {
                    const selected = selectedRecordDate === item.dateKey;
                    return (
                      <Pressable
                        key={item.dateKey}
                        onPress={() => setSelectedRecordDate(item.dateKey)}
                        style={[styles.dateChip, selected && styles.dateChipSelected]}
                      >
                        <Text style={[styles.dateChipDay, selected && styles.dateChipTextSelected]}>{item.dayName}</Text>
                        <Text style={[styles.dateChipDate, selected && styles.dateChipTextSelected]}>{item.month}/{item.date}</Text>
                        {item.isToday && <Text style={[styles.dateChipToday, selected && styles.dateChipTextSelected]}>오늘</Text>}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={styles.dateNoticeText}>여정 시작일부터 오늘까지 선택할 수 있어요.</Text>

                {/* 2. 감정 선택 */}
                <Text style={[styles.fieldLabel, { marginTop: 18 }]}>어떤 감정이 가장 컸나요?</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                  {EMOTIONS.map((e) => (
                    <Pressable
                      key={e.value}
                      onPress={() => setRecordEmotion(e.value)}
                      style={[styles.emotionChip, recordEmotion === e.value && styles.emotionChipSelected]}
                    >
                      <Text style={[styles.emotionChipText, recordEmotion === e.value && styles.emotionChipTextSelected]}>{e.emoji} {e.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* 3. 그날의 경험 작성 */}
                <Text style={styles.fieldLabel}>그날의 경험을 남겨주세요</Text>
                <TextInput
                  value={recordContent}
                  onChangeText={setRecordContent}
                  multiline
                  maxLength={1200}
                  placeholder="무엇을 보고, 듣고, 느꼈는지 자유롭게 적어보세요."
                  placeholderTextColor={T2}
                  style={styles.recordInput}
                />
                <Text style={styles.charCountText}>{recordContent.length}/1200</Text>

                {/* 4. 사진 추가 영역 (0/5) */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 8 }}>
                  <Text style={styles.fieldLabel}>사진 추가</Text>
                  <Text style={{ fontSize: 12, color: T2 }}>{recordPhotos.length}/{MAX_RECORD_PHOTOS}</Text>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                  <Pressable style={styles.photoPickerBtn} onPress={handleTakePhoto}>
                    <Ionicons name="camera-outline" size={20} color={T0} />
                    <Text style={styles.photoPickerBtnText}>직접 찍기</Text>
                  </Pressable>
                  <Pressable style={styles.photoPickerBtn} onPress={handlePickPhotos}>
                    <Ionicons name="images-outline" size={20} color={T0} />
                    <Text style={styles.photoPickerBtnText}>갤러리에서 선택</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 11, color: T2, marginBottom: 12 }}>첫 번째 사진이 대표 사진으로 사용돼요.</Text>

                {/* 사진 썸네일 노출 */}
                {recordPhotos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {recordPhotos.map((photo, index) => (
                      <View key={photo.uri} style={styles.photoThumbWrap}>
                        <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                        <Pressable style={styles.photoDeleteBtn} onPress={() => removeRecordPhoto(photo.uri)}>
                          <Text style={{ color: WH, fontSize: 10, fontWeight: "800" }}>✕</Text>
                        </Pressable>
                        {index === 0 && (
                          <View style={styles.photoCoverBadge}>
                            <Text style={{ color: WH, fontSize: 9, fontWeight: "800" }}>대표</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}

                {/* 5. 공개 범위 */}
                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>공개 범위</Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                  <Pressable
                    style={[styles.visibilityOption, recordVisibility === "private" && styles.visibilityOptionSelected]}
                    onPress={() => setRecordVisibility("private")}
                  >
                    <Text style={[styles.visibilityTitle, recordVisibility === "private" && styles.visibilityTitleSelected]}>나만 보기</Text>
                    <Text style={styles.visibilitySub}>내 기록에서만 확인해요</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.visibilityOption, recordVisibility === "nickname" && styles.visibilityOptionSelected]}
                    onPress={() => setRecordVisibility("nickname")}
                  >
                    <Text style={[styles.visibilityTitle, recordVisibility === "nickname" && styles.visibilityTitleSelected]}>익명 공유</Text>
                    <Text style={styles.visibilitySub}>이름 없이 발견 탭에 공유해요</Text>
                  </Pressable>
                </View>

                {/* 저장 버튼 */}
                <Pressable style={styles.saveSubmitButton} onPress={handleSaveRecord}>
                  <Text style={styles.saveSubmitButtonText}>기록 저장하기</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🌿 조건 설정 모달 */}
      <Modal visible={conditionVisible} animationType="slide" transparent onRequestClose={() => setConditionVisible(false)}>
        <View style={styles.conditionModalOverlay}>
          <Pressable style={styles.conditionBackdrop} onPress={() => setConditionVisible(false)} />
          <View style={styles.conditionModalCard}>
            <View style={styles.conditionHandle} />
            <View style={styles.conditionHeader}>
              <View>
                <Text style={styles.conditionCaption}>추천 조건 설정</Text>
                <Text style={styles.conditionTitle}>
                  {conditionStep === 0 ? "1. 지역 설정" : conditionStep === 1 ? "2. 카테고리" : conditionStep === 2 ? "3. 예상 시간" : "4. 비용"}
                </Text>
              </View>
              <Pressable onPress={() => setConditionVisible(false)} style={styles.conditionClose}>
                <Text style={styles.conditionCloseText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.conditionProgressRow}>
              {[0, 1, 2, 3].map((step) => (
                <View key={step} style={[styles.conditionProgress, step <= conditionStep && styles.conditionProgressActive]} />
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.conditionBody}>
              {conditionStep === 0 ? (
                <>
                  <Text style={styles.conditionHelp}>상관없음은 현재 위치 3km를 사용하고, 직접 반경이나 구·군을 선택할 수도 있어요.</Text>
                  <View style={styles.locationModeRow}>
                    {([["any", "상관없음"], ["radius", "반경"], ["district", "구·군 선택"]] as const).map(([mode, label]) => {
                      const selected = draftLocationMode === mode;
                      return (
                        <Pressable key={mode} onPress={() => setDraftLocationMode(mode)} style={[styles.locationModeButton, selected && styles.locationModeButtonSelected]}>
                          <Text style={[styles.locationModeText, selected && styles.locationModeTextSelected]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {draftLocationMode === "radius" ? (
                    <>
                      <Text style={styles.locationSubLabel}>추천 범위</Text>
                      <View style={styles.radiusOptionRow}>
                        {RADIUS_OPTIONS.map((radius) => {
                          const selected = draftRadiusKm === radius;
                          return (
                            <Pressable key={radius} onPress={() => setDraftRadiusKm(radius)} style={[styles.radiusOptionButton, selected && styles.radiusOptionButtonSelected]}>
                              <Text style={[styles.radiusOptionText, selected && styles.radiusOptionTextSelected]}>{radius}km</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : draftLocationMode === "district" ? (
                    <>
                      <Text style={styles.locationSubLabel}>부산광역시 구·군</Text>
                      <View style={styles.optionWrap}>
                        {BUSAN_DISTRICTS.map((district) => {
                          const selected = draftDistrict === district;
                          return (
                            <Pressable key={district} onPress={() => setDraftDistrict(district)} style={[styles.optionChip, selected && styles.optionChipSelected]}>
                              <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{district}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    <View style={styles.locationAnyBox}>
                      <Text style={styles.locationAnyEmoji}>📍</Text>
                      <Text style={styles.locationAnyTitle}>현재 위치 주변에서 추천받아요</Text>
                      <Text style={styles.locationAnyDescription}>현재 위치를 기준으로 반경 {DEFAULT_ANY_RADIUS_KM}km 안의 실제 장소 미션과 내 방 미션을 추천해요.</Text>
                    </View>
                  )}
                </>
              ) : conditionStep === 1 ? (
                <>
                  <Text style={styles.conditionHelp}>여러 카테고리를 동시에 선택할 수 있어요.</Text>
                  <View style={styles.optionWrap}>
                    <Pressable onPress={() => setDraftCategories([])} style={[styles.optionChip, draftCategories.length === 0 && styles.optionChipSelected]}>
                      <Text style={[styles.optionChipText, draftCategories.length === 0 && styles.optionChipTextSelected]}>상관없음</Text>
                    </Pressable>
                    {CATEGORIES.map((cat) => {
                      const selected = draftCategories.includes(cat);
                      return (
                        <Pressable key={cat} onPress={() => setDraftCategories((prev) => selected ? prev.filter((i) => i !== cat) : [...prev, cat])} style={[styles.optionChip, selected && styles.optionChipSelected]}>
                          <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{getCategoryEmoji(cat)} {cat}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : conditionStep === 2 ? (
                <>
                  <Text style={styles.conditionHelp}>미션을 수행할 수 있는 시간을 골라주세요.</Text>
                  {TIME_OPTIONS.map((option) => (
                    <Pressable key={option.value} onPress={() => setDraftTime(option.value)} style={[styles.radioOption, draftTime === option.value && styles.radioOptionSelected]}>
                      <Text style={[styles.radioOptionText, draftTime === option.value && styles.radioOptionTextSelected]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  <Text style={styles.conditionHelp}>비용이 들 수 있는 활동도 괜찮은지 선택해주세요.</Text>
                  {COST_OPTIONS.map((option) => (
                    <Pressable key={option.value} onPress={() => setDraftCost(option.value)} style={[styles.radioOption, draftCost === option.value && styles.radioOptionSelected]}>
                      <Text style={[styles.radioOptionText, draftCost === option.value && styles.radioOptionTextSelected]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>

            <View style={styles.conditionFooter}>
              {conditionStep > 0 ? (
                <Pressable onPress={() => setConditionStep((step) => step - 1)} style={styles.previousButton}>
                  <Text style={styles.previousButtonText}>이전</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  if (conditionStep < 3) setConditionStep((step) => step + 1);
                  else void applyConditions();
                }}
                style={styles.nextButton}
              >
                <Text style={styles.nextButtonText}>{conditionStep < 3 ? "다음" : "조건 적용하고 추천받기"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  sheet: {
    position: "absolute", right: 0, bottom: 0, left: 0, overflow: "hidden",
    backgroundColor: WH, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T3, elevation: 15,
  },
  dragArea: { height: 38, alignItems: "center", justifyContent: "center" },
  dragHandle: { width: 42, height: 5, backgroundColor: "#D7D9DE", borderRadius: 3 },
  sheetHeader: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 },
  sheetHeadingText: { flex: 1 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: T0 },
  sheetSub: { marginTop: 2, fontSize: 11, color: T2 },
  headerActionRow: { flexDirection: "row", alignItems: "center" },
  conditionBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: BLL, borderRadius: 10 },
  conditionText: { fontSize: 12, fontWeight: "800", color: BL },

  sectionTabs: {
    position: "relative", height: 46, marginHorizontal: SECTION_HORIZONTAL_MARGIN,
    flexDirection: "row", backgroundColor: BG, borderRadius: 12, overflow: "hidden",
  },
  sectionIndicator: {
    position: "absolute", top: 3, bottom: 3, left: 0, backgroundColor: WH,
    borderRadius: 10, elevation: 2,
  },
  sectionTab: { flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  sectionTabText: { fontSize: 11, fontWeight: "600", color: T2 },
  sectionTabTextSelected: { fontWeight: "800", color: BL },
  sectionCount: { minWidth: 18, marginLeft: 4, paddingHorizontal: 5, paddingVertical: 2, textAlign: "center", fontSize: 10, fontWeight: "700", color: T2, backgroundColor: "#E6E4DC", borderRadius: 8 },
  sectionCountSelected: { color: BL, backgroundColor: BLL },

  sectionContent: { flex: 1 },
  missionScroll: { flex: 1 },
  missionScrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 130 },

  compactCard: {
    minHeight: 90, marginBottom: 10, padding: 14, flexDirection: "row", alignItems: "center",
    backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 18,
  },
  compactCardSelected: { backgroundColor: BLL, borderColor: BL },
  compactThumb: { width: 52, height: 52, marginRight: 12, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 14 },
  compactThumbEmoji: { fontSize: 22 },
  compactContent: { flex: 1, marginRight: 8 },
  compactTitle: { fontSize: 14, lineHeight: 20, fontWeight: "800", color: T0 },
  compactMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  compactMeta: { fontSize: 11, color: T1 },
  compactMetaDot: { marginHorizontal: 4, fontSize: 11, color: T2 },
  compactCategory: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3, backgroundColor: BLL, borderRadius: 6 },
  compactCategoryText: { fontSize: 10, fontWeight: "700", color: BL },

  selectButton: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: BLL, borderRadius: 10, alignItems: "center" },
  selectButtonText: { fontSize: 12, fontWeight: "800", color: BL },
  recordButton: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: PINK_LIGHT, borderRadius: 10, alignItems: "center" },
  recordButtonText: { fontSize: 12, fontWeight: "800", color: PINK },
  completedButton: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: BLL, borderRadius: 10, alignItems: "center" },
  completedButtonText: { fontSize: 12, fontWeight: "800", color: BL },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 50 },
  emptyStateEmoji: { fontSize: 36, marginBottom: 8 },
  emptyStateTitle: { fontSize: 15, fontWeight: "800", color: T0 },
  emptyStateDescription: { fontSize: 12, color: T1, textAlign: "center", marginTop: 4, marginBottom: 16 },
  pressed: { opacity: 0.76 },

  // 🌿 미션 상세보기 / 기록 작성 모달 스타일
  detailBox: { padding: 14, backgroundColor: BG, borderRadius: 14, marginTop: 12 },
  detailBoxTitle: { fontSize: 12, fontWeight: "800", color: T0, marginBottom: 4 },
  detailBoxText: { fontSize: 13, color: T1, lineHeight: 20 },
  startLargeButton: { minHeight: 50, marginTop: 20, backgroundColor: BL, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  startLargeButtonText: { fontSize: 15, fontWeight: "800", color: WH },
  fieldLabel: { fontSize: 13, fontWeight: "800", color: T0 },
  
  // 🌟 날짜 선택 칩 스타일 (스크린샷 원본 동일)
  dateChip: {
    width: 68, height: 72, marginRight: 8, paddingVertical: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14,
  },
  dateChipSelected: {
    backgroundColor: PINK_LIGHT, borderColor: PINK, borderWidth: 1.5,
  },
  dateChipDay: { fontSize: 11, fontWeight: "700", color: T2, marginBottom: 2 },
  dateChipDate: { fontSize: 14, fontWeight: "800", color: T0 },
  dateChipToday: { fontSize: 10, fontWeight: "800", color: PINK, marginTop: 2 },
  dateChipTextSelected: { color: PINK },
  dateNoticeText: { fontSize: 11, color: T2, marginBottom: 6 },

  emotionChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 18 },
  emotionChipSelected: { backgroundColor: PINK_LIGHT, borderColor: PINK, borderWidth: 1.5 },
  emotionChipText: { fontSize: 12, color: T1 },
  emotionChipTextSelected: { fontWeight: "800", color: PINK },

  recordInput: { minHeight: 120, padding: 14, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14, fontSize: 14, color: T0 },
  charCountText: { textAlign: "right", fontSize: 11, color: T2, marginTop: 4, marginBottom: 8 },

  photoPickerBtn: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 12 },
  photoPickerBtnText: { fontSize: 12, fontWeight: "800", color: T0 },
  photoThumbWrap: { position: "relative", width: 72, height: 72, marginRight: 8 },
  photoThumb: { width: "100%", height: "100%", borderRadius: 10, backgroundColor: T3 },
  photoDeleteBtn: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  photoCoverBadge: { position: "absolute", bottom: 4, right: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: PINK, borderRadius: 6 },

  visibilityOption: { flex: 1, padding: 12, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  visibilityOptionSelected: { backgroundColor: PINK_LIGHT, borderColor: PINK, borderWidth: 1.5 },
  visibilityTitle: { fontSize: 13, fontWeight: "800", color: T0, marginBottom: 2 },
  visibilityTitleSelected: { color: PINK },
  visibilitySub: { fontSize: 10, color: T2 },

  saveSubmitButton: { minHeight: 52, backgroundColor: PINK, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 8 },
  saveSubmitButtonText: { fontSize: 15, fontWeight: "800", color: WH },

  // 🌿 조건 설정 모달
  conditionModalOverlay: { flex: 1, justifyContent: "flex-end" },
  conditionBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(24, 35, 29, 0.52)" },
  conditionModalCard: { height: "82%", backgroundColor: "#F9F7F1", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  conditionHandle: { alignSelf: "center", width: 42, height: 5, marginTop: 10, backgroundColor: "#D7D9DE", borderRadius: 3 },
  conditionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16 },
  conditionCaption: { marginBottom: 4, fontSize: 12, fontWeight: "800", color: BL },
  conditionTitle: { fontSize: 20, fontWeight: "800", color: T0 },
  conditionClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: WH, borderRadius: 18 },
  conditionCloseText: { fontSize: 14, color: T1 },
  conditionProgressRow: { flexDirection: "row", paddingHorizontal: 20, marginTop: 16 },
  conditionProgress: { flex: 1, height: 4, marginRight: 5, backgroundColor: "#E6E4DC", borderRadius: 2 },
  conditionProgressActive: { backgroundColor: BL },
  conditionBody: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  conditionHelp: { marginBottom: 16, fontSize: 13, lineHeight: 19, color: T1 },
  locationModeRow: { flexDirection: "row", marginBottom: 18, padding: 4, backgroundColor: "#E6E4DC", borderRadius: 14 },
  locationModeButton: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  locationModeButtonSelected: { backgroundColor: WH },
  locationModeText: { fontSize: 12, fontWeight: "700", color: T2 },
  locationModeTextSelected: { color: BL, fontWeight: "800" },
  locationSubLabel: { marginBottom: 10, fontSize: 13, fontWeight: "800", color: T0 },
  radiusOptionRow: { flexDirection: "row", marginBottom: 14 },
  radiusOptionButton: { flex: 1, minHeight: 44, marginRight: 8, alignItems: "center", justifyContent: "center", backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 12 },
  radiusOptionButtonSelected: { backgroundColor: BLL, borderColor: BL },
  radiusOptionText: { fontSize: 13, fontWeight: "700", color: T1 },
  radiusOptionTextSelected: { color: BL, fontWeight: "800" },
  locationAnyBox: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 26, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 18 },
  locationAnyEmoji: { marginBottom: 8, fontSize: 32 },
  locationAnyTitle: { marginBottom: 6, fontSize: 15, fontWeight: "800", color: T0 },
  locationAnyDescription: { textAlign: "center", fontSize: 12, lineHeight: 18, color: T1 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap" },
  optionChip: { marginRight: 8, marginBottom: 9, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 20 },
  optionChipSelected: { backgroundColor: BLL, borderColor: BL },
  optionChipText: { fontSize: 13, color: T1 },
  optionChipTextSelected: { fontWeight: "800", color: BL },
  radioOption: { minHeight: 52, marginBottom: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  radioOptionSelected: { backgroundColor: BLL, borderColor: BL },
  radioOptionText: { fontSize: 14, fontWeight: "700", color: T1 },
  radioOptionTextSelected: { color: BL, fontWeight: "800" },
  conditionFooter: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, borderTopWidth: 1, borderTopColor: T3 },
  previousButton: { minWidth: 80, marginRight: 8, paddingVertical: 14, alignItems: "center", backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  previousButtonText: { fontSize: 14, fontWeight: "800", color: T1 },
  nextButton: { flex: 1, paddingVertical: 14, alignItems: "center", backgroundColor: BL, borderRadius: 14 },
  nextButtonText: { fontSize: 14, fontWeight: "800", color: WH },
  videoBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  }
});