import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { WebView } from "react-native-webview";

import { KakaoMapView } from "../../components/KakaoMapView";
import { useMission } from "../../contexts/mission-context";
import { supabase } from "../../lib/supabase";
import {
  Mission as BackendMission,
  getMissionById,
  getRecommendedMissions,
} from "../../services/challenge.service";
import { createDiscoverPost } from "../../services/service_missons";

const BL = "#315C4A";
const BLL = "#E5EEE8";
const PINK = "#E07A5F";
const PINK_LIGHT = "#F4EAE1";
const T0 = "#26372E";
const T1 = "#65766D";
const T2 = "#9AA49F";
const T3 = "#E2E3DC";
const WH = "#FFFFFF";
const BG = "#F5F2E9";
const SUCCESS = "#10B981";
const SUCCESS_LIGHT = "#ECFDF5";


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
  "MT1", "CS2", "PS3", "SC4", "AC5", "PK6", "OL7", "SW8", "BK9",
  "CT1", "AG2", "PO3", "AT4", "AD5", "FD6", "CE7", "HP8", "PM9",
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
type CostStatus = "무료" | "유료" | "유료/무료";
type SheetSection = "active" | "recommended" | "records";
type ListKind = "active" | "recommended" | "record";
type RecordVisibility = "private" | "nickname";
type EmotionValue =
  | "comfortable"
  | "joyful"
  | "new"
  | "uncomfortable"
  | "unsure";
type MissionPreferenceValue =
  | "like"
  | "neutral"
  | "dislike";
type TimeFilter =
  | "any"
  | "under15"
  | "under30"
  | "under60"
  | "over60";
type CostFilter = "any" | "free" | "paid";
type LocationMode = "any" | "radius" | "district";
type RadiusKm = 1 | 3 | 5;
type BusanDistrict =
  | "강서구"
  | "금정구"
  | "기장군"
  | "남구"
  | "동구"
  | "동래구"
  | "부산진구"
  | "북구"
  | "사상구"
  | "사하구"
  | "서구"
  | "수영구"
  | "연제구"
  | "영도구"
  | "중구"
  | "해운대구";

type Coordinate = {
  lat: number;
  lng: number;
};

type RecordLocationKind = "place" | "map" | "home";

type KakaoPlaceDocument = {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_name?: string;
  road_address_name?: string;
  address_name?: string;
  x?: string;
  y?: string;
  distance?: string;
};

type KakaoAddressDocument = {
  address?: {
    address_name?: string;
    region_3depth_name?: string;
  } | null;
  road_address?: {
    address_name?: string;
    region_3depth_name?: string;
    road_name?: string;
    building_name?: string;
  } | null;
};

type LngLat = [number, number];
type DistrictPolygon = LngLat[][];

type PlaceCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  districtName?: string;
  category: CategoryName;
  kakaoCategoryName?: string;
  kakaoCategoryGroupCode?: string;
  kakaoCategoryGroupName?: string;
  foodOnly?: boolean;
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
  placeEligible?: boolean;
  placeFoodOnly?: boolean;
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
  kakao_category_name?: string | null;
  kakaoCategoryName?: string | null;
  category_group_code?: string | null;
  categoryGroupCode?: string | null;
  category_group_name?: string | null;
  categoryGroupName?: string | null;
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
  goal: string;
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
  visibility: RecordVisibility;
  recordedAt: string;
  photoUrls: string[];
  locationLat: number | null;
  locationLng: number | null;
};

type MissionFeedbackRow = {
  preference: MissionPreferenceValue;
  mission_title: string;
  mission_category: string;
  journey_id: string | null;
  created_at: string;
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
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isJwtIssuedAtFutureError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as SupabaseErrorLike;
  const code = String(candidate.code ?? "");
  const message = String(candidate.message ?? "").toLowerCase();

  return (
    message.includes("jwt issued at future") ||
    (code === "PGRST303" && message.includes("jwt"))
  );
}

async function refreshSupabaseSession() {
  // 기기와 서버의 시간이 아주 조금 어긋난 경우를 고려해 잠깐 기다린 뒤 갱신한다.
  await sleep(1200);

  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error(
      "로그인 세션을 갱신하지 못했습니다. 기기의 날짜와 시간을 자동으로 맞춘 뒤 다시 로그인해주세요.",
    );
  }

  return data.session;
}

async function withJwtRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isJwtIssuedAtFutureError(error)) {
      throw error;
    }

    await refreshSupabaseSession();
    return operation();
  }
}

async function retrySupabaseResultOnJwt<
  T extends { error?: unknown },
>(operation: () => PromiseLike<T>): Promise<T> {
  let result = await operation();

  if (result.error && isJwtIssuedAtFutureError(result.error)) {
    await refreshSupabaseSession();
    result = await operation();
  }

  return result;
}

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

const MISSION_PREFERENCES: Array<{
  value: MissionPreferenceValue;
  emoji: string;
  label: string;
  description: string;
}> = [
  {
    value: "like",
    emoji: "👍",
    label: "또 해보고 싶어요",
    description: "비슷한 미션을 더 추천해요.",
  },
  {
    value: "neutral",
    emoji: "😐",
    label: "괜찮았어요",
    description: "추천에 중립적으로 반영해요.",
  },
  {
    value: "dislike",
    emoji: "👎",
    label: "다음엔 피하고 싶어요",
    description: "비슷한 미션의 추천을 줄여요.",
  },
];

const TIME_OPTIONS: Array<{
  value: TimeFilter;
  label: string;
  backendValue: string;
}> = [
  { value: "any", label: "상관없음", backendValue: "상관없음" },
  { value: "under15", label: "15분 이내", backendValue: "15분 이내" },
  { value: "under30", label: "30분 이내", backendValue: "30분 이내" },
  { value: "under60", label: "1시간 이내", backendValue: "1시간 이내" },
  { value: "over60", label: "1시간 이상", backendValue: "1시간 이상" },
];

const COST_OPTIONS: Array<{
  value: CostFilter;
  label: string;
  backendValue: string;
}> = [
  { value: "any", label: "상관없음", backendValue: "무료/유료" },
  { value: "free", label: "무료", backendValue: "무료" },
  { value: "paid", label: "유료", backendValue: "유료" },
];



const RADIUS_OPTIONS: RadiusKm[] = [1, 3, 5];

// 부산광역시 공식 15개 자치구 + 기장군만 사용한다.
const BUSAN_DISTRICTS: BusanDistrict[] = [
  "중구",
  "서구",
  "동구",
  "영도구",
  "부산진구",
  "동래구",
  "남구",
  "북구",
  "해운대구",
  "사하구",
  "금정구",
  "강서구",
  "연제구",
  "수영구",
  "사상구",
  "기장군",
];

const BUSAN_DISTRICT_CODES: Record<BusanDistrict, string> = {
  강서구: "26440",
  금정구: "26410",
  기장군: "26710",
  남구: "26290",
  동구: "26170",
  동래구: "26260",
  부산진구: "26230",
  북구: "26320",
  사상구: "26530",
  사하구: "26380",
  서구: "26140",
  수영구: "26500",
  연제구: "26470",
  영도구: "26200",
  중구: "26110",
  해운대구: "26350",
};

const BUSAN_DISTRICT_CENTERS: Record<BusanDistrict, Coordinate> = {
  강서구: { lat: 35.2121, lng: 128.9806 },
  금정구: { lat: 35.2431, lng: 129.0921 },
  기장군: { lat: 35.2445, lng: 129.2223 },
  남구: { lat: 35.1365, lng: 129.0842 },
  동구: { lat: 35.1293, lng: 129.0454 },
  동래구: { lat: 35.2048, lng: 129.0838 },
  부산진구: { lat: 35.1629, lng: 129.0532 },
  북구: { lat: 35.1972, lng: 128.9904 },
  사상구: { lat: 35.1526, lng: 128.9911 },
  사하구: { lat: 35.1045, lng: 128.9748 },
  서구: { lat: 35.0979, lng: 129.0244 },
  수영구: { lat: 35.1455, lng: 129.1132 },
  연제구: { lat: 35.1762, lng: 129.0799 },
  영도구: { lat: 35.0912, lng: 129.0679 },
  중구: { lat: 35.1063, lng: 129.0323 },
  해운대구: { lat: 35.1631, lng: 129.1635 },
};

const SECTION_LABELS: Array<{
  key: SheetSection;
  label: string;
}> = [
  { key: "active", label: "현재 진행중" },
  { key: "recommended", label: "추천 미션" },
  { key: "records", label: "내가 쓴 기록" },
];

const SECTION_INDEX: Record<SheetSection, number> = {
  active: 0,
  recommended: 1,
  records: 2,
};

// 과거 AI 생성 결과나 DB에 남아 있는 부적절한 미션을 추천에서 차단한다.
// 제목을 코드에 고정해 추천하는 용도가 아니라, 이미 저장된 문제 미션을 숨기는 안전장치다.
const BLOCKED_MISSION_TITLE_PATTERNS = [
  "천장구름관찰하기",
] as const;

const BLOCKED_MISSION_TEXT_PATTERNS = [
  /천장\s*(?:의|에|에서)?\s*구름/u,
  /구름.*천장/u,
] as const;

const FALLBACK_MISSIONS: HomeMission[] = [
  {
    id: "fallback-cafe-reading",
    title: "조용한 카페에서 30분 독서",
    desc: "일상 속 작은 고요함을 찾아봐요.",
    instructions:
      "가까운 카페의 편안한 자리를 골라 30분 동안 책 한 권을 천천히 읽어보세요.",
    recommendationReason:
      "조용한 공간에서 혼자 집중하는 경험을 선호할 가능성이 높아 추천했어요.",
    durationMinutes: 30,
    time: "30분",
    dist: "0.3km",
    cost: "유료",
    cat: "배움",
    requiredItems: ["책 한 권"],
    placeLat: 35.13656,
    placeLng: 129.05952,
    placeName: "가까운 카페",
    isAtHome: false,
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
    durationMinutes: 20,
    time: "20분",
    dist: "0.5km",
    cost: "무료",
    cat: "산책",
    requiredItems: ["휴대폰"],
    placeLat: 35.16862,
    placeLng: 129.05748,
    placeName: "부산시민공원",
    isAtHome: false,
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
    durationMinutes: 15,
    time: "15분",
    dist: "0.7km",
    cost: "유료",
    cat: "카페 및 디저트",
    requiredItems: [],
    placeLat: 35.1517,
    placeLng: 129.0612,
    placeName: "근처 빵집",
    isAtHome: false,
    isFallback: true,
  },
];

function relationArray<T>(
  value: T | T[] | null | undefined,
): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeStringArray(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== value) {
        const parsedItems = normalizeStringArray(parsed);
        if (parsedItems.length > 0) {
          return parsedItems;
        }
      }
    } catch {
      // JSON 문자열이 아니면 구분자로 나눈다.
    }

    return trimmed
      .split(/[,|/\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "name" in value
  ) {
    return normalizeStringArray(
      (value as { name?: unknown }).name,
    );
  }

  return [];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isUuid(value: string | undefined | null) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value
    .split("-")
    .map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, 12, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysToDateKey(value: string, days: number) {
  const date = parseDateKey(value);

  if (!date) {
    return value;
  }

  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function getDateKeysBetween(startDate: string, endDate: string) {
  if (startDate > endDate) {
    return [];
  }

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

  if (!date) {
    return value;
  }

  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
}

function getRecordDateOption(value: string) {
  const date = parseDateKey(value);

  if (!date) {
    return {
      monthDay: value,
      weekday: "",
    };
  }

  return {
    monthDay: `${date.getMonth() + 1}/${date.getDate()}`,
    weekday: ["일", "월", "화", "수", "목", "금", "토"][
      date.getDay()
    ],
  };
}

function formatRecordDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
}

function getErrorMessage(error: unknown, fallback: string) {
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

function getRawCategoryName(
  mission: ExtendedBackendMission,
): string {
  if (typeof mission.category === "string") {
    return mission.category;
  }

  if (
    mission.category &&
    typeof mission.category === "object" &&
    "name" in mission.category
  ) {
    return String(mission.category.name ?? "");
  }

  return String(
    mission.category_name ??
      mission.categoryName ??
      mission.cat ??
      "",
  );
}

function inferCategoryFromText(text: string): CategoryName {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();

  if (
    /(카페|디저트|베이커리|빵집|빵|커피|라떼|케이크|아이스크림|차 한 잔)/.test(
      normalized,
    )
  ) {
    return "카페 및 디저트";
  }

  if (
    /(맛집|식사|음식|요리|먹기|국밥|라면|국수|분식|시장 음식|한 끼)/.test(
      normalized,
    )
  ) {
    return "음식";
  }

  if (
    /(산책|걷기|걸어|공원|골목길|해변|강변|둘레길|동네 한 바퀴|여행|탐방|자연|등산)/.test(
      normalized,
    )
  ) {
    return "산책";
  }

  if (
    /(독서|책 읽|공부|배우|학습|강의|도서관|서점에서 읽|새로운 지식|박물관|역사관|기념관|사찰|성당|교회|역사 유적|문화재)/.test(
      normalized,
    )
  ) {
    return "배움";
  }

  if (
    /(음악|영화|공연|전시|버스킹|미술관|갤러리|감상|사진전|사진|그림|연극)/.test(
      normalized,
    )
  ) {
    return "감상";
  }

  if (
    /(운동|체험|만들기|공방|자전거|클라이밍|러닝|요가|춤|볼링|활동)/.test(
      normalized,
    )
  ) {
    return "활동";
  }

  if (
    /(휴식|명상|호흡|온천|찜질|낮잠|멍 때리|쉬어|힐링)/.test(
      normalized,
    )
  ) {
    return "휴식";
  }

  return "기타";
}

function normalizeCategory(
  rawCategory: string | null | undefined,
  textForInference: string,
): CategoryName {
  const category = rawCategory?.trim() ?? "";
  const normalized = category.toLowerCase();
  const inferred = inferCategoryFromText(textForInference);

  let explicit: CategoryName | null = null;

  if (CATEGORIES.includes(category as CategoryName)) {
    explicit = category as CategoryName;
  } else if (/(카페|디저트|베이커리|빵)/.test(normalized)) {
    explicit = "카페 및 디저트";
  } else if (/(음식|식사|맛집|food)/.test(normalized)) {
    explicit = "음식";
  } else if (/(산책|걷기|여행|탐방|walk)/.test(normalized)) {
    explicit = "산책";
  } else if (/(배움|독서|학습|learn|study)/.test(normalized)) {
    explicit = "배움";
  } else if (/(감상|음악|영화|공연|전시|사진|culture)/.test(normalized)) {
    explicit = "감상";
  } else if (/(활동|운동|체험|activity|sport)/.test(normalized)) {
    explicit = "활동";
  } else if (/(휴식|명상|힐링|relax|rest)/.test(normalized)) {
    explicit = "휴식";
  }

  // 백엔드 분류가 한 카테고리로 몰려 있어도 제목과 안내가
  // 다른 활동을 명확히 가리키면 실제 내용에 맞는 분류를 사용한다.
  if (
    inferred !== "기타" &&
    explicit !== null &&
    inferred !== explicit
  ) {
    return inferred;
  }

  return explicit ?? inferred;
}

function normalizeCostStatus(
  mission: ExtendedBackendMission,
  textForInference: string,
): CostStatus {
  const explicit = String(
    mission.cost_type ?? mission.costType ?? "",
  )
    .trim()
    .toLowerCase();

  if (
    explicit.includes("유료/무료") ||
    explicit.includes("무료/유료") ||
    explicit.includes("optional") ||
    explicit.includes("either")
  ) {
    return "유료/무료";
  }

  if (explicit === "무료" || explicit.includes("free")) {
    return "무료";
  }

  if (explicit === "유료" || explicit.includes("paid")) {
    return "유료";
  }

  const text = textForInference.replace(/\s+/g, " ");

  if (
    /(소품샵|편집숍|플리마켓|시장 구경|서점 구경|쇼핑몰 구경|구경하기|둘러보기)/.test(
      text,
    )
  ) {
    return "유료/무료";
  }

  if (
    /(구매|주문|먹기|마시기|맛보기|카페|디저트|빵집|베이커리|음료|식사|맛집|입장권|티켓|체험비|공방)/.test(
      text,
    )
  ) {
    return "유료";
  }

  const estimatedCost = toFiniteNumber(
    mission.estimated_cost,
  );

  if (estimatedCost === null) {
    return "유료/무료";
  }

  return estimatedCost > 0 ? "유료" : "무료";
}

function parseDurationMinutes(value: unknown): number | null {
  const direct = toFiniteNumber(value);

  if (direct !== null) {
    return direct;
  }

  if (typeof value !== "string") {
    return null;
  }

  const hourMatch = value.match(/(\d+(?:\.\d+)?)\s*시간/);
  const minuteMatch = value.match(/(\d+)\s*분/);

  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
    return Math.round(hours * 60 + minutes);
  }

  return minuteMatch ? Number(minuteMatch[1]) : null;
}

function normalizeRequiredItems(
  mission: ExtendedBackendMission,
): string[] {
  const value = mission.required_items ?? mission.preparations;

  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,/]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function haversineDistanceKm(
  from: Coordinate,
  to: Coordinate,
) {
  const earthRadiusKm = 6371;
  const toRadians = (degree: number) =>
    (degree * Math.PI) / 180;
  const latitudeDistance = toRadians(to.lat - from.lat);
  const longitudeDistance = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);

  const a =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDistance / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchKakaoCategoryPlaces(
  coordinate: Coordinate,
  categoryCode: string,
  radiusM: number,
): Promise<KakaoPlaceDocument[]> {
  const url =
    `https://dapi.kakao.com/v2/local/search/category.json` +
    `?category_group_code=${encodeURIComponent(categoryCode)}` +
    `&x=${encodeURIComponent(String(coordinate.lng))}` +
    `&y=${encodeURIComponent(String(coordinate.lat))}` +
    `&radius=${radiusM}&sort=distance&size=15`;

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`카카오 장소 검색 실패 (${response.status})`);
  }

  const data = (await response.json()) as {
    documents?: KakaoPlaceDocument[];
  };

  return Array.isArray(data.documents) ? data.documents : [];
}

async function fetchKakaoKeywordPlaces(
  coordinate: Coordinate,
  query: string,
  radiusM: number,
): Promise<KakaoPlaceDocument[]> {
  const url =
    `https://dapi.kakao.com/v2/local/search/keyword.json` +
    `?query=${encodeURIComponent(query)}` +
    `&x=${encodeURIComponent(String(coordinate.lng))}` +
    `&y=${encodeURIComponent(String(coordinate.lat))}` +
    `&radius=${radiusM}&sort=distance&size=15`;

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`카카오 장소 검색 실패 (${response.status})`);
  }

  const data = (await response.json()) as {
    documents?: KakaoPlaceDocument[];
  };

  return Array.isArray(data.documents) ? data.documents : [];
}

async function fetchKakaoAddressKeywords(
  coordinate: Coordinate,
): Promise<string[]> {
  const url =
    `https://dapi.kakao.com/v2/local/geo/coord2address.json` +
    `?x=${encodeURIComponent(String(coordinate.lng))}` +
    `&y=${encodeURIComponent(String(coordinate.lat))}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    documents?: KakaoAddressDocument[];
  };
  const document = Array.isArray(data.documents)
    ? data.documents[0]
    : undefined;

  if (!document) {
    return [];
  }

  const address = document.address;
  const roadAddress = document.road_address;
  const roadAreaKeyword = [
    roadAddress?.region_3depth_name,
    roadAddress?.road_name,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");

  return [
    roadAddress?.building_name,
    roadAddress?.address_name,
    address?.address_name,
    roadAreaKeyword,
    roadAddress?.region_3depth_name,
    address?.region_3depth_name,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(
      (value, index, values) =>
        value.length >= 2 && values.indexOf(value) === index,
    )
    .slice(0, 5);
}

function toRecordPlaceCandidate(
  document: KakaoPlaceDocument,
  coordinate: Coordinate,
): PlaceCandidate | null {
  const id = String(document.id ?? "").trim();
  const name = String(document.place_name ?? "").trim();
  const latitude = Number(document.y);
  const longitude = Number(document.x);

  if (
    !id ||
    !name ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const categoryText = String(
    document.category_group_name ?? document.category_name ?? "",
  );
  const apiDistanceM = Number(document.distance);
  const distanceM = Number.isFinite(apiDistanceM)
    ? Math.max(0, Math.round(apiDistanceM))
    : Math.max(
        0,
        Math.round(
          haversineDistanceKm(coordinate, {
            lat: latitude,
            lng: longitude,
          }) * 1000,
        ),
      );

  return {
    id,
    name,
    latitude,
    longitude,
    address:
      document.road_address_name ||
      document.address_name ||
      undefined,
    category: normalizeCategory(
      categoryText,
      `${name} ${document.category_name ?? ""}`,
    ),
    categoryDetail:
      document.category_name ||
      document.category_group_name ||
      undefined,
    distanceM,
  };
}

async function searchNearbyKakaoPlacesForRecord(
  coordinate: Coordinate,
): Promise<PlaceCandidate[]> {
  const uniquePlaces = new Map<string, PlaceCandidate>();
  let addressKeywords: string[] = [];
  let successfulRequestCount = 0;
  let lastError: unknown = null;

  try {
    addressKeywords = await fetchKakaoAddressKeywords(coordinate);
  } catch (error) {
    lastError = error;
  }

  for (const radiusM of KAKAO_PLACE_SEARCH_RADII_M) {
    const requests = [
      ...KAKAO_PLACE_CATEGORY_CODES.map((code) =>
        fetchKakaoCategoryPlaces(coordinate, code, radiusM),
      ),
      ...addressKeywords.map((keyword) =>
        fetchKakaoKeywordPlaces(coordinate, keyword, radiusM),
      ),
    ];

    const results = await Promise.allSettled(requests);

    for (const result of results) {
      if (result.status === "rejected") {
        lastError = result.reason;
        continue;
      }

      successfulRequestCount += 1;

      for (const document of result.value) {
        const candidate = toRecordPlaceCandidate(document, coordinate);
        if (!candidate) {
          continue;
        }

        const previous = uniquePlaces.get(candidate.id);
        if (
          !previous ||
          (candidate.distanceM ?? Number.POSITIVE_INFINITY) <
            (previous.distanceM ?? Number.POSITIVE_INFINITY)
        ) {
          uniquePlaces.set(candidate.id, candidate);
        }
      }
    }

    if (uniquePlaces.size >= KAKAO_PLACE_CANDIDATE_LIMIT) {
      break;
    }
  }

  if (successfulRequestCount === 0 && lastError) {
    throw lastError;
  }

  return [...uniquePlaces.values()]
    .sort(
      (left, right) =>
        (left.distanceM ?? Number.POSITIVE_INFINITY) -
        (right.distanceM ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, KAKAO_PLACE_CANDIDATE_LIMIT);
}

function containsHangul(value: string | null | undefined) {
  return /[가-힣]/.test(value ?? "");
}

function isKoreanMissionText(value: string | null | undefined) {
  const text = String(value ?? "").trim();

  if (!text) {
    return false;
  }

  const hangulCount = (text.match(/[가-힣]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;

  return hangulCount > 0 && hangulCount >= latinCount;
}

function inferAtHomeMission(
  mission: ExtendedBackendMission,
  inferenceText: string,
  placeName: string | null | undefined,
) {
  // requires_place=false는 "특정 장소가 필수는 아님"이라는 뜻일 뿐,
  // 곧바로 집에서 하는 미션이라는 뜻은 아니므로 집 판정에서 제외한다.
  if (
    mission.at_home === true ||
    mission.is_home === true
  ) {
    return true;
  }

  const locationType = String(
    mission.location_type ?? mission.locationType ?? "",
  )
    .trim()
    .toLowerCase();

  if (
    locationType === "home" ||
    locationType === "at_home" ||
    locationType === "indoor_home" ||
    locationType.includes("자택") ||
    locationType.includes("집에서")
  ) {
    return true;
  }

  const normalized = `${inferenceText} ${placeName ?? ""}`
    .replace(/\s+/g, " ")
    .toLowerCase();

  return /(내 방|내 집|집에서|집 안에서|방에서|자택에서|홈트|침대에서|주방에서)/.test(
    normalized,
  );
}

function inferFlexibleMission(
  mission: ExtendedBackendMission,
  isAtHome: boolean,
  placeName: string | null | undefined,
) {
  if (isAtHome) {
    return false;
  }

  const locationType = String(
    mission.location_type ?? mission.locationType ?? "",
  )
    .trim()
    .toLowerCase();

  const normalizedPlaceName = normalizeComparableText(placeName);
  const explicitRequiresPlace =
    mission.requires_place ?? mission.requiresPlace;
  const hasSpecificPlaceData =
    (Boolean(placeName) && !isGenericPlaceName(placeName)) ||
    Boolean(mission.place_id) ||
    mission.place_lat != null ||
    mission.latitude != null;

  return (
    (explicitRequiresPlace === false &&
      !hasSpecificPlaceData) ||
    [
      "flexible",
      "anywhere",
      "location_flexible",
      "free_location",
      "no_fixed_place",
    ].includes(locationType) ||
    normalizedPlaceName === "어디서나가능" ||
    normalizedPlaceName === "어디서나"
  );
}

function isGenericPlaceName(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return (
    !normalized ||
    normalized.includes("자유장소") ||
    normalized.includes("어디서나") ||
    normalized.includes("편한장소") ||
    normalized.includes("현재위치주변") ||
    normalized.includes("지역내")
  );
}

function hasActualPlace(mission: HomeMission) {
  if (mission.isAtHome) {
    return mission.placeName === "내 방";
  }

  return (
    Boolean(mission.placeName) &&
    !isGenericPlaceName(mission.placeName) &&
    isFiniteNumber(mission.placeLat) &&
    isFiniteNumber(mission.placeLng)
  );
}

function hasUsableMissionLocation(mission: HomeMission) {
  return (
    mission.isAtHome === true ||
    mission.isLocationFlexible === true ||
    hasActualPlace(mission)
  );
}

function hasUsableDistanceLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();

  return Boolean(
    normalized &&
      normalized !== "거리 정보 없음" &&
      normalized !== "-"
  );
}

function mergeActiveMissionPlaceSnapshot(
  loadedMission: HomeMission,
  cachedMission: HomeMission | undefined,
) {
  if (!cachedMission) {
    if (
      !loadedMission.isAtHome &&
      !loadedMission.isLocationFlexible &&
      !hasUsableDistanceLabel(loadedMission.dist) &&
      loadedMission.placeName
    ) {
      return {
        ...loadedMission,
        dist: "장소 지정됨",
      };
    }

    return loadedMission;
  }

  const placeId = loadedMission.placeId ?? cachedMission.placeId;
  const placeLat = loadedMission.placeLat ?? cachedMission.placeLat;
  const placeLng = loadedMission.placeLng ?? cachedMission.placeLng;
  const placeName = loadedMission.placeName ?? cachedMission.placeName;
  const placeAddress =
    loadedMission.placeAddress ?? cachedMission.placeAddress;
  const districtName =
    loadedMission.districtName ?? cachedMission.districtName;

  const hasFixedPlace =
    loadedMission.isAtHome !== true &&
    loadedMission.isLocationFlexible !== true &&
    Boolean(placeName);

  const dist = hasUsableDistanceLabel(loadedMission.dist)
    ? loadedMission.dist
    : hasUsableDistanceLabel(cachedMission.dist)
      ? cachedMission.dist
      : hasFixedPlace
        ? "장소 지정됨"
        : loadedMission.dist;

  return {
    ...cachedMission,
    ...loadedMission,
    placeId,
    placeLat,
    placeLng,
    placeName,
    placeAddress,
    districtName,
    dist,
  };
}

function isUsableRecommendation(mission: HomeMission) {
  // 시작할 수 없는 임시 AI 미션과 영어 제목은 추천 목록에서 제외한다.
  return (
    isUuid(mission.id) &&
    containsHangul(mission.title) &&
    mission.title.trim().length > 0
  );
}

function balanceHomeMissions(
  missions: HomeMission[],
  limit = 10,
  maxHomeCount = 2,
) {
  const outsideMissions = missions.filter(
    (mission) => !mission.isAtHome,
  );
  const homeMissions = missions
    .filter((mission) => mission.isAtHome)
    .slice(0, maxHomeCount);

  const balanced: HomeMission[] = [];
  let outsideIndex = 0;
  let homeIndex = 0;

  while (balanced.length < limit) {
    for (
      let count = 0;
      count < 3 && outsideIndex < outsideMissions.length;
      count += 1
    ) {
      balanced.push(outsideMissions[outsideIndex]);
      outsideIndex += 1;

      if (balanced.length >= limit) {
        break;
      }
    }

    if (
      balanced.length < limit &&
      homeIndex < homeMissions.length
    ) {
      balanced.push(homeMissions[homeIndex]);
      homeIndex += 1;
    }

    if (
      outsideIndex >= outsideMissions.length &&
      homeIndex >= homeMissions.length
    ) {
      break;
    }
  }

  return balanced.slice(0, limit);
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\[\]{}.,·'"“”‘’_-]/g, "");
}

function getMissionRefreshKey(mission: HomeMission) {
  if (isUuid(mission.id)) {
    return `id:${mission.id}`;
  }

  return `title:${normalizeComparableText(mission.title)}`;
}

function getMissionPlaceKey(mission: HomeMission) {
  if (mission.isAtHome || mission.isLocationFlexible) {
    return "";
  }

  if (isUuid(mission.placeId)) {
    return `place-id:${mission.placeId}`;
  }

  const placeName = normalizeComparableText(mission.placeName);
  if (placeName && placeName !== "거리정보없음") {
    return `place-name:${placeName}`;
  }

  if (
    isFiniteNumber(mission.placeLat) &&
    isFiniteNumber(mission.placeLng)
  ) {
    return `coord:${mission.placeLat.toFixed(4)},${mission.placeLng.toFixed(4)}`;
  }

  return "";
}

function diversifyMissionsByPlace(missions: HomeMission[]) {
  const seenPlaces = new Set<string>();

  return missions.filter((mission) => {
    const placeKey = getMissionPlaceKey(mission);

    if (!placeKey) {
      return true;
    }

    if (seenPlaces.has(placeKey)) {
      return false;
    }

    seenPlaces.add(placeKey);
    return true;
  });
}

function prioritizeFreshRecommendations({
  candidates,
  previous,
  interests,
  useInterestRanking,
}: {
  candidates: HomeMission[];
  previous: HomeMission[];
  interests: CategoryName[];
  useInterestRanking: boolean;
}) {
  const previousMissionKeys = new Set(
    previous.map(getMissionRefreshKey),
  );
  const previousPlaceKeys = new Set(
    previous.map(getMissionPlaceKey).filter(Boolean),
  );

  const randomized = diversifyMissionsByPlace(
    shuffle(candidates),
  );

  const fresh = randomized.filter((mission) => {
    const missionKey = getMissionRefreshKey(mission);
    const placeKey = getMissionPlaceKey(mission);

    return (
      !previousMissionKeys.has(missionKey) &&
      (!placeKey || !previousPlaceKeys.has(placeKey))
    );
  });

  const repeated = randomized.filter((mission) => {
    const missionKey = getMissionRefreshKey(mission);
    const placeKey = getMissionPlaceKey(mission);

    return (
      previousMissionKeys.has(missionKey) ||
      Boolean(placeKey && previousPlaceKeys.has(placeKey))
    );
  });

  const rank = (items: HomeMission[]) =>
    useInterestRanking
      ? rankMissionsByInterests(items, interests)
      : items;

  return [...rank(fresh), ...rank(repeated)];
}

function pointInRing(point: Coordinate, ring: LngLat[]) {
  let inside = false;

  for (
    let currentIndex = 0, previousIndex = ring.length - 1;
    currentIndex < ring.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const [currentLng, currentLat] = ring[currentIndex];
    const [previousLng, previousLat] = ring[previousIndex];

    const intersects =
      currentLat > point.lat !== previousLat > point.lat &&
      point.lng <
        ((previousLng - currentLng) *
          (point.lat - currentLat)) /
          (previousLat - currentLat || Number.EPSILON) +
          currentLng;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInDistrict(
  point: Coordinate,
  polygons: DistrictPolygon[],
) {
  return polygons.some((polygon) => {
    const [outerRing, ...holes] = polygon;

    if (!outerRing || !pointInRing(point, outerRing)) {
      return false;
    }

    return !holes.some((hole) => pointInRing(point, hole));
  });
}

function decodeTopologyArc(topology: any, arcIndex: number) {
  const shouldReverse = arcIndex < 0;
  const resolvedIndex = shouldReverse ? ~arcIndex : arcIndex;
  const rawArc = topology.arcs?.[resolvedIndex] ?? [];
  const transform = topology.transform;
  let x = 0;
  let y = 0;

  const points: LngLat[] = rawArc.map(
    (coordinate: [number, number]) => {
      if (transform?.scale && transform?.translate) {
        x += coordinate[0];
        y += coordinate[1];

        return [
          x * transform.scale[0] + transform.translate[0],
          y * transform.scale[1] + transform.translate[1],
        ];
      }

      return [coordinate[0], coordinate[1]];
    },
  );

  return shouldReverse ? points.reverse() : points;
}

function joinTopologyArcs(topology: any, indexes: number[]) {
  const joined: LngLat[] = [];

  indexes.forEach((arcIndex, index) => {
    const arc = decodeTopologyArc(topology, arcIndex);
    joined.push(...(index === 0 ? arc : arc.slice(1)));
  });

  return joined;
}

let districtTopologyPromise: Promise<any> | null = null;
const districtPolygonCache = new Map<
  BusanDistrict,
  DistrictPolygon[]
>();

async function loadDistrictPolygons(
  district: BusanDistrict,
): Promise<DistrictPolygon[]> {
  const cached = districtPolygonCache.get(district);
  if (cached) {
    return cached;
  }

  if (!districtTopologyPromise) {
    districtTopologyPromise = fetch(DISTRICT_TOPOJSON_URL).then(
      async (response) => {
        if (!response.ok) {
          throw new Error("행정구역 경계 데이터를 불러오지 못했습니다.");
        }

        return response.json();
      },
    );
  }

  const topology = await districtTopologyPromise;
  const topologyObject = Object.values(
    topology.objects ?? {},
  )[0] as any;
  const geometries =
    topologyObject?.type === "GeometryCollection"
      ? topologyObject.geometries ?? []
      : [topologyObject].filter(Boolean);

  const targetCode = BUSAN_DISTRICT_CODES[district];

  const geometry = geometries.find((item: any) => {
    const properties = item?.properties ?? {};
    const name = String(
      properties.name ??
        properties.NAME ??
        properties.name_kr ??
        "",
    );
    const codeCandidates = [
      properties.code,
      properties.CODE,
      properties.adm_cd,
      properties.sig_cd,
      properties.SIG_CD,
      item?.id,
    ]
      .map((value) => String(value ?? ""))
      .filter(Boolean);

    return (
      codeCandidates.some((code) =>
        code.startsWith(targetCode),
      ) ||
      (name === district &&
        codeCandidates.some((code) => code.startsWith("26")))
    );
  });

  if (!geometry?.arcs) {
    return [];
  }

  const polygons: DistrictPolygon[] =
    geometry.type === "MultiPolygon"
      ? geometry.arcs.map((polygon: number[][]) =>
          polygon.map((ring) =>
            joinTopologyArcs(topology, ring),
          ),
        )
      : [
          geometry.arcs.map((ring: number[]) =>
            joinTopologyArcs(topology, ring),
          ),
        ];

  districtPolygonCache.set(district, polygons);
  return polygons;
}

function getDistrictCenter(polygons: DistrictPolygon[]) {
  const points = polygons.flatMap((polygon) =>
    polygon.flatMap((ring) => ring),
  );

  if (points.length === 0) {
    return null;
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
}

type KakaoPlaceCategoryResolution = {
  category: CategoryName;
  foodOnly: boolean;
  kakaoCategoryName?: string;
  kakaoCategoryGroupCode?: string;
  kakaoCategoryGroupName?: string;
};

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function isAppCategory(value: string): value is CategoryName {
  return CATEGORIES.includes(value as CategoryName);
}

function resolveKakaoPlaceCategory(
  place: any,
): KakaoPlaceCategoryResolution | null {
  const name = firstNonEmptyString(place?.name, place?.place_name);
  const address = firstNonEmptyString(
    place?.road_address_name,
    place?.address_name,
    place?.address,
  );
  const rawCategory = firstNonEmptyString(place?.category);
  const kakaoCategoryName = firstNonEmptyString(
    place?.kakao_category_name,
    place?.kakaoCategoryName,
    place?.category_name,
    place?.categoryName,
    isAppCategory(rawCategory) ? "" : rawCategory,
  );
  const kakaoCategoryGroupCode = firstNonEmptyString(
    place?.kakao_category_group_code,
    place?.kakaoCategoryGroupCode,
    place?.category_group_code,
    place?.categoryGroupCode,
  ).toUpperCase();
  const kakaoCategoryGroupName = firstNonEmptyString(
    place?.kakao_category_group_name,
    place?.kakaoCategoryGroupName,
    place?.category_group_name,
    place?.categoryGroupName,
  );
  const explicitAppCategory = [
    rawCategory,
    kakaoCategoryName,
  ].find(isAppCategory);
  const sourceText = `${kakaoCategoryName} ${kakaoCategoryGroupName} ${name} ${address}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const excludedPattern =
    /(병원|의원|치과|한의원|약국|은행|증권|보험|부동산|중개업|주차장|주유소|충전소|행정복지센터|주민센터|시청|구청|군청|경찰서|소방서|우체국|공공기관|공사|공단|법원|검찰청|세무서|관공서)/u;

  if (
    excludedPattern.test(sourceText) ||
    ["PK6", "OL7", "BK9", "AG2", "PO3", "HP8", "PM9"].includes(
      kakaoCategoryGroupCode,
    )
  ) {
    return null;
  }

  const build = (
    category: CategoryName,
    foodOnly = false,
  ): KakaoPlaceCategoryResolution => ({
    category,
    foodOnly,
    kakaoCategoryName: kakaoCategoryName || undefined,
    kakaoCategoryGroupCode: kakaoCategoryGroupCode || undefined,
    kakaoCategoryGroupName: kakaoCategoryGroupName || undefined,
  });

  // 편의점과 대형마트는 먹거리 관련 미션일 때만 음식 장소로 사용한다.
  if (
    /(편의점|대형마트|슈퍼마켓|식료품점|식자재마트|마트)/u.test(
      sourceText,
    ) ||
    ["MT1", "CS2"].includes(kakaoCategoryGroupCode)
  ) {
    return build("음식", true);
  }

  if (
    /(카페|커피전문점|커피숍|찻집|전통찻집|베이커리|제과점|빵집|디저트|아이스크림|케이크)/u.test(
      sourceText,
    ) ||
    kakaoCategoryGroupCode === "CE7"
  ) {
    return build("카페 및 디저트");
  }

  if (
    /(음식점|한식|중식|일식|양식|분식|패스트푸드|치킨|피자|국수|냉면|고기집|식당|레스토랑|뷔페|샐러드|김밥|도시락)/u.test(
      sourceText,
    ) ||
    kakaoCategoryGroupCode === "FD6"
  ) {
    return build("음식");
  }

  // 감상은 실제로 관람할 대상이 있는 장소에만 부여한다.
  if (
    /(영화관|공연장|극장|콘서트홀|아트홀|문화예술회관|버스킹|공연무대|미술관|갤러리|전시장|전시관|아쿠아리움|수족관|동물원|오페라|뮤지컬)/u.test(
      sourceText,
    )
  ) {
    return build("감상");
  }

  if (
    /(도서관|서점|과학관|천문대|박물관|역사관|기념관|사찰|절\b|성당|교회|역사유적|유적지|문화재|향교|서원|고택|생가|기념비)/u.test(
      sourceText,
    )
  ) {
    return build("배움");
  }

  if (
    /(공원|산책로|둘레길|해변|해수욕장|숲|수목원|정원|강변|하천|호수|생태공원|자연휴양림|등산로|전망대|광장|수변공원)/u.test(
      sourceText,
    )
  ) {
    return build("산책");
  }

  if (
    /(마사지|피부관리|피부미용|미용실|헤어샵|네일숍|네일샵|스파|찜질방|사우나|온천|호텔|펜션|게스트하우스|리조트|모텔|숙박|휴양소)/u.test(
      sourceText,
    ) ||
    kakaoCategoryGroupCode === "AD5"
  ) {
    return build("휴식");
  }

  if (
    /(소품샵|소품점|문구점|전통시장|시장|쇼핑몰|백화점|아울렛|편집숍|공방|체험장|체육시설|운동장|헬스장|수영장|볼링장|클라이밍|노래방|오락실|pc방|피시방|놀이공원|테마파크|캠핑장|낚시터|자전거|사진관|포토부스|스케이트장|야구장|축구장|테니스장|골프장)/u.test(
      sourceText,
    )
  ) {
    return build("활동");
  }

  // 상세 카테고리가 없는 기존 places 행은 저장된 앱 카테고리를 보조 기준으로만 사용한다.
  if (explicitAppCategory && explicitAppCategory !== "기타") {
    return build(explicitAppCategory);
  }

  console.warn(
    "앱 카테고리로 확정하지 못한 카카오 장소를 추천에서 제외합니다:",
    {
      name,
      kakaoCategoryName,
      kakaoCategoryGroupCode,
      kakaoCategoryGroupName,
    },
  );
  return null;
}

function isFoodMissionText(value: string) {
  return /(먹|맛보|음식|식사|간식|메뉴|도시락|과자|음료|식재료|장보기|구매|골라|신제품|시그니처)/u.test(
    value.replace(/\s+/g, " ").toLowerCase(),
  );
}

function isMissionTextCompatibleWithPlaceCategory(
  mission: HomeMission,
  placeCategory: CategoryName,
  foodOnly = false,
) {
  const text = `${mission.title} ${mission.desc} ${mission.instructions}`
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (mission.cat !== placeCategory) {
    return false;
  }

  if (foodOnly) {
    return isFoodMissionText(text);
  }

  if (placeCategory === "카페 및 디저트") {
    return (
      /(카페|커피|차|음료|디저트|빵|케이크|메뉴|맛|주문|시그니처|분위기)/u.test(
        text,
      ) &&
      !/(명상|호흡\s*운동|요가|러닝|달리기|낮잠|스트레칭|근력\s*운동)/u.test(
        text,
      )
    );
  }

  if (placeCategory === "음식") {
    return (
      isFoodMissionText(text) &&
      !/(명상|요가|러닝|낮잠|독서|공부)/u.test(text)
    );
  }

  if (placeCategory === "감상") {
    return /(감상|관람|전시|공연|영화|작품|무대|버스킹|둘러보|바라보|관찰)/u.test(
      text,
    );
  }

  if (placeCategory === "배움") {
    return /(배우|알아보|읽|역사|문화|건축|유래|탐방|관찰|지식|이야기)/u.test(
      text,
    );
  }

  if (placeCategory === "산책") {
    return /(걷|산책|풍경|자연|둘러보|살펴보|사진|관찰|탐방)/u.test(
      text,
    );
  }

  if (placeCategory === "활동") {
    return /(체험|활동|운동|만들|고르|구경|쇼핑|타기|도전|참여|노래|게임|찾아|발견|둘러보)/u.test(
      text,
    );
  }

  if (placeCategory === "휴식") {
    return /(쉬|휴식|여유|관리|마사지|미용|숙박|머물|편안|재충전|헤어|머리|네일|피부|스타일|손질|케어|꾸며|변신|체크인|숙소|하룻밤)/u.test(
      text,
    );
  }

  return false;
}

function isPlaceCandidateCompatibleWithMission(
  mission: HomeMission,
  place: PlaceCandidate,
) {
  return isMissionTextCompatibleWithPlaceCategory(
    mission,
    place.category,
    place.foodOnly === true,
  );
}

function isExistingMissionPlaceObviouslyInvalid(
  mission: HomeMission,
) {
  if (!hasActualPlace(mission)) {
    return false;
  }

  if (mission.placeEligible === false) {
    return true;
  }

  return !isMissionTextCompatibleWithPlaceCategory(
    mission,
    mission.cat,
    mission.placeFoodOnly === true,
  );
}

async function fetchPlaceCandidates({
  center,
  radiusKm,
  district,
  districtPolygons,
}: {
  center: Coordinate | null;
  radiusKm: number;
  district: BusanDistrict | null;
  districtPolygons: DistrictPolygon[];
}): Promise<PlaceCandidate[]> {
  let rows: any[] = [];

  const detailedResult = await retrySupabaseResultOnJwt(() => supabase
    .from("places")
    .select(
      "id, name, latitude, longitude, address, address_name, road_address_name, category, category_name, category_group_code, category_group_name, kakao_category_name, kakao_category_group_code, kakao_category_group_name, district, gu",
    )
    .limit(500));

  if (!detailedResult.error) {
    rows = detailedResult.data ?? [];
  } else {
    const existingCategoryResult = await retrySupabaseResultOnJwt(() => supabase
      .from("places")
      .select(
        "id, name, latitude, longitude, address, address_name, road_address_name, category, category_name, district, gu",
      )
      .limit(500));

    if (!existingCategoryResult.error) {
      rows = existingCategoryResult.data ?? [];
    } else {
      const basicResult = await retrySupabaseResultOnJwt(() => supabase
        .from("places")
        .select("id, name, latitude, longitude")
        .limit(500));

      if (basicResult.error) {
        console.warn("실제 장소 목록 조회 실패:", basicResult.error);
        return [];
      }

      rows = basicResult.data ?? [];
    }
  }

  const districtCenter = district
    ? BUSAN_DISTRICT_CENTERS[district]
    : null;
  const districtFallbackRadius =
    district === "기장군" || district === "강서구"
      ? 18
      : district
        ? 9
        : 0;

  return shuffle(
    rows
      .map((place): PlaceCandidate | null => {
        const latitude =
          toFiniteNumber(place.latitude) ??
          toFiniteNumber(place.lat);
        const longitude =
          toFiniteNumber(place.longitude) ??
          toFiniteNumber(place.lng);
        const name = String(place.name ?? "").trim();

        if (
          !name ||
          isGenericPlaceName(name) ||
          latitude === null ||
          longitude === null
        ) {
          return null;
        }

        const address = String(
          place.road_address_name ??
            place.address_name ??
            place.address ??
            "",
        ).trim();
        const districtName = String(
          place.district ?? place.gu ?? "",
        ).trim();

        const categoryResolution = resolveKakaoPlaceCategory(place);

        if (!categoryResolution) {
          return null;
        }

        return {
          id: String(place.id),
          name,
          latitude,
          longitude,
          address: address || undefined,
          districtName:
            district
              ? `부산광역시 ${district}`
              : districtName || undefined,
          category: categoryResolution.category,
          kakaoCategoryName: categoryResolution.kakaoCategoryName,
          kakaoCategoryGroupCode:
            categoryResolution.kakaoCategoryGroupCode,
          kakaoCategoryGroupName:
            categoryResolution.kakaoCategoryGroupName,
          foodOnly: categoryResolution.foodOnly,
        };
      })
      .filter((place): place is PlaceCandidate => place !== null)
      .filter((place) => {
        if (district) {
          const districtText = normalizeComparableText(
            `${place.districtName ?? ""} ${place.address ?? ""}`,
          );

          if (
            districtText.includes(
              normalizeComparableText(district),
            )
          ) {
            return true;
          }

          if (districtPolygons.length > 0) {
            return pointInDistrict(
              {
                lat: place.latitude,
                lng: place.longitude,
              },
              districtPolygons,
            );
          }

          return districtCenter
            ? haversineDistanceKm(districtCenter, {
                lat: place.latitude,
                lng: place.longitude,
              }) <= districtFallbackRadius
            : false;
        }

        if (center) {
          return (
            haversineDistanceKm(center, {
              lat: place.latitude,
              lng: place.longitude,
            }) <= radiusKm
          );
        }

        return true;
      }),
  );
}

async function hydrateMissionPlaces(
  missions: HomeMission[],
  center: Coordinate | null,
) {
  const placeIds = Array.from(
    new Set(
      missions
        .map((mission) =>
          isUuid(mission.placeId) ? mission.placeId! : "",
        )
        .filter(Boolean),
    ),
  );

  if (placeIds.length === 0) {
    return missions;
  }

  let data: any[] = [];
  const detailedResult = await retrySupabaseResultOnJwt(() => supabase
    .from("places")
    .select(
      "id, name, latitude, longitude, address, address_name, road_address_name, category, category_name, category_group_code, category_group_name, kakao_category_name, kakao_category_group_code, kakao_category_group_name, district, gu",
    )
    .in("id", placeIds));

  if (!detailedResult.error) {
    data = detailedResult.data ?? [];
  } else {
    const existingCategoryResult = await retrySupabaseResultOnJwt(() => supabase
      .from("places")
      .select(
        "id, name, latitude, longitude, address, address_name, road_address_name, category, category_name, district, gu",
      )
      .in("id", placeIds));

    if (!existingCategoryResult.error) {
      data = existingCategoryResult.data ?? [];
    } else {
      const basicResult = await retrySupabaseResultOnJwt(() => supabase
        .from("places")
        .select("id, name, latitude, longitude")
        .in("id", placeIds));

      if (basicResult.error) {
        console.warn("추천 장소 좌표 보완 실패:", basicResult.error);
        return missions;
      }

      data = basicResult.data ?? [];
    }
  }

  const placeMap = new Map(
    data.map((place) => [String(place.id), place]),
  );

  return missions.map((mission) => {
    if (!mission.placeId || mission.isAtHome) {
      return mission;
    }

    const place = placeMap.get(mission.placeId);
    if (!place) {
      return mission;
    }

    const placeLat =
      mission.placeLat ??
      toFiniteNumber(place.latitude) ??
      undefined;
    const placeLng =
      mission.placeLng ??
      toFiniteNumber(place.longitude) ??
      undefined;
    const placeName =
      mission.placeName ?? place.name ?? undefined;
    const placeAddress =
      mission.placeAddress ??
      (String(
        place.road_address_name ??
          place.address_name ??
          place.address ??
          "",
      ).trim() || undefined);
    const districtName =
      mission.districtName ??
      (String(place.district ?? place.gu ?? "").trim() ||
        undefined);
    const dist =
      center &&
      isFiniteNumber(placeLat) &&
      isFiniteNumber(placeLng)
        ? `${haversineDistanceKm(center, {
            lat: placeLat,
            lng: placeLng,
          }).toFixed(1)}km`
        : mission.dist;

    const categoryResolution = resolveKakaoPlaceCategory(place);

    return {
      ...mission,
      cat: categoryResolution?.category ?? mission.cat,
      placeLat,
      placeLng,
      placeName,
      placeAddress,
      districtName,
      dist,
      isLocationFlexible: false,
      placeEligible: Boolean(categoryResolution),
      placeFoodOnly: categoryResolution?.foodOnly ?? false,
    };
  });
}

function assignActualPlaces(
  missions: HomeMission[],
  places: PlaceCandidate[],
  center: Coordinate | null,
) {
  const usedPlaceIds = new Set<string>();

  return missions
    .map((mission): HomeMission | null => {
      if (mission.isAtHome) {
        return {
          ...mission,
          placeName: "내 방",
          dist: "내 방",
          placeId: undefined,
          placeLat: undefined,
          placeLng: undefined,
          placeAddress: undefined,
          districtName: undefined,
          isLocationFlexible: false,
        };
      }

      if (mission.isLocationFlexible) {
        return {
          ...mission,
          placeName: "어디서나 가능",
          dist: "어디서나 가능",
          placeId: undefined,
          placeLat: undefined,
          placeLng: undefined,
          placeAddress: undefined,
          districtName: undefined,
          isLocationFlexible: true,
        };
      }

      if (hasActualPlace(mission)) {
        // 서버에 이미 잘못 저장된 대표적 조합도 추천 목록에서 다시 노출하지 않는다.
        if (isExistingMissionPlaceObviouslyInvalid(mission)) {
          console.warn(
            "장소와 맞지 않는 기존 미션을 추천에서 제외합니다:",
            mission.title,
            mission.placeName,
          );
          return null;
        }

        if (mission.placeId) {
          usedPlaceIds.add(mission.placeId);
        }

        return {
          ...mission,
          isLocationFlexible: false,
        };
      }

      // 장소가 비어 있는 미션에는 카테고리와 행동이 모두 맞는 장소만 배정한다.
      // 아무 장소나 붙이는 fallback은 사용하지 않는다.
      const place = places.find(
        (candidate) =>
          !usedPlaceIds.has(candidate.id) &&
          isPlaceCandidateCompatibleWithMission(
            mission,
            candidate,
          ),
      );

      if (!place) {
        return null;
      }

      usedPlaceIds.add(place.id);
      const dist = center
        ? `${haversineDistanceKm(center, {
            lat: place.latitude,
            lng: place.longitude,
          }).toFixed(1)}km`
        : "장소 선택";

      return {
        ...mission,
        cat: place.category,
        placeId: place.id,
        placeName: place.name,
        placeLat: place.latitude,
        placeLng: place.longitude,
        placeAddress: place.address,
        districtName: place.districtName,
        dist,
        isLocationFlexible: false,
        placeEligible: true,
        placeFoodOnly: place.foodOnly === true,
      };
    })
    .filter((mission): mission is HomeMission => mission !== null);
}

function isGenericRecommendationReason(value: string) {
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/[.!?]/g, "");

  return (
    normalized === "" ||
    normalized === "현재취향과조건을고려해추천했어요" ||
    normalized === "사용자의취향과조건을고려해추천했어요" ||
    normalized === "취향과조건을고려해추천했어요" ||
    normalized === "현재상황과취향을고려해추천했어요"
  );
}

function normalizeRecommendationReason(value: string) {
  const fallback =
    "지금의 취향과 상황에 잘 맞는 경험이라 추천드려요.";

  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/(?:\.{3,}|…+)/g, "")
    .trim();

  if (!normalized) {
    return fallback;
  }

  const withoutTitlePrefix = normalized
    .replace(
      /^[‘'“"][^’'”"]+[’'”"](?:은|는|이|가)\s*/,
      "",
    )
    .replace(/[.!?。！？]+$/g, "")
    .trim();

  if (!withoutTitlePrefix) {
    return fallback;
  }

  const polished = withoutTitlePrefix
    .replace(/하기\s*좋음$/u, "하기 좋아요")
    .replace(/하기\s*좋다$/u, "하기 좋아요")
    .replace(/에\s*적합함$/u, "에 잘 맞아요")
    .replace(/에\s*적합하다$/u, "에 잘 맞아요")
    .replace(/도움이\s*됨$/u, "도움이 돼요")
    .replace(/도움이\s*된다$/u, "도움이 돼요")
    .replace(/추천함$/u, "추천드려요")
    .replace(/추천한다$/u, "추천드려요");

  if (
    /(요|죠|세요|까요|니다|예요|이에요|드려요|좋아요|맞아요|돼요)$/u.test(
      polished,
    )
  ) {
    return `${polished}.`;
  }

  return `${polished}. 이런 점에서 이 미션을 추천드려요.`;
}

function buildMissionSpecificRecommendationReason({
  title,
  category,
  placeName,
  time,
  cost,
  isAtHome,
}: {
  title: string;
  category: CategoryName;
  placeName?: string | null;
  time: string;
  cost: CostStatus;
  isAtHome: boolean;
}) {
  void title;
  void placeName;
  void time;
  void cost;
  void isAtHome;

  const categoryReasons: Record<CategoryName, string> = {
    음식: "새로운 맛으로 일상에 작은 변화를 주기 좋아요.",
    "카페 및 디저트": "향과 맛을 천천히 즐기며 쉬기 좋아요.",
    산책: "가볍게 걸으며 주변 풍경을 새롭게 보기 좋아요.",
    배움: "부담 없이 새로운 지식과 관점을 얻기 좋아요.",
    감상: "감각에 집중하며 마음의 속도를 늦추기 좋아요.",
    활동: "직접 움직이며 성취감과 활력을 얻기 좋아요.",
    휴식: "잠시 멈춰 몸과 마음을 돌보기 좋아요.",
    기타: "평소와 다른 작은 경험을 시작하기 좋아요.",
  };

  return categoryReasons[category];
}

function mapBackendMission(
  backendMission: ExtendedBackendMission,
  index = 0,
  center?: Coordinate | null,
  placeOverride?: {
    id?: string | null;
    name?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    category?: string | null;
    category_name?: string | null;
    category_group_code?: string | null;
    category_group_name?: string | null;
    kakao_category_name?: string | null;
    kakao_category_group_code?: string | null;
    kakao_category_group_name?: string | null;
  } | null,
): HomeMission {
  const title = String(
    backendMission.title ??
      backendMission.mission_title ??
      backendMission.name ??
      "새로운 작은 경험",
  );

  const rawDesc = String(
    backendMission.short_description ??
      backendMission.description ??
      backendMission.desc ??
      "",
  ).trim();

  const desc = isKoreanMissionText(rawDesc)
    ? rawDesc
    : "";

  const rawInstructions = String(
    backendMission.instructions ??
      backendMission.detailed_description ??
      backendMission.mission_guide ??
      rawDesc ??
      "",
  ).trim();

  // clever-task가 생성해 DB에 저장한 instructions를 그대로 표시한다.
  // 홈 화면에서는 문장을 보충하거나 description과 섞어 다시 작성하지 않는다.
  const instructions = isKoreanMissionText(rawInstructions)
    ? rawInstructions.replace(/\s+/g, " ").trim()
    : desc || "미션 안내를 확인해주세요.";

  const rawRecommendationReasonCandidate = String(
    backendMission.recommendation_reason ??
      backendMission.reason ??
      "",
  ).trim();

  const rawRecommendationReason = isKoreanMissionText(
    rawRecommendationReasonCandidate,
  )
    ? rawRecommendationReasonCandidate
    : "";

  const inferenceText = [
    title,
    desc,
    instructions,
    rawRecommendationReason,
  ].join(" ");

  const backendCategory = normalizeCategory(
    getRawCategoryName(backendMission),
    inferenceText,
  );
  const placeCategoryResolution = placeOverride
    ? resolveKakaoPlaceCategory(placeOverride)
    : null;
  const category = placeCategoryResolution?.category ?? backendCategory;

  const durationMinutes = parseDurationMinutes(
    backendMission.estimated_duration_min ??
      backendMission.estimatedTime ??
      backendMission.duration,
  );

  const time =
    durationMinutes !== null
      ? `${durationMinutes}분`
      : "시간 자유";

  const rawPlaceName =
    placeOverride?.name ??
    backendMission.place_name ??
    undefined;

  const placeAddress =
    String(
      backendMission.place_address ??
        backendMission.road_address_name ??
        backendMission.road_address ??
        backendMission.address_name ??
        backendMission.address ??
        "",
    ).trim() || undefined;

  const districtName =
    String(
      backendMission.district ??
        backendMission.gu ??
        backendMission.region_2depth_name ??
        "",
    ).trim() || undefined;

  const isAtHome = inferAtHomeMission(
    backendMission,
    inferenceText,
    rawPlaceName,
  );

  const explicitRequiresPlace =
    backendMission.requires_place ??
    backendMission.requiresPlace;

  const isLocationFlexible =
    inferFlexibleMission(
      backendMission,
      isAtHome,
      rawPlaceName,
    ) ||
    (!isAtHome &&
      explicitRequiresPlace == null &&
      !rawPlaceName &&
      !backendMission.place_id &&
      backendMission.place_lat == null &&
      backendMission.latitude == null);

  const placeLat =
    toFiniteNumber(placeOverride?.latitude) ??
    toFiniteNumber(backendMission.place_lat) ??
    toFiniteNumber(backendMission.latitude);

  const placeLng =
    toFiniteNumber(placeOverride?.longitude) ??
    toFiniteNumber(backendMission.place_lng) ??
    toFiniteNumber(backendMission.longitude);

  const suppliedDistance =
    toFiniteNumber(backendMission.distance_km) ??
    toFiniteNumber(backendMission.distance);

  const calculatedDistance =
    !isAtHome &&
    center &&
    placeLat !== null &&
    placeLng !== null
      ? haversineDistanceKm(center, {
          lat: placeLat,
          lng: placeLng,
        })
      : null;

  const distance = calculatedDistance ?? suppliedDistance;

  const rawId = backendMission.id;
  const id = rawId
    ? String(rawId)
    : `ai-temporary-${Date.now()}-${index}`;

  const cost = normalizeCostStatus(
    backendMission,
    inferenceText,
  );

  const placeName = isAtHome
    ? "내 방"
    : isLocationFlexible
      ? "어디서나 가능"
      : rawPlaceName;

  const recommendationReason =
    normalizeRecommendationReason(
      !isGenericRecommendationReason(
        rawRecommendationReason,
      )
        ? rawRecommendationReason
        : buildMissionSpecificRecommendationReason({
            title,
            category,
            placeName,
            time,
            cost,
            isAtHome,
          }),
    );

  return {
    id,
    title,
    desc,
    instructions,
    recommendationReason,
    durationMinutes,
    time,
    dist: isAtHome
      ? "내 방"
      : isLocationFlexible
        ? "어디서나 가능"
        : distance !== null
          ? `${distance.toFixed(1)}km`
          : "거리 정보 없음",
    cost,
    cat: category,
    requiredItems: normalizeRequiredItems(
      backendMission,
    ),
    placeId:
      isAtHome || isLocationFlexible
        ? undefined
        : placeOverride?.id ??
          backendMission.place_id ??
          undefined,
    placeLat:
      isAtHome || isLocationFlexible
        ? undefined
        : placeLat ?? undefined,
    placeLng:
      isAtHome || isLocationFlexible
        ? undefined
        : placeLng ?? undefined,
    placeName,
    placeAddress:
      isAtHome || isLocationFlexible
        ? undefined
        : placeAddress,
    districtName:
      isAtHome || isLocationFlexible
        ? undefined
        : districtName,
    isAtHome,
    isLocationFlexible,
    isFallback: !isUuid(id),
    placeEligible:
      isAtHome || isLocationFlexible
        ? true
        : placeOverride
          ? Boolean(placeCategoryResolution)
          : undefined,
    placeFoodOnly: placeCategoryResolution?.foodOnly ?? false,
  };
}

function missionMatchesFilters(
  mission: HomeMission,
  filters: RecommendationFilters,
  center: Coordinate | null,
  radiusKm: RadiusKm,
  district: BusanDistrict | null,
  districtPolygons: DistrictPolygon[] | null = null,
) {
  if (
    filters.categories.length > 0 &&
    !filters.categories.includes(mission.cat)
  ) {
    return false;
  }

  const minutes = mission.durationMinutes;

  if (filters.time !== "any") {
    if (minutes === null) {
      return false;
    }

    if (filters.time === "under15" && minutes > 15) {
      return false;
    }
    if (filters.time === "under30" && minutes > 30) {
      return false;
    }
    if (filters.time === "under60" && minutes > 60) {
      return false;
    }
    if (filters.time === "over60" && minutes < 60) {
      return false;
    }
  }

  if (filters.cost === "free") {
    if (
      mission.cost !== "무료" &&
      mission.cost !== "유료/무료"
    ) {
      return false;
    }
  }

  if (filters.cost === "paid") {
    if (
      mission.cost !== "유료" &&
      mission.cost !== "유료/무료"
    ) {
      return false;
    }
  }

  if (mission.isLocationFlexible) {
    return true;
  }

  if (center && !mission.isAtHome) {
    if (!hasActualPlace(mission)) {
      return false;
    }

    const distance = haversineDistanceKm(center, {
      lat: mission.placeLat!,
      lng: mission.placeLng!,
    });

    if (distance > radiusKm) {
      return false;
    }
  }

  if (district) {
    if (mission.isAtHome || !hasActualPlace(mission)) {
      return false;
    }

    const districtKey = normalizeComparableText(district);
    const locationText = normalizeComparableText(
      `${mission.districtName ?? ""} ${mission.placeAddress ?? ""} ${mission.placeName ?? ""}`,
    );

    if (locationText.includes(districtKey)) {
      return true;
    }

    if (
      districtPolygons &&
      districtPolygons.length > 0
    ) {
      return pointInDistrict(
        { lat: mission.placeLat!, lng: mission.placeLng! },
        districtPolygons,
      );
    }

    return false;
  }

  return true;
}

function isBlockedRecommendationMission(
  mission: HomeMission,
) {
  const normalizedTitle = normalizeComparableText(
    mission.title,
  );
  const fullText = `${mission.title} ${mission.desc} ${mission.instructions}`;

  return (
    BLOCKED_MISSION_TITLE_PATTERNS.some(
      (pattern) => normalizedTitle === pattern,
    ) ||
    BLOCKED_MISSION_TEXT_PATTERNS.some((pattern) =>
      pattern.test(fullText),
    )
  );
}

function ensureCurrentAiFlexibleRecommendations({
  selected,
  aiFlexibleCandidates,
  minimumCount,
  limit,
}: {
  selected: HomeMission[];
  aiFlexibleCandidates: HomeMission[];
  minimumCount: number;
  limit: number;
}) {
  const required = dedupeMissions(
    aiFlexibleCandidates.filter(
      (mission) =>
        mission.isLocationFlexible === true &&
        !isBlockedRecommendationMission(mission),
    ),
  ).slice(0, minimumCount);

  if (required.length === 0) {
    return selected.slice(0, limit);
  }

  const requiredIds = new Set(
    required.map((mission) => mission.id),
  );
  const withoutRequiredDuplicates = selected.filter(
    (mission) => !requiredIds.has(mission.id),
  );

  return dedupeMissions([
    ...required,
    ...withoutRequiredDuplicates,
  ]).slice(0, limit);
}

function dedupeMissions(missions: HomeMission[]) {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  return missions.filter((mission) => {
    const normalizedTitle = mission.title
      .trim()
      .toLowerCase();

    if (
      seenIds.has(mission.id) ||
      seenTitles.has(normalizedTitle)
    ) {
      return false;
    }

    seenIds.add(mission.id);
    seenTitles.add(normalizedTitle);
    return true;
  });
}

function shuffle<T>(items: T[]) {
  const copied = [...items];

  for (let index = copied.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1),
    );
    [copied[index], copied[randomIndex]] = [
      copied[randomIndex],
      copied[index],
    ];
  }

  return copied;
}

function rankMissionsByInterests(
  missions: HomeMission[],
  interests: CategoryName[],
) {
  if (interests.length === 0) {
    return missions;
  }

  const preferred = missions.filter((mission) =>
    interests.includes(mission.cat),
  );
  const others = missions.filter(
    (mission) => !interests.includes(mission.cat),
  );

  const result: HomeMission[] = [];
  let preferredIndex = 0;
  let otherIndex = 0;

  while (
    preferredIndex < preferred.length ||
    otherIndex < others.length
  ) {
    for (
      let count = 0;
      count < 2 && preferredIndex < preferred.length;
      count += 1
    ) {
      result.push(preferred[preferredIndex]);
      preferredIndex += 1;
    }

    if (otherIndex < others.length) {
      result.push(others[otherIndex]);
      otherIndex += 1;
    }
  }

  return result;
}

function rankMissionsByPreferenceSignals(
  missions: HomeMission[],
  initialInterests: CategoryName[],
  likedCategories: CategoryName[],
  dislikedCategories: CategoryName[],
) {
  const initialSet = new Set(initialInterests);
  const likedSet = new Set(likedCategories);
  const dislikedSet = new Set(dislikedCategories);

  return shuffle(missions)
    .map((mission, index) => {
      let score = 0;

      if (initialSet.has(mission.cat)) {
        score += 2;
      }
      if (likedSet.has(mission.cat)) {
        score += 4;
      }
      if (dislikedSet.has(mission.cat)) {
        score -= 4;
      }

      return { mission, score, index };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.index - right.index,
    )
    .map(({ mission }) => mission);
}

function applyLocationPresentation(
  mission: HomeMission,
  _locationMode: LocationMode,
  _district: BusanDistrict | null,
) {
  if (mission.isAtHome) {
    return {
      ...mission,
      placeName: "내 방",
      dist: "내 방",
      placeId: undefined,
      placeLat: undefined,
      placeLng: undefined,
      placeAddress: undefined,
      districtName: undefined,
      isLocationFlexible: false,
    };
  }

  if (mission.isLocationFlexible) {
    return {
      ...mission,
      placeName: "어디서나 가능",
      dist: "어디서나 가능",
      placeId: undefined,
      placeLat: undefined,
      placeLng: undefined,
      placeAddress: undefined,
      districtName: undefined,
      isLocationFlexible: true,
    };
  }

  return mission;
}

function selectDiverseRecommendations({
  candidates,
  interests,
  locationMode,
  district,
  limit = 10,
}: {
  candidates: HomeMission[];
  interests: CategoryName[];
  locationMode: LocationMode;
  district: BusanDistrict | null;
  limit?: number;
}) {
  const maxHomeCount = locationMode === "district" ? 0 : 2;
  const prepared = candidates.map((mission) =>
    applyLocationPresentation(
      mission,
      locationMode,
      district,
    ),
  );

  const groups = new Map<CategoryName, HomeMission[]>();
  for (const category of CATEGORIES) {
    groups.set(category, []);
  }
  for (const mission of prepared) {
    groups.get(mission.cat)?.push(mission);
  }

  const preferredCategories = CATEGORIES.filter((category) =>
    interests.includes(category),
  );
  const otherCategories = CATEGORIES.filter(
    (category) => !interests.includes(category),
  );
  const categoryOrder = [
    ...preferredCategories,
    ...otherCategories,
  ];

  const selected: HomeMission[] = [];
  const selectedKeys = new Set<string>();
  const selectedPlaces = new Set<string>();
  const categoryCounts = new Map<CategoryName, number>();
  let homeCount = 0;

  const tryAdd = (
    mission: HomeMission | undefined,
    maxPerCategory: number,
  ) => {
    if (!mission || selected.length >= limit) {
      return false;
    }

    const missionKey = getMissionRefreshKey(mission);
    const placeKey = getMissionPlaceKey(mission);
    const currentCategoryCount =
      categoryCounts.get(mission.cat) ?? 0;

    if (
      selectedKeys.has(missionKey) ||
      (placeKey && selectedPlaces.has(placeKey)) ||
      currentCategoryCount >= maxPerCategory ||
      (mission.isAtHome && homeCount >= maxHomeCount)
    ) {
      return false;
    }

    selected.push(mission);
    selectedKeys.add(missionKey);
    if (placeKey) {
      selectedPlaces.add(placeKey);
    }
    categoryCounts.set(
      mission.cat,
      currentCategoryCount + 1,
    );
    if (mission.isAtHome) {
      homeCount += 1;
    }
    return true;
  };

  const takeFromCategory = (
    category: CategoryName,
    maxPerCategory: number,
  ) => {
    const group = groups.get(category) ?? [];
    while (group.length > 0) {
      const mission = group.shift();
      if (tryAdd(mission, maxPerCategory)) {
        return true;
      }
    }
    return false;
  };

  // 첫 바퀴에서는 관심 카테고리를 먼저 넣되 다른 카테고리도
  // 최소한 한 번씩 섞어 초기 추천이 한 종류로 몰리지 않게 한다.
  const firstRound: CategoryName[] = [];
  const maxRoundLength = Math.max(
    preferredCategories.length,
    otherCategories.length,
  );
  for (let index = 0; index < maxRoundLength; index += 1) {
    if (preferredCategories[index]) {
      firstRound.push(preferredCategories[index]);
    }
    if (otherCategories[index]) {
      firstRound.push(otherCategories[index]);
    }
  }

  for (const category of firstRound) {
    takeFromCategory(category, 2);
    if (selected.length >= Math.min(limit, 6)) {
      break;
    }
  }

  // 관심사 2 : 그 외 1 비율로 채운다.
  const weightedOrder = [
    ...preferredCategories,
    ...preferredCategories,
    ...otherCategories,
  ];
  const fillOrder =
    weightedOrder.length > 0 ? weightedOrder : categoryOrder;

  for (const maxPerCategory of [2, 3, Number.POSITIVE_INFINITY]) {
    let madeProgress = true;
    while (selected.length < limit && madeProgress) {
      madeProgress = false;
      for (const category of fillOrder) {
        if (takeFromCategory(category, maxPerCategory)) {
          madeProgress = true;
        }
        if (selected.length >= limit) {
          break;
        }
      }
    }
  }

  return selected.slice(0, limit);
}

function getPreparationText(mission: HomeMission) {
  return mission.requiredItems.length > 0
    ? mission.requiredItems.join(", ")
    : "별도 준비물 없음";
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

function getEmotionInfo(value: EmotionValue) {
  return (
    EMOTIONS.find((item) => item.value === value) ?? {
      label: value,
      value,
      emoji: "🙂",
    }
  );
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

async function prepareRecordPhotoForUpload(
  photo: ImagePicker.ImagePickerAsset,
) {
  const originalExtension = getPhotoExtension(photo);
  const originalContentType = getPhotoContentType(
    photo,
    originalExtension,
  ).toLowerCase();
  const shouldConvertToJpeg =
    originalExtension === "heic" ||
    originalExtension === "heif" ||
    originalContentType === "image/heic" ||
    originalContentType === "image/heif";

  if (!shouldConvertToJpeg) {
    return {
      uri: photo.uri,
      extension: originalExtension,
      contentType: originalContentType,
    };
  }

  const converted = await ImageManipulator.manipulateAsync(
    photo.uri,
    [],
    {
      compress: 0.88,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    uri: converted.uri,
    extension: "jpg",
    contentType: "image/jpeg",
  };
}

function getConditionSummary(
  filters: RecommendationFilters,
  locationMode: LocationMode,
  center: Coordinate | null,
  radiusKm: RadiusKm,
  district: BusanDistrict | null,
) {
  const parts: string[] = [];

  if (locationMode === "radius" && center) {
    parts.push(`선택 지역 ${radiusKm}km`);
  }

  if (locationMode === "district" && district) {
    parts.push(district);
  }

  if (filters.categories.length > 0) {
    parts.push(
      filters.categories.length === 1
        ? filters.categories[0]
        : `카테고리 ${filters.categories.length}개`,
    );
  }

  const timeLabel = TIME_OPTIONS.find(
    (item) => item.value === filters.time,
  )?.label;
  if (timeLabel && filters.time !== "any") {
    parts.push(timeLabel);
  }

  const costLabel = COST_OPTIONS.find(
    (item) => item.value === filters.cost,
  )?.label;
  if (costLabel && filters.cost !== "any") {
    parts.push(costLabel);
  }

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return locationMode === "any"
    ? `현재 위치 ${DEFAULT_ANY_RADIUS_KM}km · 취향을 반영한 추천 미션`
    : "취향을 반영한 추천 미션";
}

function LocationPickerMap({
  coordinate,
  radiusKm,
  onSelect,
}: {
  coordinate: Coordinate;
  radiusKm: RadiusKm;
  onSelect: (coordinate: Coordinate) => void;
}) {
  const html = useMemo(
    () => `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
    #loading {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: #f7f8fa; color: #5c5f6a; font-family: sans-serif; font-size: 13px; z-index: 10;
    }
  </style>
</head>
<body>
  <div id="loading">지도를 불러오는 중이에요</div>
  <div id="map"></div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"></script>
  <script>
    const radiusMeters = ${radiusKm * 1000};

    const send = (lat, lng) => {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'location', lat, lng })
      );
    };

    const getBoundsForRadius = (lat, lng) => {
      const latDelta = radiusMeters / 111320;
      const lngDelta =
        radiusMeters /
        (111320 * Math.max(Math.cos(lat * Math.PI / 180), 0.2));

      const bounds = new kakao.maps.LatLngBounds();
      bounds.extend(new kakao.maps.LatLng(lat - latDelta, lng - lngDelta));
      bounds.extend(new kakao.maps.LatLng(lat + latDelta, lng + lngDelta));
      return bounds;
    };

    kakao.maps.load(function () {
      document.getElementById('loading').style.display = 'none';

      const initial = new kakao.maps.LatLng(
        ${coordinate.lat},
        ${coordinate.lng}
      );

      const map = new kakao.maps.Map(
        document.getElementById('map'),
        {
          center: initial,
          level: 5,
        }
      );

      const marker = new kakao.maps.Marker({
        position: initial,
        map,
        draggable: true,
      });

      const circle = new kakao.maps.Circle({
        center: initial,
        radius: radiusMeters,
        strokeWeight: 3,
        strokeColor: '#3D5AFE',
        strokeOpacity: 1,
        strokeStyle: 'solid',
        fillColor: '#3D5AFE',
        fillOpacity: 0.18,
      });

      circle.setMap(map);

      const fitRadius = (latLng) => {
        map.setBounds(
          getBoundsForRadius(
            latLng.getLat(),
            latLng.getLng()
          ),
          28,
          28,
          28,
          28
        );
      };

      const update = (latLng, notify = true) => {
        marker.setPosition(latLng);
        circle.setPosition(latLng);
        circle.setRadius(radiusMeters);
        circle.setMap(map);
        fitRadius(latLng);

        if (notify) {
          send(latLng.getLat(), latLng.getLng());
        }
      };

      update(initial, false);

      kakao.maps.event.addListener(
        map,
        'click',
        function (mouseEvent) {
          update(mouseEvent.latLng);
        }
      );

      kakao.maps.event.addListener(
        marker,
        'dragend',
        function () {
          update(marker.getPosition());
        }
      );
    });
  </script>
</body>
</html>`,
    [coordinate.lat, coordinate.lng, radiusKm],
  );

  return (
    <WebView
      key={`${coordinate.lat.toFixed(5)}-${coordinate.lng.toFixed(
        5,
      )}-${radiusKm}`}
      originWhitelist={["*"]}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      onMessage={(event) => {
        try {
          const message = JSON.parse(
            event.nativeEvent.data,
          ) as {
            type?: string;
            lat?: number;
            lng?: number;
          };

          if (
            message.type === "location" &&
            isFiniteNumber(message.lat) &&
            isFiniteNumber(message.lng)
          ) {
            onSelect({
              lat: message.lat,
              lng: message.lng,
            });
          }
        } catch {
          // 지도 내부의 다른 메시지는 무시한다.
        }
      }}
      style={styles.locationPickerMap}
    />
  );
}


function RecordLocationPickerMap({
  center,
  pickedLocation,
  onSelect,
}: {
  center: Coordinate;
  pickedLocation: Coordinate | null;
  onSelect: (coordinate: Coordinate) => void;
}) {
  const html = useMemo(
    () => `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
  />

  <style>
    html,
    body,
    #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    #loading {
      position: fixed;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f7f8fa;
      color: #5c5f6a;
      font-family: sans-serif;
      font-size: 13px;
    }
  </style>
</head>

<body>
  <div id="loading">지도를 불러오는 중이에요</div>
  <div id="map"></div>

  <script>
    /*
     * iOS WebView에서는 원래 ReactNativeWebView가 존재한다.
     * 웹 iframe에서는 부모 React 화면으로 메시지를 전달하도록 직접 만든다.
     */
    window.ReactNativeWebView =
      window.ReactNativeWebView || {
        postMessage: function (message) {
          window.parent.postMessage(
            {
              source: "record-location-picker",
              payload: message
            },
            "*"
          );
        }
      };
  </script>

  <script
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"
  ></script>

  <script>
    kakao.maps.load(function () {
      document.getElementById("loading").style.display =
        "none";

      const initial = new kakao.maps.LatLng(
        ${center.lat},
        ${center.lng}
      );

      const map = new kakao.maps.Map(
        document.getElementById("map"),
        {
          center: initial,
          level: 4
        }
      );

      let marker = null;
      const initialPicked =
        ${JSON.stringify(pickedLocation)};

      const sendLocation = function (latLng) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "recordLocation",
            lat: latLng.getLat(),
            lng: latLng.getLng()
          })
        );
      };

      const makeMarker = function (latLng) {
        if (!marker) {
          marker = new kakao.maps.Marker({
            map: map,
            position: latLng,
            draggable: true
          });

          kakao.maps.event.addListener(
            marker,
            "dragend",
            function () {
              sendLocation(marker.getPosition());
            }
          );
        } else {
          marker.setPosition(latLng);
        }

        map.panTo(latLng);
      };

      if (
        initialPicked &&
        Number.isFinite(initialPicked.lat) &&
        Number.isFinite(initialPicked.lng)
      ) {
        makeMarker(
          new kakao.maps.LatLng(
            initialPicked.lat,
            initialPicked.lng
          )
        );
      }

      kakao.maps.event.addListener(
        map,
        "click",
        function (mouseEvent) {
          makeMarker(mouseEvent.latLng);
          sendLocation(mouseEvent.latLng);
        }
      );
    });
  </script>
</body>
</html>
`,
    [
      center.lat,
      center.lng,
      pickedLocation?.lat,
      pickedLocation?.lng,
    ],
  );

  const parseLocationMessage = useCallback(
    (rawMessage: string) => {
      try {
        const message = JSON.parse(rawMessage) as {
          type?: string;
          lat?: number;
          lng?: number;
        };

        if (
          message.type === "recordLocation" &&
          isFiniteNumber(message.lat) &&
          isFiniteNumber(message.lng)
        ) {
          onSelect({
            lat: message.lat,
            lng: message.lng,
          });
        }
      } catch {
        // 지도에서 전달된 다른 메시지는 무시한다.
      }
    },
    [onSelect],
  );

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const handleWebMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            source?: string;
            payload?: unknown;
          }
        | undefined;

      if (
        data?.source !== "record-location-picker" ||
        typeof data.payload !== "string"
      ) {
        return;
      }

      parseLocationMessage(data.payload);
    };

    window.addEventListener(
      "message",
      handleWebMessage,
    );

    return () => {
      window.removeEventListener(
        "message",
        handleWebMessage,
      );
    };
  }, [parseLocationMessage]);

  const mapKey =
    `${center.lat.toFixed(5)}-` +
    `${center.lng.toFixed(5)}-` +
    `${pickedLocation?.lat?.toFixed(5) ?? "none"}-` +
    `${pickedLocation?.lng?.toFixed(5) ?? "none"}`;

  if (Platform.OS === "web") {
    return (
      <View style={styles.recordLocationPickerMap}>
        <iframe
          key={mapKey}
          title="미션 수행 위치 선택 지도"
          srcDoc={html}
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
          }}
          allow="geolocation"
        />
      </View>
    );
  }

  return (
    <WebView
      key={mapKey}
      originWhitelist={["*"]}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      onMessage={(event) => {
        parseLocationMessage(
          event.nativeEvent.data,
        );
      }}
      style={styles.recordLocationPickerMap}
    />
  );
}

type ActualPlaceSearchRequest = {
  coordinate: Coordinate;
  nonce: number;
};

function ActualPlacePickerMap({
  center,
  selectedPlace,
  searchRequest,
  onLoadingChange,
  onPlaceSelected,
}: {
  center: Coordinate;
  selectedPlace: PlaceCandidate | null;
  searchRequest: ActualPlaceSearchRequest | null;
  onLoadingChange: (loading: boolean) => void;
  onPlaceSelected: (place: PlaceCandidate) => void;
}) {
  const webViewRef = useRef<any>(null);

  const html = useMemo(
    () => `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
    body { overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; }
    #loading {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: #F5F2E9; color: #65766D; font-size: 13px; z-index: 30;
    }
    #status {
      position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
      max-width: calc(100vw - 28px); padding: 8px 12px; border-radius: 999px;
      background: rgba(255,255,255,0.96); color: #315C4A; font-size: 11px;
      line-height: 15px; font-weight: 800; text-align: center;
      box-shadow: 0 3px 12px rgba(0,0,0,0.14); z-index: 20; white-space: nowrap;
    }
    .place-poi {
      position: relative; display: flex; flex-direction: column; align-items: center;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    .place-poi-button {
      width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
      padding: 0; border: 2px solid #fff; border-radius: 17px;
      background: #315C4A; color: #fff; font-size: 16px;
      box-shadow: 0 3px 9px rgba(15,23,42,0.28); cursor: pointer;
    }
    .place-poi-label {
      max-width: 116px; margin-top: 3px; padding: 3px 6px;
      overflow: hidden; border: 1px solid rgba(15,23,42,0.08); border-radius: 7px;
      background: rgba(255,255,255,0.95); color: #26372E; font-size: 9px;
      line-height: 12px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    }
    .selected-card {
      min-width: 190px; max-width: 245px; padding: 9px 11px;
      border: 2px solid #E07A5F; border-radius: 12px; background: #fff;
      box-shadow: 0 5px 16px rgba(0,0,0,0.20); transform: translateY(-10px);
    }
    .selected-caption { color: #E07A5F; font-size: 10px; font-weight: 850; margin-bottom: 3px; }
    .selected-name { overflow: hidden; color: #26372E; font-size: 13px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
    .selected-address { overflow: hidden; margin-top: 3px; color: #65766D; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  </style>
</head>
<body>
  <div id="loading">지도를 불러오는 중이에요</div>
  <div id="status">장소 마커를 눌러 실제 장소를 선택해주세요</div>
  <div id="map"></div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services"></script>
  <script>
    kakao.maps.load(function () {
      document.getElementById('loading').style.display = 'none';
      const initial = new kakao.maps.LatLng(${center.lat}, ${center.lng});
      const map = new kakao.maps.Map(document.getElementById('map'), { center: initial, level: 4 });
      const placesService = new kakao.maps.services.Places();
      const categoryCodes = ['MT1','CS2','PS3','SC4','AC5','PK6','OL7','SW8','BK9','CT1','AG2','PO3','AT4','AD5','FD6','CE7','HP8','PM9'];
      const categoryEmoji = { MT1:'🛒',CS2:'🏪',PS3:'👶',SC4:'🏫',AC5:'📚',PK6:'🅿️',OL7:'⛽',SW8:'🚇',BK9:'🏦',CT1:'🎭',AG2:'🏠',PO3:'🏛️',AT4:'📍',AD5:'🏨',FD6:'🍽️',CE7:'☕',HP8:'🏥',PM9:'💊' };
      let overlays = [];
      let selectedOverlay = null;
      let loadSequence = 0;
      let idleTimer = null;
      const statusElement = document.getElementById('status');
      const post = function (payload) { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); };
      const escapeHtml = function (value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); };
      const clearOverlays = function () { overlays.forEach(function (overlay) { overlay.setMap(null); }); overlays = []; };
      const normalizePlace = function (raw) { return { id:String(raw.id || ''), name:String(raw.place_name || ''), latitude:Number(raw.y), longitude:Number(raw.x), address:String(raw.road_address_name || raw.address_name || ''), category:String(raw.category_group_name || raw.category_name || ''), categoryCode:String(raw.category_group_code || '') }; };
      const showSelectedPlace = function (place, shouldPan) {
        if (selectedOverlay) selectedOverlay.setMap(null);
        const position = new kakao.maps.LatLng(Number(place.latitude), Number(place.longitude));
        const content = document.createElement('div');
        content.className = 'selected-card';
        content.innerHTML = '<div class="selected-caption">현재 선택된 실제 장소</div><div class="selected-name">' + escapeHtml(place.name) + '</div><div class="selected-address">' + escapeHtml(place.address || '주소 정보 없음') + '</div>';
        selectedOverlay = new kakao.maps.CustomOverlay({ map:map, position:position, content:content, xAnchor:0.5, yAnchor:1.25, zIndex:50 });
        if (shouldPan) map.panTo(position);
      };
      const selectPlace = function (rawPlace) {
        const place = normalizePlace(rawPlace);
        if (!place.id || !place.name || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return;
        showSelectedPlace(place, true);
        statusElement.textContent = '선택됨 · ' + place.name;
        post({ type:'recordPlaceSelected', place:place });
      };
      const searchCategory = function (code, bounds) {
        return new Promise(function (resolve) {
          placesService.categorySearch(code, function (data, status) { resolve(status === kakao.maps.services.Status.OK ? data : []); }, { bounds:bounds, sort:kakao.maps.services.SortBy.ACCURACY });
        });
      };
      const renderMarkers = function (places) {
        clearOverlays();
        places.forEach(function (rawPlace) {
          const place = normalizePlace(rawPlace);
          if (!place.id || !place.name || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return;
          const content = document.createElement('div');
          content.className = 'place-poi';
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'place-poi-button'; button.textContent = categoryEmoji[place.categoryCode] || '📍';
          const label = document.createElement('div'); label.className = 'place-poi-label'; label.textContent = place.name;
          content.appendChild(button); content.appendChild(label);
          const choose = function (event) { event.preventDefault(); event.stopPropagation(); selectPlace(rawPlace); };
          button.addEventListener('click', choose); content.addEventListener('click', choose);
          overlays.push(new kakao.maps.CustomOverlay({ map:map, position:new kakao.maps.LatLng(place.latitude, place.longitude), content:content, xAnchor:0.5, yAnchor:1, zIndex:10 }));
        });
      };
      const loadVisiblePlaces = async function () {
        const sequence = ++loadSequence;
        post({ type:'recordPlaceListLoading' });
        statusElement.textContent = map.getLevel() > 7 ? '장소를 보려면 지도를 확대해주세요' : '현재 지도에서 실제 장소를 불러오는 중이에요';
        if (map.getLevel() > 7) { clearOverlays(); post({ type:'recordPlaceListReady' }); return; }
        try {
          const groups = await Promise.all(categoryCodes.map(function (code) { return searchCategory(code, map.getBounds()); }));
          if (sequence !== loadSequence) return;
          const unique = {};
          groups.flat().forEach(function (place) { if (place && place.id) unique[place.id] = place; });
          const results = Object.values(unique).slice(0, 55);
          renderMarkers(results);
          statusElement.textContent = results.length ? '장소 마커를 눌러 선택해주세요 · ' + results.length + '곳' : '이 화면에서는 장소를 찾지 못했어요. 지도를 이동하거나 확대해주세요';
          post({ type:'recordPlaceListReady' });
        } catch (_) {
          clearOverlays(); statusElement.textContent = '장소를 불러오지 못했어요. 지도를 다시 움직여주세요'; post({ type:'recordPlaceListReady' });
        }
      };
      const scheduleLoad = function () { if (idleTimer) clearTimeout(idleTimer); idleTimer = setTimeout(loadVisiblePlaces, 260); };
      window.focusActualPlaceMap = function (lat, lng) { lat=Number(lat); lng=Number(lng); if (!Number.isFinite(lat) || !Number.isFinite(lng)) return; map.panTo(new kakao.maps.LatLng(lat,lng)); setTimeout(loadVisiblePlaces,320); };
      window.showSelectedActualPlace = function (placeJson) { try { const place = typeof placeJson === 'string' ? JSON.parse(placeJson) : placeJson; showSelectedPlace(place,false); } catch (_) {} };
      kakao.maps.event.addListener(map, 'idle', scheduleLoad);
      loadVisiblePlaces();
    });
  </script>
</body>
</html>`,
    [center.lat, center.lng],
  );

  useEffect(() => {
    if (!searchRequest) return;
    webViewRef.current?.injectJavaScript(`
      if (window.focusActualPlaceMap) {
        window.focusActualPlaceMap(${searchRequest.coordinate.lat}, ${searchRequest.coordinate.lng});
      }
      true;
    `);
  }, [searchRequest?.nonce]);

  useEffect(() => {
    if (!selectedPlace) return;
    const serialized = JSON.stringify(selectedPlace).replace(/</g, "\\u003c");
    webViewRef.current?.injectJavaScript(`
      if (window.showSelectedActualPlace) {
        window.showSelectedActualPlace(${JSON.stringify(serialized)});
      }
      true;
    `);
  }, [selectedPlace?.id, selectedPlace?.latitude, selectedPlace?.longitude]);

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={["*"]}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      onMessage={(event) => {
        try {
          const message = JSON.parse(event.nativeEvent.data) as {
            type?: string;
            place?: {
              id?: string;
              name?: string;
              latitude?: number;
              longitude?: number;
              address?: string;
              category?: string;
            };
          };

          if (message.type === "recordPlaceListLoading") {
            onLoadingChange(true);
            return;
          }

          if (message.type === "recordPlaceListReady") {
            onLoadingChange(false);
            return;
          }

          if (
            message.type === "recordPlaceSelected" &&
            message.place &&
            typeof message.place.id === "string" &&
            typeof message.place.name === "string" &&
            isFiniteNumber(message.place.latitude) &&
            isFiniteNumber(message.place.longitude)
          ) {
            onLoadingChange(false);
            onPlaceSelected({
              id: message.place.id,
              name: message.place.name,
              latitude: message.place.latitude,
              longitude: message.place.longitude,
              address: message.place.address || undefined,
              category: normalizeCategory(
                message.place.category,
                `${message.place.name} ${message.place.address ?? ""}`,
              ),
            });
          }
        } catch {
          // 지도 내부의 다른 메시지는 무시합니다.
        }
      }}
      style={styles.recordLocationPickerMap}
    />
  );
}

export default function HomeScreen() {
  const [missions, setMissions] =
    useState<HomeMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] =
    useState<Coordinate | null>(null);
  const [activeJourney, setActiveJourney] =
    useState<ActiveJourney | null>(null);
  const [startedAttempts, setStartedAttempts] =
    useState<Record<string, StartedAttempt>>({});
  const [attemptMissions, setAttemptMissions] =
    useState<Record<string, HomeMission>>({});
  const [completedRecords, setCompletedRecords] =
    useState<CompletedRecord[]>([]);
  const [completedMissionIds, setCompletedMissionIds] =
    useState<Set<string>>(new Set());
  const [completedMissionCount, setCompletedMissionCount] =
    useState(0);
  const [startLoadingId, setStartLoadingId] =
    useState<string | null>(null);

  const [sheetSection, setSheetSection] =
    useState<SheetSection>("recommended");
  const [selectedItemKey, setSelectedItemKey] =
    useState<string | null>(null);
  const [homeMissionPanelOpen, setHomeMissionPanelOpen] =
    useState(false);

  const [appliedFilters, setAppliedFilters] =
    useState<RecommendationFilters>(DEFAULT_FILTERS);
  const [recommendationCenter, setRecommendationCenter] =
    useState<Coordinate | null>(null);
  const [recommendationLocationMode, setRecommendationLocationMode] =
    useState<LocationMode>("any");
  const [recommendationRadiusKm, setRecommendationRadiusKm] =
    useState<RadiusKm>(1);
  const [recommendationDistrict, setRecommendationDistrict] =
    useState<BusanDistrict | null>(null);
  const [profileInterests, setProfileInterests] =
    useState<CategoryName[]>([]);
  const [conditionVisible, setConditionVisible] =
    useState(false);
  const [conditionStep, setConditionStep] = useState(0);
  const [draftCategories, setDraftCategories] = useState<
    CategoryName[]
  >([]);
  const [draftTime, setDraftTime] =
    useState<TimeFilter>("any");
  const [draftCost, setDraftCost] =
    useState<CostFilter>("any");
  const [draftCenter, setDraftCenter] =
    useState<Coordinate | null>(null);
  const [draftLocationMode, setDraftLocationMode] =
    useState<LocationMode>("any");
  const [draftRadiusKm, setDraftRadiusKm] =
    useState<RadiusKm>(1);
  const [draftDistrict, setDraftDistrict] =
    useState<BusanDistrict | null>(null);

  const [recordMission, setRecordMission] =
    useState<HomeMission | null>(null);
  const [recordContent, setRecordContent] = useState("");
  const [recordEmotion, setRecordEmotion] =
    useState<EmotionValue | "">("");
  const [recordPreference, setRecordPreference] =
    useState<MissionPreferenceValue | "">("");
  const [recordVisibility, setRecordVisibility] =
    useState<RecordVisibility>("private");
  const [recordDate, setRecordDate] = useState(
    toDateKey(new Date()),
  );
  const [recordPhotos, setRecordPhotos] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [recordLocation, setRecordLocation] =
    useState<Coordinate | null>(null);
  const [recordLocationKind, setRecordLocationKind] =
    useState<RecordLocationKind | null>(null);
  const [recordPlaceCandidates, setRecordPlaceCandidates] =
    useState<PlaceCandidate[]>([]);
  const [recordSelectedPlace, setRecordSelectedPlace] =
    useState<PlaceCandidate | null>(null);
  const [recordPlaceSearch, setRecordPlaceSearch] =
    useState("");
  const [recordPlacesLoading, setRecordPlacesLoading] =
    useState(false);
  const [recordExternalPlaceSearch, setRecordExternalPlaceSearch] =
    useState<ActualPlaceSearchRequest | null>(null);
  const recordPlaceSearchSequenceRef = useRef(0);
  const [recordSaving, setRecordSaving] =
    useState(false);
  const [recordDetail, setRecordDetail] =
    useState<CompletedRecord | null>(null);

  const {
    pendingSharedMission,
    clearPendingSharedMission,
  } = useMission();

  const visibleRecordPlaceCandidates = useMemo(() => {
    const query = normalizeComparableText(recordPlaceSearch);

    if (!query) {
      return recordPlaceCandidates.slice(0, 30);
    }

    return recordPlaceCandidates
      .filter((place) =>
        normalizeComparableText(
          `${place.name} ${place.address ?? ""} ${place.districtName ?? ""}`,
        ).includes(query),
      )
      .slice(0, 30);
  }, [recordPlaceCandidates, recordPlaceSearch]);

  const locationRequested = useRef(false);
  const recommendationsInitialized = useRef(false);
  const recommendationsRef = useRef<HomeMission[]>([]);
  const recommendationRequestIdRef = useRef(0);
  const sheetTranslateY = useRef(
    new Animated.Value(COLLAPSED_POSITION),
  ).current;
  const dragStartPosition = useRef(
    COLLAPSED_POSITION,
  );
  const sectionIndicator = useRef(
    new Animated.Value(SECTION_INDEX.recommended),
  ).current;
  const sectionContentAnimation = useRef(
    new Animated.Value(1),
  ).current;
  const homeCardAnimation = useRef(
    new Animated.Value(0),
  ).current;

  useEffect(() => {
    recommendationsRef.current = missions;
  }, [missions]);

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

  const fetchRecommendations = useCallback(
    async ({
      filters,
      center,
      locationMode,
      radiusKm,
      district,
      locationHint,
      completedCount,
      showInitialLoading = false,
      avoidCurrent = false,
    }: {
      filters: RecommendationFilters;
      center: Coordinate | null;
      locationMode: LocationMode;
      radiusKm: RadiusKm;
      district: BusanDistrict | null;
      locationHint?: Coordinate | null;
      completedCount: number;
      showInitialLoading?: boolean;
      avoidCurrent?: boolean;
    }) => {
      const requestId = ++recommendationRequestIdRef.current;
      const previousRecommendations = avoidCurrent
        ? recommendationsRef.current
        : [];

      if (showInitialLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const timeOption = TIME_OPTIONS.find(
          (item) => item.value === filters.time,
        );
        const costOption = COST_OPTIONS.find(
          (item) => item.value === filters.cost,
        );
        const districtPolygons =
          locationMode === "district" && district
            ? await loadDistrictPolygons(district).catch((error) => {
                console.warn("선택 구 경계 로딩 실패:", error);
                return [] as DistrictPolygon[];
              })
            : [];

        const districtCenter =
          locationMode === "district" && district
            ? BUSAN_DISTRICT_CENTERS[district]
            : districtPolygons.length > 0
              ? getDistrictCenter(districtPolygons)
              : null;

        const effectiveCenter =
          locationMode === "radius"
            ? center ?? locationHint ?? null
            : locationMode === "any"
              ? locationHint ?? null
              : null;

        const effectiveRadiusKm =
          locationMode === "radius"
            ? radiusKm
            : DEFAULT_ANY_RADIUS_KM;

        const requestCoordinate =
          locationMode === "district"
            ? districtCenter ?? DEFAULT_CENTER
            : effectiveCenter;

        const placeSearchCenter =
          locationMode === "district"
            ? districtCenter ?? DEFAULT_CENTER
            : effectiveCenter;

        const availablePlaces = await fetchPlaceCandidates({
          center: placeSearchCenter,
          radiusKm:
            locationMode === "district"
              ? 20
              : effectiveRadiusKm,
          district:
            locationMode === "district" ? district : null,
          districtPolygons,
        });

        let interests = profileInterests;
        let journeyGoal = "";
        let likedCategories: CategoryName[] = [];
        let dislikedCategories: CategoryName[] = [];
        let likedMissionExamples: string[] = [];
        let dislikedMissionExamples: string[] = [];

        const {
          data: { user },
          error: personalizationUserError,
        } = await retrySupabaseResultOnJwt(() =>
          supabase.auth.getUser(),
        );

        if (personalizationUserError) {
          console.warn(
            "추천 개인화 사용자 조회 실패:",
            personalizationUserError,
          );
        }

        if (user) {
          if (
            filters.categories.length === 0 &&
            interests.length === 0
          ) {
            const { data: profile, error: profileError } =
              await retrySupabaseResultOnJwt(() =>
                supabase
                  .from("profiles")
                  .select("interests")
                  .eq("id", user.id)
                  .maybeSingle(),
              );

            if (profileError) {
              console.warn(
                "초기 관심 카테고리 조회 실패:",
                profileError,
              );
            } else {
              const rawInterests = normalizeStringArray(
                profile?.interests,
              );
              interests = Array.from(
                new Set(
                  rawInterests.map((interest) =>
                    normalizeCategory(interest, interest),
                  ),
                ),
              );
              setProfileInterests(interests);
            }
          }

          const todayKey = toDateKey(new Date());
          const { data: journeyPreferenceData, error: goalError } =
            await retrySupabaseResultOnJwt(() =>
              supabase
                .from("journeys")
                .select("id, goal")
                .eq("user_id", user.id)
                .eq("status", "active")
                .lte("start_date", todayKey)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            );

          if (goalError) {
            console.warn("여정 목표 조회 실패:", goalError);
          } else {
            journeyGoal = String(
              journeyPreferenceData?.goal ?? "",
            ).trim();
          }

          const { data: feedbackData, error: feedbackError } =
            await retrySupabaseResultOnJwt(() =>
              supabase
                .from("mission_feedback")
                .select(
                  "preference, mission_title, mission_category, journey_id, created_at",
                )
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(30),
            );

          if (feedbackError) {
            console.warn(
              "최근 미션 호불호 조회 실패:",
              feedbackError,
            );
          } else {
            const feedbackRows =
              (feedbackData ?? []) as MissionFeedbackRow[];
            const latestCategoryPreference = new Map<
              CategoryName,
              MissionPreferenceValue
            >();

            for (const row of feedbackRows) {
              const category = normalizeCategory(
                row.mission_category,
                row.mission_category,
              );

              if (!latestCategoryPreference.has(category)) {
                latestCategoryPreference.set(
                  category,
                  row.preference,
                );
              }
            }

            likedCategories = Array.from(
              latestCategoryPreference.entries(),
            )
              .filter(([, preference]) => preference === "like")
              .map(([category]) => category);
            dislikedCategories = Array.from(
              latestCategoryPreference.entries(),
            )
              .filter(
                ([, preference]) => preference === "dislike",
              )
              .map(([category]) => category);
            likedMissionExamples = feedbackRows
              .filter((row) => row.preference === "like")
              .map((row) => String(row.mission_title).trim())
              .filter(Boolean)
              .slice(0, 6);
            dislikedMissionExamples = feedbackRows
              .filter((row) => row.preference === "dislike")
              .map((row) => String(row.mission_title).trim())
              .filter(Boolean)
              .slice(0, 6);
          }
        }

        const personalizedInterests = Array.from(
          new Set([...likedCategories, ...interests]),
        ).filter(
          (category) => !dislikedCategories.includes(category),
        );

        const excludedMissionIds = previousRecommendations
          .map((mission) => mission.id)
          .filter(isUuid);
        const excludedTitles = previousRecommendations.map(
          (mission) => mission.title,
        );
        const excludedPlaceIds = previousRecommendations
          .map((mission) => mission.placeId)
          .filter((value): value is string => isUuid(value));
        const excludedPlaceNames = previousRecommendations
          .map((mission) => mission.placeName)
          .filter((value): value is string => Boolean(value));

        const requestBody = {
          category:
            filters.categories.length > 0
              ? filters.categories.join(", ")
              : "전체",
          categories:
            filters.categories.length > 0
              ? filters.categories
              : [...CATEGORIES],
          preferredCategories:
            filters.categories.length === 0
              ? personalizedInterests
              : filters.categories,
          interests,
          initialInterests: interests,
          journeyGoal,
          likedCategories,
          dislikedCategories,
          likedMissionExamples,
          dislikedMissionExamples,
          time:
            timeOption?.backendValue ?? "상관없음",
          estimatedDuration:
            timeOption?.backendValue ?? "상관없음",
          cost:
            costOption?.backendValue ?? "무료/유료",
          locationType: "실제 장소, 내 방 또는 어디서나 가능",
          actualPlaceRequired: false,
          flexiblePlaceAllowed: true,
          allowedLocationTypes: [
            "fixed",
            "home",
            "flexible",
          ],
          flexibleMissionLimit: 3,
          minimumFlexibleMissionCount: 2,
          availablePlaces: availablePlaces.slice(0, 100).map((place) => ({
            id: place.id,
            name: place.name,
            latitude: place.latitude,
            longitude: place.longitude,
            address: place.address,
            district: place.districtName,
            category: place.category,
            categoryName: place.kakaoCategoryName,
            categoryGroupCode: place.kakaoCategoryGroupCode,
            categoryGroupName: place.kakaoCategoryGroupName,
            foodOnly: place.foodOnly,
          })),
          latitude: requestCoordinate?.lat,
          longitude: requestCoordinate?.lng,
          locationMode:
            locationMode === "any"
              ? "radius"
              : locationMode,
          radiusKm:
            locationMode === "district"
              ? undefined
              : effectiveRadiusKm,
          radius_km:
            locationMode === "district"
              ? undefined
              : effectiveRadiusKm,
          district:
            locationMode === "district" && district
              ? `부산광역시 ${district}`
              : undefined,
          gu:
            locationMode === "district"
              ? district
              : undefined,
          sido:
            locationMode === "district"
              ? "부산광역시"
              : undefined,
          city:
            locationMode === "district"
              ? "부산광역시"
              : undefined,
          region_1depth_name:
            locationMode === "district"
              ? "부산광역시"
              : undefined,
          region_2depth_name:
            locationMode === "district"
              ? district
              : undefined,
          administrativeCode:
            locationMode === "district" && district
              ? BUSAN_DISTRICT_CODES[district]
              : undefined,
          categoryMode:
            filters.categories.length === 0
              ? "interest_weighted_diverse"
              : "selected_categories",
          categoryDiversityRequired: true,
          minimumCategoryCount: 4,
          maxPerCategory: 2,
          interestPreferenceRatio: 0.6,
          excludeMissionIds: excludedMissionIds,
          exclude_mission_ids: excludedMissionIds,
          excludeTitles: excludedTitles,
          excludePlaceIds: excludedPlaceIds,
          exclude_place_ids: excludedPlaceIds,
          excludePlaceNames: excludedPlaceNames,
          language: "ko",
          locale: "ko-KR",
          outputLanguage: "Korean",
          koreanOnly: true,
          homeMissionLimit: 2,
          atHomeMissionLimit: 2,
          includeRecommendationReason: true,
          recommendationReasonRequired: true,
          recommendationReasonInstruction:
            "각 미션마다 가장 핵심적인 추천 이유 하나만 recommendation_reason 필드에 가능하면 한 줄 분량의 짧은 한국어 한 문장으로 작성해주세요. 반드시 '~해요.', '~좋아요.', '~추천드려요.'처럼 높임말 완결형으로 끝내고, 말줄임표나 미완성 표현을 쓰지 마세요. 미션마다 서로 다른 이유를 쓰고 같은 문장을 반복하지 마세요.",
          generationInstruction:
            `제목, 설명, 미션 안내, 추천 이유를 모두 자연스러운 한국어로 작성하세요. instructions는 반드시 정확히 두 문장으로 작성하세요. 첫 문장은 무엇을 할지 부드러운 높임말로 안내하고, 둘째 문장은 그 경험의 기대나 매력을 높임말로 설명하세요. 번호, 불릿, 단계 나열, 세 번째 문장은 절대 쓰지 마세요. 추천 이유는 가능하면 한 줄 분량으로 짧게 쓰되 반드시 높임말 완결형으로 끝내고 말줄임표를 사용하지 마세요. 카테고리를 상관없음으로 선택했을 때는 이번 여정의 목표를 가장 우선하고, 최근 미션 호불호와 최초 관심 카테고리를 차례로 반영하세요. 다만 취향 밖의 카테고리도 일부 섞어 새로운 경험의 가능성을 남겨두세요. 가능한 경우 최소 4개 이상의 서로 다른 카테고리를 포함하고 같은 카테고리는 최대 2개까지만 포함하세요. 장소 유형은 세 가지입니다. 특정 장소 미션은 availablePlaces에 포함된 실제 장소의 이름과 ID를 사용하고, 반드시 그 장소의 category와 실제 수행 행동을 일치시키세요. 카페 및 디저트 장소에서는 메뉴·음료·디저트·맛·공간 분위기 미션만 만들고 명상·요가·운동·낮잠 미션은 만들지 마세요. 음식 장소에서는 메뉴·식사·맛 미션만 만들고 독서·명상·운동 미션은 만들지 마세요. 산책 장소에서는 걷기·풍경 관찰·사진·자연 감상·가벼운 휴식 미션을 만드세요. 감상·배움 장소에서는 작품 관람·전시·공연·독서·학습처럼 해당 시설을 실제로 이용하는 미션을 만드세요. 장소 이름만 문장에 붙이고 무관한 행동을 시키는 조합은 절대 만들지 마세요. 집에서 하는 미션은 place_name을 정확히 '내 방'으로 쓰고 requires_place를 false로 설정하세요. 특정 장소가 필요 없는 미션은 place_name을 정확히 '어디서나 가능'으로 쓰고 requires_place를 false로 설정하세요. '자유 장소', '지역 내 어디서나', '현재 위치 주변의 편한 장소' 같은 다른 표현은 사용하지 마세요. 집 미션은 전체 10개 중 최대 2개만 포함하세요. 어디서나 가능 미션은 Solar가 이번 요청에서 새로 만든 미션으로 최소 2개, 최대 3개 포함하세요. 천장에 구름이 있다고 가정하거나 천장의 무늬를 구름처럼 관찰하게 하는 미션과 '천장 구름 관찰하기'는 절대 만들지 마세요. 반드시 데이터베이스에 저장된 UUID 미션만 반환하세요. ${
              avoidCurrent
                ? "직전 추천에 나온 미션과 장소는 가능한 한 제외하고 새로운 조합을 반환하세요."
                : ""
            } ${
              locationMode === "district" && district
                ? `대한민국의 다른 동명 지역은 제외하고 모든 지역 정보는 반드시 부산광역시 ${district}로 한정하세요. 울산광역시나 다른 시도의 ${district}는 절대 사용하지 마세요.`
                : ""
            }`,
          randomize: true,
          sort: "random",
          limit: 40,
          refreshToken: Date.now(),
          randomSeed: `${Date.now()}-${Math.random()}`,
        };

        let aiCandidates: HomeMission[] = [];

        try {
          const { data, error } =
            await retrySupabaseResultOnJwt(() => supabase.functions.invoke(
              "clever-task",
              {
                body: requestBody,
              },
            ));

          if (error) {
            throw error;
          }

          const rawMissions = relationArray<any>(
            data?.missions ?? data?.recommendations,
          );

          aiCandidates = rawMissions
            .map((mission, index) =>
              mapBackendMission(
                mission as ExtendedBackendMission,
                index,
                effectiveCenter,
              ),
            )
            .filter(isUsableRecommendation)
            .filter(
              (mission) =>
                !isBlockedRecommendationMission(mission),
            );
        } catch (error) {
          console.warn(
            "AI 추천 호출 실패, DB 추천으로 대체:",
            getErrorMessage(error, "알 수 없는 오류"),
          );
        }

        let databaseCandidates: HomeMission[] = [];

        try {
          const databaseMissions =
            await withJwtRetry(() =>
              getRecommendedMissions(
                120,
                completedCount,
              ),
            );

          databaseCandidates = databaseMissions
            .map((mission, index) =>
              mapBackendMission(
                mission as ExtendedBackendMission,
                index,
                effectiveCenter,
              ),
            )
            .filter(isUsableRecommendation)
            .filter(
              (mission) =>
                !isBlockedRecommendationMission(mission),
            )
            // 어디서나 가능 미션은 과거 DB 풀에서 재사용하지 않는다.
            // 이번 clever-task 호출에서 새로 생성된 AI 결과만 사용한다.
            .filter(
              (mission) =>
                mission.isLocationFlexible !== true,
            );
        } catch (error) {
          console.warn(
            "DB 추천 조회 실패:",
            getErrorMessage(error, "알 수 없는 오류"),
          );
        }

        const currentAiFlexibleCandidates =
          aiCandidates.filter(
            (mission) =>
              mission.isLocationFlexible === true &&
              !isBlockedRecommendationMission(mission),
          );

        const hydratedCandidates = await hydrateMissionPlaces(
          dedupeMissions([
            ...aiCandidates,
            ...shuffle(databaseCandidates),
          ]),
          placeSearchCenter,
        );

        const placedCandidates = assignActualPlaces(
          hydratedCandidates,
          availablePlaces,
          placeSearchCenter,
        );

        const filtered = placedCandidates.filter((mission) =>
          !isBlockedRecommendationMission(mission) &&
          hasUsableMissionLocation(mission) &&
          missionMatchesFilters(
            mission,
            filters,
            effectiveCenter,
            effectiveRadiusKm,
            locationMode === "district" ? district : null,
            districtPolygons,
          ),
        );

        const categoryRankingInterests =
          filters.categories.length === 0
            ? personalizedInterests
            : filters.categories;

        const freshFirst = prioritizeFreshRecommendations({
          candidates: filtered,
          previous: previousRecommendations,
          interests: categoryRankingInterests,
          useInterestRanking:
            categoryRankingInterests.length > 0,
        });

        const preferenceRanked =
          rankMissionsByPreferenceSignals(
            freshFirst,
            interests,
            likedCategories,
            dislikedCategories,
          );

        const balanced = selectDiverseRecommendations({
          candidates: preferenceRanked,
          interests: categoryRankingInterests,
          locationMode,
          district,
          limit: 10,
        });

        const filteredAiFlexibleCandidates =
          currentAiFlexibleCandidates.filter((mission) =>
            filtered.some(
              (candidate) => candidate.id === mission.id,
            ),
          );
        const recommendationsWithAiFlexible =
          ensureCurrentAiFlexibleRecommendations({
            selected: balanced,
            aiFlexibleCandidates:
              filteredAiFlexibleCandidates,
            minimumCount: 2,
            limit: 10,
          });

        if (requestId === recommendationRequestIdRef.current) {
          setMissions(recommendationsWithAiFlexible);
        }
      } catch (error) {
        console.error("추천 미션 새로고침 실패:", error);
        Alert.alert(
          "추천 미션 불러오기 실패",
          getErrorMessage(
            error,
            "추천 미션을 새로 불러오지 못했습니다.",
          ),
        );
      } finally {
        if (requestId === recommendationRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [profileInterests],
  );

  const loadJourneyAndAttempts = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await retrySupabaseResultOnJwt(() => supabase.auth.getUser());

      if (userError) {
        throw userError;
      }

      if (!user) {
        setActiveJourney(null);
        setStartedAttempts({});
        setAttemptMissions({});
        setCompletedRecords([]);
        setCompletedMissionIds(new Set());
        setCompletedMissionCount(0);
        return;
      }

      const todayKey = toDateKey(new Date());
      const {
        data: journeyData,
        error: journeyError,
      } = await retrySupabaseResultOnJwt(() => supabase
        .from("journeys")
        .select("id, start_date, end_date, goal")
        .eq("user_id", user.id)
        .eq("status", "active")
        .lte("start_date", todayKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle());

      if (journeyError) {
        throw journeyError;
      }

      if (!journeyData) {
        setActiveJourney(null);
        setStartedAttempts({});
        setAttemptMissions({});
        setCompletedRecords([]);
        setCompletedMissionIds(new Set());
        setCompletedMissionCount(0);
        return;
      }

      const journey = {
        id: String(journeyData.id),
        startDate: String(journeyData.start_date),
        endDate: String(journeyData.end_date),
        goal: String(journeyData.goal ?? "").trim(),
      };
      setActiveJourney(journey);

      const {
        data: attemptRows,
        error: attemptsError,
      } = await retrySupabaseResultOnJwt(() => supabase
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
        .order("created_at", { ascending: false }));

      if (attemptsError) {
        throw attemptsError;
      }

      const attempts = attemptRows ?? [];
      const missionIds = [
        ...new Set(
          attempts
            .map((row) => String(row.mission_id))
            .filter(Boolean),
        ),
      ];
      const placeIds = [
        ...new Set(
          attempts
            .map((row) =>
              row.place_id ? String(row.place_id) : "",
            )
            .filter(Boolean),
        ),
      ];

      const placeMap: Record<
        string,
        {
          id: string;
          name: string | null;
          latitude: number | null;
          longitude: number | null;
          category?: string | null;
          category_name?: string | null;
          category_group_code?: string | null;
          category_group_name?: string | null;
          kakao_category_name?: string | null;
          kakao_category_group_code?: string | null;
          kakao_category_group_name?: string | null;
        }
      > = {};

      if (placeIds.length > 0) {
        let placeRows: any[] = [];
        const detailedPlaceResult = await retrySupabaseResultOnJwt(() => supabase
          .from("places")
          .select(
            "id, name, latitude, longitude, category, category_name, category_group_code, category_group_name, kakao_category_name, kakao_category_group_code, kakao_category_group_name",
          )
          .in("id", placeIds));

        if (!detailedPlaceResult.error) {
          placeRows = detailedPlaceResult.data ?? [];
        } else {
          const existingCategoryResult = await retrySupabaseResultOnJwt(() => supabase
            .from("places")
            .select("id, name, latitude, longitude, category, category_name")
            .in("id", placeIds));

          if (!existingCategoryResult.error) {
            placeRows = existingCategoryResult.data ?? [];
          } else {
            const basicPlaceResult = await retrySupabaseResultOnJwt(() => supabase
              .from("places")
              .select("id, name, latitude, longitude")
              .in("id", placeIds));

            if (basicPlaceResult.error) {
              console.warn("장소 정보 조회 실패:", basicPlaceResult.error);
            } else {
              placeRows = basicPlaceResult.data ?? [];
            }
          }
        }

        for (const place of placeRows) {
          placeMap[String(place.id)] = {
            id: String(place.id),
            name: place.name ?? null,
            latitude: toFiniteNumber(place.latitude),
            longitude: toFiniteNumber(place.longitude),
            category: place.category ?? null,
            category_name: place.category_name ?? null,
            category_group_code: place.category_group_code ?? null,
            category_group_name: place.category_group_name ?? null,
            kakao_category_name: place.kakao_category_name ?? null,
            kakao_category_group_code:
              place.kakao_category_group_code ?? null,
            kakao_category_group_name:
              place.kakao_category_group_name ?? null,
          };
        }
      }

      const missionPairs = await Promise.all(
        missionIds.map(async (missionId) => {
          try {
            const mission = await withJwtRetry(() =>
              getMissionById(missionId),
            );
            const attemptWithPlace = attempts.find(
              (row) =>
                String(row.mission_id) === missionId &&
                row.place_id,
            );
            const place = attemptWithPlace?.place_id
              ? placeMap[String(attemptWithPlace.place_id)]
              : null;

            const loadedMission = mapBackendMission(
              mission as ExtendedBackendMission,
              0,
              recommendationCenter ?? userLocation,
              place,
            );
            const cachedMission = recommendationsRef.current.find(
              (candidate) => candidate.id === missionId,
            );

            return [
              missionId,
              mergeActiveMissionPlaceSnapshot(
                loadedMission,
                cachedMission,
              ),
            ] as const;
          } catch (error) {
            console.warn(
              `미션 ${missionId} 상세 조회 실패:`,
              getErrorMessage(error, "알 수 없는 오류"),
            );
            return null;
          }
        }),
      );

      const nextMissionMap: Record<string, HomeMission> = {};
      for (const pair of missionPairs) {
        if (pair) {
          nextMissionMap[pair[0]] = pair[1];
        }
      }

      const nextStartedAttempts: Record<
        string,
        StartedAttempt
      > = {};
      const nextCompletedMissionIds = new Set<string>();
      const completedAttemptIds: string[] = [];
      const completedAttemptMissionMap: Record<
        string,
        string
      > = {};

      for (const row of attempts) {
        const missionId = String(row.mission_id);
        const attemptId = String(row.id);

        if (row.status === "completed") {
          nextCompletedMissionIds.add(missionId);
          completedAttemptIds.push(attemptId);
          completedAttemptMissionMap[attemptId] = missionId;
          continue;
        }

        if (!nextStartedAttempts[missionId]) {
          nextStartedAttempts[missionId] = {
            id: attemptId,
            journeyId: String(row.journey_id),
            missionId,
            placeId: row.place_id
              ? String(row.place_id)
              : null,
            createdAt: String(row.created_at),
          };
        }
      }

      const nextCompletedRecords: CompletedRecord[] = [];

      if (completedAttemptIds.length > 0) {
        const { data: recordRows, error: recordError } =
          await retrySupabaseResultOnJwt(() => supabase
            .from("records")
            .select(`
              id,
              mission_attempt_id,
              content,
              emotion,
              visibility,
              recorded_at,
              location_latitude,
              location_longitude,
              record_photos (
                storage_path,
                sort_order,
                is_cover
              )
            `)
            .eq("user_id", user.id)
            .in("mission_attempt_id", completedAttemptIds)
            .order("recorded_at", { ascending: false }));

        if (recordError) {
          throw recordError;
        }

        for (const record of recordRows ?? []) {
          const attemptId = String(
            record.mission_attempt_id,
          );
          const missionId =
            completedAttemptMissionMap[attemptId];

          if (!missionId) {
            continue;
          }

          const photos = relationArray<any>(
            record.record_photos,
          ).sort((a, b) => {
            if (Boolean(a.is_cover) !== Boolean(b.is_cover)) {
              return a.is_cover ? -1 : 1;
            }
            return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
          });
          const photoUrls = (
            await Promise.all(
              photos.map(async (photo) => {
                const storagePath = String(
                  photo.storage_path ?? "",
                );

                if (!storagePath) {
                  return null;
                }

                const { data, error } =
                  await retrySupabaseResultOnJwt(() => supabase.storage
                    .from("record-photos")
                    .createSignedUrl(storagePath, 3600));

                if (error) {
                  console.warn(
                    "기록 사진 URL 생성 실패:",
                    error,
                  );
                  return null;
                }

                return data.signedUrl;
              }),
            )
          ).filter((url): url is string => Boolean(url));

          nextCompletedRecords.push({
            id: String(record.id),
            attemptId,
            missionId,
            content: String(record.content ?? ""),
            emotion: record.emotion as EmotionValue,
            visibility:
              record.visibility === "private" ? "private" : "nickname",
            recordedAt: String(record.recorded_at),
            photoUrls,
            locationLat: toFiniteNumber(record.location_latitude),
            locationLng: toFiniteNumber(record.location_longitude),
          });
        }
      }

      setStartedAttempts(nextStartedAttempts);
      setAttemptMissions(nextMissionMap);
      setCompletedRecords(nextCompletedRecords);
      setCompletedMissionIds(nextCompletedMissionIds);
      setCompletedMissionCount(nextCompletedRecords.length);
    } catch (error) {
      console.error("미션 상태 조회 실패:", error);
    }
  }, [recommendationCenter, userLocation]);

  useFocusEffect(
    useCallback(() => {
      void loadJourneyAndAttempts();
    }, [loadJourneyAndAttempts]),
  );

  useEffect(() => {
    if (recommendationsInitialized.current) {
      return;
    }

    recommendationsInitialized.current = true;

    const initialize = async () => {
      let coordinate: Coordinate | null = null;

      try {
        if (!locationRequested.current) {
          locationRequested.current = true;
          const { status } =
            await Location.requestForegroundPermissionsAsync();

          if (status === "granted") {
            const location =
              await Location.getCurrentPositionAsync({});
            coordinate = {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            };
            setUserLocation(coordinate);
          }
        }
      } catch (error) {
        console.warn("현재 위치 조회 실패:", error);
      }

      await fetchRecommendations({
        filters: DEFAULT_FILTERS,
        center: null,
        locationMode: "any",
        radiusKm: DEFAULT_ANY_RADIUS_KM,
        district: null,
        locationHint: coordinate,
        completedCount: 0,
        showInitialLoading: true,
      });
    };

    void initialize();
  }, [fetchRecommendations]);

  useEffect(() => {
    if (!pendingSharedMission) {
      return;
    }

    const shared = pendingSharedMission as any;
    const sharedTitle = String(shared.title);
    const sharedDescription = String(
      shared.desc ?? shared.shortDescription ?? "",
    );
    const sharedInstructions = String(
      shared.instructions ?? shared.desc ?? "",
    );
    const sharedCategory = normalizeCategory(
      shared.cat,
      `${sharedTitle} ${sharedDescription} ${sharedInstructions}`,
    );
    const sharedIsAtHome =
      shared.isAtHome === true ||
      normalizeComparableText(shared.placeName) === "내방" ||
      /(내 방|내 집|집에서|집 안|방에서|자택)/.test(
        `${sharedTitle} ${sharedDescription} ${sharedInstructions}`,
      );
    const sharedIsLocationFlexible =
      !sharedIsAtHome &&
      (shared.isLocationFlexible === true ||
        shared.requiresPlace === false ||
        shared.requires_place === false ||
        normalizeComparableText(shared.placeName) ===
          "어디서나가능");

    const missionToAdd: HomeMission = {
      id: String(shared.id),
      title: sharedTitle,
      desc: sharedDescription,
      instructions: sharedInstructions,
      recommendationReason: String(
        shared.recommendationReason ??
          buildMissionSpecificRecommendationReason({
            title: sharedTitle,
            category: sharedCategory,
            placeName: sharedIsAtHome
              ? "내 방"
              : sharedIsLocationFlexible
                ? "어디서나 가능"
                : shared.placeName,
            time: String(shared.time ?? "시간 자유"),
            cost:
              shared.cost === "무료" ||
              shared.cost === "유료" ||
              shared.cost === "유료/무료"
                ? shared.cost
                : "유료/무료",
            isAtHome: sharedIsAtHome,
          }),
      ),
      durationMinutes:
        toFiniteNumber(shared.durationMinutes) ??
        parseDurationMinutes(shared.time),
      time: String(
        shared.time ??
          (toFiniteNumber(shared.durationMinutes) !== null
            ? `${toFiniteNumber(shared.durationMinutes)}분`
            : "시간 자유"),
      ),
      dist: sharedIsAtHome
        ? "내 방"
        : sharedIsLocationFlexible
          ? "어디서나 가능"
          : String(shared.dist ?? "거리 정보 없음"),
      cost:
        shared.cost === "무료" ||
        shared.cost === "유료" ||
        shared.cost === "유료/무료"
          ? shared.cost
          : "유료/무료",
      cat: sharedCategory,
      requiredItems: Array.isArray(
        shared.requiredItems,
      )
        ? shared.requiredItems
        : [],
      placeId:
        sharedIsAtHome || sharedIsLocationFlexible
          ? undefined
          : shared.placeId,
      placeLat:
        sharedIsAtHome || sharedIsLocationFlexible
          ? undefined
          : toFiniteNumber(shared.placeLat) ?? undefined,
      placeLng:
        sharedIsAtHome || sharedIsLocationFlexible
          ? undefined
          : toFiniteNumber(shared.placeLng) ?? undefined,
      placeName: sharedIsAtHome
        ? "내 방"
        : sharedIsLocationFlexible
          ? "어디서나 가능"
          : shared.placeName,
      placeAddress:
        sharedIsAtHome || sharedIsLocationFlexible
          ? undefined
          : shared.placeAddress,
      districtName:
        sharedIsAtHome || sharedIsLocationFlexible
          ? undefined
          : shared.districtName,
      isAtHome: sharedIsAtHome,
      isLocationFlexible: sharedIsLocationFlexible,
      isFallback: !isUuid(String(shared.id)),
    };

    setMissions((previous) => {
      const exists = previous.some(
        (mission) => mission.id === missionToAdd.id,
      );

      return exists
        ? previous.map((mission) =>
            mission.id === missionToAdd.id
              ? missionToAdd
              : mission,
          )
        : [missionToAdd, ...previous];
    });
    setSheetSection("recommended");
    sectionIndicator.setValue(
      SECTION_INDEX.recommended,
    );
    setSelectedItemKey(
      `recommended:${missionToAdd.id}`,
    );
    moveSheet(COLLAPSED_POSITION);
    clearPendingSharedMission();
  }, [
    clearPendingSharedMission,
    moveSheet,
    pendingSharedMission,
    sectionIndicator,
  ]);

  const activeItems = useMemo<MissionListItem[]>(() => {
      const sortedAttempts = Object.values(startedAttempts).sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt),
      );

      const items: MissionListItem[] = [];

      for (const attempt of sortedAttempts) {
        const mission =
          attemptMissions[attempt.missionId] ??
          missions.find((item) => item.id === attempt.missionId);

        if (mission) {
          items.push({
            key: `active:${attempt.id}`,
            kind: "active" as const,
            mission,
            attempt,
          });
        }
      }

      return items;
    }, [attemptMissions, missions, startedAttempts]);

    const recommendedItemsWithHome = useMemo<MissionListItem[]>(
      () =>
        missions
          .filter(
            (mission) =>
              !startedAttempts[mission.id] &&
              !completedMissionIds.has(mission.id),
          )
          .map((mission) => ({
            key: `recommended:${mission.id}`,
            kind: "recommended" as const,
            mission,
          })),
      [completedMissionIds, missions, startedAttempts],
    );

  // 하단 추천 미션 슬라이드에는 "내 방" 미션을 노출하지 않는다.
  // 내 방 미션은 우측 상단 "내 방 미션" 버튼을 눌렀을 때만 보여준다.
  const recommendedItems = useMemo<MissionListItem[]>(
    () =>
      recommendedItemsWithHome.filter(
        (item) => item.mission.isAtHome !== true,
      ),
    [recommendedItemsWithHome],
  );

  const recordItems = useMemo<MissionListItem[]>(() => {
      const items: MissionListItem[] = [];

      for (const record of completedRecords) {
        const mission =
          attemptMissions[record.missionId] ??
          missions.find((item) => item.id === record.missionId);

        if (mission) {
          items.push({
            key: `record:${record.attemptId}`,
            kind: "record" as const,
            mission,
            record,
          });
        }
      }

      return items;
    }, [attemptMissions, completedRecords, missions]);
  const recordDateOptions = useMemo(() => {
    if (!recordMission || !activeJourney) {
      return [];
    }

    const todayKey = toDateKey(new Date());
    const latestDate =
      activeJourney.endDate < todayKey
        ? activeJourney.endDate
        : todayKey;

    return getDateKeysBetween(
      activeJourney.startDate,
      latestDate,
    );
  }, [activeJourney, recordMission]);

  const currentItems =
    sheetSection === "active"
      ? activeItems
      : sheetSection === "recommended"
        ? recommendedItems
        : recordItems;

  const currentSectionTitle =
    sheetSection === "active"
      ? "현재 진행중인 미션"
      : sheetSection === "recommended"
        ? "추천 미션"
        : "내가 쓴 기록";

  const currentSectionSub =
    sheetSection === "recommended"
      ? `${getConditionSummary(
          appliedFilters,
          recommendationLocationMode,
          recommendationCenter,
          recommendationRadiusKm,
          recommendationDistrict,
        )} · ${recommendedItems.length}개`
      : sheetSection === "active"
        ? `${activeItems.length}개의 미션을 진행하고 있어요`
        : `${recordItems.length}개의 기록을 남겼어요`;

  const changeSection = (next: SheetSection) => {
    if (next === sheetSection) {
      return;
    }

    Animated.spring(sectionIndicator, {
      toValue: SECTION_INDEX[next],
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.8,
    }).start();

    Animated.timing(sectionContentAnimation, {
      toValue: 0,
      duration: 90,
      useNativeDriver: true,
    }).start(() => {
      setSelectedItemKey(null);
      setHomeMissionPanelOpen(false);
      setSheetSection(next);
      sectionContentAnimation.setValue(0);

      Animated.timing(sectionContentAnimation, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const toggleSheet = () => {
    sheetTranslateY.stopAnimation((currentPosition) => {
      const isCollapsed =
        currentPosition > COLLAPSED_POSITION / 2;
      moveSheet(isCollapsed ? 0 : COLLAPSED_POSITION);
    });
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

    moveSheet(
      currentPosition < COLLAPSED_POSITION / 2
        ? 0
        : COLLAPSED_POSITION,
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dy) > 2,
      onMoveShouldSetPanResponderCapture: (
        _event,
        gesture,
      ) => Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation(
          (currentPosition) => {
            dragStartPosition.current = currentPosition;
          },
        );
      },
      onPanResponderMove: (_event, gesture) => {
        const nextPosition =
          dragStartPosition.current + gesture.dy;
        sheetTranslateY.setValue(
          Math.max(
            0,
            Math.min(
              nextPosition,
              COLLAPSED_POSITION,
            ),
          ),
        );
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
      onPanResponderTerminate: (_event, gesture) => {
        const currentPosition = Math.max(
          0,
          Math.min(
            dragStartPosition.current + gesture.dy,
            COLLAPSED_POSITION,
          ),
        );
        finishDrag(currentPosition, gesture.vy);
      },
      onPanResponderTerminationRequest: () => false,
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

  const selectListItem = (item: MissionListItem) => {
    if (selectedItemKey === item.key) {
      if (item.mission.isAtHome) {
        setHomeMissionPanelOpen(true);
      }
      moveSheet(COLLAPSED_POSITION);
      return;
    }

    LayoutAnimation.configureNext(
      LayoutAnimation.Presets.easeInEaseOut,
    );

    if (item.mission.isAtHome) {
      homeCardAnimation.stopAnimation();
      homeCardAnimation.setValue(0);
      setHomeMissionPanelOpen(true);
    } else {
      homeCardAnimation.setValue(0);
      setHomeMissionPanelOpen(false);
    }

    setSelectedItemKey(item.key);
    moveSheet(COLLAPSED_POSITION);
  };

  const openHomeMissionPanel = () => {
    homeCardAnimation.stopAnimation();
    homeCardAnimation.setValue(0);
    setSelectedItemKey(null);
    setHomeMissionPanelOpen(true);
    moveSheet(COLLAPSED_POSITION);
  };

  const closeSelectedItem = () => {
    if (!selectedItemKey && !homeMissionPanelOpen) {
      return;
    }

    LayoutAnimation.configureNext(
      LayoutAnimation.Presets.easeInEaseOut,
    );
    homeCardAnimation.setValue(0);
    setHomeMissionPanelOpen(false);
    setSelectedItemKey(null);
  };

  const handleMarkerPress = (markerId: string | number) => {
    const missionId = String(markerId);
    const item = currentItems.find(
      (candidate) => candidate.mission.id === missionId,
    );

    if (item) {
      selectListItem(item);
    }
  };

  const handleMissionItemAction = (item: MissionListItem) => {
    if (item.kind === "recommended") {
      void handleStartMission(item.mission);
      return;
    }

    if (item.kind === "active") {
      openRecordModal(item.mission);
      return;
    }

    if (item.record) {
      setRecordDetail(item.record);
    }
  };

  const handleMarkerAction = (markerId: string | number) => {
    const missionId = String(markerId);
    const item = currentItems.find(
      (candidate) => candidate.mission.id === missionId,
    );

    if (!item) {
      return;
    }

    handleMissionItemAction(item);
  };

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

  const params = useLocalSearchParams<{ openCondition?: string }>();

  useEffect(() => {
    if (params.openCondition === "1") {
      openConditionModal(0);
    }
  }, [params.openCondition]);

  const applyConditions = async () => {
    if (
      draftLocationMode === "radius" &&
      !draftCenter
    ) {
      Alert.alert(
        "중심 위치를 선택해주세요",
        "지도에서 추천 범위의 중심이 될 위치를 눌러주세요.",
      );
      setConditionStep(0);
      return;
    }

    if (
      draftLocationMode === "district" &&
      !draftDistrict
    ) {
      Alert.alert(
        "구를 선택해주세요",
        "추천받을 부산광역시 구·군을 하나 선택해주세요.",
      );
      setConditionStep(0);
      return;
    }

    const nextFilters: RecommendationFilters = {
      categories: draftCategories,
      time: draftTime,
      cost: draftCost,
    };

    setAppliedFilters(nextFilters);
    setRecommendationCenter(
      draftLocationMode === "radius" ? draftCenter : null,
    );
    setRecommendationLocationMode(draftLocationMode);
    setRecommendationRadiusKm(draftRadiusKm);
    setRecommendationDistrict(
      draftLocationMode === "district"
        ? draftDistrict
        : null,
    );
    setConditionVisible(false);
    setSelectedItemKey(null);
    setHomeMissionPanelOpen(false);
    changeSection("recommended");

    await fetchRecommendations({
      filters: nextFilters,
      center:
        draftLocationMode === "radius"
          ? draftCenter
          : null,
      locationMode: draftLocationMode,
      radiusKm: draftRadiusKm,
      district:
        draftLocationMode === "district"
          ? draftDistrict
          : null,
      locationHint: userLocation,
      completedCount: completedMissionCount,
      avoidCurrent: true,
    });
  };

  const refreshRecommendations = async () => {
    setSelectedItemKey(null);
    setHomeMissionPanelOpen(false);
    await fetchRecommendations({
      filters: appliedFilters,
      center: recommendationCenter,
      locationMode: recommendationLocationMode,
      radiusKm: recommendationRadiusKm,
      district: recommendationDistrict,
      locationHint: userLocation,
      completedCount: completedMissionCount,
      avoidCurrent: true,
    });
  };

  const handleStartMission = async (
    mission: HomeMission,
  ) => {
    if (startedAttempts[mission.id]) {
      changeSection("active");
      return;
    }

    if (!activeJourney) {
      Alert.alert(
        "여정이 필요해요",
        "캘린더에서 여정 기간을 먼저 선택해주세요.",
      );
      return;
    }

    if (mission.isFallback || !isUuid(mission.id)) {
      Alert.alert(
        "임시 미션이에요",
        "AI 또는 데이터베이스에 저장된 실제 미션만 시작할 수 있어요.",
      );
      return;
    }

    try {
      setStartLoadingId(mission.id);

      const {
        data: { user },
        error: userError,
      } = await retrySupabaseResultOnJwt(() => supabase.auth.getUser());

      if (userError) {
        throw userError;
      }
      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }

      const placeId = isUuid(mission.placeId)
        ? mission.placeId
        : null;
      const {
        data: existingAttempt,
        error: existingError,
      } = await retrySupabaseResultOnJwt(() => supabase
        .from("mission_attempts")
        .select(
          "id, journey_id, mission_id, place_id, created_at",
        )
        .eq("user_id", user.id)
        .eq("journey_id", activeJourney.id)
        .eq("mission_id", mission.id)
        .in("status", ["selected", "started"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle());

      if (existingError) {
        throw existingError;
      }

      let attempt = existingAttempt;

      if (!attempt) {
        const now = new Date().toISOString();
        const {
          data: insertedAttempt,
          error: insertError,
        } = await retrySupabaseResultOnJwt(() => supabase
          .from("mission_attempts")
          .insert({
            user_id: user.id,
            journey_id: activeJourney.id,
            mission_id: mission.id,
            place_id: placeId,
            status: "selected",
            selected_at: now,
          })
          .select(
            "id, journey_id, mission_id, place_id, created_at",
          )
          .single());

        if (insertError) {
          throw insertError;
        }

        attempt = insertedAttempt;
      }

      if (!attempt) {
        throw new Error(
          "생성된 미션 시도를 확인하지 못했습니다.",
        );
      }

      const startedAttempt: StartedAttempt = {
        id: String(attempt.id),
        journeyId: String(attempt.journey_id),
        missionId: String(attempt.mission_id),
        placeId: attempt.place_id
          ? String(attempt.place_id)
          : null,
        createdAt: String(
          attempt.created_at ?? new Date().toISOString(),
        ),
      };

      setStartedAttempts((previous) => ({
        ...previous,
        [mission.id]: startedAttempt,
      }));
      setAttemptMissions((previous) => ({
        ...previous,
        [mission.id]: mission,
      }));
      setSelectedItemKey(null);
      setHomeMissionPanelOpen(false);
      changeSection("active");
      moveSheet(0);
    } catch (error) {
      console.error("미션 시작 실패:", error);
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

      if (errorCode === "23505") {
        await loadJourneyAndAttempts();
        Alert.alert(
          "이미 시작한 미션이에요",
          "현재 진행중인 미션 탭에서 확인해주세요.",
        );
        changeSection("active");
        return;
      }

      Alert.alert("미션 시작 실패", errorMessage);
    } finally {
      setStartLoadingId(null);
    }
  };

  const openRecordModal = (mission: HomeMission) => {
    const attempt = startedAttempts[mission.id];

    if (!attempt) {
      Alert.alert(
        "미션을 먼저 시작해주세요",
        "미션 시작 후 기록을 남길 수 있어요.",
      );
      return;
    }

    const todayKey = toDateKey(new Date());
    const earliestDate =
      activeJourney?.startDate ?? todayKey;
    const journeyEndDate =
      activeJourney?.endDate ?? todayKey;
    const latestDate =
      journeyEndDate < todayKey
        ? journeyEndDate
        : todayKey;

    if (earliestDate > latestDate) {
      Alert.alert(
        "선택 가능한 날짜가 없어요",
        "여정 시작 날짜와 종료 날짜를 확인해주세요.",
      );
      return;
    }

    setRecordMission(mission);
    setRecordContent("");
    setRecordEmotion("");
    setRecordPreference("");
    setRecordVisibility("private");
    setRecordDate(latestDate);
    setRecordPhotos([]);
    setRecordLocation(null);
    setRecordLocationKind(null);
    setRecordPlaceCandidates([]);
    setRecordSelectedPlace(null);
    setRecordPlaceSearch("");
    setRecordPlacesLoading(false);
    setRecordExternalPlaceSearch(null);
  };

  const closeRecordModal = (force = false) => {
    if (recordSaving && !force) {
      return;
    }

    setRecordMission(null);
    setRecordContent("");
    setRecordEmotion("");
    setRecordPreference("");
    setRecordVisibility("private");
    setRecordDate(toDateKey(new Date()));
    setRecordPhotos([]);
    setRecordLocation(null);
    setRecordLocationKind(null);
    setRecordPlaceCandidates([]);
    setRecordSelectedPlace(null);
    setRecordPlaceSearch("");
    setRecordPlacesLoading(false);
    setRecordExternalPlaceSearch(null);
  };

  const handleRecordPlaceMapSelect = async (
    coordinate: Coordinate,
  ) => {
    const requestId = ++recordPlaceSearchSequenceRef.current;

    // 발견 탭과 동일하게, 먼저 누른 지점에 핀을 남긴다.
    setRecordLocation(coordinate);
    setRecordSelectedPlace(null);
    setRecordPlaceCandidates([]);
    setRecordPlaceSearch("");
    setRecordPlacesLoading(true);

    try {
      const candidates =
        await searchNearbyKakaoPlacesForRecord(coordinate);

      if (requestId !== recordPlaceSearchSequenceRef.current) {
        return;
      }

      setRecordPlaceCandidates(candidates);

      if (candidates.length === 0) {
        Alert.alert(
          "주변 장소를 찾지 못했어요",
          "다른 위치를 누르거나 장소명이 없는 곳이라면 ‘길 위·야외’를 선택해주세요.",
        );
      }
    } catch (error) {
      if (requestId !== recordPlaceSearchSequenceRef.current) {
        return;
      }

      console.error("기록 장소 검색 실패:", error);
      Alert.alert(
        "장소 검색에 실패했어요",
        getErrorMessage(
          error,
          "잠시 후 다시 시도하거나 ‘길 위·야외’를 선택해주세요.",
        ),
      );
    } finally {
      if (requestId === recordPlaceSearchSequenceRef.current) {
        setRecordPlacesLoading(false);
      }
    }
  };

  const chooseRecordLocationKind = (kind: RecordLocationKind) => {
    // 이전 위치 검색 응답이 늦게 도착해 새 선택을 덮어쓰지 않게 무효화한다.
    recordPlaceSearchSequenceRef.current += 1;
    setRecordLocationKind(kind);
    setRecordLocation(null);
    setRecordSelectedPlace(null);
    setRecordPlaceCandidates([]);
    setRecordPlaceSearch("");
    setRecordPlacesLoading(false);
  };

  const addRecordPhotos = (
    photos: ImagePicker.ImagePickerAsset[],
  ) => {
    setRecordPhotos((previous) => {
      const combined = [...previous];

      for (const photo of photos) {
        if (
          !combined.some(
            (item) => item.uri === photo.uri,
          )
        ) {
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
          ...(Platform.OS === "ios"
            ? {
                preferredAssetRepresentationMode:
                  ImagePicker.UIImagePickerPreferredAssetRepresentationMode
                    .Compatible,
              }
            : {}),
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
          ...(Platform.OS === "ios"
            ? {
                preferredAssetRepresentationMode:
                  ImagePicker.UIImagePickerPreferredAssetRepresentationMode
                    .Compatible,
              }
            : {}),
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
      for (
        let index = 0;
        index < photos.length;
        index += 1
      ) {
        const photo = photos[index];
        const preparedPhoto =
          await prepareRecordPhotoForUpload(photo);
        const { extension, contentType, uri } = preparedPhoto;
        const uniquePart = `${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const storagePath = `${userId}/${recordId}/${uniquePart}.${extension}`;
        const response = await fetch(uri);

        if (!response.ok) {
          throw new Error(
            "선택한 사진 파일을 읽지 못했습니다.",
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const { error: uploadError } =
          await retrySupabaseResultOnJwt(() => supabase.storage
            .from("record-photos")
            .upload(storagePath, arrayBuffer, {
              contentType,
              cacheControl: "3600",
              upsert: false,
            }));

        if (uploadError) {
          throw uploadError;
        }

        uploadedPaths.push(storagePath);
      }

      const { error: rowsError } = await retrySupabaseResultOnJwt(() => supabase
        .from("record_photos")
        .insert(
          uploadedPaths.map((storagePath, index) => ({
            record_id: recordId,
            storage_path: storagePath,
            sort_order: index,
            is_cover: index === 0,
          })),
        ));

      if (rowsError) {
        throw rowsError;
      }
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await retrySupabaseResultOnJwt(() => supabase.storage
          .from("record-photos")
          .remove(uploadedPaths));
      }
      throw error;
    }
  };

  const handleSaveRecord = async () => {
    if (!recordMission) {
      return;
    }

    const attempt = startedAttempts[recordMission.id];

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

    if (!recordPreference) {
      Alert.alert(
        "미션 만족도를 선택해주세요",
        "이 미션을 다음에도 추천할지 알려주세요.",
      );
      return;
    }

    const selectedPreference =
      recordPreference as MissionPreferenceValue;

    if (
      !recordDate ||
      !recordDateOptions.includes(recordDate)
    ) {
      Alert.alert(
        "수행 날짜를 선택해주세요",
        "미션을 수행한 날짜를 다시 선택해주세요.",
      );
      return;
    }

    if (recordMission.isLocationFlexible && !recordLocationKind) {
      Alert.alert(
        "수행 위치를 선택해주세요",
        "실제 장소, 길 위·야외, 내 방 중 하나를 골라주세요.",
      );
      return;
    }

    if (
      recordMission.isLocationFlexible &&
      recordLocationKind === "place" &&
      !recordSelectedPlace
    ) {
      Alert.alert(
        "장소를 선택해주세요",
        "목록에서 실제로 미션을 수행한 장소를 골라주세요.",
      );
      return;
    }

    if (
      recordMission.isLocationFlexible &&
      recordLocationKind === "map" &&
      !recordLocation
    ) {
      Alert.alert(
        "위치를 선택해주세요",
        "지도에서 미션을 수행한 위치를 한 번 눌러주세요.",
      );
      return;
    }

    const selectedPlaceId = recordMission.isLocationFlexible
      ? recordLocationKind === "place" &&
        recordSelectedPlace &&
        isUuid(recordSelectedPlace.id)
        ? recordSelectedPlace.id
        : null
      : attempt.placeId;

    let selectedCoordinate: Coordinate | null =
      recordMission.isLocationFlexible
        ? recordLocationKind === "place" && recordSelectedPlace
          ? {
              lat: recordSelectedPlace.latitude,
              lng: recordSelectedPlace.longitude,
            }
          : recordLocationKind === "map"
            ? recordLocation
            : null
        : isFiniteNumber(recordMission.placeLat) &&
            isFiniteNumber(recordMission.placeLng)
          ? {
              lat: recordMission.placeLat,
              lng: recordMission.placeLng,
            }
          : null;

    let selectedPlaceName = recordMission.isLocationFlexible
      ? recordLocationKind === "place"
        ? recordSelectedPlace?.name ?? "선택한 장소"
        : recordLocationKind === "map"
          ? "길 위의 기록"
          : "내 방"
      : recordMission.placeName ?? "미션 수행 장소";

    try {
      setRecordSaving(true);
      const {
        data: { user },
        error: userError,
      } = await retrySupabaseResultOnJwt(() => supabase.auth.getUser());

      if (userError) {
        throw userError;
      }
      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }

      // 고정 장소 미션의 화면 스냅샷에 장소명이 빠져 있더라도
      // mission_attempts.place_id에 연결된 실제 places 행을 사용한다.
      const selectedPlaceNameKey = normalizeComparableText(
        selectedPlaceName,
      );
      const needsFixedPlaceSnapshot =
        !recordMission.isLocationFlexible &&
        !recordMission.isAtHome &&
        Boolean(attempt.placeId) &&
        (
          !selectedPlaceNameKey ||
          selectedPlaceNameKey === "미션수행장소" ||
          selectedPlaceNameKey === "장소정보없음" ||
          !selectedCoordinate
        );

      if (needsFixedPlaceSnapshot) {
        const { data: actualPlace, error: actualPlaceError } =
          await retrySupabaseResultOnJwt(() =>
            supabase
              .from("places")
              .select("name, latitude, longitude")
              .eq("id", attempt.placeId!)
              .maybeSingle(),
          );

        if (actualPlaceError) {
          console.warn(
            "미션 수행 장소 보완 실패:",
            actualPlaceError,
          );
        } else if (actualPlace) {
          const actualPlaceName = String(
            actualPlace.name ?? "",
          ).trim();
          const actualPlaceLat = toFiniteNumber(
            actualPlace.latitude,
          );
          const actualPlaceLng = toFiniteNumber(
            actualPlace.longitude,
          );

          if (actualPlaceName) {
            selectedPlaceName = actualPlaceName;
          }
          if (
            actualPlaceLat !== null &&
            actualPlaceLng !== null
          ) {
            selectedCoordinate = {
              lat: actualPlaceLat,
              lng: actualPlaceLng,
            };
          }
        }
      }

      const {
        data: createdRecordId,
        error: recordError,
      } = await retrySupabaseResultOnJwt(() => supabase.rpc(
        "complete_mission_with_record_on_date",
        {
          p_mission_attempt_id: attempt.id,
          p_emotion: recordEmotion,
          p_content: recordContent.trim(),
          p_visibility: recordVisibility,
          p_place_id: selectedPlaceId,
          p_recorded_at: recordDate,
          p_location_latitude: selectedCoordinate?.lat ?? null,
          p_location_longitude: selectedCoordinate?.lng ?? null,
        },
      ));

      if (recordError) {
        throw recordError;
      }
      if (!createdRecordId) {
        throw new Error(
          "생성된 기록 ID를 확인하지 못했습니다.",
        );
      }

      const savedLocationType: RecordLocationKind =
        recordMission.isLocationFlexible
          ? (recordLocationKind as RecordLocationKind)
          : recordMission.isAtHome
            ? "home"
            : "place";
      const savedLocationName =
        savedLocationType === "map"
          ? "거리"
          : savedLocationType === "home"
            ? "내 방"
            : selectedPlaceName;

      const { error: locationMetadataError } =
        await retrySupabaseResultOnJwt(() =>
          supabase.rpc("set_record_location_metadata", {
            p_record_id: String(createdRecordId),
            p_location_type: savedLocationType,
            p_location_name: savedLocationName,
          }),
        );

      if (locationMetadataError) {
        throw new Error(
          `수행 위치 정보를 저장하지 못했습니다: ${getErrorMessage(locationMetadataError, "알 수 없는 오류")}`,
        );
      }

      let feedbackWarning = "";
      const { error: feedbackSaveError } =
        await retrySupabaseResultOnJwt(() =>
          supabase
            .from("mission_feedback")
            .upsert(
              {
                user_id: user.id,
                journey_id: activeJourney?.id ?? null,
                mission_id: recordMission.id,
                record_id: String(createdRecordId),
                preference: selectedPreference,
                mission_title: recordMission.title,
                mission_category: recordMission.cat,
                mission_place_name:
                  selectedPlaceName || recordMission.placeName || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,record_id" },
            ),
        );

      if (feedbackSaveError) {
        console.error(
          "미션 호불호 저장 실패:",
          feedbackSaveError,
        );
        feedbackWarning =
          "\n\n기록은 저장됐지만 미션 만족도는 저장하지 못했어요.";
      }

      let photoWarning = "";

      if (recordPhotos.length > 0) {
        try {
          await uploadRecordPhotos({
            userId: user.id,
            recordId: String(createdRecordId),
            photos: recordPhotos,
          });
        } catch (photoError) {
          console.error("기록 사진 저장 실패:", photoError);
          photoWarning =
            "\n\n기록은 저장됐지만 사진은 업로드하지 못했어요.";
        }
      }

      let discoverWarning = "";

      if (recordVisibility === "nickname") {
        try {
          await createDiscoverPost({
            placeName: savedLocationName,
            lat: selectedCoordinate?.lat ?? 0,
            lng: selectedCoordinate?.lng ?? 0,
            category: recordMission.cat,
            content: recordContent.trim(),
            emotion: recordEmotion as EmotionValue,
            // 주변 공개 조회는 기존 anonymous 값을 사용하고,
            // 실제 표시 방식은 share_mode=nickname 메타데이터로 구분한다.
            visibility: "anonymous",
            photos: recordPhotos.map((photo) => ({
              uri: photo.uri,
              mimeType: photo.mimeType,
            })),
          });

          const { error: discoverMetadataError } =
            await retrySupabaseResultOnJwt(() =>
              supabase.rpc("set_latest_discover_post_metadata_v2", {
                p_place_name: savedLocationName,
                p_content: recordContent.trim(),
                p_title: recordMission.title,
                p_source_kind: "mission",
                p_source_mission_id: isUuid(recordMission.id)
                  ? recordMission.id
                  : null,
                p_share_mode: "nickname",
              }),
            );

          if (discoverMetadataError) {
            throw new Error(
              `발견 기록의 미션 정보를 저장하지 못했습니다: ${getErrorMessage(discoverMetadataError, "알 수 없는 오류")}`,
            );
          }
        } catch (discoverError) {
          console.error("발견 탭 닉네임 공유 실패:", discoverError);
          discoverWarning =
            "\n\n기록은 저장됐지만 발견 탭 닉네임 공유에는 실패했어요.";
        }
      }

      closeRecordModal(true);
      await loadJourneyAndAttempts();
      changeSection("records");

      Alert.alert(
        "기록 완료",
        `${formatDateKeyKorean(recordDate)}의 경험이 여정에 저장됐어요.${feedbackWarning}${photoWarning}${discoverWarning}`,
      );
    } catch (error) {
      console.error("기록 저장 실패:", error);
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

  const renderCompactItem = (item: MissionListItem) => {
    const { mission } = item;
    const isSelected = selectedItemKey === item.key;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.compactCard,
          isSelected && styles.compactCardSelected,
          pressed && styles.cardPressed,
        ]}
        onPress={() => selectListItem(item)}
      >
        <View
          style={[
            styles.compactThumb,
            isSelected && styles.compactThumbSelected,
          ]}
        >
          <Text style={styles.compactThumbEmoji}>
            {getCategoryEmoji(mission.cat)}
          </Text>
        </View>

        <View style={styles.compactContent}>
          <Text numberOfLines={2} style={styles.compactTitle}>
            {mission.title}
          </Text>
          <View style={styles.compactMetaRow}>
            <Text style={styles.compactMeta}>
              {mission.time}
            </Text>
            <Text style={styles.compactMetaDot}>·</Text>
            <Text style={styles.compactMeta}>
              {mission.dist}
            </Text>
            <View style={styles.compactCategory}>
              <Text style={styles.compactCategoryText}>
                {mission.cat}
              </Text>
            </View>
            <View style={styles.compactCost}>
              <Text style={styles.compactCostText}>
                {mission.cost}
              </Text>
            </View>
          </View>
          {mission.placeName ? (
            <Text numberOfLines={1} style={styles.compactPlace}>
              📍 {mission.placeName}
            </Text>
          ) : null}
        </View>

        {item.kind === "recommended" ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              selectListItem(item);
            }}
            style={({ pressed }) => [
              styles.selectButton,
              isSelected && styles.selectButtonSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.selectButtonText,
                isSelected && styles.selectButtonTextSelected,
              ]}
            >
              {isSelected ? "선택됨" : "선택"}
            </Text>
          </Pressable>
        ) : item.kind === "active" ? (
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
            <Text style={styles.recordButtonText}>
              기록하기
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              if (item.record) {
                setRecordDetail(item.record);
              }
            }}
            style={({ pressed }) => [
              styles.completedButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.completedButtonText}>
              기록 보기
            </Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  const selectedItem = currentItems.find(
    (item) => item.key === selectedItemKey,
  );
  const displayedItems = selectedItem
    ? [
        selectedItem,
        ...currentItems.filter((item) => item.key !== selectedItem.key),
      ]
    : currentItems;

  const homeItems: MissionListItem[] =
      sheetSection === "recommended"
        ? recommendedItemsWithHome.filter(
            (item) => item.mission.isAtHome === true,
          )
        : currentItems.filter(
            (item) => item.mission.isAtHome === true,
          );

    const selectedHomeItem =
      selectedItem?.mission.isAtHome === true
        ? selectedItem
        : null;
    const homeDockItem = selectedHomeItem ?? homeItems[0] ?? null;

  const orderedHomeItems = selectedHomeItem
    ? [
        selectedHomeItem,
        ...homeItems.filter(
          (item) => item.key !== selectedHomeItem.key,
        ),
      ]
    : homeItems;

  useEffect(() => {
    if (!homeMissionPanelOpen) {
      homeCardAnimation.setValue(0);
      return;
    }

    homeCardAnimation.stopAnimation();
    homeCardAnimation.setValue(0);
    Animated.timing(homeCardAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [homeCardAnimation, homeMissionPanelOpen]);

  useEffect(() => {
    if (homeItems.length === 0 && homeMissionPanelOpen) {
      setHomeMissionPanelOpen(false);
    }
  }, [homeItems.length, homeMissionPanelOpen]);

  const flexibleMissionCoordinate =
    recommendationLocationMode === "district" &&
    recommendationDistrict
      ? BUSAN_DISTRICT_CENTERS[recommendationDistrict]
      : recommendationCenter ?? userLocation ?? DEFAULT_CENTER;

  const selectedMissionCoordinate =
    selectedItem?.mission.isLocationFlexible
      ? flexibleMissionCoordinate
      : selectedItem &&
          isFiniteNumber(selectedItem.mission.placeLat) &&
          isFiniteNumber(selectedItem.mission.placeLng)
        ? {
            lat: selectedItem.mission.placeLat,
            lng: selectedItem.mission.placeLng,
          }
        : null;

  const mapCenter =
    selectedMissionCoordinate ??
    recommendationCenter ??
    userLocation ??
    DEFAULT_CENTER;
  const recordDetailMission = recordDetail
    ? attemptMissions[recordDetail.missionId] ??
      missions.find(
        (mission) => mission.id === recordDetail.missionId,
      )
    : null;
  const conditionMapCoordinate =
    draftCenter ?? userLocation ?? DEFAULT_CENTER;

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        userLocation={userLocation}
        selectedMarkerId={
          selectedItem && selectedMissionCoordinate
            ? selectedItem.mission.id
            : null
        }
        focusOffsetY={0}
        style={styles.mapPlaceholder}
        markers={currentItems
          .filter(
            (item) =>
              (isFiniteNumber(item.mission.placeLat) &&
                isFiniteNumber(item.mission.placeLng)) ||
              (item.key === selectedItemKey &&
                item.mission.isLocationFlexible === true),
          )
          .map((item) => {
            const isFlexible =
              item.mission.isLocationFlexible === true;
            const markerCoordinate = isFlexible
              ? flexibleMissionCoordinate
              : {
                  lat: item.mission.placeLat!,
                  lng: item.mission.placeLng!,
                };

            return {
            id: item.mission.id,
            lat: markerCoordinate.lat,
            lng: markerCoordinate.lng,
            category: item.mission.cat,
            title: item.mission.title,
            description: item.mission.instructions,
            recommendationReason: normalizeRecommendationReason(
              item.mission.recommendationReason,
            ),
            placeName: item.mission.placeName,
            locationFlexible: isFlexible,
            time: item.mission.time,
            cost: item.mission.cost,
            preparation: getPreparationText(item.mission),
            actionLabel:
              item.kind === "recommended"
                ? startLoadingId === item.mission.id
                  ? "시작 중..."
                  : "미션 시작하기"
                : item.kind === "active"
                  ? "기록하기"
                  : "내 기록 보기",
            actionVariant:
              item.kind === "recommended"
                ? "primary"
                : item.kind === "active"
                  ? "pink"
                  : "green",
            actionDisabled:
              item.kind === "recommended" &&
              startLoadingId === item.mission.id,
            };
          })}
        onMarkerPress={handleMarkerPress}
        onMarkerClose={closeSelectedItem}
        onMarkerAction={handleMarkerAction}
      />

      {homeDockItem ? (
        homeMissionPanelOpen ? (
          <Animated.View
            style={[
              styles.homeMissionCard,
              {
                opacity: homeCardAnimation,
                transform: [
                  {
                    scale: homeCardAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                  {
                    translateY: homeCardAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-6, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.homeMissionPanelHeader}>
              <View style={styles.homeMissionCardIcon}>
                <Text style={styles.homeMissionCardIconText}>🏠</Text>
              </View>
              <View style={styles.homeMissionCardHeaderText}>
                <Text style={styles.homeMissionPanelTitle}>
                  내 방 미션
                </Text>
                <Text style={styles.homeMissionPanelCount}>
                  {homeItems.length}개
                </Text>
              </View>
              <Pressable
                onPress={closeSelectedItem}
                hitSlop={10}
                style={styles.homeMissionCardClose}
              >
                <Text style={styles.homeMissionCardCloseText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.homeMissionListContent}
            >
              {orderedHomeItems.map((homeItem, index) => (
                <View
                  key={homeItem.key}
                  style={[
                    styles.homeMissionEntry,
                    index > 0 && styles.homeMissionEntrySeparated,
                  ]}
                >
                  <View style={styles.homeMissionEntryTopRow}>
                    <Text style={styles.homeMissionCardCategory}>
                      {homeItem.mission.cat}
                    </Text>
                    <Text style={styles.homeMissionEntryIndex}>
                      {index + 1} / {orderedHomeItems.length}
                    </Text>
                  </View>

                  <Text style={styles.homeMissionCardTitle}>
                    {homeItem.mission.title}
                  </Text>

                  {homeItem.mission.instructions ? (
                    <Text style={styles.homeMissionCardDescription}>
                      {homeItem.mission.instructions}
                    </Text>
                  ) : null}

                  <View style={styles.homeMissionMetrics}>
                    <View style={styles.homeMissionMetric}>
                      <Text style={styles.homeMissionMetricLabel}>
                        예상 시간
                      </Text>
                      <Text style={styles.homeMissionMetricValue}>
                        {homeItem.mission.time}
                      </Text>
                    </View>
                    <View style={styles.homeMissionMetric}>
                      <Text style={styles.homeMissionMetricLabel}>
                        준비물
                      </Text>
                      <Text style={styles.homeMissionMetricValue}>
                        {getPreparationText(homeItem.mission)}
                      </Text>
                    </View>
                    <View style={styles.homeMissionMetric}>
                      <Text style={styles.homeMissionMetricLabel}>
                        비용
                      </Text>
                      <Text style={styles.homeMissionMetricValue}>
                        {homeItem.mission.cost}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.homeMissionReasonBox}>
                    <Text style={styles.homeMissionReasonLabel}>
                      추천 이유
                    </Text>
                    <Text style={styles.homeMissionReasonText}>
                      {normalizeRecommendationReason(
                        homeItem.mission.recommendationReason,
                      )}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      handleMissionItemAction(homeItem)
                    }
                    disabled={
                      homeItem.kind === "recommended" &&
                      startLoadingId === homeItem.mission.id
                    }
                    style={({ pressed }) => [
                      styles.homeMissionAction,
                      homeItem.kind === "active" &&
                        styles.homeMissionActionPink,
                      homeItem.kind === "record" &&
                        styles.homeMissionActionGreen,
                      pressed && styles.pressed,
                    ]}
                  >
                    {homeItem.kind === "recommended" &&
                    startLoadingId === homeItem.mission.id ? (
                      <ActivityIndicator color={WH} />
                    ) : (
                      <Text style={styles.homeMissionActionText}>
                        {homeItem.kind === "recommended"
                          ? "미션 시작하기"
                          : homeItem.kind === "active"
                            ? "기록하기"
                            : "내 기록 보기"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        ) : (
          <Pressable
            onPress={openHomeMissionPanel}
            style={({ pressed }) => [
              styles.homeMissionDock,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.homeMissionDockEmoji}>🏠</Text>
            <View style={styles.homeMissionDockTextWrap}>
              <Text style={styles.homeMissionDockTitle}>내 방 미션</Text>
              <Text style={styles.homeMissionDockCount}>
                {homeItems.length}개
              </Text>
            </View>
          </Pressable>
        )
      ) : null}

      <Animated.View
        style={[
          styles.sheet,
          {
            height: SHEET_HEIGHT,
            transform: [
              { translateY: sheetTranslateY },
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
          <View style={styles.sheetHeadingText}>
            <Text style={styles.sheetTitle}>
              {currentSectionTitle}
            </Text>
            <Text
              numberOfLines={1}
              style={styles.sheetSub}
            >
              {currentSectionSub}
            </Text>
          </View>

          {sheetSection === "recommended" ? (
            <View style={styles.headerActionRow}>
              <Pressable
                onPress={() =>
                  void refreshRecommendations()
                }
                disabled={refreshing}
                style={({ pressed }) => [
                  styles.refreshBtn,
                  pressed && styles.pressed,
                  refreshing && styles.buttonDisabled,
                ]}
              >
                {refreshing ? (
                  <ActivityIndicator
                    size="small"
                    color={BL}
                  />
                ) : (
                  <Text style={styles.refreshText}>
                    ↻
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => openConditionModal(0)}
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
          ) : null}
        </View>

        <View style={styles.sectionTabs}>
          <Animated.View
            style={[
              styles.sectionIndicator,
              {
                width: SECTION_INDICATOR_WIDTH,
                transform: [
                  {
                    translateX:
                      sectionIndicator.interpolate({
                        inputRange: [0, 1, 2],
                        outputRange: [
                          0,
                          SECTION_INDICATOR_WIDTH,
                          SECTION_INDICATOR_WIDTH * 2,
                        ],
                      }),
                  },
                ],
              },
            ]}
          />

          {SECTION_LABELS.map((section) => {
            const count =
              section.key === "active"
                ? activeItems.length
                : section.key === "recommended"
                  ? recommendedItems.length
                  : recordItems.length;
            const selected = sheetSection === section.key;

            return (
              <Pressable
                key={section.key}
                onPress={() => changeSection(section.key)}
                style={styles.sectionTab}
              >
                <Text
                  style={[
                    styles.sectionTabText,
                    selected &&
                      styles.sectionTabTextSelected,
                  ]}
                >
                  {section.label}
                </Text>
                <Text
                  style={[
                    styles.sectionCount,
                    selected &&
                      styles.sectionCountSelected,
                  ]}
                >
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator color={BL} />
          </View>
        ) : (
          <Animated.View
            style={[
              styles.sectionContent,
              {
                opacity: sectionContentAnimation,
                transform: [
                  {
                    translateY:
                      sectionContentAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                  },
                ],
              },
            ]}
          >
            <ScrollView
              style={styles.missionScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.missionScrollContent
              }
            >
              {displayedItems.length > 0 ? (
                displayedItems.map((item) => (
                  <View key={item.key}>
                    {renderCompactItem(item)}
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateEmoji}>
                    {sheetSection === "active"
                      ? "🚶"
                      : sheetSection === "records"
                        ? "📝"
                        : "🔎"}
                  </Text>
                  <Text style={styles.emptyStateTitle}>
                    {sheetSection === "active"
                      ? "진행 중인 미션이 없어요"
                      : sheetSection === "records"
                        ? "아직 작성한 기록이 없어요"
                        : "조건에 맞는 미션을 찾지 못했어요"}
                  </Text>
                  <Text style={styles.emptyStateDescription}>
                    {sheetSection === "active"
                      ? "추천 미션에서 새로운 경험을 시작해보세요."
                      : sheetSection === "records"
                        ? "미션을 완료하고 첫 기록을 남겨보세요."
                        : "조건을 조금 넓히거나 새로고침해보세요."}
                  </Text>
                  {sheetSection === "recommended" ? (
                    <Pressable
                      onPress={() => openConditionModal(0)}
                      style={styles.emptyStateButton}
                    >
                      <Text style={styles.emptyStateButtonText}>
                        조건 다시 설정하기
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        )}
      </Animated.View>

      <Modal
        visible={conditionVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setConditionVisible(false)}
      >
        <View style={styles.conditionModalOverlay}>
          <Pressable
            style={styles.conditionBackdrop}
            onPress={() => setConditionVisible(false)}
          />
          <View style={styles.conditionModalCard}>
            <View style={styles.conditionHandle} />
            <View style={styles.conditionHeader}>
              <View>
                <Text style={styles.conditionCaption}>
                  추천 조건 설정
                </Text>
                <Text style={styles.conditionTitle}>
                  {conditionStep === 0
                    ? "1. 지역 설정"
                    : conditionStep === 1
                      ? "2. 카테고리"
                      : conditionStep === 2
                        ? "3. 예상 시간"
                        : "4. 비용"}
                </Text>
              </View>
              <Pressable
                onPress={() => setConditionVisible(false)}
                style={styles.conditionClose}
              >
                <Text style={styles.conditionCloseText}>
                  ✕
                </Text>
              </Pressable>
            </View>

            <View style={styles.conditionProgressRow}>
              {[0, 1, 2, 3].map((step) => (
                <View
                  key={step}
                  style={[
                    styles.conditionProgress,
                    step <= conditionStep &&
                      styles.conditionProgressActive,
                  ]}
                />
              ))}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.conditionBody
              }
            >
              {conditionStep === 0 ? (
                <>
                  <Text style={styles.conditionHelp}>
                    상관없음은 현재 위치 3km를 사용하고, 직접 반경이나 부산광역시의 구·군을 선택할 수도 있어요.
                  </Text>

                  <View style={styles.locationModeRow}>
                    {([
                      ["any", "상관없음"],
                      ["radius", "반경"],
                      ["district", "구·군 선택"],
                    ] as const).map(([mode, label]) => {
                      const selected =
                        draftLocationMode === mode;

                      return (
                        <Pressable
                          key={mode}
                          onPress={() => {
                            setDraftLocationMode(mode);

                            if (
                              mode === "radius" &&
                              !draftCenter
                            ) {
                              setDraftCenter(
                                userLocation ??
                                  DEFAULT_CENTER,
                              );
                            }
                          }}
                          style={[
                            styles.locationModeButton,
                            selected &&
                              styles.locationModeButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.locationModeText,
                              selected &&
                                styles.locationModeTextSelected,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {draftLocationMode === "radius" ? (
                    <>
                      <Text style={styles.locationSubLabel}>
                        추천 범위
                      </Text>
                      <View style={styles.radiusOptionRow}>
                        {RADIUS_OPTIONS.map((radius) => {
                          const selected =
                            draftRadiusKm === radius;

                          return (
                            <Pressable
                              key={radius}
                              onPress={() =>
                                setDraftRadiusKm(radius)
                              }
                              style={[
                                styles.radiusOptionButton,
                                selected &&
                                  styles.radiusOptionButtonSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.radiusOptionText,
                                  selected &&
                                    styles.radiusOptionTextSelected,
                                ]}
                              >
                                {radius}km
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <View style={styles.locationQuickRow}>
                        <Pressable
                          onPress={() => {
                            if (userLocation) {
                              setDraftCenter(userLocation);
                            } else {
                              Alert.alert(
                                "현재 위치를 확인할 수 없어요",
                                "위치 권한을 허용한 뒤 다시 시도해주세요.",
                              );
                            }
                          }}
                          style={styles.quickLocationButton}
                        >
                          <Text style={styles.quickLocationText}>
                            내 현재 위치로 이동
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.locationMapWrapper}>
                        <LocationPickerMap
                          coordinate={conditionMapCoordinate}
                          radiusKm={draftRadiusKm}
                          onSelect={setDraftCenter}
                        />
                        <View style={styles.radiusBadge}>
                          <Text style={styles.radiusBadgeText}>
                            반경 {draftRadiusKm}km
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.selectedCoordinateText}>
                        {draftCenter
                          ? `선택 위치: ${draftCenter.lat.toFixed(5)}, ${draftCenter.lng.toFixed(5)}`
                          : "지도를 눌러 중심 위치를 선택해주세요."}
                      </Text>
                    </>
                  ) : draftLocationMode === "district" ? (
                    <>
                      <Text style={styles.locationSubLabel}>
                        부산광역시 구·군
                      </Text>
                      <View style={styles.optionWrap}>
                        {BUSAN_DISTRICTS.map((district) => {
                          const selected =
                            draftDistrict === district;

                          return (
                            <Pressable
                              key={district}
                              onPress={() =>
                                setDraftDistrict(district)
                              }
                              style={[
                                styles.optionChip,
                                selected &&
                                  styles.optionChipSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.optionChipText,
                                  selected &&
                                    styles.optionChipTextSelected,
                                ]}
                              >
                                {district}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {draftDistrict ? (
                        <View style={styles.locationAnyBox}>
                          <Text style={styles.locationAnyEmoji}>
                            📍
                          </Text>
                          <Text style={styles.locationAnyTitle}>
                            부산광역시 {draftDistrict}
                          </Text>
                          <Text style={styles.locationAnyDescription}>
                            선택한 부산 구·군 안에 등록된 실제 장소 미션만 추천해요.
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.selectedCoordinateText}>
                          부산광역시 구·군을 하나 선택해주세요.
                        </Text>
                      )}
                    </>
                  ) : (
                    <View style={styles.locationAnyBox}>
                      <Text style={styles.locationAnyEmoji}>
                        📍
                      </Text>
                      <Text style={styles.locationAnyTitle}>
                        현재 위치 주변에서 추천받아요
                      </Text>
                      <Text style={styles.locationAnyDescription}>
                        상관없음을 선택하면 현재 위치를 기준으로 반경 {DEFAULT_ANY_RADIUS_KM}km 안의 실제 장소 미션과 내 방에서 할 수 있는 미션을 보여줘요.
                      </Text>
                    </View>
                  )}
                </>
              ) : conditionStep === 1 ? (
                <>
                  <Text style={styles.conditionHelp}>
                    여러 카테고리를 동시에 선택할 수 있어요.
                  </Text>
                  <View style={styles.optionWrap}>
                    <Pressable
                      onPress={() => setDraftCategories([])}
                      style={[
                        styles.optionChip,
                        draftCategories.length === 0 &&
                          styles.optionChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          draftCategories.length === 0 &&
                            styles.optionChipTextSelected,
                        ]}
                      >
                        상관없음
                      </Text>
                    </Pressable>
                    {CATEGORIES.map((category) => {
                      const selected =
                        draftCategories.includes(category);

                      return (
                        <Pressable
                          key={category}
                          onPress={() =>
                            setDraftCategories((previous) =>
                              selected
                                ? previous.filter(
                                    (item) =>
                                      item !== category,
                                  )
                                : [...previous, category],
                            )
                          }
                          style={[
                            styles.optionChip,
                            selected &&
                              styles.optionChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              selected &&
                                styles.optionChipTextSelected,
                            ]}
                          >
                            {getCategoryEmoji(category)} {category}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : conditionStep === 2 ? (
                <>
                  <Text style={styles.conditionHelp}>
                    미션을 수행할 수 있는 시간을 골라주세요.
                  </Text>
                  {TIME_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setDraftTime(option.value)}
                      style={[
                        styles.radioOption,
                        draftTime === option.value &&
                          styles.radioOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.radioOptionText,
                          draftTime === option.value &&
                            styles.radioOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <View
                        style={[
                          styles.radioCircle,
                          draftTime === option.value &&
                            styles.radioCircleSelected,
                        ]}
                      >
                        {draftTime === option.value ? (
                          <View style={styles.radioDot} />
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  <Text style={styles.conditionHelp}>
                    비용이 들 수 있는 활동도 괜찮은지 선택해주세요.
                  </Text>
                  {COST_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setDraftCost(option.value)}
                      style={[
                        styles.radioOption,
                        draftCost === option.value &&
                          styles.radioOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.radioOptionText,
                          draftCost === option.value &&
                            styles.radioOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <View
                        style={[
                          styles.radioCircle,
                          draftCost === option.value &&
                            styles.radioCircleSelected,
                        ]}
                      >
                        {draftCost === option.value ? (
                          <View style={styles.radioDot} />
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>

            <View style={styles.conditionFooter}>
              {conditionStep > 0 ? (
                <Pressable
                  onPress={() =>
                    setConditionStep((step) => step - 1)
                  }
                  style={styles.previousButton}
                >
                  <Text style={styles.previousButtonText}>
                    이전
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  if (conditionStep < 3) {
                    setConditionStep((step) => step + 1);
                  } else {
                    void applyConditions();
                  }
                }}
                style={styles.nextButton}
              >
                <Text style={styles.nextButtonText}>
                  {conditionStep < 3
                    ? "다음"
                    : "조건 적용하고 추천받기"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={recordMission !== null}
        transparent
        animationType="slide"
        onRequestClose={() => closeRecordModal()}
      >
        <KeyboardAvoidingView
          style={styles.recordModalOverlay}
          behavior={
            Platform.OS === "ios" ? "padding" : undefined
          }
        >
          <Pressable
            style={styles.recordModalBackdrop}
            onPress={() => closeRecordModal()}
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
                <View style={styles.recordModalHeaderText}>
                  <Text style={styles.recordModalCaption}>
                    경험 기록하기
                  </Text>
                  <Text style={styles.recordModalTitle}>
                    {recordMission?.title}
                  </Text>
                </View>
                <Pressable
                  onPress={() => closeRecordModal()}
                  style={styles.recordModalClose}
                >
                  <Text style={styles.recordModalCloseText}>
                    ✕
                  </Text>
                </Pressable>
              </View>

              {recordMission ? (
                <View style={styles.recordMissionReminder}>
                  <View style={styles.recordMissionReminderTop}>
                    <View style={styles.recordMissionReminderIcon}>
                      <Text style={styles.recordMissionReminderEmoji}>
                        {getCategoryEmoji(recordMission.cat)}
                      </Text>
                    </View>
                    <View style={styles.recordMissionReminderText}>
                      <Text style={styles.recordMissionReminderLabel}>
                        지금 기록하는 미션
                      </Text>
                      <Text style={styles.recordMissionReminderTitle}>
                        {recordMission.title}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.recordMissionReminderDescription}>
                    {recordMission.instructions ||
                      recordMission.desc ||
                      "미션 안내에 따라 경험을 돌아보며 기록해주세요."}
                  </Text>
                  <View style={styles.recordMissionReminderMetaRow}>
                    <Text style={styles.recordMissionReminderMeta}>
                      ⏱ {recordMission.time}
                    </Text>
                    <Text style={styles.recordMissionReminderMeta}>
                      🎒 {getPreparationText(recordMission)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {recordMission?.isLocationFlexible ? (
                <View style={styles.recordLocationSection}>
                  <Text style={styles.recordFieldLabel}>
                    미션 수행 위치
                  </Text>
                  <Text style={styles.recordLocationHelp}>
                    실제 장소, 길 위·야외, 내 방 중 어디에서 했는지 선택해주세요.
                  </Text>

                  <View style={styles.recordLocationKindRow}>
                    {[
                      { value: "place" as const, emoji: "📍", label: "실제 장소" },
                      { value: "map" as const, emoji: "🗺️", label: "길 위·야외" },
                      { value: "home" as const, emoji: "🏠", label: "내 방" },
                    ].map((option, index) => {
                      const selected = recordLocationKind === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => chooseRecordLocationKind(option.value)}
                          style={[
                            styles.recordLocationKindButton,
                            index < 2 && styles.recordLocationKindButtonSpaced,
                            selected && styles.recordLocationKindButtonSelected,
                          ]}
                        >
                          <Text style={styles.recordLocationKindEmoji}>
                            {option.emoji}
                          </Text>
                          <Text
                            style={[
                              styles.recordLocationKindLabel,
                              selected && styles.recordLocationKindLabelSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {recordLocationKind === "place" ? (
                    <View style={styles.recordPlacePickerBox}>
                      <View style={styles.recordLocationHeader}>
                        <View style={styles.recordLocationHeaderText}>
                          <Text style={styles.recordLocationHelp}>
                            지도에서 미션을 수행한 위치를 눌러주세요. 핀이 표시되면 그 주변 실제 장소 중 한 곳을 선택할 수 있어요.
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            if (userLocation) {
                              void handleRecordPlaceMapSelect(userLocation);
                            } else {
                              Alert.alert(
                                "현재 위치를 확인할 수 없어요",
                                "위치 권한을 허용한 뒤 다시 시도해주세요.",
                              );
                            }
                          }}
                          style={styles.recordCurrentLocationButton}
                        >
                          <Text style={styles.recordCurrentLocationButtonText}>
                            현재 위치 찍기
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.recordLocationMapWrapper}>
                        <RecordLocationPickerMap
                          center={
                            recordLocation ??
                            userLocation ??
                            recommendationCenter ??
                            DEFAULT_CENTER
                          }
                          pickedLocation={recordLocation}
                          onSelect={(coordinate) => {
                            void handleRecordPlaceMapSelect(coordinate);
                          }}
                        />
                      </View>

                      <Text
                        style={[
                          styles.recordLocationStatus,
                          recordLocation &&
                            styles.recordLocationStatusSelected,
                        ]}
                      >
                        {recordLocation
                          ? "선택한 위치 주변의 실제 장소를 확인해주세요."
                          : "지도에서 위치를 한 번 눌러주세요."}
                      </Text>

                      {recordPlacesLoading ? (
                        <View style={styles.recordPlaceLoading}>
                          <ActivityIndicator color={BL} />
                          <Text style={styles.recordPlaceLoadingText}>
                            선택한 위치 주변의 실제 장소를 찾는 중이에요...
                          </Text>
                        </View>
                      ) : null}

                      {recordPlaceCandidates.length > 0 ? (
                        <>
                          <TextInput
                            value={recordPlaceSearch}
                            onChangeText={setRecordPlaceSearch}
                            placeholder="주변 장소 이름이나 주소 검색"
                            placeholderTextColor={T2}
                            style={styles.recordPlaceSearchInput}
                          />

                          <ScrollView
                            nestedScrollEnabled
                            style={styles.recordPlaceList}
                            keyboardShouldPersistTaps="handled"
                          >
                            {visibleRecordPlaceCandidates.map((place) => {
                              const selected =
                                recordSelectedPlace?.id === place.id;
                              const distanceM =
                                place.distanceM ??
                                (recordLocation
                                  ? Math.round(
                                      haversineDistanceKm(recordLocation, {
                                        lat: place.latitude,
                                        lng: place.longitude,
                                      }) * 1000,
                                    )
                                  : null);

                              return (
                                <Pressable
                                  key={place.id}
                                  onPress={() => {
                                    setRecordSelectedPlace(place);
                                    setRecordLocation({
                                      lat: place.latitude,
                                      lng: place.longitude,
                                    });
                                    setRecordPlaceSearch("");
                                  }}
                                  style={[
                                    styles.recordPlaceOption,
                                    selected &&
                                      styles.recordPlaceOptionSelected,
                                  ]}
                                >
                                  <View style={styles.recordPlaceOptionText}>
                                    <Text
                                      numberOfLines={1}
                                      style={[
                                        styles.recordPlaceOptionName,
                                        selected &&
                                          styles.recordPlaceOptionNameSelected,
                                      ]}
                                    >
                                      {place.name}
                                    </Text>
                                    <Text
                                      numberOfLines={1}
                                      style={styles.recordPlaceOptionAddress}
                                    >
                                      {place.address ??
                                        place.categoryDetail ??
                                        "주소 정보 없음"}
                                    </Text>
                                  </View>
                                  <Text
                                    style={styles.recordPlaceOptionDistance}
                                  >
                                    {selected
                                      ? "선택됨"
                                      : distanceM !== null
                                        ? distanceM < 1000
                                          ? `${distanceM}m`
                                          : `${(distanceM / 1000).toFixed(1)}km`
                                        : "선택"}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </>
                      ) : recordLocation && !recordPlacesLoading ? (
                        <Text style={styles.recordLocationStatus}>
                          이 위치 주변에서 선택할 장소를 찾지 못했어요. 다른 위치를 눌러보세요.
                        </Text>
                      ) : null}

                      {recordSelectedPlace ? (
                        <View style={styles.recordSelectedPlaceBox}>
                          <Text style={styles.recordSelectedPlaceLabel}>
                            선택한 장소
                          </Text>
                          <Text style={styles.recordSelectedPlaceName}>
                            📍 {recordSelectedPlace.name}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {recordLocationKind === "map" ? (
                    <>
                      <View style={styles.recordLocationHeader}>
                        <View style={styles.recordLocationHeaderText}>
                          <Text style={styles.recordLocationHelp}>
                            장소명이 없는 길이나 공원, 야외라면 지도에서 정확한 위치를 찍어주세요.
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            if (userLocation) {
                              setRecordLocation(userLocation);
                            } else {
                              Alert.alert(
                                "현재 위치를 확인할 수 없어요",
                                "위치 권한을 허용한 뒤 다시 시도해주세요.",
                              );
                            }
                          }}
                          style={styles.recordCurrentLocationButton}
                        >
                          <Text style={styles.recordCurrentLocationButtonText}>
                            현재 위치 찍기
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.recordLocationMapWrapper}>
                        <RecordLocationPickerMap
                          center={
                            recordLocation ??
                            userLocation ??
                            recommendationCenter ??
                            DEFAULT_CENTER
                          }
                          pickedLocation={recordLocation}
                          onSelect={setRecordLocation}
                        />
                      </View>

                      <Text
                        style={[
                          styles.recordLocationStatus,
                          recordLocation && styles.recordLocationStatusSelected,
                        ]}
                      >
                        {recordLocation
                          ? `선택 완료 · ${recordLocation.lat.toFixed(5)}, ${recordLocation.lng.toFixed(5)}`
                          : "아직 위치를 선택하지 않았어요."}
                      </Text>
                    </>
                  ) : null}

                  {recordLocationKind === "home" ? (
                    <View style={styles.recordHomeLocationBox}>
                      <Text style={styles.recordHomeLocationTitle}>
                        🏠 내 방에서 한 미션
                      </Text>
                      <Text style={styles.recordHomeLocationDesc}>
                        집 주소나 좌표는 저장하지 않아요. 닉네임 공유를 선택하면 방 안 기록 목록에는 보이지만 지도에는 표시되지 않아요.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : recordMission?.placeName ? (
                <View style={styles.recordPlaceBox}>
                  <Text style={styles.recordPlaceLabel}>
                    이 장소에서의 기록
                  </Text>
                  <Text style={styles.recordPlaceName}>
                    {recordMission.isAtHome ? "🏠" : "📍"}{" "}
                    {recordMission.placeName}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.recordFieldLabel}>
                미션 수행 날짜
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.recordDateScroll}
                contentContainerStyle={
                  styles.recordDateScrollContent
                }
              >
                {recordDateOptions.map((dateKey) => {
                  const option =
                    getRecordDateOption(dateKey);
                  const selected =
                    recordDate === dateKey;
                  const isToday =
                    dateKey === toDateKey(new Date());

                  return (
                    <Pressable
                      key={dateKey}
                      onPress={() =>
                        setRecordDate(dateKey)
                      }
                      style={[
                        styles.recordDateChip,
                        selected &&
                          styles.recordDateChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.recordDateWeekday,
                          selected &&
                            styles.recordDateTextSelected,
                        ]}
                      >
                        {option.weekday}
                      </Text>
                      <Text
                        style={[
                          styles.recordDateMonthDay,
                          selected &&
                            styles.recordDateTextSelected,
                        ]}
                      >
                        {option.monthDay}
                      </Text>
                      {isToday ? (
                        <Text
                          style={[
                            styles.recordDateToday,
                            selected &&
                              styles.recordDateTodaySelected,
                          ]}
                        >
                          오늘
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.recordDateHint}>
                여정 시작일부터 오늘까지 선택할 수 있어요.
              </Text>

              <Text style={styles.recordFieldLabel}>
                어떤 감정이 가장 컸나요?
              </Text>
              <View style={styles.emotionWrap}>
                {EMOTIONS.map((emotion) => {
                  const selected =
                    recordEmotion === emotion.value;
                  return (
                    <Pressable
                      key={emotion.value}
                      onPress={() =>
                        setRecordEmotion(emotion.value)
                      }
                      style={[
                        styles.emotionChip,
                        selected &&
                          styles.emotionChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.emotionChipText,
                          selected &&
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
                이 미션은 어땠나요?
              </Text>
              <Text style={styles.preferenceHelpText}>
                선택한 답변은 다음 미션 추천에 반영돼요.
              </Text>
              <View style={styles.preferenceWrap}>
                {MISSION_PREFERENCES.map((preference) => {
                  const selected =
                    recordPreference === preference.value;

                  return (
                    <Pressable
                      key={preference.value}
                      onPress={() =>
                        setRecordPreference(preference.value)
                      }
                      style={[
                        styles.preferenceCard,
                        selected && styles.preferenceCardSelected,
                      ]}
                    >
                      <Text style={styles.preferenceEmoji}>
                        {preference.emoji}
                      </Text>
                      <View style={styles.preferenceTextWrap}>
                        <Text
                          style={[
                            styles.preferenceLabel,
                            selected &&
                              styles.preferenceLabelSelected,
                          ]}
                        >
                          {preference.label}
                        </Text>
                        <Text style={styles.preferenceDescription}>
                          {preference.description}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.recordFieldLabel}>
                그날의 경험을 남겨주세요
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
                    recordPhotos.length >= MAX_RECORD_PHOTOS
                  }
                  style={({ pressed }) => [
                    styles.photoActionButton,
                    pressed && styles.pressed,
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
                    recordPhotos.length >= MAX_RECORD_PHOTOS
                  }
                  style={({ pressed }) => [
                    styles.photoActionButton,
                    styles.photoActionButtonLast,
                    pressed && styles.pressed,
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
                          setRecordPhotos((previous) =>
                            previous.filter(
                              (item) =>
                                item.uri !== photo.uri,
                            ),
                          )
                        }
                        style={styles.photoRemoveButton}
                      >
                        <Text style={styles.photoRemoveText}>
                          ✕
                        </Text>
                      </Pressable>
                      {index === 0 ? (
                        <View style={styles.coverBadge}>
                          <Text style={styles.coverBadgeText}>
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
                  <Text style={styles.visibilityOptionDesc}>
                    내 기록에서만 확인해요
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setRecordVisibility("nickname")
                  }
                  style={[
                    styles.visibilityOption,
                    styles.visibilityOptionLast,
                    recordVisibility === "nickname" &&
                      styles.visibilityOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.visibilityOptionTitle,
                      recordVisibility === "nickname" &&
                        styles.visibilityOptionTitleSelected,
                    ]}
                  >
                    닉네임 공유
                  </Text>
                  <Text style={styles.visibilityOptionDesc}>
                    {recordMission?.isLocationFlexible &&
                    recordLocationKind === "home"
                      ? "방 안 기록 목록에 닉네임으로 공유해요"
                      : "내 닉네임과 함께 발견 탭에 공유해요"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => void handleSaveRecord()}
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
                  <Text style={styles.saveRecordButtonText}>
                    기록 저장하기
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={recordDetail !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setRecordDetail(null)}
      >
        <View style={styles.recordDetailOverlay}>
          <Pressable
            style={styles.recordModalBackdrop}
            onPress={() => setRecordDetail(null)}
          />
          <View style={styles.recordDetailCard}>
            <View style={styles.recordModalHandle} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                styles.recordDetailContent
              }
            >
              <View style={styles.recordModalHeader}>
                <View style={styles.recordModalHeaderText}>
                  <Text style={styles.recordDetailCaption}>
                    내가 쓴 기록
                  </Text>
                  <Text style={styles.recordModalTitle}>
                    {recordDetailMission?.title ??
                      "완료한 미션"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setRecordDetail(null)}
                  style={styles.recordModalClose}
                >
                  <Text style={styles.recordModalCloseText}>
                    ✕
                  </Text>
                </Pressable>
              </View>

              {recordDetail ? (
                <>
                  <Text style={styles.recordDetailDate}>
                    {formatRecordDate(recordDetail.recordedAt)}
                  </Text>
                  <View style={styles.recordDetailMetaRow}>
                    <View style={styles.recordDetailEmotion}>
                      <Text style={styles.recordDetailEmotionText}>
                        {getEmotionInfo(recordDetail.emotion).emoji}{" "}
                        {getEmotionInfo(recordDetail.emotion).label}
                      </Text>
                    </View>
                    <View style={styles.recordDetailVisibility}>
                      <Text style={styles.recordDetailVisibilityText}>
                        {recordDetail.visibility === "private"
                          ? "나만 보기"
                          : "닉네임 공유"}
                      </Text>
                    </View>
                  </View>

                  {recordDetail.locationLat !== null &&
                  recordDetail.locationLng !== null ? (
                    <View style={styles.recordDetailLocationBox}>
                      <Text style={styles.recordDetailLocationTitle}>
                        📍 지도에서 선택한 수행 위치
                      </Text>
                      <Text style={styles.recordDetailLocationCoordinate}>
                        {recordDetail.locationLat.toFixed(5)}, {" "}
                        {recordDetail.locationLng.toFixed(5)}
                      </Text>
                    </View>
                  ) : null}

                  {recordDetail.photoUrls.length > 0 ? (
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={styles.recordDetailPhotoScroll}
                    >
                      {recordDetail.photoUrls.map((url) => (
                        <Image
                          key={url}
                          source={{ uri: url }}
                          style={styles.recordDetailPhoto}
                        />
                      ))}
                    </ScrollView>
                  ) : null}

                  <View style={styles.recordDetailTextBox}>
                    <Text style={styles.recordDetailText}>
                      {recordDetail.content}
                    </Text>
                  </View>
                </>
              ) : null}
            </ScrollView>
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
    backgroundColor: "#DFE8F0",
  },
  homeMissionDock: {
    position: "absolute",
    top: 58,
    right: 14,
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WH,
    borderWidth: 1,
    borderColor: "rgba(61,90,254,0.16)",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 40,
  },
  homeMissionDockEmoji: {
    marginRight: 8,
    fontSize: 23,
  },
  homeMissionDockTextWrap: {
    alignItems: "flex-start",
  },
  homeMissionDockTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: T0,
  },
  homeMissionDockCount: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: BL,
  },
  homeMissionCard: {
    position: "absolute",
    top: 54,
    left: (SCREEN_WIDTH - Math.min(330, SCREEN_WIDTH - 28)) / 2,
    width: Math.min(330, SCREEN_WIDTH - 28),
    maxHeight: Math.max(320, SCREEN_HEIGHT - COLLAPSED_VISIBLE_HEIGHT - 76),
    overflow: "hidden",
    backgroundColor: WH,
    borderWidth: 1,
    borderColor: "rgba(61,90,254,0.20)",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 18,
    zIndex: 50,
  },
  homeMissionCardContent: {
    padding: 15,
  },
  homeMissionPanelHeader: {
    minHeight: 66,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WH,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(27,31,42,0.10)",
  },
  homeMissionPanelTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: T0,
  },
  homeMissionPanelCount: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "700",
    color: BL,
  },
  homeMissionListContent: {
    paddingHorizontal: 15,
    paddingBottom: 16,
  },
  homeMissionEntry: {
    paddingTop: 14,
  },
  homeMissionEntrySeparated: {
    marginTop: 16,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(27,31,42,0.10)",
  },
  homeMissionEntryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  homeMissionEntryIndex: {
    fontSize: 10,
    fontWeight: "700",
    color: T2,
  },
  homeMissionCardHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  homeMissionCardIcon: {
    width: 42,
    height: 42,
    marginRight: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLL,
    borderRadius: 14,
  },
  homeMissionCardIconText: {
    fontSize: 22,
  },
  homeMissionCardHeaderText: {
    flex: 1,
  },
  homeMissionCardCategory: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
    backgroundColor: BLL,
    borderRadius: 7,
    fontSize: 10,
    fontWeight: "800",
    color: BL,
  },
  homeMissionCardLocation: {
    marginTop: 4,
    fontSize: 10,
    color: T2,
  },
  homeMissionCardClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
    borderRadius: 16,
  },
  homeMissionCardCloseText: {
    fontSize: 18,
    color: T1,
  },
  homeMissionCardTitle: {
    marginTop: 11,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: T0,
  },
  homeMissionCardDescription: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    color: T1,
  },
  homeMissionInstructionBox: {
    marginTop: 11,
    padding: 11,
    backgroundColor: BG,
    borderRadius: 11,
  },
  homeMissionInstructionLabel: {
    marginBottom: 4,
    fontSize: 10,
    fontWeight: "800",
    color: T2,
  },
  homeMissionInstructionText: {
    fontSize: 12,
    lineHeight: 19,
    color: T1,
  },
  homeMissionMetrics: {
    marginTop: 10,
    flexDirection: "row",
  },
  homeMissionMetric: {
    flex: 1,
    minWidth: 0,
    marginRight: 6,
    padding: 8,
    backgroundColor: "#FAFAFA",
    borderRadius: 9,
  },
  homeMissionMetricLabel: {
    fontSize: 9,
    color: T2,
  },
  homeMissionMetricValue: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    color: T0,
  },
  homeMissionReasonBox: {
    marginTop: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F4F6F8",
    borderRadius: 10,
  },
  homeMissionReasonLabel: {
    marginRight: 7,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "800",
    color: BL,
  },
  homeMissionReasonText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    color: T1,
  },
  homeMissionAction: {
    minHeight: 44,
    marginTop: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BL,
    borderRadius: 12,
  },
  homeMissionActionPink: {
    backgroundColor: PINK,
  },
  homeMissionActionGreen: {
    backgroundColor: SUCCESS,
  },
  homeMissionActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: WH,
  },
  mapConditionButton: {
    position: "absolute",
    top: 54,
    right: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: WH,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 7,
  },
  mapConditionButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: BL,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 15,
  },
  dragArea: {
    height: 44,
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
    minHeight: 58,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sheetHeadingText: {
    flex: 1,
    marginRight: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: T0,
  },
  sheetSub: {
    marginTop: 3,
    fontSize: 11,
    color: T2,
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  refreshBtn: {
    width: 34,
    height: 34,
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
    borderRadius: 10,
  },
  refreshText: {
    fontSize: 20,
    lineHeight: 22,
    color: BL,
  },
  conditionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: BLL,
    borderRadius: 10,
  },
  conditionText: {
    fontSize: 11,
    fontWeight: "700",
    color: BL,
  },
  sectionTabs: {
    position: "relative",
    height: 50,
    marginHorizontal: SECTION_HORIZONTAL_MARGIN,
    flexDirection: "row",
    backgroundColor: BG,
    borderRadius: 13,
    overflow: "hidden",
  },
  sectionIndicator: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 0,
    backgroundColor: WH,
    borderRadius: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  sectionTabText: {
    fontSize: 10,
    fontWeight: "600",
    color: T2,
  },
  sectionTabTextSelected: {
    fontWeight: "800",
    color: BL,
  },
  sectionCount: {
    minWidth: 18,
    marginLeft: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "700",
    color: T2,
    backgroundColor: "#ECEEF2",
    borderRadius: 8,
  },
  sectionCountSelected: {
    color: BL,
    backgroundColor: BLL,
  },
  loadingArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionContent: {
    flex: 1,
  },
  missionScroll: {
    flex: 1,
  },
  missionScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 130,
  },
  selectedCard: {
    marginBottom: 10,
    padding: 18,
    backgroundColor: WH,
    borderWidth: 1,
    borderColor: "rgba(61, 90, 254, 0.20)",
    borderRadius: 18,
  },
  selectedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryTag: {
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
    paddingLeft: 16,
    paddingRight: 0,
  },
  metricItem: {
    flex: 1,
    minWidth: 0,
    paddingRight: 5,
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
  recommendationBoxPressed: {
    opacity: 0.78,
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
  viewRecordLargeButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SUCCESS_LIGHT,
    borderRadius: 14,
  },
  viewRecordLargeButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: SUCCESS,
  },
  compactCard: {
    minHeight: 96,
    marginBottom: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WH,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 15,
  },
  compactCardSelected: {
    backgroundColor: "#F8F9FF",
    borderColor: "rgba(61,90,254,0.48)",
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
  compactThumbSelected: {
    backgroundColor: "#E0E7FF",
  },
  compactThumbEmoji: {
    fontSize: 25,
  },
  compactContent: {
    flex: 1,
    marginRight: 8,
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
    fontSize: 10,
    color: T2,
  },
  compactMetaDot: {
    marginHorizontal: 4,
    fontSize: 10,
    color: T2,
  },
  compactCategory: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: BG,
    borderRadius: 6,
  },
  compactCategoryText: {
    fontSize: 9,
    color: T1,
  },
  compactCost: {
    marginLeft: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "#FFF7ED",
    borderRadius: 6,
  },
  compactCostText: {
    fontSize: 9,
    color: "#C2410C",
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
  selectButtonSelected: {
    backgroundColor: BL,
  },
  selectButtonTextSelected: {
    color: WH,
  },
  recordButton: {
    minWidth: 68,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 11,
    backgroundColor: PINK_LIGHT,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.22)",
    borderRadius: 11,
  },
  recordButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: PINK,
  },
  completedButton: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    paddingVertical: 11,
    backgroundColor: SUCCESS_LIGHT,
    borderRadius: 11,
  },
  completedButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: SUCCESS,
  },
  emptyState: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: "center",
    backgroundColor: BG,
    borderRadius: 18,
  },
  emptyStateEmoji: {
    marginBottom: 10,
    fontSize: 30,
  },
  emptyStateTitle: {
    marginBottom: 6,
    fontSize: 15,
    fontWeight: "800",
    color: T0,
  },
  emptyStateDescription: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
    color: T2,
  },
  emptyStateButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: BLL,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: BL,
  },


  locationModeRow: {
    flexDirection: "row",
    marginBottom: 18,
    padding: 4,
    backgroundColor: BG,
    borderRadius: 12,
  },

  locationModeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },

  locationModeButtonSelected: {
    backgroundColor: WH,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },

  locationModeText: {
    fontSize: 12,
    fontWeight: "700",
    color: T2,
  },

  locationModeTextSelected: {
    color: BL,
  },

  locationSubLabel: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "700",
    color: T1,
  },

  radiusOptionRow: {
    flexDirection: "row",
    marginBottom: 14,
  },

  radiusOptionButton: {
    flex: 1,
    minHeight: 42,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 10,
  },

  radiusOptionButtonSelected: {
    backgroundColor: BLL,
    borderColor: BL,
  },

  radiusOptionText: {
    fontSize: 12,
    fontWeight: "700",
    color: T1,
  },

  radiusOptionTextSelected: {
    color: BL,
  },

  locationAnyBox: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 26,
    backgroundColor: BG,
    borderRadius: 14,
  },

  locationAnyEmoji: {
    marginBottom: 8,
    fontSize: 28,
  },

  locationAnyTitle: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "800",
    color: T0,
  },

  locationAnyDescription: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: T2,
  },

  conditionModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  conditionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  conditionModalCard: {
    height: "88%",
    backgroundColor: WH,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  conditionHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    marginTop: 10,
    backgroundColor: "#D7D9DE",
    borderRadius: 3,
  },
  conditionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  conditionCaption: {
    marginBottom: 4,
    fontSize: 11,
    fontWeight: "700",
    color: BL,
  },
  conditionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: T0,
  },
  conditionClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
    borderRadius: 18,
  },
  conditionCloseText: {
    fontSize: 14,
    color: T1,
  },
  conditionProgressRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 16,
  },
  conditionProgress: {
    flex: 1,
    height: 4,
    marginRight: 5,
    backgroundColor: "#ECEEF2",
    borderRadius: 2,
  },
  conditionProgressActive: {
    backgroundColor: BL,
  },
  conditionBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  conditionHelp: {
    marginBottom: 14,
    fontSize: 12,
    lineHeight: 19,
    color: T1,
  },
  locationQuickRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  quickLocationButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 11,
  },
  quickLocationButtonLast: {
    marginRight: 0,
  },
  quickLocationButtonSelected: {
    backgroundColor: BLL,
    borderColor: BL,
  },
  quickLocationText: {
    fontSize: 11,
    fontWeight: "700",
    color: T1,
  },
  quickLocationTextSelected: {
    color: BL,
  },
  locationMapWrapper: {
    position: "relative",
    height: 330,
    overflow: "hidden",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 16,
  },
  locationPickerMap: {
    flex: 1,
    backgroundColor: BG,
  },
  radiusBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 9,
  },
  radiusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: BL,
  },
  selectedCoordinateText: {
    marginTop: 9,
    fontSize: 10,
    color: T2,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  optionChip: {
    marginRight: 8,
    marginBottom: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 20,
  },
  optionChipSelected: {
    backgroundColor: BLL,
    borderColor: BL,
  },
  optionChipText: {
    fontSize: 12,
    color: T1,
  },
  optionChipTextSelected: {
    fontWeight: "700",
    color: BL,
  },
  radioOption: {
    minHeight: 56,
    marginBottom: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 13,
  },
  radioOptionSelected: {
    backgroundColor: BLL,
    borderColor: BL,
  },
  radioOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: T1,
  },
  radioOptionTextSelected: {
    color: BL,
  },
  radioCircle: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: T2,
    borderRadius: 10,
  },
  radioCircleSelected: {
    borderColor: BL,
  },
  radioDot: {
    width: 10,
    height: 10,
    backgroundColor: BL,
    borderRadius: 5,
  },
  conditionFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: T3,
  },
  previousButton: {
    minWidth: 88,
    marginRight: 8,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: BG,
    borderRadius: 13,
  },
  previousButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: T1,
  },
  nextButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: BL,
    borderRadius: 13,
  },
  nextButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: WH,
  },
  recordModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  recordModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.44)",
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
  recordModalHeaderText: {
    flex: 1,
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
  recordMissionReminder: {
    marginBottom: 18,
    padding: 14,
    backgroundColor: BLL,
    borderWidth: 1,
    borderColor: "#C8D8CF",
    borderRadius: 16,
  },
  recordMissionReminderTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordMissionReminderIcon: {
    width: 40,
    height: 40,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WH,
    borderRadius: 12,
  },
  recordMissionReminderEmoji: {
    fontSize: 20,
  },
  recordMissionReminderText: {
    flex: 1,
    minWidth: 0,
  },
  recordMissionReminderLabel: {
    marginBottom: 2,
    fontSize: 10,
    fontWeight: "800",
    color: BL,
  },
  recordMissionReminderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: T0,
  },
  recordMissionReminderDescription: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: T1,
  },
  recordMissionReminderMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recordMissionReminderMeta: {
    fontSize: 10,
    fontWeight: "700",
    color: BL,
  },
  recordDateScroll: {
    marginBottom: 8,
  },
  recordDateScrollContent: {
    paddingRight: 8,
  },
  recordDateChip: {
    width: 66,
    minHeight: 76,
    marginRight: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 14,
  },
  recordDateChipSelected: {
    backgroundColor: PINK_LIGHT,
    borderColor: PINK,
  },
  recordDateWeekday: {
    marginBottom: 4,
    fontSize: 10,
    fontWeight: "700",
    color: T2,
  },
  recordDateMonthDay: {
    fontSize: 13,
    fontWeight: "800",
    color: T0,
  },
  recordDateTextSelected: {
    color: PINK,
  },
  recordDateToday: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "700",
    color: T2,
  },
  recordDateTodaySelected: {
    color: PINK,
  },
  recordDateHint: {
    marginBottom: 18,
    fontSize: 10,
    lineHeight: 16,
    color: T2,
  },
  recordLocationSection: {
    marginBottom: 18,
  },
  recordLocationKindRow: {
    marginTop: 10,
    marginBottom: 12,
    flexDirection: "row",
  },
  recordLocationKindButton: {
    flex: 1,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 14,
  },
  recordLocationKindButtonSpaced: {
    marginRight: 8,
  },
  recordLocationKindButtonSelected: {
    backgroundColor: BLL,
    borderColor: BL,
  },
  recordLocationKindEmoji: {
    marginBottom: 5,
    fontSize: 20,
  },
  recordLocationKindLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: T1,
  },
  recordLocationKindLabelSelected: {
    color: BL,
  },
  recordPlacePickerBox: {
    padding: 12,
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 14,
  },
  recordPlaceSearchInput: {
    height: 42,
    paddingHorizontal: 12,
    fontSize: 12,
    color: T0,
    backgroundColor: WH,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 10,
  },
  recordPlaceLoading: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  recordPlaceLoadingText: {
    marginTop: 8,
    fontSize: 11,
    color: T1,
  },
  recordPlaceList: {
    maxHeight: 245,
    marginTop: 10,
  },
  recordPlaceOption: {
    minHeight: 58,
    marginBottom: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WH,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 11,
  },
  recordPlaceOptionSelected: {
    backgroundColor: BLL,
    borderColor: BL,
  },
  recordPlaceOptionText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  recordPlaceOptionName: {
    fontSize: 12,
    fontWeight: "700",
    color: T0,
  },
  recordPlaceOptionNameSelected: {
    color: BL,
  },
  recordPlaceOptionAddress: {
    marginTop: 3,
    fontSize: 10,
    color: T2,
  },
  recordPlaceOptionDistance: {
    fontSize: 10,
    fontWeight: "700",
    color: BL,
  },
  recordPlaceEmpty: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  recordPlaceEmptyText: {
    marginBottom: 9,
    fontSize: 11,
    color: T2,
  },
  recordPlaceReloadButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BLL,
    borderRadius: 9,
  },
  recordPlaceReloadButtonText: {
    fontSize: 10,
    fontWeight: "800",
    color: BL,
  },
  recordSelectedPlaceBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: BLL,
    borderRadius: 10,
  },
  recordSelectedPlaceLabel: {
    marginBottom: 3,
    fontSize: 9,
    fontWeight: "700",
    color: BL,
  },
  recordSelectedPlaceName: {
    fontSize: 12,
    fontWeight: "800",
    color: T0,
  },
  recordHomeLocationBox: {
    padding: 14,
    backgroundColor: PINK_LIGHT,
    borderWidth: 1,
    borderColor: "#E9D6CB",
    borderRadius: 14,
  },
  recordHomeLocationTitle: {
    marginBottom: 5,
    fontSize: 13,
    fontWeight: "800",
    color: T0,
  },
  recordHomeLocationDesc: {
    fontSize: 10,
    lineHeight: 16,
    color: T1,
  },
  recordLocationHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  recordLocationHeaderText: {
    flex: 1,
    marginRight: 10,
  },
  recordLocationHelp: {
    marginTop: 0,
    fontSize: 10,
    lineHeight: 16,
    color: T2,
  },
  recordCurrentLocationButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: BLL,
    borderRadius: 9,
  },
  recordCurrentLocationButtonText: {
    fontSize: 10,
    fontWeight: "800",
    color: BL,
  },
  recordLocationMapWrapper: {
    height: 250,
    overflow: "hidden",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 14,
  },
  recordLocationPickerMap: {
    flex: 1,
    backgroundColor: BG,
  },
  recordLocationStatus: {
    marginTop: 8,
    fontSize: 10,
    color: T2,
  },
  recordLocationStatusSelected: {
    fontWeight: "700",
    color: BL,
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
  preferenceHelpText: {
    marginTop: -3,
    marginBottom: 10,
    fontSize: 11,
    lineHeight: 17,
    color: T2,
  },
  preferenceWrap: {
    marginBottom: 18,
  },
  preferenceCard: {
    minHeight: 58,
    marginBottom: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 14,
  },
  preferenceCardSelected: {
    backgroundColor: BLL,
    borderColor: BL,
  },
  preferenceEmoji: {
    width: 30,
    marginRight: 9,
    fontSize: 20,
    textAlign: "center",
  },
  preferenceTextWrap: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: T1,
  },
  preferenceLabelSelected: {
    color: BL,
  },
  preferenceDescription: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: T2,
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
    backgroundColor: "rgba(15,15,15,0.7)",
    borderRadius: 12,
  },
  photoRemoveText: {
    fontSize: 11,
    fontWeight: "800",
    color: WH,
  },
  coverBadge: {
    position: "absolute",
    right: 5,
    bottom: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: PINK,
    borderRadius: 7,
  },
  coverBadgeText: {
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
  visibilityOptionLast: {
    marginRight: 0,
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
  recordDetailOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  recordDetailCard: {
    maxHeight: "84%",
    backgroundColor: WH,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  recordDetailContent: {
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 36,
  },
  recordDetailCaption: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
    color: SUCCESS,
  },
  recordDetailDate: {
    marginBottom: 10,
    fontSize: 11,
    color: T2,
  },
  recordDetailMetaRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  recordDetailEmotion: {
    marginRight: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: PINK_LIGHT,
    borderRadius: 9,
  },
  recordDetailEmotionText: {
    fontSize: 11,
    fontWeight: "700",
    color: PINK,
  },
  recordDetailVisibility: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: BLL,
    borderRadius: 9,
  },
  recordDetailVisibilityText: {
    fontSize: 11,
    fontWeight: "700",
    color: BL,
  },
  recordDetailLocationBox: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: BLL,
    borderRadius: 11,
  },
  recordDetailLocationTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: BL,
  },
  recordDetailLocationCoordinate: {
    marginTop: 4,
    fontSize: 10,
    color: T1,
  },
  recordDetailPhotoScroll: {
    marginBottom: 16,
  },
  recordDetailPhoto: {
    width: SCREEN_WIDTH - 40,
    height: 250,
    marginRight: 8,
    backgroundColor: T3,
    borderRadius: 16,
  },
  recordDetailTextBox: {
    padding: 17,
    backgroundColor: BG,
    borderRadius: 15,
  },
  recordDetailText: {
    fontSize: 14,
    lineHeight: 24,
    color: T0,
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