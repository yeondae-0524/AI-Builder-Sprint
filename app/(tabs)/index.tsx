import * as ImagePicker from "expo-image-picker";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";

import { KakaoMapView } from "../../components/KakaoMapView";
import { useMission } from "../../contexts/mission-context";
import { supabase } from "../../lib/supabase";
import {
  Mission as BackendMission
} from "../../services/challenge.service";

// 🌿 에세이/캘린더/발견/마이페이지 탭과 동일한 톤앤매너 팔레트
const BL = "#315C4A";            // 메인 다크 그린
const BLL = "#E5EEE8";           // 연한 그린 (배경/태그용)
const ACCENT = "#F2C96D";        // 노란 포인트
const PINK = "#E07A5F";          // 차분한 코랄 핑크
const PINK_LIGHT = "#F4EAE1";    // 연한 피치/코랄
const T0 = "#26372E";            // 텍스트 메인
const T1 = "#65766D";            // 서브 텍스트
const T2 = "#9AA49F";            // 뮤트 텍스트
const T3 = "#E2E3DC";            // 테두리
const WH = "#FFFFFF";
const BG = "#F5F2E9";            // 따뜻한 베이지 배경
const SUCCESS = "#315C4A";
const SUCCESS_LIGHT = "#E5EEE8";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SHEET_HEIGHT = SCREEN_HEIGHT - 90;
const TAB_BAR_SPACE = 105;
const COLLAPSED_HEADER_HEIGHT = 148;
const COLLAPSED_VISIBLE_HEIGHT =
  TAB_BAR_SPACE + COLLAPSED_HEADER_HEIGHT;
const COLLAPSED_POSITION = Math.max(
  SHEET_HEIGHT - COLLAPSED_VISIBLE_HEIGHT,
  0,
);
const SECTION_HORIZONTAL_MARGIN = 16;
const SECTION_INDICATOR_WIDTH =
  (SCREEN_WIDTH - SECTION_HORIZONTAL_MARGIN * 2) / 3;

const KAKAO_JS_KEY = "f937d15a94db64ab114b3495f8b6ad3c";
const KAKAO_REST_API_KEY = "c10a1b62f7bbf1d90e0ff60bb94bdadd";
const KAKAO_PLACE_CATEGORY_CODES = [
  "MT1", "CS2", "PS3", "SC4", "AC5", "PK6", "OL7", "SW8", "BK9", "CT1", "AG2", "PO3", "AT4", "AD5", "FD6", "CE7", "HP8", "PM9",
] as const;
const KAKAO_PLACE_SEARCH_RADII_M = [500, 2000] as const;
const KAKAO_PLACE_CANDIDATE_LIMIT = 5;
const DEFAULT_ANY_RADIUS_KM = 3;
const DISTRICT_TOPOJSON_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo-simple.json";

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

type RecordLocationKind = "place" | "map" | "home";
type LngLat = [number, number];
type DistrictPolygon = LngLat[][];

type PlaceCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  districtName?: string;
  category?: CategoryName;
  categoryDetail?: string;
  distanceM?: number;
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
  placeAddress?: string;
  districtName?: string;
  isAtHome?: boolean;
  isLocationFlexible?: boolean;
  isFallback?: boolean;
};

type ExtendedBackendMission = Partial<BackendMission> & {
  id?: string | number | null;
  name?: string | null;
  mission_title?: string | null;
  description?: string | null;
  desc?: string | null;
  detailed_description?: string | null;
  mission_guide?: string | null;
  reason?: string | null;
  category?: BackendMission["category"] | string | null;
  category_name?: string | null;
  categoryName?: string | null;
  cat?: string | null;
  cost_type?: string | null;
  costType?: string | null;
  estimatedTime?: number | string | null;
  duration?: number | string | null;
  preparations?: string[] | string | null;
  place_id?: string | null;
  place_lat?: number | string | null;
  place_lng?: number | string | null;
  place_name?: string | null;
  place_address?: string | null;
  address?: string | null;
  address_name?: string | null;
  road_address?: string | null;
  road_address_name?: string | null;
  district?: string | null;
  gu?: string | null;
  region_2depth_name?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  distance_km?: number | string | null;
  distance?: number | string | null;
  requires_place?: boolean | null;
  requiresPlace?: boolean | null;
  location_type?: string | null;
  locationType?: string | null;
  at_home?: boolean | null;
  is_home?: boolean | null;
};

type ActiveJourney = {
  id: string;
  startDate: string;
  endDate: string;
};

type StartedAttempt = {
  id: string;
  journeyId: string;
  missionId: string;
  placeId: string | null;
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
  locationType: RecordLocationKind | null;
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

const MAX_RECORD_PHOTOS = 5;

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => { setTimeout(resolve, milliseconds); });
}

function isJwtIssuedAtFutureError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as SupabaseErrorLike;
  const code = String(candidate.code ?? "");
  const message = String(candidate.message ?? "").toLowerCase();
  return message.includes("jwt issued at future") || (code === "PGRST303" && message.includes("jwt"));
}

async function refreshSupabaseSession() {
  await sleep(1200);
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  if (!data.session) throw new Error("로그인 세션을 갱신하지 못했습니다.");
  return data.session;
}

async function withJwtRetry<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (!isJwtIssuedAtFutureError(error)) throw error;
    await refreshSupabaseSession();
    return operation();
  }
}

async function retrySupabaseResultOnJwt<T extends { error?: unknown }>(operation: () => PromiseLike<T>): Promise<T> {
  let result = await operation();
  if (result.error && isJwtIssuedAtFutureError(result.error)) {
    await refreshSupabaseSession();
    result = await operation();
  }
  return result;
}

const EMOTIONS: Array<{ label: string; value: EmotionValue; emoji: string }> = [
  { label: "편안해요", value: "comfortable", emoji: "😌" },
  { label: "즐거워요", value: "joyful", emoji: "😊" },
  { label: "새로워요", value: "new", emoji: "✨" },
  { label: "불편해요", value: "uncomfortable", emoji: "😣" },
  { label: "잘 모르겠어요", value: "unsure", emoji: "🤔" },
];

const TIME_OPTIONS: Array<{ value: TimeFilter; label: string; backendValue: string }> = [
  { value: "any", label: "상관없음", backendValue: "상관없음" },
  { value: "under15", label: "15분 이내", backendValue: "15분 이내" },
  { value: "under30", label: "30분 이내", backendValue: "30분 이내" },
  { value: "under60", label: "1시간 이내", backendValue: "1시간 이내" },
  { value: "over60", label: "1시간 이상", backendValue: "1시간 이상" },
];

const COST_OPTIONS: Array<{ value: CostFilter; label: string; backendValue: string }> = [
  { value: "any", label: "상관없음", backendValue: "무료/유료" },
  { value: "free", label: "무료", backendValue: "무료" },
  { value: "paid", label: "유료", backendValue: "유료" },
];

const RADIUS_OPTIONS: RadiusKm[] = [1, 3, 5];

const BUSAN_DISTRICTS: BusanDistrict[] = [
  "중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군",
];

const BUSAN_DISTRICT_CODES: Record<BusanDistrict, string> = {
  강서구: "26440", 금정구: "26410", 기장군: "26710", 남구: "26290", 동구: "26170", 동래구: "26260", 부산진구: "26230", 북구: "26320",
  사상구: "26530", 사하구: "26380", 서구: "26140", 수영구: "26500", 연제구: "26470", 영도구: "26200", 중구: "26110", 해운대구: "26350",
};

const BUSAN_DISTRICT_CENTERS: Record<BusanDistrict, Coordinate> = {
  강서구: { lat: 35.2121, lng: 128.9806 }, 금정구: { lat: 35.2431, lng: 129.0921 }, 기장군: { lat: 35.2445, lng: 129.2223 },
  남구: { lat: 35.1365, lng: 129.0842 }, 동구: { lat: 35.1293, lng: 129.0454 }, 동래구: { lat: 35.2048, lng: 129.0838 },
  부산진구: { lat: 35.1629, lng: 129.0532 }, 북구: { lat: 35.1972, lng: 128.9904 }, 사상구: { lat: 35.1526, lng: 128.9911 },
  사하구: { lat: 35.1045, lng: 128.9748 }, 서구: { lat: 35.0979, lng: 129.0244 }, 수영구: { lat: 35.1455, lng: 129.1132 },
  연제구: { lat: 35.1762, lng: 129.0799 }, 영도구: { lat: 35.0912, lng: 129.0679 }, 중구: { lat: 35.1063, lng: 129.0323 },
  해운대구: { lat: 35.1631, lng: 129.1635 },
};

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

function relationArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeStringArray(item)).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== value) {
        const parsedItems = normalizeStringArray(parsed);
        if (parsedItems.length > 0) return parsedItems;
      }
    } catch {}
    return trimmed.split(/[,|/\n]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function isFiniteNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

function toFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isUuid(value: string | undefined | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysToDateKey(value: string, days: number) {
  const date = parseDateKey(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function getDateKeysBetween(startDate: string, endDate: string) {
  if (startDate > endDate) return [];
  const dates: string[] = [];
  let current = startDate;
  for (let index = 0; index < 370 && current <= endDate; index += 1) {
    dates.push(current);
    current = addDaysToDateKey(current, 1);
  }
  return dates;
}

function formatDateKeyKorean(value: string) {
  const date = parseDateKey(value);
  if (!date) return value;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
}

function getRecordDateOption(value: string) {
  const date = parseDateKey(value);
  if (!date) return { monthDay: value, weekday: "" };
  return {
    monthDay: `${date.getMonth() + 1}/${date.getDate()}`,
    weekday: ["일", "월", "화", "수", "목", "금", "토"][date.getDay()],
  };
}

function formatRecordDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

function getRawCategoryName(mission: ExtendedBackendMission): string {
  if (typeof mission.category === "string") return mission.category;
  if (mission.category && typeof mission.category === "object" && "name" in mission.category) {
    return String(mission.category.name ?? "");
  }
  return String(mission.category_name ?? mission.categoryName ?? mission.cat ?? "");
}

function inferCategoryFromText(text: string): CategoryName {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();
  if (/(카페|디저트|베이커리|빵집|빵|커피|라떼|케이크|아이스크림|차 한 잔)/.test(normalized)) return "카페 및 디저트";
  if (/(맛집|식사|음식|요리|먹기|국밥|라면|국수|분식|시장 음식|한 끼)/.test(normalized)) return "음식";
  if (/(산책|걷기|걸어|공원|골목길|해변|강변|둘레길|동네 한 바퀴|여행|탐방|자연|등산)/.test(normalized)) return "산책";
  if (/(독서|책 읽|공부|배우|학습|강의|도서관|서점에서 읽|새로운 지식)/.test(normalized)) return "배움";
  if (/(음악|영화|공연|전시|버스킹|미술관|박물관|감상|사진전|사진|그림|연극)/.test(normalized)) return "감상";
  if (/(운동|체험|만들기|공방|자전거|클라이밍|러닝|요가|춤|볼링|활동)/.test(normalized)) return "활동";
  if (/(휴식|명상|호흡|온천|찜질|낮잠|멍 때리|쉬어|힐링)/.test(normalized)) return "휴식";
  return "기타";
}

function normalizeCategory(rawCategory: string | null | undefined, textForInference: string): CategoryName {
  const category = rawCategory?.trim() ?? "";
  const normalized = category.toLowerCase();
  const inferred = inferCategoryFromText(textForInference);
  let explicit: CategoryName | null = null;

  if (CATEGORIES.includes(category as CategoryName)) explicit = category as CategoryName;
  else if (/(카페|디저트|베이커리|빵)/.test(normalized)) explicit = "카페 및 디저트";
  else if (/(음식|식사|맛집|food)/.test(normalized)) explicit = "음식";
  else if (/(산책|걷기|여행|탐방|walk)/.test(normalized)) explicit = "산책";
  else if (/(배움|독서|학습|learn|study)/.test(normalized)) explicit = "배움";
  else if (/(감상|음악|영화|공연|전시|사진|culture)/.test(normalized)) explicit = "감상";
  else if (/(활동|운동|체험|activity|sport)/.test(normalized)) explicit = "활동";
  else if (/(휴식|명상|힐링|relax|rest)/.test(normalized)) explicit = "휴식";

  if (inferred !== "기타" && explicit !== null && inferred !== explicit) return inferred;
  return explicit ?? inferred;
}

function normalizeCostStatus(mission: ExtendedBackendMission, textForInference: string): CostStatus {
  const explicit = String(mission.cost_type ?? mission.costType ?? "").trim().toLowerCase();
  if (explicit.includes("유료/무료") || explicit.includes("무료/유료")) return "유료/무료";
  if (explicit === "무료" || explicit.includes("free")) return "무료";
  if (explicit === "유료" || explicit.includes("paid")) return "유료";

  const text = textForInference.replace(/\s+/g, " ");
  if (/(소품샵|편집숍|플리마켓|시장 구경|서점 구경|구경하기)/.test(text)) return "유료/무료";
  if (/(구매|주문|먹기|마시기|카페|디저트|빵집|음료|식사|입장권|티켓)/.test(text)) return "유료";

  const estimatedCost = toFiniteNumber(mission.estimated_cost);
  if (estimatedCost === null) return "유료/무료";
  return estimatedCost > 0 ? "유료" : "무료";
}

function parseDurationMinutes(value: unknown): number | null {
  const direct = toFiniteNumber(value);
  if (direct !== null) return direct;
  if (typeof value !== "string") return null;

  const hourMatch = value.match(/(\d+(?:\.\d+)?)\s*시간/);
  const minuteMatch = value.match(/(\d+)\s*분/);
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60 + (minuteMatch ? Number(minuteMatch[1]) : 0));
  return minuteMatch ? Number(minuteMatch[1]) : null;
}

function normalizeRequiredItems(mission: ExtendedBackendMission): string[] {
  const value = mission.required_items ?? mission.preparations;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/[,/]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function haversineDistanceKm(from: Coordinate, to: Coordinate) {
  const earthRadiusKm = 6371;
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const latitudeDistance = toRadians(to.lat - from.lat);
  const longitudeDistance = toRadians(to.lng - from.lng);
  const a = Math.sin(latitudeDistance / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(longitudeDistance / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCategoryEmoji(category: CategoryName) {
  const emojis: Record<CategoryName, string> = { 음식: "🍽️", "카페 및 디저트": "☕", 산책: "🌿", 배움: "📚", 감상: "🎧", 활동: "🏃", 휴식: "🛋️", 기타: "✨" };
  return emojis[category];
}

function getEmotionInfo(value: EmotionValue) {
  return EMOTIONS.find((item) => item.value === value) ?? { label: value, value, emoji: "🙂" };
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

export default function HomeScreen() {
  const [missions, setMissions] = useState<HomeMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [activeJourney, setActiveJourney] = useState<ActiveJourney | null>(null);
  const [startedAttempts, setStartedAttempts] = useState<Record<string, StartedAttempt>>({});
  const [attemptMissions, setAttemptMissions] = useState<Record<string, HomeMission>>({});
  const [completedRecords, setCompletedRecords] = useState<CompletedRecord[]>([]);
  const [completedMissionIds, setCompletedMissionIds] = useState<Set<string>>(new Set());
  const [completedMissionCount, setCompletedMissionCount] = useState(0);
  const [startLoadingId, setStartLoadingId] = useState<string | null>(null);

  const [sheetSection, setSheetSection] = useState<SheetSection>("recommended");
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [homeMissionPanelOpen, setHomeMissionPanelOpen] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState<RecommendationFilters>(DEFAULT_FILTERS);
  const [recommendationCenter, setRecommendationCenter] = useState<Coordinate | null>(null);
  const [recommendationLocationMode, setRecommendationLocationMode] = useState<LocationMode>("any");
  const [recommendationRadiusKm, setRecommendationRadiusKm] = useState<RadiusKm>(1);
  const [recommendationDistrict, setRecommendationDistrict] = useState<BusanDistrict | null>(null);
  const [profileInterests, setProfileInterests] = useState<CategoryName[]>([]);
  const [conditionVisible, setConditionVisible] = useState(false);
  const [conditionStep, setConditionStep] = useState(0);
  const [draftCategories, setDraftCategories] = useState<CategoryName[]>([]);
  const [draftTime, setDraftTime] = useState<TimeFilter>("any");
  const [draftCost, setDraftCost] = useState<CostFilter>("any");
  const [draftCenter, setDraftCenter] = useState<Coordinate | null>(null);
  const [draftLocationMode, setDraftLocationMode] = useState<LocationMode>("any");
  const [draftRadiusKm, setDraftRadiusKm] = useState<RadiusKm>(1);
  const [draftDistrict, setDraftDistrict] = useState<BusanDistrict | null>(null);

  const [recordMission, setRecordMission] = useState<HomeMission | null>(null);
  const [recordContent, setRecordContent] = useState("");
  const [recordEmotion, setRecordEmotion] = useState<EmotionValue | "">("");
  const [recordVisibility, setRecordVisibility] = useState<RecordVisibility>("private");
  const [recordDate, setRecordDate] = useState(toDateKey(new Date()));
  const [recordPhotos, setRecordPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [recordLocation, setRecordLocation] = useState<Coordinate | null>(null);
  const [recordLocationKind, setRecordLocationKind] = useState<RecordLocationKind | null>(null);
  const [recordPlaceCandidates, setRecordPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [recordSelectedPlace, setRecordSelectedPlace] = useState<PlaceCandidate | null>(null);
  const [recordPlaceTapLocation, setRecordPlaceTapLocation] = useState<Coordinate | null>(null);
  const [recordNearestPlaceDistanceM, setRecordNearestPlaceDistanceM] = useState<number | null>(null);
  const [recordPlacesLoading, setRecordPlacesLoading] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordDetail, setRecordDetail] = useState<CompletedRecord | null>(null);

  const { pendingSharedMission, clearPendingSharedMission } = useMission();

  const locationRequested = useRef(false);
  const recommendationsInitialized = useRef(false);
  const recommendationsRef = useRef<HomeMission[]>([]);
  const recommendationRequestIdRef = useRef(0);
  const sheetTranslateY = useRef(new Animated.Value(COLLAPSED_POSITION)).current;
  const dragStartPosition = useRef(COLLAPSED_POSITION);
  const sectionIndicator = useRef(new Animated.Value(SECTION_INDEX.recommended)).current;
  const sectionContentAnimation = useRef(new Animated.Value(1)).current;
  const homeCardAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => { recommendationsRef.current = missions; }, [missions]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const moveSheet = useCallback((destination: number) => {
    dragStartPosition.current = destination;
    Animated.spring(sheetTranslateY, {
      toValue: destination, useNativeDriver: true, damping: 24, stiffness: 190, mass: 0.9, overshootClamping: true,
    }).start();
  }, [sheetTranslateY]);

  const activeItems = useMemo<MissionListItem[]>(() => Object.values(startedAttempts).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).flatMap((attempt): MissionListItem[] => {
    const mission = attemptMissions[attempt.missionId] ?? missions.find((item) => item.id === attempt.missionId);
    if (!mission) return [];
    return [{ key: `active:${attempt.id}`, kind: "active", mission, attempt }];
  }), [attemptMissions, missions, startedAttempts]);

  const recommendedItems = useMemo<MissionListItem[]>(() => missions.filter((mission) => !startedAttempts[mission.id] && !completedMissionIds.has(mission.id)).map((mission) => ({ key: `recommended:${mission.id}`, kind: "recommended" as const, mission })), [completedMissionIds, missions, startedAttempts]);

  const recordItems = useMemo<MissionListItem[]>(() => completedRecords.flatMap((record): MissionListItem[] => {
    const mission = attemptMissions[record.missionId] ?? missions.find((item) => item.id === record.missionId);
    if (!mission) return [];
    return [{ key: `record:${record.attemptId}`, kind: "record", mission, record }];
  }), [attemptMissions, completedRecords, missions]);

  const currentItems = sheetSection === "active" ? activeItems : sheetSection === "recommended" ? recommendedItems : recordItems;
  const currentSectionTitle = sheetSection === "active" ? "현재 진행중인 미션" : sheetSection === "recommended" ? "추천 미션" : "내가 쓴 기록";
  const currentSectionSub = sheetSection === "recommended" ? `${getConditionSummary(appliedFilters, recommendationLocationMode, recommendationCenter, recommendationRadiusKm, recommendationDistrict)} · ${recommendedItems.length}개` : sheetSection === "active" ? `${activeItems.length}개의 미션을 진행하고 있어요` : `${recordItems.length}개의 기록을 남겼어요`;

  const changeSection = (next: SheetSection) => {
    if (next === sheetSection) return;
    Animated.spring(sectionIndicator, { toValue: SECTION_INDEX[next], useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.8 }).start();
    Animated.timing(sectionContentAnimation, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setSelectedItemKey(null); setHomeMissionPanelOpen(false); setSheetSection(next);
      sectionContentAnimation.setValue(0);
      Animated.timing(sectionContentAnimation, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const toggleSheet = () => {
    sheetTranslateY.stopAnimation((currentPosition) => {
      const isCollapsed = currentPosition > COLLAPSED_POSITION / 2;
      moveSheet(isCollapsed ? 0 : COLLAPSED_POSITION);
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
        if (Math.abs(g.dy) < 5) { toggleSheet(); return; }
        moveSheet(current < COLLAPSED_POSITION / 2 || g.vy < -0.35 ? 0 : COLLAPSED_POSITION);
      },
    })
  ).current;

  const selectListItem = (item: MissionListItem) => {
    if (selectedItemKey === item.key) {
      if (item.mission.isAtHome) setHomeMissionPanelOpen(true);
      moveSheet(COLLAPSED_POSITION);
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (item.mission.isAtHome) {
      homeCardAnimation.setValue(0); setHomeMissionPanelOpen(true);
    } else {
      homeCardAnimation.setValue(0); setHomeMissionPanelOpen(false);
    }
    setSelectedItemKey(item.key); moveSheet(COLLAPSED_POSITION);
  };

  const mapCenter = recommendationCenter ?? userLocation ?? DEFAULT_CENTER;

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        userLocation={userLocation}
        selectedMarkerId={selectedItemKey ? selectedItemKey.split(":")[1] : null}
        markers={currentItems.filter((item) => isFiniteNumber(item.mission.placeLat) && isFiniteNumber(item.mission.placeLng)).map((item) => ({
          id: item.mission.id,
          lat: item.mission.placeLat!,
          lng: item.mission.placeLng!,
          category: item.mission.cat,
          title: item.mission.title,
          description: item.mission.desc,
          recommendationReason: item.mission.recommendationReason,
          placeName: item.mission.placeName,
          time: item.mission.time,
          cost: item.mission.cost,
          actionLabel: item.kind === "recommended" ? "미션 시작하기" : item.kind === "active" ? "기록하기" : "내 기록 보기",
          actionVariant: item.kind === "recommended" ? "primary" : item.kind === "active" ? "pink" : "green",
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
              <Pressable onPress={() => setConditionVisible(true)} style={({ pressed }) => [styles.conditionBtn, pressed && styles.pressed]}>
                <Text style={styles.conditionText}>조건 설정</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* 🌿 상단 탭 3개 (현재 진행중 / 추천 미션 / 내가 쓴 기록) */}
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
            {currentItems.length > 0 ? (
              currentItems.map((item) => (
                <Pressable key={item.key} style={({ pressed }) => [styles.compactCard, selectedItemKey === item.key && styles.compactCardSelected, pressed && styles.pressed]} onPress={() => selectListItem(item)}>
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
                    <View style={styles.selectButton}><Text style={styles.selectButtonText}>선택</Text></View>
                  ) : item.kind === "active" ? (
                    <View style={styles.recordButton}><Text style={styles.recordButtonText}>기록하기</Text></View>
                  ) : (
                    <View style={styles.completedButton}><Text style={styles.completedButtonText}>기록 보기</Text></View>
                  )}
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🌱</Text>
                <Text style={styles.emptyStateTitle}>미션이 없어요</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
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
  compactCategory: { marginLeft: 6, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: BLL, borderRadius: 6 },
  compactCategoryText: { fontSize: 10, fontWeight: "700", color: BL },

  selectButton: { minWidth: 54, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: BLL, borderRadius: 10, alignItems: "center" },
  selectButtonText: { fontSize: 12, fontWeight: "800", color: BL },
  recordButton: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: PINK_LIGHT, borderRadius: 10, alignItems: "center" },
  recordButtonText: { fontSize: 12, fontWeight: "800", color: PINK },
  completedButton: { minWidth: 68, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: BLL, borderRadius: 10, alignItems: "center" },
  completedButtonText: { fontSize: 12, fontWeight: "800", color: BL },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 50 },
  emptyStateEmoji: { fontSize: 36, marginBottom: 8 },
  emptyStateTitle: { fontSize: 15, fontWeight: "800", color: T0 },
  pressed: { opacity: 0.76 },
});