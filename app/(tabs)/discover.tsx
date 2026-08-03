import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { KakaoMapView } from "../../components/KakaoMapView";
import { useMission } from "../../contexts/mission-context";
import { supabase } from "../../lib/supabase";
import {
  createDiscoverPost,
  deleteDiscoverPost,
  getDiscoverPhotoUrl,
  getNearbyDiscoverPosts,
  getOriginalMissionFromDiscoverPost,
} from "../../services/service_missons";

const BL = "#315C4A";
const BLL = "#E5EEE8";
const ACCENT = "#F2C96D";
const PINK = "#E07A5F";
const PINK_LIGHT = "#F4EAE1";
const T0 = "#26372E";
const T1 = "#65766D";
const T2 = "#9AA49F";
const T3 = "#E2E3DC";
const WH = "#FFFFFF";
const BG = "#F5F2E9";

const KAKAO_JS_KEY = "f937d15a94db64ab114b3495f8b6ad3c";
const KAKAO_REST_API_KEY = "c10a1b62f7bbf1d90e0ff60bb94bdadd";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SHEET_CLOSE_POSITION = SCREEN_HEIGHT * 0.6;
const HOME_SHEET_TOP = 188;
const HOME_SHEET_HEIGHT = Math.max(SCREEN_HEIGHT - HOME_SHEET_TOP, 1);
const HOME_SHEET_CLOSE_POSITION = HOME_SHEET_HEIGHT + 28;
const MY_SHEET_TOP = 188;
const MY_SHEET_HEIGHT = Math.max(SCREEN_HEIGHT - MY_SHEET_TOP, 1);
const MY_SHEET_COLLAPSED_VISIBLE_HEIGHT = 188;
const MY_SHEET_COLLAPSED_POSITION = Math.max(
  MY_SHEET_HEIGHT - MY_SHEET_COLLAPSED_VISIBLE_HEIGHT,
  0,
);
const MY_SHEET_CLOSE_POSITION = MY_SHEET_HEIGHT + 28;
const MY_RECORD_TAB_HORIZONTAL_MARGIN = 14;
const MY_RECORD_TAB_INDICATOR_WIDTH =
  (SCREEN_WIDTH - MY_RECORD_TAB_HORIZONTAL_MARGIN * 2) / 3;
const MAX_PHOTOS = 5;
const SEARCH_RESULT_RADIUS_KM = 0.5;
const MAP_AUTO_SEARCH_RADIUS_KM = 5;
const MAP_AUTO_SEARCH_MIN_MOVE_M = 80;
const KAKAO_PLACE_CATEGORY_CODES = [
  "MT1", "CS2", "PS3", "SC4", "AC5", "PK6", "OL7", "SW8", "BK9", "CT1", "AG2", "PO3", "AT4", "AD5", "FD6", "CE7", "HP8", "PM9",
] as const;
const KAKAO_PLACE_SEARCH_RADII_M = [500, 2000] as const;
const KAKAO_PLACE_CANDIDATE_LIMIT = 5;

const DEFAULT_CENTER = { lat: 35.1795543, lng: 129.0756416 };

const FILTERS = ["방 안 기록", "내 기록", "가까운 기록", "최근 기록", "내 취향", "새로운 분야", "산책"];
const CATEGORIES = ["음식", "카페 및 디저트", "산책", "배움", "감상", "활동", "휴식", "기타"];

type EmotionValue = "comfortable" | "joyful" | "new" | "uncomfortable" | "unsure";
type RecordVisibility = "private" | "nickname";
type ExperiencePreferenceValue = "like" | "neutral" | "dislike";
type RecordLocationKind = "place" | "map" | "home";
type MapPickerMode = Exclude<RecordLocationKind, "home">;

type Coordinate = {
  lat: number;
  lng: number;
};

type KakaoPlace = {
  id: string;
  place_name: string;
  address_name: string;
  x: string;
  y: string;
};

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
  address?: { address_name?: string; region_3depth_name?: string } | null;
  road_address?: { address_name?: string; region_3depth_name?: string; road_name?: string; building_name?: string } | null;
};

type PlaceCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  categoryDetail?: string;
  distanceM: number;
};

type HomeArchiveTab = "shared" | "mine";
type MyRecordVisibilityFilter = "all" | "private" | "nickname";

const MY_RECORD_FILTER_INDEX: Record<MyRecordVisibilityFilter, number> = {
  all: 0,
  private: 1,
  nickname: 2,
};

type HomeRoomRecord = {
  id: string;
  source: "discover" | "mission";
  userId: string | null;
  isMine: boolean;
  title: string;
  content: string;
  emotion: string;
  category: string;
  visibility: string;
  createdAt: string;
  likes: number;
  sourceKind: "independent" | "mission";
  nickname: string;
  shareMode: "private" | "anonymous" | "nickname";
};

type MyRecordItem = {
  key: string;
  id: string;
  source: "discover" | "mission";
  discoverPostId: string | null;
  missionAttemptId: string | null;
  title: string;
  content: string;
  placeName: string;
  emotion: string;
  category: string;
  visibility: string;
  createdAt: string;
  likes: number;
  lat: number | null;
  lng: number | null;
  photo?: string;
};

type DiscoverPostPhoto = {
  is_cover?: boolean | null;
  storage_path?: string | null;
};

type DiscoverBubble = {
  id: string;
  discoverPostId?: string | null;
  missionRecordId?: string | null;
  missionAttemptId?: string | null;
  canLike?: boolean;
  canDelete?: boolean;
  user_id: string | null;
  place: string;
  lat: number;
  lng: number;
  mission: string;
  sourceKind: "independent" | "mission";
  sourceMissionId?: string | null;
  time: string;
  nick: string;
  emotion: string;
  note: string;
  likes: number;
  category: string;
  photo?: string;
  real?: boolean;
  createdAt?: string;
  multi?: boolean;
  count?: number;
  groupRecords?: DiscoverBubble[];
};

const EMOTIONS: {
  label: string;
  value: EmotionValue;
  emoji: string;
}[] = [
  { label: "편안해요", value: "comfortable", emoji: "😌" },
  { label: "즐거워요", value: "joyful", emoji: "😊" },
  { label: "새로워요", value: "new", emoji: "✨" },
  { label: "불편해요", value: "uncomfortable", emoji: "😣" },
  { label: "잘 모르겠어요", value: "unsure", emoji: "🤔" },
];

const EXPERIENCE_PREFERENCES: {
  value: ExperiencePreferenceValue;
  emoji: string;
  label: string;
  description: string;
}[] = [
  {
    value: "like",
    emoji: "👍",
    label: "또 해보고 싶어요",
    description: "비슷한 경험을 다음 추천에 더 반영해요.",
  },
  {
    value: "neutral",
    emoji: "😐",
    label: "괜찮았어요",
    description: "추천을 늘리거나 줄이지 않아요.",
  },
  {
    value: "dislike",
    emoji: "👎",
    label: "다음엔 피하고 싶어요",
    description: "비슷한 경험의 추천 비중을 줄여요.",
  },
];

const EMOTION_LABEL: Record<string, string> = {
  comfortable: "편안해요",
  joyful: "즐거워요",
  new: "새로워요",
  uncomfortable: "불편해요",
  unsure: "잘 모르겠어요",
};

const MOCK_BUBBLES: DiscoverBubble[] = [
  { id: "mock-1", user_id: null, place: "연남동 카페 봄날", lat: 35.1795543, lng: 129.0806416, mission: "조용한 카페에서 30분 독서", sourceKind: "mission", time: "2일 전", nick: "소리의 탐험가", emotion: "차분함", note: "창가 자리에서 책 읽으니 딴 세상 같았어요.", likes: 12, category: "휴식", photo: "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=200&h=200&fit=crop" },
  { id: "mock-2", user_id: null, place: "경의선 숲길", lat: 35.1825543, lng: 129.0756416, mission: "공원 산책하며 계절 사진 찍기", sourceKind: "mission", time: "1일 전", nick: "산책러", emotion: "상쾌함", note: "노을 질 때가 진짜 예뻐요.", likes: 8, category: "산책", photo: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&h=200&fit=crop" },
];

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceM: number) {
  if (distanceM < 1000) {
    return `${Math.max(0, Math.round(distanceM))}m`;
  }
  return `${(distanceM / 1000).toFixed(1)}km`;
}

async function fetchKakaoCategoryPlaces(coordinate: Coordinate, categoryCode: string, radiusM: number): Promise<KakaoPlaceDocument[]> {
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${encodeURIComponent(categoryCode)}&x=${encodeURIComponent(String(coordinate.lng))}&y=${encodeURIComponent(String(coordinate.lat))}&radius=${radiusM}&sort=distance&size=15`;
  const response = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } });
  if (!response.ok) throw new Error(`카카오 장소 검색 실패 (${response.status})`);
  const data = (await response.json()) as { documents?: KakaoPlaceDocument[] };
  return Array.isArray(data.documents) ? data.documents : [];
}

async function fetchKakaoKeywordPlaces(coordinate: Coordinate, query: string, radiusM: number): Promise<KakaoPlaceDocument[]> {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&x=${encodeURIComponent(String(coordinate.lng))}&y=${encodeURIComponent(String(coordinate.lat))}&radius=${radiusM}&sort=distance&size=15`;
  const response = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } });
  if (!response.ok) throw new Error(`카카오 장소 검색 실패 (${response.status})`);
  const data = (await response.json()) as { documents?: KakaoPlaceDocument[] };
  return Array.isArray(data.documents) ? data.documents : [];
}

async function fetchKakaoAddressKeywords(coordinate: Coordinate): Promise<string[]> {
  const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${encodeURIComponent(String(coordinate.lng))}&y=${encodeURIComponent(String(coordinate.lat))}`;
  const response = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } });
  if (!response.ok) return [];
  const data = (await response.json()) as { documents?: KakaoAddressDocument[] };
  const document = Array.isArray(data.documents) ? data.documents[0] : undefined;
  if (!document) return [];
  const address = document.address;
  const roadAddress = document.road_address;
  const roadAreaKeyword = [roadAddress?.region_3depth_name, roadAddress?.road_name].filter((value): value is string => Boolean(value?.trim())).join(" ");
  return [roadAddress?.building_name, roadAddress?.address_name, address?.address_name, roadAreaKeyword, roadAddress?.region_3depth_name, address?.region_3depth_name]
    .map((value) => String(value ?? "").trim())
    .filter((value, index, values) => value.length >= 2 && values.indexOf(value) === index)
    .slice(0, 5);
}

function toPlaceCandidate(document: KakaoPlaceDocument, coordinate: Coordinate): PlaceCandidate | null {
  const id = String(document.id ?? "").trim();
  const name = String(document.place_name ?? "").trim();
  const latitude = Number(document.y);
  const longitude = Number(document.x);
  if (!id || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const apiDistanceM = Number(document.distance);
  const distanceM = Number.isFinite(apiDistanceM) ? Math.max(0, Math.round(apiDistanceM)) : Math.max(0, Math.round(haversineM(coordinate.lat, coordinate.lng, latitude, longitude)));

  return { id, name, latitude, longitude, address: document.road_address_name || document.address_name || undefined, categoryDetail: document.category_name || document.category_group_name || undefined, distanceM };
}

async function searchNearbyKakaoPlaces(coordinate: Coordinate): Promise<PlaceCandidate[]> {
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
      ...KAKAO_PLACE_CATEGORY_CODES.map((code) => fetchKakaoCategoryPlaces(coordinate, code, radiusM)),
      ...addressKeywords.map((keyword) => fetchKakaoKeywordPlaces(coordinate, keyword, radiusM)),
    ];
    const results = await Promise.allSettled(requests);

    for (const result of results) {
      if (result.status === "rejected") {
        lastError = result.reason;
        continue;
      }
      successfulRequestCount += 1;
      for (const document of result.value) {
        const candidate = toPlaceCandidate(document, coordinate);
        if (!candidate) continue;
        const previous = uniquePlaces.get(candidate.id);
        if (!previous || candidate.distanceM < previous.distanceM) {
          uniquePlaces.set(candidate.id, candidate);
        }
      }
    }
    if (uniquePlaces.size >= KAKAO_PLACE_CANDIDATE_LIMIT) break;
  }

  if (successfulRequestCount === 0 && lastError) throw lastError;

  return [...uniquePlaces.values()].sort((a, b) => a.distanceM - b.distanceM).slice(0, KAKAO_PLACE_CANDIDATE_LIMIT);
}

async function buildBubbleList(posts: any[]): Promise<DiscoverBubble[]> {
  const mapPosts = posts.filter((post) => {
    const lat = Number(post?.lat);
    const lng = Number(post?.lng);
    return post?.place_name !== "내 방" && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  });

  // 🚀 나만 보기 게시물엔 좋아요 버튼이 아예 안 보이도록, visibility 정보를 미리 저장해둔다.
  const visibilityById = new Map<string, string>();
  for (const post of mapPosts) {
    visibilityById.set(String(post.id), String(post.visibility ?? ""));
  }

  const postIds = mapPosts.map((post) => String(post?.id ?? "")).filter(Boolean);
  const metadataById = new Map<string, {
    title: string;
    sourceKind: "independent" | "mission";
    sourceMissionId: string | null;
    authorNickname: string;
    shareMode: "anonymous" | "nickname";
  }>();

  if (postIds.length > 0) {
    const { data: metadataRows, error: metadataError } = await supabase.rpc("get_discover_post_display_metadata", { p_post_ids: postIds });
    if (!metadataError) {
      for (const row of metadataRows ?? []) {
        metadataById.set(String(row.id), {
          title: String(row.title ?? "").trim(),
          sourceKind: row.source_kind === "mission" ? "mission" : "independent",
          sourceMissionId:
            row.source_mission_id
              ? String(row.source_mission_id)
              : null,
          authorNickname: String(row.author_nickname ?? "").trim() || "사용자",
          shareMode: row.share_mode === "nickname" ? "nickname" : "anonymous",
        });
      }
    }
  }

  return Promise.all(
    mapPosts.map(async (p) => {
      const photos: DiscoverPostPhoto[] = Array.isArray(p.photos) ? p.photos : [];
      const cover = photos.find((ph) => ph.is_cover) ?? photos[0];
      let photoUrl: string | undefined;

      try {
        photoUrl = cover?.storage_path ? await getDiscoverPhotoUrl(cover.storage_path) : undefined;
      } catch {
        photoUrl = undefined;
      }

      const id = String(p.id);
      const content = String(p.content ?? "");
      const metadata = metadataById.get(id);
      const title = metadata?.title || String(p.title ?? "").trim() || content.slice(0, 40) || "기록";
      const canLikeThisPost = visibilityById.get(id) === "anonymous";

      return {
        id,
        discoverPostId: id,
        canLike: canLikeThisPost,
        canDelete: true,
        user_id: p.user_id ? String(p.user_id) : null,
        place: String(p.place_name ?? "장소"),
        lat: Number(p.lat),
        lng: Number(p.lng),
        mission: title,
        sourceKind: metadata?.sourceKind || (p.source_kind === "mission" ? "mission" : "independent"),
        sourceMissionId:
          metadata?.sourceMissionId ??
          (p.source_mission_id ? String(p.source_mission_id) : null),
        time: new Date(p.created_at).toLocaleDateString("ko-KR"),
        nick: metadata?.shareMode === "nickname" ? metadata.authorNickname : "익명",
        emotion: EMOTION_LABEL[p.emotion] ?? String(p.emotion ?? ""),
        note: content,
        likes: Number(p.likes_count ?? 0),
        category: String(p.category ?? "기타"),
        photo: photoUrl,
        real: true,
        createdAt: String(p.created_at ?? ""),
      };
    }),
  );
}

function normalizePlaceGroupText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\[\]{}.,·'"“”‘’_-]/g, "");
}

function getDiscoverPlaceGroupKey(bubble: DiscoverBubble) {
  const normalizedPlace = normalizePlaceGroupText(bubble.place);
  const isGenericMapLocation =
    !normalizedPlace ||
    normalizedPlace === "거리" ||
    normalizedPlace === "길위야외" ||
    normalizedPlace === "길위의기록" ||
    normalizedPlace === "장소";

  if (isGenericMapLocation) {
    return `record:${bubble.id}`;
  }

  // 카카오 장소 좌표는 같은 장소라면 거의 같으므로 약 10m 단위로 묶는다.
  return `place:${normalizedPlace}:${bubble.lat.toFixed(4)}:${bubble.lng.toFixed(4)}`;
}

function sortDiscoverRecords(records: DiscoverBubble[]) {
  return [...records].sort((left, right) => {
    const likesDifference = right.likes - left.likes;
    if (likesDifference !== 0) {
      return likesDifference;
    }

    return (
      new Date(right.createdAt ?? 0).getTime() -
      new Date(left.createdAt ?? 0).getTime()
    );
  });
}

function groupDiscoverBubblesByPlace(bubbles: DiscoverBubble[]) {
  const groups = new Map<string, DiscoverBubble[]>();

  for (const bubble of bubbles) {
    const key = getDiscoverPlaceGroupKey(bubble);
    const current = groups.get(key) ?? [];
    current.push(bubble);
    groups.set(key, current);
  }

  return [...groups.entries()].map(([key, records]) => {
    const orderedRecords = sortDiscoverRecords(records);
    const representative = orderedRecords[0];

    if (orderedRecords.length === 1) {
      return representative;
    }

    return {
      ...representative,
      id: `place-group:${key}`,
      discoverPostId: null,
      canLike: false,
      canDelete: false,
      mission: `${representative.place}의 기록 ${orderedRecords.length}개`,
      note: "이 장소에 남겨진 기록을 모두 확인해보세요.",
      likes: orderedRecords.reduce(
        (sum, record) => sum + record.likes,
        0,
      ),
      multi: true,
      count: orderedRecords.length,
      groupRecords: orderedRecords,
    } satisfies DiscoverBubble;
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function RecordLocationPickerMap({ center, pickedLocation, guideText, onSelect }: { center: Coordinate; pickedLocation: Coordinate | null; guideText: string; onSelect: (coordinate: Coordinate) => void; }) {
  const webViewRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const escapedGuideText = guideText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = useMemo(() => `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
    body { overflow: hidden; }
    #loading {
      position: fixed; inset: 0; z-index: 10; display: flex;
      align-items: center; justify-content: center; background: #F5F2E9;
      color: #65766D; font-family: sans-serif; font-size: 13px;
    }
    #guide {
      position: fixed; top: 10px; left: 50%; z-index: 20;
      max-width: calc(100vw - 28px); padding: 8px 12px;
      transform: translateX(-50%); border-radius: 999px;
      background: rgba(255,255,255,0.96); color: #315C4A;
      font-family: sans-serif; font-size: 11px; line-height: 15px;
      font-weight: 800; white-space: nowrap;
      box-shadow: 0 3px 12px rgba(0,0,0,0.08);
    }
  </style>
</head>
<body>
  <div id="loading">지도를 불러오는 중이에요</div>
  <div id="guide">${escapedGuideText}</div>
  <div id="map"></div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"></script>
  <script>
    kakao.maps.load(function () {
      document.getElementById('loading').style.display = 'none';
      const initial = new kakao.maps.LatLng(${center.lat}, ${center.lng});
      const map = new kakao.maps.Map(document.getElementById('map'), { center: initial, level: 4 });
      let marker = null;

      const postLocation = function (position) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recordLocation', lat: position.getLat(), lng: position.getLng() }));
      };

      window.setPickedLocation = function (lat, lng, shouldPan) {
        lat = Number(lat); lng = Number(lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const latLng = new kakao.maps.LatLng(lat, lng);
        if (!marker) {
          marker = new kakao.maps.Marker({ map: map, position: latLng, draggable: true });
          kakao.maps.event.addListener(marker, 'dragend', function () { postLocation(marker.getPosition()); });
        } else {
          marker.setPosition(latLng); marker.setMap(map);
        }
        if (shouldPan) map.panTo(latLng);
      };

      kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
        const position = mouseEvent.latLng;
        window.setPickedLocation(position.getLat(), position.getLng(), false);
        postLocation(position);
      });

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recordLocationMapReady' }));
    });
  </script>
</body>
</html>`, [center.lat, center.lng, escapedGuideText]);

  const pickedLatitude = pickedLocation?.lat;
const pickedLongitude = pickedLocation?.lng;

const syncPickedLocation = useCallback(
  (shouldPan: boolean) => {
    if (
      !mapReadyRef.current ||
      pickedLatitude == null ||
      pickedLongitude == null
    ) {
      return;
    }

    webViewRef.current?.injectJavaScript(`
      if (window.setPickedLocation) {
        window.setPickedLocation(
          ${pickedLatitude},
          ${pickedLongitude},
          ${shouldPan ? "true" : "false"}
        );
      }
      true;
    `);
  },
  [pickedLatitude, pickedLongitude],
);

useEffect(() => {
  syncPickedLocation(true);
}, [syncPickedLocation]);

  useEffect(() => { syncPickedLocation(true); }, [syncPickedLocation]);

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={["*"]}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      onLoadStart={() => { mapReadyRef.current = false; }}
      onMessage={(event) => {
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.type === "recordLocationMapReady") {
            mapReadyRef.current = true; syncPickedLocation(false); return;
          }
          if (message.type === "recordLocation" && isFiniteNumber(message.lat) && isFiniteNumber(message.lng)) {
            onSelect({ lat: message.lat, lng: message.lng });
          }
        } catch {}
      }}
      style={styles.recordLocationPickerMap}
    />
  );
}

function inferRecordCategory(text: string): string {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();
  if (/(카페|디저트|베이커리|빵|커피|라떼|케이크|아이스크림)/.test(normalized)) return "카페 및 디저트";
  if (/(음식|식사|맛집|요리|먹기|국밥|라면|국수|분식|한 끼)/.test(normalized)) return "음식";
  if (/(산책|걷기|공원|골목|해변|강변|둘레길|등산|자연)/.test(normalized)) return "산책";
  if (/(독서|책|공부|배움|학습|강의|도서관|서점)/.test(normalized)) return "배움";
  if (/(음악|영화|공연|전시|미술관|박물관|감상|사진|그림|연극)/.test(normalized)) return "감상";
  if (/(운동|체험|만들기|공방|자전거|클라이밍|러닝|요가|춤|볼링)/.test(normalized)) return "활동";
  if (/(휴식|명상|호흡|온천|찜질|낮잠|힐링|쉬기)/.test(normalized)) return "휴식";
  return "기타";
}

function normalizeRecordCategory(rawCategory: unknown, textForInference: string) {
  const category = String(rawCategory ?? "").trim();
  if (CATEGORIES.includes(category)) return category;
  return inferRecordCategory(`${category} ${textForInference}`);
}

type MissionRecordMetadata = {
  title: string;
  category: string;
  placeName: string | null;
  placeLat: number | null;
  placeLng: number | null;
};

function isGenericMissionPlaceLabel(value: unknown) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return (
    !normalized ||
    normalized === "미션수행장소" ||
    normalized === "미션장소" ||
    normalized === "장소정보없음" ||
    normalized === "장소지정됨"
  );
}

async function getMissionMetadataByAttemptIds(attemptIds: string[]) {
  const result = new Map<string, MissionRecordMetadata>();
  const uniqueAttemptIds = Array.from(new Set(attemptIds.filter(Boolean)));
  if (uniqueAttemptIds.length === 0) return result;

  const { data: attempts } = await supabase
    .from("mission_attempts")
    .select("id, mission_id, place_id")
    .in("id", uniqueAttemptIds);

  const missionIds = Array.from(
    new Set((attempts ?? []).map((row) => String(row.mission_id)).filter(Boolean)),
  );
  const placeIds = Array.from(
    new Set((attempts ?? []).map((row) => String(row.place_id ?? "")).filter(Boolean)),
  );

  if (missionIds.length === 0) return result;

  let missionRows: any[] = [];
  const extendedMissionResult = await supabase
    .from("missions")
    .select("id, title, category_id, place_name, place_lat, place_lng")
    .in("id", missionIds);

  if (extendedMissionResult.error) {
    const basicMissionResult = await supabase
      .from("missions")
      .select("id, title, category_id")
      .in("id", missionIds);
    missionRows = basicMissionResult.data ?? [];
  } else {
    missionRows = extendedMissionResult.data ?? [];
  }

  const categoryIds = Array.from(
    new Set(missionRows.map((row) => String(row.category_id ?? "")).filter(Boolean)),
  );
  const categoryNameById = new Map<string, string>();

  if (categoryIds.length > 0) {
    const missionCategoryResult = await supabase
      .from("mission_categories")
      .select("id, name")
      .in("id", categoryIds);

    const categoryRows = !missionCategoryResult.error
      ? missionCategoryResult.data ?? []
      : (
          await supabase
            .from("categories")
            .select("id, name")
            .in("id", categoryIds)
        ).data ?? [];

    for (const category of categoryRows) {
      categoryNameById.set(String(category.id), String(category.name ?? ""));
    }
  }

  const placeById = new Map<
    string,
    { name: string | null; lat: number | null; lng: number | null }
  >();

  if (placeIds.length > 0) {
    const { data: placeRows } = await supabase
      .from("places")
      .select("id, name, latitude, longitude")
      .in("id", placeIds);

    for (const place of placeRows ?? []) {
      const latitude = place.latitude == null ? Number.NaN : Number(place.latitude);
      const longitude = place.longitude == null ? Number.NaN : Number(place.longitude);
      placeById.set(String(place.id), {
        name: String(place.name ?? "").trim() || null,
        lat: Number.isFinite(latitude) ? latitude : null,
        lng: Number.isFinite(longitude) ? longitude : null,
      });
    }
  }

  const metadataByMissionId = new Map<string, MissionRecordMetadata>();
  for (const mission of missionRows) {
    const title = String(mission.title ?? "미션 기록");
    const rawCategory = categoryNameById.get(String(mission.category_id ?? ""));
    const missionLat = mission.place_lat == null
      ? Number.NaN
      : Number(mission.place_lat);
    const missionLng = mission.place_lng == null
      ? Number.NaN
      : Number(mission.place_lng);
    const missionPlaceName = String(mission.place_name ?? "").trim();

    metadataByMissionId.set(String(mission.id), {
      title,
      category: normalizeRecordCategory(rawCategory, title),
      placeName: isGenericMissionPlaceLabel(missionPlaceName)
        ? null
        : missionPlaceName || null,
      placeLat: Number.isFinite(missionLat) ? missionLat : null,
      placeLng: Number.isFinite(missionLng) ? missionLng : null,
    });
  }

  for (const attempt of attempts ?? []) {
    const missionMetadata = metadataByMissionId.get(String(attempt.mission_id));
    const attemptPlace = attempt.place_id
      ? placeById.get(String(attempt.place_id))
      : null;

    result.set(String(attempt.id), {
      title: missionMetadata?.title ?? "미션 기록",
      category: missionMetadata?.category ?? "기타",
      placeName: attemptPlace?.name ?? missionMetadata?.placeName ?? null,
      placeLat: attemptPlace?.lat ?? missionMetadata?.placeLat ?? null,
      placeLng: attemptPlace?.lng ?? missionMetadata?.placeLng ?? null,
    });
  }

  return result;
}

async function resolveDiscoverCoverPhoto(row: any) {
  const photos: (DiscoverPostPhoto & {
    sort_order?: number | null;
  })[] = Array.isArray(row?.photos) ? row.photos : [];

  const sorted = [...photos].sort((left, right) => {
    if (Boolean(left.is_cover) !== Boolean(right.is_cover)) {
      return left.is_cover ? -1 : 1;
    }

    return Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  });

  const storagePath = String(sorted[0]?.storage_path ?? "").trim();
  if (!storagePath) return undefined;

  try {
    return await getDiscoverPhotoUrl(storagePath);
  } catch {
    return undefined;
  }
}

async function resolveRecordCoverPhoto(
  row: any,
): Promise<string | undefined> {
  const photos: (DiscoverPostPhoto & {
    sort_order?: number | null;
  })[] = Array.isArray(row?.record_photos)
    ? row.record_photos
    : [];

  const sorted = [...photos].sort((left, right) => {
    if (Boolean(left.is_cover) !== Boolean(right.is_cover)) {
      return left.is_cover ? -1 : 1;
    }

    return Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  });

  const storagePath = String(sorted[0]?.storage_path ?? "").trim();

  if (!storagePath) {
    return undefined;
  }

  try {
    return await getDiscoverPhotoUrl(storagePath);
  } catch {
    return undefined;
  }
}

function normalizeInterests(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function normalizeRecordVisibility(value: unknown): "private" | "nickname" {
  return String(value ?? "") === "private" ? "private" : "nickname";
}

function getCategoryEmoji(category: string) {
  const emojis: Record<string, string> = { 음식: "🍽️", "카페 및 디저트": "☕", 산책: "🌿", 배움: "📚", 감상: "🎧", 활동: "🏃", 휴식: "🛋️", 기타: "✨" };
  return emojis[category] ?? "✨";
}

function isArchiveFilter(value: string) { return value === "방 안 기록"; }
function isPersonalMapFilter(value: string) { return value === "내 기록"; }

export default function DiscoverScreen() {
  const router = useRouter();
  const { shareMissionToHome } = useMission();

  const [activeFilter, setActiveFilter] = useState("가까운 기록");
  const [bubbles, setBubbles] = useState<DiscoverBubble[]>(MOCK_BUBBLES);
  const [activeBubble, setActiveBubble] = useState<DiscoverBubble | null>(null);
  const [sheetBubble, setSheetBubble] = useState<DiscoverBubble | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [likeUpdatingIds, setLikeUpdatingIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapRecordsLoading, setMapRecordsLoading] = useState(false);
  const [mapRefreshAvailable, setMapRefreshAvailable] = useState(false);
  const [tryingMission, setTryingMission] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentNickname, setCurrentNickname] = useState("나");
  const [deleting, setDeleting] = useState(false);
  const [myInterests, setMyInterests] = useState<string[]>([]);

  const [locationTypeVisible, setLocationTypeVisible] = useState(false);
  const [locationKind, setLocationKind] = useState<RecordLocationKind | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<MapPickerMode>("map");
  const [pickerCenter, setPickerCenter] = useState<Coordinate>(DEFAULT_CENTER);
  const [pickedLocation, setPickedLocation] = useState<Coordinate | null>(null);
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceCandidate | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [pickerPlaceQuery, setPickerPlaceQuery] = useState("");
  const [pickerPlaceSearchResults, setPickerPlaceSearchResults] = useState<PlaceCandidate[]>([]);
  const [pickerPlaceSearching, setPickerPlaceSearching] = useState(false);
  const [sharedHomeRecords, setSharedHomeRecords] = useState<HomeRoomRecord[]>([]);
  const [myHomeRecords, setMyHomeRecords] = useState<HomeRoomRecord[]>([]);
  const [homeArchiveTab, setHomeArchiveTab] = useState<HomeArchiveTab>("shared");
  const [homeRecordsLoading, setHomeRecordsLoading] = useState(false);
  const [myRecords, setMyRecords] = useState<MyRecordItem[]>([]);
  const [myRecordsLoading, setMyRecordsLoading] = useState(false);
  const [myRecordVisibilityFilter, setMyRecordVisibilityFilter] = useState<MyRecordVisibilityFilter>("all");
  const [focusedMyRecordKey, setFocusedMyRecordKey] = useState<string | null>(null);
  const [selectedMapBubbleId, setSelectedMapBubbleId] = useState<string | null>(null);
  const [fitMyRecordMarkers, setFitMyRecordMarkers] = useState(false);

  const [registerVisible, setRegisterVisible] = useState(false);
  const [recordTitle, setRecordTitle] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [emotion, setEmotion] = useState<EmotionValue | "">("");
  const [experiencePreference, setExperiencePreference] =
    useState<ExperiencePreferenceValue | "">("");
  const [visibility, setVisibility] = useState<RecordVisibility>("private");
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [placeGroupName, setPlaceGroupName] = useState("");
  const [placeGroupRecords, setPlaceGroupRecords] =
    useState<DiscoverBubble[]>([]);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_CLOSE_POSITION)).current;
  const dragStart = useRef(0);
  const homeSheetTranslateY = useRef(new Animated.Value(HOME_SHEET_CLOSE_POSITION)).current;
  const homeDragStart = useRef(0);
  const mySheetTranslateY = useRef(new Animated.Value(MY_SHEET_CLOSE_POSITION)).current;
  const mySheetDragStart = useRef(0);
  const myRecordsListRef = useRef<ScrollView | null>(null);
  const myRecordFilterIndicator = useRef(new Animated.Value(0)).current;
  const myRecordContentAnimation = useRef(new Animated.Value(1)).current;
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerPlaceSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapSearchSequence = useRef(0);
  const mapCenterRef = useRef<Coordinate>(DEFAULT_CENTER);
  const lastMapSearchCenterRef = useRef<Coordinate | null>(null);
  const activeFilterRef = useRef(activeFilter);
  const placeSearchSequence = useRef(0);

  useEffect(() => { mapCenterRef.current = mapCenter; }, [mapCenter]);
  useEffect(() => { activeFilterRef.current = activeFilter; }, [activeFilter]);

  const glowAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  const loop = Animated.loop(
    Animated.sequence([
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 1100,
        useNativeDriver: true,
      }),
    ]),
  );

  loop.start();

  return () => {
    loop.stop();
  };
}, [glowAnim]);

  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const btnScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const loadLikedPostIds = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("discover_post_likes").select("post_id").eq("user_id", userId);
    if (!error) setLikedPostIds((data ?? []).map((row) => String(row.post_id)));
  }, []);

  const loadHomeRecords = useCallback(async (userId: string) => {
    setHomeRecordsLoading(true);
    try {
      const [homeDiscoverRpcResult, missionResult] = await Promise.all([
        supabase.rpc("get_home_room_discover_posts"),
        supabase.from("records").select("id, mission_attempt_id, content, emotion, visibility, recorded_at, created_at, location_type, location_name").eq("user_id", userId).eq("location_type", "home").order("recorded_at", { ascending: false }),
      ]);

      let discoverRows: any[] = [];
      if (homeDiscoverRpcResult.error) {
        const fallbackResult = await supabase.from("discover_posts").select("id, user_id, title, source_kind, content, emotion, category, visibility, likes_count, created_at, place_name").eq("place_name", "내 방").or(`visibility.eq.anonymous,user_id.eq.${userId}`).order("created_at", { ascending: false });
        discoverRows = fallbackResult.data ?? [];
      } else {
        discoverRows = Array.isArray(homeDiscoverRpcResult.data) ? homeDiscoverRpcResult.data : [];
      }

      const missionMetadataByAttemptId = await getMissionMetadataByAttemptIds((missionResult.data ?? []).map((row) => String(row.mission_attempt_id ?? "")).filter(Boolean));
      const homeDisplayMetadata = new Map<string, { nickname: string; shareMode: "anonymous" | "nickname" }>();
      const homePostIds = discoverRows.map((row) => String(row.id ?? "")).filter(Boolean);

      if (homePostIds.length > 0) {
        const { data: displayRows } = await supabase.rpc("get_discover_post_display_metadata", { p_post_ids: homePostIds });
        for (const row of displayRows ?? []) {
          homeDisplayMetadata.set(String(row.id), { nickname: String(row.author_nickname ?? "").trim() || "사용자", shareMode: row.share_mode === "nickname" ? "nickname" : "anonymous" });
        }
      }

      const discoverRecords: HomeRoomRecord[] = discoverRows.map((row) => {
        const ownerId = row.user_id ? String(row.user_id) : null;
        const content = String(row.content ?? "");
        const displayMetadata = homeDisplayMetadata.get(String(row.id));
        return {
          id: String(row.id),
          source: "discover",
          userId: ownerId,
          isMine: ownerId === userId,
          title: String(row.title ?? "").trim() || content.slice(0, 40) || "방 안 기록",
          content,
          emotion: EMOTION_LABEL[String(row.emotion ?? "")] ?? String(row.emotion ?? ""),
          category: String(row.category ?? "기타"),
          visibility: String(row.visibility ?? "private"),
          createdAt: String(row.created_at ?? ""),
          likes: Number(row.likes_count ?? 0),
          sourceKind: row.source_kind === "mission" ? "mission" : "independent",
          nickname: displayMetadata?.nickname ?? (ownerId === userId ? "나" : "익명"),
          shareMode: displayMetadata?.shareMode ?? "anonymous",
        };
      });

      const missionRecords: HomeRoomRecord[] = (missionResult.data ?? []).map((row) => {
        const attemptId = String(row.mission_attempt_id ?? "");
        return {
          id: String(row.id),
          source: "mission",
          userId,
          isMine: true,
          title: missionMetadataByAttemptId.get(attemptId)?.title ?? "미션 기록",
          content: String(row.content ?? ""),
          emotion: EMOTION_LABEL[String(row.emotion ?? "")] ?? String(row.emotion ?? ""),
          category: missionMetadataByAttemptId.get(attemptId)?.category ?? "기타",
          visibility: String(row.visibility ?? "private"),
          createdAt: String(row.recorded_at ?? row.created_at ?? ""),
          likes: 0,
          sourceKind: "mission",
          nickname: "나",
          shareMode: normalizeRecordVisibility(row.visibility),
        };
      });

      const byNewest = (a: HomeRoomRecord, b: HomeRoomRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      setSharedHomeRecords(discoverRecords.filter((record) => record.visibility !== "private").sort(byNewest));
      setMyHomeRecords([...discoverRecords.filter((record) => record.isMine), ...missionRecords].sort(byNewest));
    } finally {
      setHomeRecordsLoading(false);
    }
  }, []);

  const loadMyRecords = useCallback(async (userId: string) => {
    setMyRecordsLoading(true);
    try {
      let discoverRows: any[] = [];
      const discoverSelections = [
        `id, title, source_kind, content, emotion, category, visibility, share_mode, likes_count, created_at, place_name, lat, lng, photos:discover_post_photos(storage_path, is_cover, sort_order)`,
        `id, title, source_kind, content, emotion, category, visibility, share_mode, likes_count, created_at, place_name, lat, lng, photos:discover_photos(storage_path, is_cover, sort_order)`,
        `id, title, source_kind, content, emotion, category, visibility, share_mode, likes_count, created_at, place_name, lat, lng, photos(storage_path, is_cover, sort_order)`,
      ];

      for (const selection of discoverSelections) {
        const result = await supabase.from("discover_posts").select(selection).eq("user_id", userId).order("created_at", { ascending: false });
        if (!result.error) { discoverRows = result.data ?? []; break; }
      }

      if (discoverRows.length === 0) {
        const fallbackDiscoverResult = await supabase.from("discover_posts").select("id, title, source_kind, content, emotion, category, visibility, likes_count, created_at, place_name, lat, lng").eq("user_id", userId).order("created_at", { ascending: false });
        discoverRows = fallbackDiscoverResult.data ?? [];
      }

      const recordsResult = await supabase.from("records").select(`id, mission_attempt_id, content, emotion, visibility, recorded_at, created_at, location_name, location_type, location_latitude, location_longitude, record_photos(storage_path, is_cover, sort_order)`).eq("user_id", userId).order("recorded_at", { ascending: false });

      const missionMetadataByAttemptId = await getMissionMetadataByAttemptIds((recordsResult.data ?? []).map((row) => String(row.mission_attempt_id ?? "")).filter(Boolean));

      const independentRecords = await Promise.all(
        discoverRows.filter((row) => row.source_kind !== "mission").map(async (row): Promise<MyRecordItem> => {
          const content = String(row.content ?? "");
          const title = String(row.title ?? "").trim() || content.slice(0, 40) || "기록";
          return {
            key: `discover-${row.id}`,
            id: String(row.id),
            source: "discover",
            discoverPostId: String(row.id),
            missionAttemptId: null,
            title,
            content,
            placeName: String(row.place_name ?? "장소 정보 없음"),
            emotion: EMOTION_LABEL[String(row.emotion ?? "")] ?? String(row.emotion ?? ""),
            category: normalizeRecordCategory(row.category, `${title} ${content}`),
            visibility: normalizeRecordVisibility(row.share_mode ?? row.visibility),
            createdAt: String(row.created_at ?? ""),
            likes: Number(row.likes_count ?? 0),
            lat: Number.isFinite(Number(row.lat)) ? Number(row.lat) : null,
            lng: Number.isFinite(Number(row.lng)) ? Number(row.lng) : null,
            photo: await resolveDiscoverCoverPhoto(row),
          };
        }),
      );

      const missionRecords = await Promise.all(
        (recordsResult.data ?? []).map(async (row): Promise<MyRecordItem> => {
          const attemptId = String(row.mission_attempt_id ?? "");
          const metadata = missionMetadataByAttemptId.get(attemptId);
          const content = String(row.content ?? "");
          const title = metadata?.title ?? "미션 기록";
          const storedPlaceName = String(row.location_name ?? "").trim();
          const isHomeRecord = row.location_type === "home";
          const storedLat = row.location_latitude == null
            ? Number.NaN
            : Number(row.location_latitude);
          const storedLng = row.location_longitude == null
            ? Number.NaN
            : Number(row.location_longitude);
          const resolvedPlaceName = isHomeRecord
            ? "내 방"
            : !isGenericMissionPlaceLabel(storedPlaceName)
              ? storedPlaceName
              : metadata?.placeName ?? "장소 정보 없음";

          return {
            key: `mission-${row.id}`,
            id: String(row.id),
            source: "mission",
            discoverPostId: null,
            missionAttemptId: attemptId || null,
            title,
            content,
            placeName: resolvedPlaceName,
            emotion: EMOTION_LABEL[String(row.emotion ?? "")] ?? String(row.emotion ?? ""),
            category: metadata?.category ?? inferRecordCategory(`${title} ${content}`),
            visibility: normalizeRecordVisibility(row.visibility),
            createdAt: String(row.recorded_at ?? row.created_at ?? ""),
            likes: 0,
            lat: Number.isFinite(storedLat)
              ? storedLat
              : metadata?.placeLat ?? null,
            lng: Number.isFinite(storedLng)
              ? storedLng
              : metadata?.placeLng ?? null,
            photo: await resolveRecordCoverPhoto(row),
          };
        }),
      );

      setMyRecords([...independentRecords, ...missionRecords].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } finally {
      setMyRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      if (user) {
        const { data: profileData } = await supabase.from("profiles").select("interests, nickname").eq("id", user.id).maybeSingle();
        setMyInterests(normalizeInterests(profileData?.interests));
        setCurrentNickname(String(profileData?.nickname ?? "").trim() || "나");
        await Promise.all([loadHomeRecords(user.id), loadMyRecords(user.id), loadLikedPostIds(user.id)]);
      }

      let lat = DEFAULT_CENTER.lat;
      let lng = DEFAULT_CENTER.lng;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        const currentCoordinate = { lat, lng };
        setUserLocation(currentCoordinate);
        setMapCenter(currentCoordinate);
        mapCenterRef.current = currentCoordinate;
      }

      try {
        lastMapSearchCenterRef.current = { lat, lng };
        const posts = await getNearbyDiscoverPosts(lat, lng, MAP_AUTO_SEARCH_RADIUS_KM);
        if (posts.length > 0) setBubbles(await buildBubbleList(posts));
      } catch {}
    };
    void init();
  }, [loadHomeRecords, loadLikedPostIds, loadMyRecords]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const refreshDiscoverPosts = async () => {
        const { lat, lng } = mapCenterRef.current;
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isActive) {
          setCurrentUserId(user.id);
          await Promise.all([loadHomeRecords(user.id), loadMyRecords(user.id), loadLikedPostIds(user.id)]);
        }

        try {
          const posts = await getNearbyDiscoverPosts(lat, lng, MAP_AUTO_SEARCH_RADIUS_KM);
          const nextBubbles = posts.length > 0 ? await buildBubbleList(posts) : [];
          lastMapSearchCenterRef.current = { lat, lng };
          if (isActive) {
            setMapRefreshAvailable(false);
            setBubbles(nextBubbles);
          }
        } catch {}
      };
      void refreshDiscoverPosts();
      return () => { isActive = false; };
    }, [loadHomeRecords, loadLikedPostIds, loadMyRecords])
  );

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }

    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery.trim())}&size=5`, { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } });
        const data = await res.json();
        setSearchResults(data.documents ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (pickerPlaceSearchDebounce.current) clearTimeout(pickerPlaceSearchDebounce.current);
    if (!pickerVisible || pickerMode !== "place" || !pickerPlaceQuery.trim()) {
      setPickerPlaceSearchResults([]);
      setPickerPlaceSearching(false);
      return;
    }

    pickerPlaceSearchDebounce.current = setTimeout(async () => {
      setPickerPlaceSearching(true);
      const center = pickedLocation ?? pickerCenter;
      try {
        const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(pickerPlaceQuery.trim())}&x=${encodeURIComponent(String(center.lng))}&y=${encodeURIComponent(String(center.lat))}&sort=distance&size=8`;
        const response = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } });
        const data = (await response.json()) as { documents?: KakaoPlaceDocument[] };
        const nextResults = (data.documents ?? []).map((document, index): PlaceCandidate | null => {
          const latitude = Number(document.y);
          const longitude = Number(document.x);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          return {
            id: String(document.id ?? `search-${index}-${latitude}-${longitude}`),
            name: String(document.place_name ?? "장소"),
            latitude, longitude,
            address: String(document.road_address_name || document.address_name || ""),
            categoryDetail: String(document.category_name || document.category_group_name || "장소"),
            distanceM: Number(document.distance) || haversineM(center.lat, center.lng, latitude, longitude),
          };
        }).filter((place): place is PlaceCandidate => place !== null);
        setPickerPlaceSearchResults(nextResults);
      } catch {
        setPickerPlaceSearchResults([]);
      } finally {
        setPickerPlaceSearching(false);
      }
    }, 350);

    return () => { if (pickerPlaceSearchDebounce.current) clearTimeout(pickerPlaceSearchDebounce.current); };
  }, [pickerPlaceQuery, pickerVisible, pickerMode, pickerCenter, pickedLocation]);

  useEffect(() => {
  if (activeBubble) {
    setSheetBubble(activeBubble);

    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
    }).start();
  }
}, [activeBubble, sheetTranslateY]);

  const closeSheet = useCallback(() => {
  Animated.timing(sheetTranslateY, {
    toValue: SHEET_CLOSE_POSITION,
    duration: 220,
    useNativeDriver: true,
  }).start(() => {
    setActiveBubble(null);
    setSheetBubble(null);
    setPlaceGroupName("");
    setPlaceGroupRecords([]);
  });
}, [sheetTranslateY]);

  const openSheet = () => { Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }).start(); };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => { sheetTranslateY.stopAnimation((v) => (dragStart.current = v)); },
      onPanResponderMove: (_e, g) => { sheetTranslateY.setValue(Math.max(0, dragStart.current + g.dy)); },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(0, dragStart.current + g.dy);
        if (current > 120 || g.vy > 0.6) closeSheet();
        else openSheet();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const openHomeSheet = useCallback(() => {
  homeSheetTranslateY.stopAnimation();

  Animated.spring(homeSheetTranslateY, {
    toValue: 0,
    useNativeDriver: true,
    damping: 22,
    stiffness: 180,
  }).start();
}, [homeSheetTranslateY]);

  const closeHomeSheet = (nextFilter = "가까운 기록") => {
    homeSheetTranslateY.stopAnimation();
    Animated.timing(homeSheetTranslateY, { toValue: HOME_SHEET_CLOSE_POSITION, duration: 220, useNativeDriver: true }).start(() => {
      setActiveFilter(nextFilter);
    });
  };

  useEffect(() => {
  if (activeFilter === "방 안 기록") {
    openHomeSheet();
  }
}, [activeFilter, openHomeSheet]);

  const homePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => { homeSheetTranslateY.stopAnimation((value) => (homeDragStart.current = value)); },
      onPanResponderMove: (_e, g) => { homeSheetTranslateY.setValue(Math.max(0, homeDragStart.current + g.dy)); },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(0, homeDragStart.current + g.dy);
        if (current > 120 || g.vy > 0.6) closeHomeSheet();
        else Animated.spring(homeSheetTranslateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }).start();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const openMyRecordsSheet = useCallback(
  (expanded = false) => {
    mySheetTranslateY.stopAnimation();

    Animated.spring(mySheetTranslateY, {
      toValue: expanded ? 0 : MY_SHEET_COLLAPSED_POSITION,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
    }).start();
  },
  [mySheetTranslateY],
);

  const closeMyRecordsSheet = (callback?: () => void) => {
    mySheetTranslateY.stopAnimation();
    Animated.timing(mySheetTranslateY, { toValue: MY_SHEET_CLOSE_POSITION, duration: 220, useNativeDriver: true }).start(callback);
  };

  useEffect(() => {
  if (activeFilter === "내 기록") {
    setFitMyRecordMarkers(true);
    openMyRecordsSheet(false);
  }
}, [activeFilter, openMyRecordsSheet]);

  const mySheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => { mySheetTranslateY.stopAnimation((value) => (mySheetDragStart.current = value)); },
      onPanResponderMove: (_e, g) => {
        mySheetTranslateY.setValue(Math.max(0, Math.min(MY_SHEET_COLLAPSED_POSITION, mySheetDragStart.current + g.dy)));
      },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(0, Math.min(MY_SHEET_COLLAPSED_POSITION, mySheetDragStart.current + g.dy));
        const shouldCollapse = g.vy > 0.45 || (g.vy >= -0.45 && current > MY_SHEET_COLLAPSED_POSITION / 2);
        Animated.spring(mySheetTranslateY, { toValue: shouldCollapse ? MY_SHEET_COLLAPSED_POSITION : 0, useNativeDriver: true, damping: 22, stiffness: 180 }).start();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const webDragStyle = Platform.OS === "web" ? ({ touchAction: "none", userSelect: "none", cursor: "grab" } as any) : undefined;

  const handleMapIdle = useCallback((lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const nextCenter = { lat, lng };
    mapCenterRef.current = nextCenter;
    setMapCenter(nextCenter);

    if (isArchiveFilter(activeFilterRef.current) || isPersonalMapFilter(activeFilterRef.current)) {
      if (activeFilterRef.current === "내 기록") {
        setFitMyRecordMarkers(false);
      }
      setMapRefreshAvailable(false);
      return;
    }

    const lastCenter = lastMapSearchCenterRef.current;
    const movedFarEnough = !lastCenter || haversineM(lastCenter.lat, lastCenter.lng, lat, lng) >= MAP_AUTO_SEARCH_MIN_MOVE_M;
    setMapRefreshAvailable(movedFarEnough);
  }, []);

  const handleRefreshAtMapCenter = useCallback(async () => {
    if (mapRecordsLoading || isArchiveFilter(activeFilterRef.current) || isPersonalMapFilter(activeFilterRef.current)) return;

    const { lat, lng } = mapCenterRef.current;
    const requestId = ++mapSearchSequence.current;
    setMapRecordsLoading(true);

    try {
      const posts = await getNearbyDiscoverPosts(lat, lng, MAP_AUTO_SEARCH_RADIUS_KM);
      const nextBubbles = posts.length > 0 ? await buildBubbleList(posts) : [];
      if (requestId !== mapSearchSequence.current) return;
      lastMapSearchCenterRef.current = { lat, lng };
      setBubbles(nextBubbles);
      setMapRefreshAvailable(false);
    } catch {
      if (requestId === mapSearchSequence.current) {
        Alert.alert("새로고침 실패", "이 위치의 기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      if (requestId === mapSearchSequence.current) setMapRecordsLoading(false);
    }
  }, [mapRecordsLoading]);

  const visibleMyRecords = useMemo(() => myRecords.filter((record) => {
    if (myRecordVisibilityFilter === "all") return true;
    return record.visibility === myRecordVisibilityFilter;
  }), [myRecordVisibilityFilter, myRecords]);

  const orderedVisibleMyRecords = useMemo(() => {
    if (!focusedMyRecordKey) return visibleMyRecords;
    const focusedIndex = visibleMyRecords.findIndex((record) => record.key === focusedMyRecordKey);
    if (focusedIndex <= 0) return visibleMyRecords;
    return [visibleMyRecords[focusedIndex], ...visibleMyRecords.slice(0, focusedIndex), ...visibleMyRecords.slice(focusedIndex + 1)];
  }, [focusedMyRecordKey, visibleMyRecords]);

  const myRecordVisibilityCounts = useMemo(() => ({
    all: myRecords.length,
    private: myRecords.filter((record) => record.visibility === "private").length,
    nickname: myRecords.filter((record) => record.visibility === "nickname").length,
  }), [myRecords]);

  const changeMyRecordVisibilityFilter = useCallback((nextFilter: MyRecordVisibilityFilter) => {
    if (nextFilter === myRecordVisibilityFilter) return;

    Animated.spring(myRecordFilterIndicator, { toValue: MY_RECORD_FILTER_INDEX[nextFilter], useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.8 }).start();
    Animated.timing(myRecordContentAnimation, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setMyRecordVisibilityFilter(nextFilter);
      setFocusedMyRecordKey(null);
      setSelectedMapBubbleId(null);
      setFitMyRecordMarkers(true);
      myRecordsListRef.current?.scrollTo({ y: 0, animated: false });
      myRecordContentAnimation.setValue(0);
      Animated.timing(myRecordContentAnimation, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }, [myRecordContentAnimation, myRecordFilterIndicator, myRecordVisibilityFilter]);

  const myRecordBubbles = useMemo<DiscoverBubble[]>(() => visibleMyRecords.flatMap((record) => {
    if (record.placeName === "내 방" || record.lat === null || record.lng === null || !Number.isFinite(record.lat) || !Number.isFinite(record.lng) || (record.lat === 0 && record.lng === 0)) return [];
    const discoverPostId = record.discoverPostId;
    return [{
      id: discoverPostId ?? `mission-record-${record.id}`,
      discoverPostId,
      missionRecordId: record.source === "mission" ? record.id : null,
      missionAttemptId: record.missionAttemptId,
      canLike: Boolean(discoverPostId) && record.visibility === "nickname",
      canDelete: true,
      user_id: currentUserId,
      place: record.placeName,
      lat: record.lat,
      lng: record.lng,
      mission: record.title,
      sourceKind: record.source === "mission" ? "mission" : "independent",
      time: record.createdAt ? new Date(record.createdAt).toLocaleDateString("ko-KR") : "날짜 정보 없음",
      nick: currentNickname,
      emotion: record.emotion,
      note: record.content,
      likes: record.likes,
      category: normalizeRecordCategory(record.category, `${record.title} ${record.content}`),
      photo: record.photo,
      real: Boolean(discoverPostId),
    }];
  }), [currentNickname, currentUserId, visibleMyRecords]);

  const focusMyRecordOnMap = useCallback((record: MyRecordItem) => {
    const markerId = record.discoverPostId ?? `mission-record-${record.id}`;
    const bubble = myRecordBubbles.find((item) => String(item.id) === String(markerId));
    if (!bubble) {
      Alert.alert("지도 위치가 없어요", "이 기록은 방 안 기록이거나 저장된 위치 정보가 없어 지도에서 볼 수 없어요.");
      return;
    }
    const nextCenter = { lat: bubble.lat, lng: bubble.lng };
    mapCenterRef.current = nextCenter;
    setMapCenter(nextCenter);
    setFitMyRecordMarkers(false);
    setFocusedMyRecordKey(record.key);
    setSelectedMapBubbleId(String(bubble.id));
    setActiveBubble(null);
    setSheetBubble(null);

    mySheetTranslateY.stopAnimation();
    Animated.spring(mySheetTranslateY, { toValue: MY_SHEET_COLLAPSED_POSITION, useNativeDriver: true, damping: 22, stiffness: 180 }).start();
    setTimeout(() => { myRecordsListRef.current?.scrollTo({ y: 0, animated: true }); }, 40);
  }, [myRecordBubbles, mySheetTranslateY]);

  const filteredBubbles = useMemo(() => {
    if (isArchiveFilter(activeFilter)) return [];
    if (activeFilter === "내 기록") return myRecordBubbles;
    if (activeFilter === "내 취향") {
      if (myInterests.length === 0) return bubbles;
      return bubbles.filter((b) => myInterests.includes(b.category));
    }
    if (activeFilter === "새로운 분야") {
      if (myInterests.length === 0) return bubbles;
      return bubbles.filter((b) => !myInterests.includes(b.category));
    }
    if (activeFilter === "산책") return bubbles.filter((b) => b.category === "산책");
    return bubbles;
  }, [activeFilter, bubbles, myInterests, myRecordBubbles]);

  const groupedMapBubbles = useMemo(
    () =>
      activeFilter === "내 기록"
        ? filteredBubbles
        : groupDiscoverBubblesByPlace(filteredBubbles),
    [activeFilter, filteredBubbles],
  );

  const visibleHomeRecords = homeArchiveTab === "shared" ? sharedHomeRecords : myHomeRecords;

  const applyLikeResult = useCallback((postId: string, liked: boolean, likesCount: number) => {
    setLikedPostIds((current) => liked ? (current.includes(postId) ? current : [...current, postId]) : current.filter((id) => id !== postId));
    setBubbles((current) => current.map((item) => item.id === postId ? { ...item, likes: likesCount } : item));
    setSheetBubble((current) => current?.id === postId ? { ...current, likes: likesCount } : current);
    setPlaceGroupRecords((current) =>
      sortDiscoverRecords(
        current.map((item) =>
          item.discoverPostId === postId || item.id === postId
            ? { ...item, likes: likesCount }
            : item,
        ),
      ),
    );
    setSharedHomeRecords((current) => current.map((item) => item.id === postId ? { ...item, likes: likesCount } : item));
    setMyHomeRecords((current) => current.map((item) => item.id === postId ? { ...item, likes: likesCount } : item));
    setMyRecords((current) => current.map((item) => item.discoverPostId === postId ? { ...item, likes: likesCount } : item));
  }, []);

  const handleToggleLike = useCallback(async (postId: string) => {
    if (!currentUserId) { Alert.alert("로그인이 필요해요", "좋아요를 누르려면 먼저 로그인해주세요."); return; }
    if (likeUpdatingIds.includes(postId)) return;

    if (postId.startsWith("mock-")) {
      const nextLiked = !likedPostIds.includes(postId);
      const currentCount = bubbles.find((item) => item.id === postId)?.likes ?? 0;
      applyLikeResult(postId, nextLiked, Math.max(0, currentCount + (nextLiked ? 1 : -1)));
      return;
    }

    setLikeUpdatingIds((current) => [...current, postId]);
    try {
      const { data, error } = await supabase.rpc("toggle_discover_post_like", { p_post_id: postId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      applyLikeResult(postId, Boolean(row?.liked), Number(row?.likes_count ?? 0));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as any).message)
            : JSON.stringify(error);
      console.error("좋아요 저장 실패 상세:", error);
      Alert.alert("좋아요 실패", message);
    } finally {
      setLikeUpdatingIds((current) => current.filter((id) => id !== postId));
    }
  }, [applyLikeResult, bubbles, currentUserId, likedPostIds, likeUpdatingIds]);

  const handleTryMission = useCallback(
  async (targetBubble?: DiscoverBubble) => {
    const bubble = targetBubble ?? sheetBubble;
    if (!bubble) return;

    if (
      !bubble.real ||
      !bubble.discoverPostId ||
      bubble.sourceKind !== "mission" ||
      !bubble.sourceMissionId
    ) {
      Alert.alert(
        "가져올 미션이 없어요",
        "이 기록은 원본 미션과 연결되어 있지 않아 홈으로 가져올 수 없어요.",
      );
      return;
    }

    setTryingMission(true);

    try {
      const mission = await getOriginalMissionFromDiscoverPost(
        bubble.discoverPostId,
      );

      const normalizedPlaceName = String(
        mission.place_name ?? "",
      )
        .replace(/\s+/g, "")
        .toLowerCase();

      const isAtHome = normalizedPlaceName === "내방";
      const isLocationFlexible =
        !isAtHome &&
        (normalizedPlaceName === "어디서나가능" ||
          (mission.requires_place === false &&
            !mission.place_name &&
            mission.place_lat == null &&
            mission.place_lng == null));

      const fixedPlaceName =
        mission.place_name ?? bubble.place;

      const placeLat =
        mission.place_lat ??
        (!isAtHome && !isLocationFlexible
          ? bubble.lat
          : null);

      const placeLng =
        mission.place_lng ??
        (!isAtHome && !isLocationFlexible
          ? bubble.lng
          : null);

      shareMissionToHome({
        id: mission.id,
        title: mission.title,
        desc: mission.short_description,
        instructions: mission.instructions,
        recommendationReason:
          mission.recommendation_reason ?? "",
        durationMinutes: mission.estimated_duration_min,
        time: mission.estimated_duration_min
          ? `${mission.estimated_duration_min}분`
          : "시간 자유",
        dist: isAtHome
          ? "내 방"
          : isLocationFlexible
            ? "어디서나 가능"
            : "거리 정보 없음",
        cost:
          mission.estimated_cost === 0
            ? "무료"
            : "유료",
        cat:
          mission.category?.name ??
          bubble.category ??
          "기타",
        requiredItems: mission.required_items ?? [],
        placeId: mission.place_id ?? undefined,
        placeLat:
          placeLat == null ? undefined : placeLat,
        placeLng:
          placeLng == null ? undefined : placeLng,
        placeName: isAtHome
          ? "내 방"
          : isLocationFlexible
            ? "어디서나 가능"
            : fixedPlaceName,
        placeAddress:
          mission.place_address ?? undefined,
        requiresPlace:
          mission.requires_place ?? undefined,
        isAtHome,
        isLocationFlexible,
      });

      setSelectedMapBubbleId(null);
      closeSheet();
      router.push("/");
    } catch (error) {
      Alert.alert(
        "미션 가져오기 실패",
        error instanceof Error
          ? error.message
          : "원본 미션을 불러오지 못했어요.",
      );
    } finally {
      setTryingMission(false);
    }
  },
  [
    closeSheet,
    router,
    shareMissionToHome,
    sheetBubble,
  ],
);

  const deleteMissionRecord = useCallback(
  async (
    recordId: string,
    missionAttemptId: string | null,
  ) => {
    if (!currentUserId) {
      throw new Error("로그인이 필요합니다.");
    }

    const { data: photoRows, error: photoQueryError } =
      await supabase
        .from("record_photos")
        .select("storage_path")
        .eq("record_id", recordId);

    if (photoQueryError) {
      throw photoQueryError;
    }

    const storagePaths = (photoRows ?? [])
      .map((photo) =>
        String(photo.storage_path ?? "").trim(),
      )
      .filter(Boolean);

    if (storagePaths.length > 0) {
      const { error: storageError } =
        await supabase.storage
          .from("record-photos")
          .remove(storagePaths);

      if (storageError) {
        console.warn(
          "기록 사진 파일 삭제 실패:",
          storageError,
        );
      }
    }

    const { error: feedbackError } = await supabase
      .from("mission_feedback")
      .delete()
      .eq("record_id", recordId)
      .eq("user_id", currentUserId);

    if (feedbackError) {
      console.warn(
        "기록 호불호 삭제 실패:",
        feedbackError,
      );
    }

    const { error: recordError } = await supabase
      .from("records")
      .delete()
      .eq("id", recordId)
      .eq("user_id", currentUserId);

    if (recordError) {
      throw recordError;
    }

    if (missionAttemptId) {
      const { error: attemptError } = await supabase
        .from("mission_attempts")
        .update({
          status: "selected",
          completed_at: null,
        })
        .eq("id", missionAttemptId)
        .eq("user_id", currentUserId);

      if (attemptError) {
        console.warn(
          "미션 진행 상태 복원 실패:",
          attemptError,
        );
      }
    }
  },
  [currentUserId],
);

  const deleteRecordTarget = useCallback(
  async (target: {
    source: "discover" | "mission";
    discoverPostId?: string | null;
    missionRecordId?: string | null;
    missionAttemptId?: string | null;
  }) => {
    if (
      target.source === "discover" &&
      target.discoverPostId
    ) {
      await deleteDiscoverPost(target.discoverPostId);
      return;
    }

    if (
      target.source === "mission" &&
      target.missionRecordId
    ) {
      await deleteMissionRecord(
        target.missionRecordId,
        target.missionAttemptId ?? null,
      );
      return;
    }

    throw new Error(
      "삭제할 기록 정보를 확인하지 못했습니다.",
    );
  },
  [deleteMissionRecord],
);

  const handleDeleteBubble = useCallback(
  (targetBubble?: DiscoverBubble) => {
    const bubble = targetBubble ?? sheetBubble;
    if (!bubble || bubble.multi) return;

    const source = bubble.missionRecordId
      ? "mission"
      : "discover";

    Alert.alert(
      "기록을 삭제할까요?",
      "삭제하면 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);

            try {
              await deleteRecordTarget({
                source,
                discoverPostId: bubble.discoverPostId,
                missionRecordId: bubble.missionRecordId,
                missionAttemptId: bubble.missionAttemptId,
              });

              setSelectedMapBubbleId(null);
              setFocusedMyRecordKey(null);
              setFitMyRecordMarkers(false);
              closeSheet();

              if (currentUserId) {
                await Promise.all([
                  loadMyRecords(currentUserId),
                  loadHomeRecords(currentUserId),
                ]);
              }

              const currentCenter = mapCenterRef.current;
              const posts = await getNearbyDiscoverPosts(
                currentCenter.lat,
                currentCenter.lng,
                MAP_AUTO_SEARCH_RADIUS_KM,
              );

              setBubbles(
                posts.length > 0
                  ? await buildBubbleList(posts)
                  : [],
              );
            } catch (error) {
              Alert.alert(
                "삭제 실패",
                error instanceof Error
                  ? error.message
                  : "기록을 삭제하지 못했습니다.",
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  },
  [
  closeSheet,
  currentUserId,
  deleteRecordTarget,
  loadHomeRecords,
  loadMyRecords,
  sheetBubble,
],
);

  const handleDeleteMyRecord = (record: MyRecordItem) => {
    Alert.alert("기록을 삭제할까요?", "삭제하면 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteRecordTarget({
              source: record.source,
              discoverPostId: record.discoverPostId,
              missionRecordId: record.source === "mission" ? record.id : null,
              missionAttemptId: record.missionAttemptId,
            });
            setSelectedMapBubbleId(null);
            setFocusedMyRecordKey(null);
            setFitMyRecordMarkers(false);
            if (currentUserId) {
              await Promise.all([
                loadMyRecords(currentUserId),
                loadHomeRecords(currentUserId),
              ]);
            }
          } catch (error) {
            Alert.alert(
              "삭제 실패",
              error instanceof Error ? error.message : "기록을 삭제하지 못했습니다.",
            );
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleSelectSearchResult = async (place: KakaoPlace) => {
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);
    const selectedCenter = { lat, lng };
    mapCenterRef.current = selectedCenter;
    lastMapSearchCenterRef.current = selectedCenter;
    setMapRefreshAvailable(false);
    setMapCenter(selectedCenter);
    setSearchQuery(""); setSearchResults([]); Keyboard.dismiss();

    try {
      const posts = await getNearbyDiscoverPosts(lat, lng, SEARCH_RESULT_RADIUS_KM);
      setBubbles(posts.length > 0 ? await buildBubbleList(posts) : []);
    } catch {
      setBubbles([]);
    }
  };

  const resetRecordForm = () => { setRecordTitle(""); setCategory(""); setContent(""); setEmotion(""); setExperiencePreference(""); setVisibility("private"); setPhotos([]); };
  const openLocationTypePicker = () => { setLocationTypeVisible(true); };

  const chooseLocationKind = (kind: RecordLocationKind) => {
    placeSearchSequence.current += 1;
    setLocationKind(kind); setLocationTypeVisible(false); setPickedLocation(null); setSelectedPlace(null);
    setPlaceCandidates([]); setPickerPlaceQuery(""); setPickerPlaceSearchResults([]); setPickerPlaceSearching(false); setPlacesLoading(false);
    resetRecordForm();

    if (kind === "home") {
      setPlaceName("내 방"); setVisibility("private"); setRegisterVisible(true); return;
    }

    const center = mapCenterRef.current ?? mapCenter ?? userLocation ?? DEFAULT_CENTER;
    setPickerMode(kind); setPickerCenter(center); setPlaceName(kind === "map" ? "거리" : ""); setPickerVisible(true);
  };

  const handleMapTapForPicking = async (lat: number, lng: number) => {
    const coordinate = { lat, lng };
    setPickedLocation(coordinate);
    if (pickerMode === "map") return;

    const sequence = ++placeSearchSequence.current;
    setSelectedPlace(null); setPlaceCandidates([]); setPlacesLoading(true);

    try {
      const candidates = await searchNearbyKakaoPlaces(coordinate);
      if (sequence !== placeSearchSequence.current) return;
      setPlaceCandidates(candidates);
      if (candidates.length === 0) {
        Alert.alert("주변 장소를 찾지 못했어요", "다른 위치를 누르거나 장소가 없는 곳이라면 ‘길 위·야외’를 선택해주세요.");
      }
    } catch (error) {
      if (sequence !== placeSearchSequence.current) return;
      Alert.alert("장소 검색에 실패했어요", error instanceof Error ? error.message : "");
    } finally {
      if (sequence === placeSearchSequence.current) setPlacesLoading(false);
    }
  };

  const selectPlaceCandidate = (place: PlaceCandidate) => {
    setSelectedPlace(place); setPickedLocation({ lat: place.latitude, lng: place.longitude });
  };

  const selectPickerSearchResult = (place: PlaceCandidate) => {
    selectPlaceCandidate(place);
    setPickerCenter({ lat: place.latitude, lng: place.longitude });
    setPlaceCandidates((current) => [place, ...current.filter((item) => item.id !== place.id)]);
    setPickerPlaceQuery(""); setPickerPlaceSearchResults([]); Keyboard.dismiss();
  };

  const confirmPickedLocation = () => {
    if (pickerMode === "place" && !selectedPlace) { Alert.alert("실제 장소를 선택해주세요", "주변 실제 장소 목록에서 한 곳을 골라주세요."); return; }
    if (pickerMode === "map" && !pickedLocation) { Alert.alert("위치를 선택해주세요", "지도에서 위치를 한 번 눌러주세요."); return; }
    setLocationKind(pickerMode); setPlaceName(pickerMode === "place" ? selectedPlace?.name ?? "선택한 장소" : "거리");
    setPickerVisible(false); setRegisterVisible(true);
  };

  const closeRegister = (force = false) => { if (saving && !force) return; setRegisterVisible(false); };

  const addPhotos = (newPhotos: ImagePicker.ImagePickerAsset[]) => {
    setPhotos((prev) => {
      const combined = [...prev];
      for (const p of newPhotos) { if (!combined.some((x) => x.uri === p.uri)) combined.push(p); }
      if (combined.length > MAX_PHOTOS) Alert.alert("사진 개수 제한", `사진은 최대 ${MAX_PHOTOS}장까지 추가할 수 있어요.`);
      return combined.slice(0, MAX_PHOTOS);
    });
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert("카메라 권한 필요", "카메라 접근을 허용해주세요."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled) addPhotos(result.assets);
  };

  const handlePickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("사진 권한 필요", "사진 접근을 허용해주세요."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.85 });
    if (!result.canceled) addPhotos(result.assets);
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p.uri !== uri));

  const handleSubmit = async () => {
    if (!locationKind || (locationKind === "place" && !selectedPlace) || (locationKind !== "home" && !pickedLocation) || !recordTitle.trim() || !category || !content.trim() || !emotion || !experiencePreference) {
      Alert.alert("입력 확인", "필수 항목들을 모두 입력하고 선택해주세요.");
      return;
    }

    const effectiveVisibility = visibility;
    const discoverStorageVisibility = effectiveVisibility === "nickname" ? "anonymous" : "private";
    const effectiveCoordinate = locationKind === "home" ? { lat: 0, lng: 0 } : (pickedLocation as Coordinate);
    const effectivePlaceName = locationKind === "place" ? selectedPlace?.name ?? placeName : locationKind === "map" ? "거리" : "내 방";

    setSaving(true);
    try {
      const createdPostId = await createDiscoverPost({
        placeName: effectivePlaceName, lat: effectiveCoordinate.lat, lng: effectiveCoordinate.lng,
        category, content: content.trim(), emotion, visibility: discoverStorageVisibility as any,
        photos: photos.map((photo) => ({ uri: photo.uri, mimeType: photo.mimeType })),
      });

      const { error: metadataError } = await supabase.rpc("set_latest_discover_post_metadata_v2", {
        p_place_name: effectivePlaceName, p_content: content.trim(), p_title: recordTitle.trim(),
        p_source_kind: "independent", p_source_mission_id: null, p_share_mode: effectiveVisibility,
      });
      if (metadataError) throw new Error(`제목 저장 실패: ${metadataError.message}`);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("로그인이 필요합니다.");

      const { error: preferenceError } = await supabase
        .from("mission_feedback")
        .upsert(
          {
            user_id: user.id,
            journey_id: null,
            mission_id: null,
            record_id: null,
            discover_post_id: createdPostId,
            source_kind: "independent",
            preference: experiencePreference,
            mission_title: recordTitle.trim(),
            mission_category: category,
            mission_place_name: effectivePlaceName,
          },
          { onConflict: "user_id,discover_post_id" },
        );

      if (preferenceError) {
        throw new Error(
          `경험 호불호 저장 실패: ${preferenceError.message}`,
        );
      }

      closeRegister(true);

      if (locationKind === "home") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await Promise.all([loadHomeRecords(user.id), loadMyRecords(user.id)]);
        setHomeArchiveTab(effectiveVisibility === "nickname" ? "shared" : "mine");
        setActiveFilter("방 안 기록");
        Alert.alert("저장 완료", effectiveVisibility === "nickname" ? "닉네임 공유로 방 안 기록에 저장되었어요." : "내 방 기록에 안전하게 저장되었어요.");
      } else {
        if (currentUserId) await loadMyRecords(currentUserId);
        Alert.alert("저장 완료", "기록을 저장했어요.");
        if (userLocation) {
          const posts = await getNearbyDiscoverPosts(userLocation.lat, userLocation.lng, 5);
          setBubbles(posts.length > 0 ? await buildBubbleList(posts) : []);
        }
      }
    } catch (error) {
      Alert.alert("저장 실패", error instanceof Error ? error.message : "");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHomeRecord = (record: HomeRoomRecord) => {
    if (record.source !== "discover" || !record.isMine) return;
    Alert.alert("기록을 삭제할까요?", "삭제하면 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          try {
            await deleteDiscoverPost(record.id);
            if (currentUserId) await loadHomeRecords(currentUserId);
          } catch (error) {
            Alert.alert("삭제 실패", error instanceof Error ? error.message : "");
          }
        },
      },
    ]);
  };

  const applyFilter = (nextFilter: string) => {
    setActiveFilter(nextFilter);
    setFocusedMyRecordKey(null);
    setSelectedMapBubbleId(null);
    if (nextFilter === "내 기록" && myRecordBubbles.length > 0) {
      const newestRecord = myRecordBubbles[0];
      const nextCenter = { lat: newestRecord.lat, lng: newestRecord.lng };
      mapCenterRef.current = nextCenter; setMapCenter(nextCenter);
    }
  };

  const handleFilterPress = (nextFilter: string) => {
    if (nextFilter === activeFilter) {
      if (nextFilter === "방 안 기록") openHomeSheet();
      else if (nextFilter === "내 기록") openMyRecordsSheet(false);
      return;
    }
    closeSheet(); setMapRefreshAvailable(false);
    if (activeFilter === "방 안 기록") {
      homeSheetTranslateY.stopAnimation();
      Animated.timing(homeSheetTranslateY, { toValue: HOME_SHEET_CLOSE_POSITION, duration: 220, useNativeDriver: true }).start(() => applyFilter(nextFilter));
      return;
    }
    if (activeFilter === "내 기록") { closeMyRecordsSheet(() => applyFilter(nextFilter)); return; }
    applyFilter(nextFilter);
  };

  const handleDiscoverMarkerPress = useCallback((id: string | number) => {
    const bubble = groupedMapBubbles.find((item) => String(item.id) === String(id));
    if (!bubble) return;
    const nextCenter = { lat: bubble.lat, lng: bubble.lng };
    mapCenterRef.current = nextCenter;
    setMapCenter(nextCenter);
    setFitMyRecordMarkers(false);
    setSelectedMapBubbleId(String(bubble.id));
    setActiveBubble(null);
    setSheetBubble(null);

    if (bubble.multi && bubble.groupRecords && bubble.groupRecords.length > 1) {
      setPlaceGroupName(bubble.place);
      setPlaceGroupRecords(sortDiscoverRecords(bubble.groupRecords));
      sheetTranslateY.stopAnimation();
      sheetTranslateY.setValue(SHEET_CLOSE_POSITION);
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
      }).start();
      return;
    }

    setPlaceGroupName("");
    setPlaceGroupRecords([]);

    if (activeFilter === "내 기록") {
      const matchingRecord = visibleMyRecords.find((record) => {
        const markerId = record.discoverPostId ?? `mission-record-${record.id}`;
        return String(markerId) === String(id);
      });
      if (matchingRecord) {
        setFocusedMyRecordKey(matchingRecord.key);
        myRecordsListRef.current?.scrollTo({ y: 0, animated: true });
      }
      openMyRecordsSheet(false);
    }
  }, [
  activeFilter,
  groupedMapBubbles,
  openMyRecordsSheet,
  sheetTranslateY,
  visibleMyRecords,
]);

  const handleDiscoverMarkerClose = useCallback(() => {
    // 선택 카드만 닫고 현재 지도 중심과 확대 수준은 그대로 유지한다.
    setFitMyRecordMarkers(false);
    setSelectedMapBubbleId(null);
    setPlaceGroupName("");
    setPlaceGroupRecords([]);
  }, []);
  const handleDiscoverMarkerAction = useCallback(
  (id: string | number) => {
    const bubble = groupedMapBubbles.find(
      (item) => String(item.id) === String(id),
    );

    if (bubble && !bubble.multi) {
      void handleTryMission(bubble);
    }
  },
  [groupedMapBubbles, handleTryMission],
);

const handleDiscoverMarkerLike = useCallback(
  (id: string | number) => {
    const bubble = groupedMapBubbles.find(
      (item) => String(item.id) === String(id),
    );

    if (!bubble?.multi && bubble?.discoverPostId) {
      void handleToggleLike(bubble.discoverPostId);
    }
  },
  [groupedMapBubbles, handleToggleLike],
);

const handleDiscoverMarkerDelete = useCallback(
  (id: string | number) => {
    const bubble = groupedMapBubbles.find(
      (item) => String(item.id) === String(id),
    );

    if (bubble && !bubble.multi) {
      handleDeleteBubble(bubble);
    }
  },
  [groupedMapBubbles, handleDeleteBubble],
);

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        userLocation={userLocation}
        fitAllMarkers={activeFilter === "내 기록" && fitMyRecordMarkers}
        selectedMarkerId={selectedMapBubbleId}
        markers={groupedMapBubbles.map((b) => ({
          id: b.id, lat: b.lat, lng: b.lng, photo: b.photo, count: b.multi ? b.count : undefined,
          category: b.category, cardVariant: "record" as const, title: b.mission, description: b.note,
          placeName: b.place, recordTime: b.time, nickname: b.nick, emotion: b.emotion, likes: b.likes,
          liked: Boolean(b.discoverPostId && likedPostIds.includes(b.discoverPostId)),
          canLike: Boolean(!b.multi && b.canLike !== false && b.discoverPostId),
          canDelete: Boolean(
            !b.multi &&
              b.canDelete !== false &&
              b.user_id === currentUserId &&
              (b.discoverPostId || b.missionRecordId)
          ),
          likeDisabled: Boolean(b.discoverPostId && likeUpdatingIds.includes(b.discoverPostId)),
          actionLabel:
            !b.multi && b.sourceKind === "mission" && b.sourceMissionId
              ? tryingMission
                ? "미션 가져오는 중..."
                : "나도 해볼래요"
              : undefined,
          actionVariant: "primary" as const,
          actionDisabled: tryingMission,
        }))}
        onMapIdle={handleMapIdle}
        onMarkerPress={handleDiscoverMarkerPress}
        onMarkerClose={handleDiscoverMarkerClose}
        onMarkerAction={handleDiscoverMarkerAction}
        onMarkerLike={handleDiscoverMarkerLike}
        onMarkerDelete={handleDiscoverMarkerDelete}
      />

      <View style={styles.topBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <Ionicons name="search" size={18} color={T1} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="장소나 지역 검색"
              placeholderTextColor={T2}
              style={styles.searchTextInput}
              returnKeyType="search"
            />
          </View>
        </View>

        {searchQuery.trim().length > 0 && (
          <View style={styles.searchDropdown}>
            {searching ? (
              <Text style={styles.searchEmptyText}>검색 중...</Text>
            ) : searchResults.length > 0 ? (
              searchResults.map((place) => (
                <Pressable key={place.id} onPress={() => handleSelectSearchResult(place)} style={({ pressed }) => [styles.searchResultRow, pressed && { opacity: 0.6 }]}>
                  <View style={styles.searchResultThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultPlace}>{place.place_name}</Text>
                    <Text style={styles.searchResultMission} numberOfLines={1}>{place.address_name}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
            <Text style={styles.searchEmptyText}>
              “{searchQuery}”에 대한 검색 결과가 없어요
              </Text>
            )}
          </View>
        )}

        {searchQuery.trim().length === 0 && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
              {FILTERS.map((f) => (
                <Pressable key={f} onPress={() => handleFilterPress(f)} style={[styles.chip, activeFilter === f && styles.chipActive]}>
                  <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>
                    {f === "방 안 기록" ? "🛏️ 방 안 기록" : f}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {mapRefreshAvailable && !isArchiveFilter(activeFilter) && !isPersonalMapFilter(activeFilter) && (
              <View style={styles.mapRefreshButtonRow}>
                <Pressable disabled={mapRecordsLoading} onPress={() => void handleRefreshAtMapCenter()} style={({ pressed }) => [styles.mapRefreshButton, pressed && styles.mapRefreshButtonPressed]}>
                  {mapRecordsLoading ? <ActivityIndicator size="small" color={BL} /> : <Ionicons name="refresh" size={16} color={BL} />}
                  <Text style={styles.mapRefreshButtonText}>{mapRecordsLoading ? "불러오는 중..." : "이 위치로 새로고침"}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>

      {activeFilter === "방 안 기록" && (
        <Animated.View style={[styles.homeArchiveSheet, { height: HOME_SHEET_HEIGHT, transform: [{ translateY: homeSheetTranslateY }] }]}>
          <View style={[styles.homeArchiveDragArea, webDragStyle]} {...homePanResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <View style={styles.homeArchiveContent}>
            <View style={styles.homeArchiveHeader}>
              <View>
                <Text style={styles.homeArchiveCaption}>위치를 공개하지 않는 기록 공간</Text>
                <Text style={styles.homeArchiveTitle}>방 안 기록</Text>
              </View>
              <View style={styles.homeArchiveCountBadge}>
                <Text style={styles.homeArchiveCountText}>{visibleHomeRecords.length}</Text>
              </View>
            </View>

            <View style={styles.homeArchiveTabs}>
              <Pressable onPress={() => setHomeArchiveTab("shared")} style={[styles.homeArchiveTab, homeArchiveTab === "shared" && styles.homeArchiveTabActive]}>
                <Text style={[styles.homeArchiveTabText, homeArchiveTab === "shared" && styles.homeArchiveTabTextActive]}>모두의 기록</Text>
              </Pressable>
              <Pressable onPress={() => setHomeArchiveTab("mine")} style={[styles.homeArchiveTab, homeArchiveTab === "mine" && styles.homeArchiveTabActive]}>
                <Text style={[styles.homeArchiveTabText, homeArchiveTab === "mine" && styles.homeArchiveTabTextActive]}>내 기록</Text>
              </Pressable>
            </View>

            <Text style={styles.homeArchiveGuide}>
              {homeArchiveTab === "shared" ? "닉네임과 함께 공유된 방 안 기록을 볼 수 있어요." : "나만 보기와 내가 닉네임으로 공유한 기록을 모아봐요."}
            </Text>

            {homeRecordsLoading ? (
              <View style={styles.homeArchiveEmpty}>
                <ActivityIndicator color={BL} />
                <Text style={styles.homeArchiveEmptyText}>방 안 기록을 불러오는 중...</Text>
              </View>
            ) : visibleHomeRecords.length === 0 ? (
              <View style={styles.homeArchiveEmpty}>
                <Text style={styles.homeArchiveEmptyEmoji}>🛏️</Text>
                <Text style={styles.homeArchiveEmptyTitle}>{homeArchiveTab === "shared" ? "아직 공유된 방 안 기록이 없어요" : "아직 내 방 기록이 없어요"}</Text>
                <Text style={styles.homeArchiveEmptyText}>아래 + 버튼을 눌러 방 안에서의 경험을 남겨보세요.</Text>
              </View>
            ) : (
              <ScrollView style={styles.homeArchiveScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeArchiveList}>
                {visibleHomeRecords.map((record) => (
                  <View key={`${record.source}-${record.id}`} style={styles.homeRecordCard}>
                    <View style={styles.homeRecordHeader}>
                      <View style={styles.homeRecordIcon}>
                        <Text style={styles.homeRecordIconText}>🛏️</Text>
                      </View>
                      <View style={styles.homeRecordHeaderText}>
                        <Text style={styles.homeRecordDate}>{record.createdAt ? new Date(record.createdAt).toLocaleDateString("ko-KR") : "날짜 정보 없음"}</Text>
                        <Text style={styles.homeRecordSource}>
                          {record.isMine ? (record.source === "mission" ? "내 미션 기록" : record.shareMode === "nickname" ? "내 닉네임 공유" : "내 공개 기록") : (record.shareMode === "nickname" ? `${record.nickname}님의 기록` : "익명 기록")}
                        </Text>
                      </View>
                      {record.source === "discover" && record.isMine ? (
                        <Pressable hitSlop={8} onPress={() => handleDeleteHomeRecord(record)} style={({ pressed }) => [styles.homeRecordDelete, pressed && styles.pressed]}>
                          <Ionicons name="trash-outline" size={16} color="#D43B30" />
                        </Pressable>
                      ) : null}
                    </View>

                    <Text style={styles.homeRecordTitle}>{record.title}</Text>

                    <View style={styles.homeRecordTags}>
                      <View style={styles.homeRecordTag}>
                        <Text style={styles.homeRecordTagText}>{record.category}</Text>
                      </View>
                      {record.emotion ? (
                        <View style={styles.homeRecordEmotionTag}>
                          <Text style={styles.homeRecordEmotionText}>{record.emotion}</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.homeRecordContent}>{record.content || "작성한 내용이 없어요."}</Text>

                    {record.source === "discover" && record.visibility !== "private" ? (
                      <Pressable onPress={() => void handleToggleLike(record.id)} disabled={likeUpdatingIds.includes(record.id)} style={({ pressed }) => [styles.archiveLikeButton, pressed && styles.pressed]}>
                        <Ionicons name={likedPostIds.includes(record.id) ? "heart" : "heart-outline"} size={16} color={PINK} />
                        <Text style={styles.archiveLikeText}>{record.likes}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Animated.View>
      )}

      {activeFilter === "내 기록" && (
        <Animated.View style={[styles.myRecordsSheet, { height: MY_SHEET_HEIGHT, transform: [{ translateY: mySheetTranslateY }] }]}>
          <View style={[styles.myRecordsSheetDragArea, webDragStyle]} {...mySheetPanResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <View style={styles.myRecordsSheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myRecordsSheetCaption}>지도와 목록으로 모아보기</Text>
              <Text style={styles.myRecordsSheetTitle}>내 기록</Text>
            </View>
            <View style={styles.myRecordsCountBadge}>
              <Text style={styles.myRecordsCountText}>{visibleMyRecords.length}</Text>
            </View>
          </View>

          <View pointerEvents="none" style={styles.myRecordsMapSummary}>
            {myRecordsLoading ? (
              <ActivityIndicator size="small" color={BL} />
            ) : (
              <>
                <Ionicons name="location-outline" size={15} color={BL} />
                <Text style={styles.myRecordsMapSummaryText}>지도에 표시 가능한 내 기록 {myRecordBubbles.length}개</Text>
                {visibleMyRecords.length > myRecordBubbles.length ? (
                  <Text style={styles.myRecordsMapSummaryMuted}> · 위치 없는 기록 {visibleMyRecords.length - myRecordBubbles.length}개</Text>
                ) : null}
              </>
            )}
          </View>

          <View style={styles.myRecordsSectionTabs}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.myRecordsSectionIndicator,
                {
                  width: MY_RECORD_TAB_INDICATOR_WIDTH,
                  transform: [{
                    translateX: myRecordFilterIndicator.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0, MY_RECORD_TAB_INDICATOR_WIDTH, MY_RECORD_TAB_INDICATOR_WIDTH * 2],
                    }),
                  }],
                },
              ]}
            />
            {([
              { value: "all" as const, label: "전체", count: myRecordVisibilityCounts.all },
              { value: "private" as const, label: "나만 보기", count: myRecordVisibilityCounts.private },
              { value: "nickname" as const, label: "닉네임 공유", count: myRecordVisibilityCounts.nickname },
            ]).map((option) => {
              const selected = myRecordVisibilityFilter === option.value;
              return (
                <Pressable key={option.value} onPress={() => changeMyRecordVisibilityFilter(option.value)} style={({ pressed }) => [styles.myRecordsSectionTab, pressed && styles.pressed]}>
                  <Text style={[styles.myRecordsSectionTabText, selected && styles.myRecordsSectionTabTextSelected]}>{option.label}</Text>
                  <Text style={[styles.myRecordsSectionCount, selected && styles.myRecordsSectionCountSelected]}>{option.count}</Text>
                </Pressable>
              );
            })}
          </View>

          <Animated.View style={[styles.myRecordsSectionContent, { opacity: myRecordContentAnimation }]}>
            {myRecordsLoading ? (
              <View style={styles.myRecordsEmpty}>
                <ActivityIndicator color={BL} />
                <Text style={styles.myRecordsEmptyText}>내 기록을 불러오는 중...</Text>
              </View>
            ) : visibleMyRecords.length === 0 ? (
              <View style={styles.myRecordsEmpty}>
                <Text style={styles.myRecordsEmptyEmoji}>🗺️</Text>
                <Text style={styles.myRecordsEmptyTitle}>이 분류의 기록이 없어요</Text>
                <Text style={styles.myRecordsEmptyText}>아래 + 버튼이나 홈의 미션 기록하기에서 경험을 남겨보세요.</Text>
              </View>
            ) : (
              <ScrollView ref={myRecordsListRef} style={styles.myRecordsListScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.myRecordsList}>
                {orderedVisibleMyRecords.map((record) => (
                  <View key={record.key} style={styles.myRecordCard}>
                    <View style={styles.myRecordCardHeader}>
                      {record.photo ? (
                        <Image source={{ uri: record.photo }} style={styles.myRecordCardPhoto} />
                      ) : (
                        <View style={styles.myRecordCardIcon}>
                          <Text style={styles.myRecordCardIconText}>{getCategoryEmoji(record.category)}</Text>
                        </View>
                      )}
                      <View style={styles.myRecordCardHeaderText}>
                        <Text style={styles.myRecordCardDate}>{record.createdAt ? new Date(record.createdAt).toLocaleDateString("ko-KR") : "날짜 정보 없음"}</Text>
                        <Text style={styles.myRecordCardVisibility}>{record.visibility === "nickname" ? `${currentNickname} · 닉네임 공유` : "나만 보기"}</Text>
                      </View>
                      <View style={styles.myRecordCardActions}>
                        {record.placeName !== "내 방" && record.lat !== null && record.lng !== null && Number.isFinite(record.lat) && Number.isFinite(record.lng) && !(record.lat === 0 && record.lng === 0) ? (
                          <Pressable hitSlop={8} onPress={() => focusMyRecordOnMap(record)} style={({ pressed }) => [styles.myRecordCardOpen, focusedMyRecordKey === record.key && styles.myRecordCardOpenFocused, pressed && styles.pressed]}>
                            <Ionicons name={focusedMyRecordKey === record.key ? "locate" : "locate-outline"} size={17} color={focusedMyRecordKey === record.key ? WH : BL} />
                          </Pressable>
                        ) : null}
                        <Pressable
                          hitSlop={8}
                          onPress={() => handleDeleteMyRecord(record)}
                          disabled={deleting}
                          style={({ pressed }) => [
                            styles.myRecordCardDelete,
                            deleting && styles.buttonDisabled,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Ionicons name="trash-outline" size={16} color="#D43B30" />
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.myRecordCardTitle}>{record.title}</Text>
                    <Text style={styles.myRecordCardPlace}>📍 {record.placeName}</Text>

                    <View style={styles.homeRecordTags}>
                      <View style={styles.homeRecordTag}>
                        <Text style={styles.homeRecordTagText}>{record.category}</Text>
                      </View>
                      {record.emotion ? (
                        <View style={styles.homeRecordEmotionTag}>
                          <Text style={styles.homeRecordEmotionText}>{record.emotion}</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.homeRecordContent}>{record.content || "작성한 내용이 없어요."}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        </Animated.View>
      )}

      {placeGroupRecords.length > 1 && (
        <Animated.View
          style={[
            styles.sheet,
            styles.placeGroupSheet,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={[styles.dragArea, webDragStyle]} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <View style={styles.placeGroupHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeGroupCaption}>이 장소의 기록</Text>
              <Text style={styles.placeGroupTitle}>{placeGroupName}</Text>
              <Text style={styles.placeGroupCount}>
                좋아요 많은 순 · 좋아요가 같으면 최신순 · {placeGroupRecords.length}개
              </Text>
            </View>
            <Pressable onPress={closeSheet} hitSlop={10} style={styles.placeGroupClose}>
              <Ionicons name="close" size={18} color={T1} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.placeGroupList}
          >
            {placeGroupRecords.map((record, index) => (
              <View key={record.id} style={styles.placeGroupRecordCard}>
                <View style={styles.placeGroupRankBadge}>
                  <Text style={styles.placeGroupRankText}>{index + 1}</Text>
                </View>
                {record.photo ? (
                  <Image source={{ uri: record.photo }} style={styles.placeGroupRecordPhoto} />
                ) : (
                  <View style={styles.placeGroupRecordIcon}>
                    <Text style={styles.placeGroupRecordIconText}>
                      {getCategoryEmoji(record.category)}
                    </Text>
                  </View>
                )}
                <View style={styles.placeGroupRecordBody}>
                  <View style={styles.placeGroupRecordHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.placeGroupRecordTitle}>{record.mission}</Text>
                      <Text style={styles.placeGroupRecordMeta}>
                        {record.time} · {record.nick} · {record.emotion}
                      </Text>
                    </View>
                    {record.canLike && record.discoverPostId ? (
                      <Pressable
                        onPress={() => void handleToggleLike(record.discoverPostId!)}
                        disabled={likeUpdatingIds.includes(record.discoverPostId)}
                        style={styles.placeGroupLikeButton}
                      >
                        <Ionicons
                          name={
                            likedPostIds.includes(record.discoverPostId)
                              ? "heart"
                              : "heart-outline"
                          }
                          size={18}
                          color={PINK}
                        />
                        <Text style={styles.placeGroupLikeText}>{record.likes}</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.placeGroupLikeButton}>
                        <Ionicons name="heart-outline" size={18} color={T2} />
                        <Text style={styles.placeGroupLikeText}>{record.likes}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.placeGroupRecordNote}>{record.note}</Text>

                  <View style={styles.placeGroupRecordActions}>
                    {record.sourceKind === "mission" && record.sourceMissionId ? (
                      <Pressable
                        onPress={() => void handleTryMission(record)}
                        disabled={tryingMission}
                        style={styles.placeGroupMissionButton}
                      >
                        <Text style={styles.placeGroupMissionButtonText}>
                          나도 해볼래요
                        </Text>
                      </Pressable>
                    ) : null}
                    {record.canDelete !== false &&
                    (record.discoverPostId || record.missionRecordId) &&
                    record.user_id === currentUserId ? (
                      <Pressable
                        onPress={() => handleDeleteBubble(record)}
                        disabled={deleting}
                        style={styles.placeGroupDeleteButton}
                      >
                        <Text style={styles.placeGroupDeleteButtonText}>삭제</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {sheetBubble && (
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={[styles.dragArea, webDragStyle]} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            {sheetBubble.photo ? <Image source={{ uri: sheetBubble.photo }} style={styles.sheetPhoto} /> : null}
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{sheetBubble.mission}</Text>
                <Text style={styles.sheetMeta}>{sheetBubble.place} · {sheetBubble.time} · {sheetBubble.nick}</Text>
              </View>
              {sheetBubble.canLike && sheetBubble.discoverPostId ? (
                <Pressable onPress={() => void handleToggleLike(sheetBubble.discoverPostId!)} disabled={likeUpdatingIds.includes(sheetBubble.discoverPostId)} style={{ alignItems: "center" }}>
                  <Ionicons name={likedPostIds.includes(sheetBubble.discoverPostId) ? "heart" : "heart-outline"} size={20} color={PINK} />
                  <Text style={{ fontSize: 11, color: T1, marginTop: 2 }}>{sheetBubble.likes}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.emotionTag}>
              <Text style={{ fontSize: 11, color: BL, fontWeight: "800" }}>{sheetBubble.emotion}</Text>
            </View>

            <Text style={styles.note}>{sheetBubble.note}</Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {sheetBubble.sourceKind === "mission" &&
              sheetBubble.sourceMissionId ? (
                <Pressable
                  style={[
                    styles.primaryBtn,
                    tryingMission && { opacity: 0.6 },
                  ]}
                  onPress={() => void handleTryMission()}
                  disabled={tryingMission}
                >
                  <Text
                    style={{
                      color: T0,
                      fontSize: 13,
                      fontWeight: "800",
                    }}
                  >
                    {tryingMission
                      ? "미션 가져오는 중..."
                      : "나도 해볼래요"}
                  </Text>
                </Pressable>
              ) : null}
              {sheetBubble.canDelete !== false && (sheetBubble.discoverPostId || sheetBubble.missionRecordId) && sheetBubble.user_id === currentUserId ? (
                <Pressable style={[styles.deleteBtn, deleting && { opacity: 0.6 }]} onPress={() => handleDeleteBubble()} disabled={deleting}>
                  <Text style={{ color: "#D43B30", fontSize: 13, fontWeight: "800" }}>
                    {deleting ? "삭제 중..." : "삭제"}
                  </Text>
                </Pressable>
              ) : (
                <Pressable style={styles.secondaryBtn}>
                  <Text style={{ color: T1, fontSize: 13, fontWeight: "700" }}>저장</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Animated.View style={[styles.fabGlow, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable style={styles.fabBtn} onPress={openLocationTypePicker}>
            <Ionicons name="add" size={30} color={WH} />
          </Pressable>
        </Animated.View>
      </View>

      <Modal visible={locationTypeVisible} transparent animationType="fade" onRequestClose={() => setLocationTypeVisible(false)}>
        <View style={styles.locationTypeOverlay}>
          <Pressable style={styles.locationTypeBackdrop} onPress={() => setLocationTypeVisible(false)} />
          <View style={styles.locationTypeCard}>
            <Text style={styles.locationTypeCaption}>미션 없이 기록하기</Text>
            <Text style={styles.locationTypeTitle}>어디에서 한 경험인가요?</Text>
            <Text style={styles.locationTypeDescription}>위치에 맞는 방식을 선택하면 기록이 알맞은 곳에 정리돼요.</Text>

            {([
              { value: "place" as const, emoji: "📍", title: "실제 장소", desc: "지도에서 위치를 누르고 주변 장소를 선택해요" },
              { value: "map" as const, emoji: "🌿", title: "길 위·야외", desc: "지도에서 경험한 위치를 직접 표시해요" },
              { value: "home" as const, emoji: "🛏️", title: "내 방", desc: "지도에는 표시하지 않고 내 방 기록함에 모아요" },
            ]).map((option) => (
              <Pressable key={option.value} onPress={() => chooseLocationKind(option.value)} style={({ pressed }) => [styles.locationTypeOption, pressed && styles.pressed]}>
                <Text style={styles.locationTypeEmoji}>{option.emoji}</Text>
                <View style={styles.locationTypeOptionText}>
                  <Text style={styles.locationTypeOptionTitle}>{option.title}</Text>
                  <Text style={styles.locationTypeOptionDesc}>{option.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={T2} />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={{ flex: 1 }}>
          <RecordLocationPickerMap
            center={pickerCenter}
            pickedLocation={pickedLocation}
            guideText={pickerMode === "place" ? "지도를 눌러 주변 실제 장소를 찾아보세요" : "지도를 눌러 길 위·야외 위치를 표시하세요"}
            onSelect={(coordinate) => void handleMapTapForPicking(coordinate.lat, coordinate.lng)}
          />

          <View style={styles.pickerTopBar}>
            {pickerMode === "place" ? (
              <>
                <View style={styles.pickerSearchBox}>
                  <Ionicons name="search" size={18} color={T2} />
                  <TextInput
                    value={pickerPlaceQuery} onChangeText={setPickerPlaceQuery}
                    placeholder="기록할 실제 장소 검색" placeholderTextColor={T2}
                    returnKeyType="search" style={styles.pickerSearchInput}
                  />
                  {pickerPlaceSearching ? (
                    <ActivityIndicator size="small" color={BL} />
                  ) : pickerPlaceQuery ? (
                    <Pressable onPress={() => setPickerPlaceQuery("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={T2} />
                    </Pressable>
                  ) : null}
                </View>

                {pickerPlaceQuery.trim().length > 0 && (
                  <View style={styles.pickerSearchDropdown}>
                    {pickerPlaceSearching ? (
                      <Text style={styles.pickerSearchEmpty}>검색 중...</Text>
                    ) : pickerPlaceSearchResults.length > 0 ? (
                      pickerPlaceSearchResults.map((place) => (
                        <Pressable key={`picker-search-${place.id}`} onPress={() => selectPickerSearchResult(place)} style={({ pressed }) => [styles.pickerSearchResult, pressed && styles.pressed]}>
                          <View style={styles.pickerSearchResultIcon}>
                            <Ionicons name="location" size={16} color={BL} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={styles.pickerSearchResultName}>{place.name}</Text>
                            <Text numberOfLines={1} style={styles.pickerSearchResultAddress}>{place.address || place.categoryDetail || "장소"}</Text>
                          </View>
                          <Text style={styles.pickerSearchResultDistance}>{formatDistance(place.distanceM)}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.pickerSearchEmpty}>검색 결과가 없어요</Text>
                    )}
                  </View>
                )}
              </>
            ) : null}

            <Text style={styles.pickerGuide}>{pickerMode === "place" ? "장소를 검색하거나 지도에서 경험한 위치를 눌러주세요." : "지도에서 경험한 위치를 눌러주세요."}</Text>
          </View>

          <View style={styles.pickerBottomBar}>
            {pickerMode === "place" ? (
              <>
                {placesLoading ? (
                  <View style={styles.placeLoadingRow}>
                    <ActivityIndicator size="small" color={BL} />
                    <Text style={styles.placeLoadingText}>주변 실제 장소를 찾고 있어요</Text>
                  </View>
                ) : placeCandidates.length > 0 ? (
                  <ScrollView style={styles.placeCandidateScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    <Text style={styles.placeCandidateSectionTitle}>주변 실제 장소</Text>
                    {placeCandidates.map((place) => {
                      const selected = selectedPlace?.id === place.id;
                      return (
                        <Pressable key={place.id} onPress={() => selectPlaceCandidate(place)} style={[styles.placeCandidateButton, selected && styles.placeCandidateButtonSelected]}>
                          <View style={[styles.placeCandidateRadio, selected && styles.placeCandidateRadioSelected]}>
                            {selected ? <View style={styles.placeCandidateRadioDot} /> : null}
                          </View>
                          <View style={styles.placeCandidateText}>
                            <View style={styles.placeCandidateNameRow}>
                              <Text numberOfLines={1} style={styles.placeCandidateName}>{place.name}</Text>
                              <Text style={styles.placeCandidateDistance}>{formatDistance(place.distanceM)}</Text>
                            </View>
                            <Text numberOfLines={1} style={styles.placeCandidateCategory}>{place.categoryDetail ?? "장소"}</Text>
                            <Text numberOfLines={2} style={styles.placeCandidateAddress}>{place.address ?? "주소 정보 없음"}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : pickedLocation ? (
                  <Text style={styles.placeEmptyText}>주변 장소를 찾지 못했어요. 다른 위치를 누르거나 길 위·야외를 선택해주세요.</Text>
                ) : (
                  <Text style={styles.placeEmptyText}>지도에서 위치를 먼저 눌러주세요.</Text>
                )}
              </>
            ) : pickedLocation ? (
              <Text style={styles.pickerDistanceText}>선택한 위치가 ‘거리’로 기록돼요.</Text>
            ) : (
              <Text style={styles.pickerDistanceText}>지도에서 위치를 한 번 눌러주세요.</Text>
            )}

            <View style={styles.pickerActionRow}>
              <Pressable style={styles.pickerCancelBtn} onPress={() => setPickerVisible(false)}>
                <Text style={{ color: T1, fontSize: 14, fontWeight: "700" }}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.pickerConfirmBtn, ((pickerMode === "place" && !selectedPlace) || (pickerMode === "map" && !pickedLocation)) && styles.buttonDisabled]}
                onPress={confirmPickedLocation}
                disabled={(pickerMode === "place" && !selectedPlace) || (pickerMode === "map" && !pickedLocation)}
              >
                <Text style={{ color: WH, fontSize: 14, fontWeight: "800" }}>
                  {pickerMode === "place" ? "이 장소로 기록" : "이 위치로 기록"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={registerVisible} transparent animationType="slide" onRequestClose={() => closeRegister()}>
        <KeyboardAvoidingView style={styles.shareModalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.shareModalBackdrop} onPress={() => closeRegister()} />
          <View style={styles.shareModalCard}>
            <View style={styles.shareModalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.shareModalContent}>
              <View style={styles.shareModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareModalCaption}>장소 공유하기</Text>
                  <Text style={styles.shareModalTitle}>이곳에서의 경험을 남겨보세요</Text>
                </View>
                <Pressable onPress={() => closeRegister()} hitSlop={10} style={({ pressed }) => [styles.shareModalClose, pressed && styles.pressed]}>
                  <Ionicons name="close" size={20} color={T1} />
                </Pressable>
              </View>

              <View style={styles.selectedLocationBox}>
                <Text style={styles.selectedLocationCaption}>
                  {locationKind === "place" ? "실제 장소" : locationKind === "map" ? "길 위·야외" : "내 방"}
                </Text>
                <Text style={styles.selectedLocationName}>
                  {locationKind === "home" ? "🛏️ 내 방" : `📍 ${placeName}`}
                </Text>
                {locationKind === "place" && selectedPlace?.address ? (
                  <Text style={styles.selectedLocationAddress}>{selectedPlace.address}</Text>
                ) : locationKind === "home" ? (
                  <Text style={styles.selectedLocationAddress}>지도에 표시되지 않고 내 방 기록함에 저장돼요.</Text>
                ) : null}
              </View>

              <Text style={styles.fieldLabel}>기록 제목</Text>
              <TextInput
                value={recordTitle} onChangeText={setRecordTitle} maxLength={60}
                placeholder="예: 비 오는 날 발견한 조용한 카페" placeholderTextColor={T2}
                style={styles.recordTitleInput}
              />
              <Text style={styles.recordTitleCount}>{recordTitle.length}/60</Text>

              <Text style={styles.fieldLabel}>카테고리</Text>
              <View style={styles.emotionWrap}>
                {CATEGORIES.map((c) => {
                  const isSelected = category === c;
                  return (
                    <Pressable key={c} onPress={() => setCategory(c)} style={[styles.emotionChip, isSelected && styles.emotionChipSelected]}>
                      <Text style={[styles.emotionChipText, isSelected && styles.emotionChipTextSelected]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>어떤 감정이 가장 컸나요?</Text>
              <View style={styles.emotionWrap}>
                {EMOTIONS.map((e) => {
                  const isSelected = emotion === e.value;
                  return (
                    <Pressable key={e.value} onPress={() => setEmotion(e.value)} style={[styles.emotionChip, isSelected && styles.emotionChipSelected]}>
                      <Text style={[styles.emotionChipText, isSelected && styles.emotionChipTextSelected]}>
                        {e.emoji} {e.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>이곳에서의 경험을 남겨주세요</Text>
              <TextInput
                value={content} onChangeText={setContent} multiline maxLength={1200} textAlignVertical="top"
                placeholder="무엇을 보고, 듣고, 느꼈는지 자유롭게 적어보세요." placeholderTextColor={T2}
                style={styles.contentInput}
              />
              <Text style={styles.characterCount}>{content.length}/1200</Text>

              <Text style={styles.fieldLabel}>이 경험은 어땠나요?</Text>
              <Text style={styles.preferenceGuide}>
                이 선택은 공개되지 않고 다음 미션 추천에만 사용돼요.
              </Text>
              <View style={styles.preferenceList}>
                {EXPERIENCE_PREFERENCES.map((preference) => {
                  const selected = experiencePreference === preference.value;
                  return (
                    <Pressable
                      key={preference.value}
                      onPress={() => setExperiencePreference(preference.value)}
                      style={[
                        styles.preferenceOption,
                        selected && styles.preferenceOptionSelected,
                      ]}
                    >
                      <Text style={styles.preferenceOptionEmoji}>
                        {preference.emoji}
                      </Text>
                      <View style={styles.preferenceOptionTextWrap}>
                        <Text
                          style={[
                            styles.preferenceOptionTitle,
                            selected && styles.preferenceOptionTitleSelected,
                          ]}
                        >
                          {preference.label}
                        </Text>
                        <Text style={styles.preferenceOptionDescription}>
                          {preference.description}
                        </Text>
                      </View>
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={selected ? BL : T2}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.photoSectionHeader}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>사진 추가</Text>
                <Text style={styles.photoCountText}>{photos.length}/{MAX_PHOTOS}</Text>
              </View>
              <Text style={styles.photoOptionalHint}>사진을 안 올리면 지도에는 카테고리 아이콘으로 표시돼요.</Text>

              <View style={styles.photoActionRow}>
                <Pressable onPress={() => void handleTakePhoto()} disabled={saving || photos.length >= MAX_PHOTOS} style={({ pressed }) => [styles.photoActionButton, pressed && styles.pressed, (saving || photos.length >= MAX_PHOTOS) && styles.buttonDisabled]}>
                  <Text style={styles.photoActionIcon}>📷</Text>
                  <Text style={styles.photoActionText}>직접 찍기</Text>
                </Pressable>
                <Pressable onPress={() => void handlePickPhotos()} disabled={saving || photos.length >= MAX_PHOTOS} style={({ pressed }) => [styles.photoActionButton, { marginRight: 0 }, pressed && styles.pressed, (saving || photos.length >= MAX_PHOTOS) && styles.buttonDisabled]}>
                  <Text style={styles.photoActionIcon}>🖼️</Text>
                  <Text style={styles.photoActionText}>갤러리에서 선택</Text>
                </Pressable>
              </View>

              {photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 17 }} contentContainerStyle={{ paddingRight: 8 }}>
                  {photos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`} style={styles.photoPreviewWrapper}>
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                      <Pressable onPress={() => removePhoto(photo.uri)} disabled={saving} hitSlop={8} style={({ pressed }) => [styles.photoRemoveButton, pressed && styles.pressed]}>
                        <Text style={styles.photoRemoveButtonText}>✕</Text>
                      </Pressable>
                      {index === 0 ? (
                        <View style={styles.coverPhotoBadge}>
                          <Text style={styles.coverPhotoBadgeText}>대표</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.photoHelperText}>첫 번째 사진이 대표 사진으로 사용돼요.</Text>
              )}

              <Text style={styles.fieldLabel}>공개 범위</Text>
              {locationKind === "home" ? (
                <View style={styles.homePrivacyBox}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={BL} />
                  <View style={styles.homePrivacyText}>
                    <Text style={styles.homePrivacyTitle}>내 방의 실제 위치는 저장하지 않아요</Text>
                    <Text style={styles.homePrivacyDesc}>닉네임 공유를 선택하면 지도 대신 ‘방 안 기록’ 공간에서 다른 사람에게 보여요.</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.visibilityRow}>
                <Pressable onPress={() => setVisibility("private")} style={[styles.visibilityOption, visibility === "private" && styles.visibilityOptionSelected]}>
                  <Text style={[styles.visibilityOptionTitle, visibility === "private" && styles.visibilityOptionTitleSelected]}>나만 보기</Text>
                  <Text style={styles.visibilityOptionDesc}>내 기록에서만 확인해요</Text>
                </Pressable>
                <Pressable onPress={() => setVisibility("nickname")} style={[styles.visibilityOption, visibility === "nickname" && styles.visibilityOptionSelected]}>
                  <Text style={[styles.visibilityOptionTitle, visibility === "nickname" && styles.visibilityOptionTitleSelected]}>닉네임 공유</Text>
                  <Text style={styles.visibilityOptionDesc}>
                    {locationKind === "home" ? "내 닉네임과 함께 방 안 기록 공간에 공유해요" : "내 닉네임과 함께 발견 탭에 공유해요"}
                  </Text>
                </Pressable>
              </View>

              <Pressable onPress={() => void handleSubmit()} disabled={saving} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, saving && styles.buttonDisabled]}>
                <Text style={styles.submitButtonText}>{saving ? "저장 중..." : "기록 저장하기"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", backgroundColor: BG },
  topBar: { position: "absolute", top: 60, left: 16, right: 16, zIndex: 10, elevation: 10 },
  searchRow: { flexDirection: "row", gap: 9, marginBottom: 10 },
  searchInput: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: WH, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: T3 },
  searchTextInput: { flex: 1, fontSize: 14, color: T0, paddingVertical: 12 },
  filterScrollContent: { gap: 8, paddingRight: 6 },
  chip: { minHeight: 36, justifyContent: "center", backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 },
  chipActive: { backgroundColor: BL, borderColor: BL },
  chipText: { fontSize: 12, color: T1, fontWeight: "600" },
  chipTextActive: { color: WH, fontWeight: "800" },
  mapRefreshButtonRow: { alignItems: "center", marginTop: 11 },
  mapRefreshButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: WH, borderWidth: 1.5, borderColor: BL, borderRadius: 20, elevation: 4 },
  mapRefreshButtonPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  mapRefreshButtonText: { marginLeft: 6, fontSize: 12, fontWeight: "800", color: BL },
  searchDropdown: { backgroundColor: WH, borderRadius: 16, paddingVertical: 6, maxHeight: 260, borderWidth: 1, borderColor: T3, elevation: 6 },
  searchResultRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "#EFECE6" },
  searchResultThumb: { width: 38, height: 38, borderRadius: 10, backgroundColor: BLL },
  searchResultPlace: { fontSize: 13, fontWeight: "800", color: T0 },
  searchResultMission: { fontSize: 11, color: T1, marginTop: 2 },
  searchEmptyText: { padding: 14, fontSize: 12, color: T2, textAlign: "center" },

  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: WH, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 100, zIndex: 30, elevation: 30 },
  dragArea: { height: 36, alignItems: "center", justifyContent: "center" },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#D7D9DE" },
  sheetPhoto: { width: "100%", height: 180, borderRadius: 16, backgroundColor: T3, marginBottom: 14 },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: T0, marginBottom: 4 },
  sheetMeta: { fontSize: 11, color: T1 },
  emotionTag: { alignSelf: "flex-start", backgroundColor: BLL, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 10 },
  note: { fontSize: 14, color: T0, lineHeight: 22, marginBottom: 16 },
  primaryBtn: { flex: 1, backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  secondaryBtn: { backgroundColor: BLL, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center" },
  deleteBtn: { backgroundColor: "#FCE8E6", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center" },

  placeGroupSheet: { maxHeight: "78%", overflow: "hidden" },
  placeGroupHeader: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "flex-start" },
  placeGroupCaption: { marginBottom: 3, fontSize: 11, fontWeight: "800", color: BL },
  placeGroupTitle: { fontSize: 20, fontWeight: "800", color: T0 },
  placeGroupCount: { marginTop: 4, fontSize: 11, lineHeight: 16, color: T1 },
  placeGroupClose: { width: 34, height: 34, marginLeft: 10, alignItems: "center", justifyContent: "center", backgroundColor: BG, borderRadius: 17 },
  placeGroupList: { paddingHorizontal: 16, paddingBottom: 118 },
  placeGroupRecordCard: { position: "relative", marginBottom: 12, padding: 12, flexDirection: "row", backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 18 },
  placeGroupRankBadge: { position: "absolute", top: 7, left: 7, zIndex: 2, minWidth: 22, height: 22, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: BL, borderRadius: 11 },
  placeGroupRankText: { fontSize: 10, fontWeight: "800", color: WH },
  placeGroupRecordPhoto: { width: 82, height: 96, marginRight: 12, borderRadius: 13, backgroundColor: T3 },
  placeGroupRecordIcon: { width: 82, height: 96, marginRight: 12, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 13 },
  placeGroupRecordIconText: { fontSize: 30 },
  placeGroupRecordBody: { flex: 1, minWidth: 0 },
  placeGroupRecordHeader: { flexDirection: "row", alignItems: "flex-start" },
  placeGroupRecordTitle: { paddingRight: 6, fontSize: 14, lineHeight: 19, fontWeight: "800", color: T0 },
  placeGroupRecordMeta: { marginTop: 3, fontSize: 10, color: T1 },
  placeGroupLikeButton: { minWidth: 34, alignItems: "center", paddingLeft: 5 },
  placeGroupLikeText: { marginTop: 1, fontSize: 10, fontWeight: "700", color: T1 },
  placeGroupRecordNote: { marginTop: 8, fontSize: 12, lineHeight: 18, color: T0 },
  placeGroupRecordActions: { marginTop: 10, flexDirection: "row", gap: 7 },
  placeGroupMissionButton: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: ACCENT, borderRadius: 9 },
  placeGroupMissionButtonText: { fontSize: 10, fontWeight: "800", color: T0 },
  placeGroupDeleteButton: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#FCE8E6", borderRadius: 9 },
  placeGroupDeleteButtonText: { fontSize: 10, fontWeight: "800", color: "#D43B30" },

  preferenceGuide: { marginTop: -8, marginBottom: 10, fontSize: 11, lineHeight: 16, color: T1 },
  preferenceList: { marginBottom: 18, gap: 8 },
  preferenceOption: { minHeight: 64, paddingHorizontal: 13, paddingVertical: 10, flexDirection: "row", alignItems: "center", backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  preferenceOptionSelected: { backgroundColor: BLL, borderColor: BL },
  preferenceOptionEmoji: { width: 30, marginRight: 8, fontSize: 21, textAlign: "center" },
  preferenceOptionTextWrap: { flex: 1, minWidth: 0 },
  preferenceOptionTitle: { marginBottom: 2, fontSize: 13, fontWeight: "800", color: T0 },
  preferenceOptionTitleSelected: { color: BL },
  preferenceOptionDescription: { fontSize: 10, lineHeight: 15, color: T1 },

  fabWrap: { position: "absolute", right: 24, bottom: 100, width: 58, height: 58, alignItems: "center", justifyContent: "center", zIndex: 10 },
  fabGlow: { position: "absolute", width: 58, height: 58, borderRadius: 29, backgroundColor: BL },
  fabBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: BL, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: WH, elevation: 6 },

  recordLocationPickerMap: { flex: 1, backgroundColor: BG },
  pickerTopBar: { position: "absolute", top: 60, left: 18, right: 18 },
  pickerGuide: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14, fontSize: 12, color: T1, textAlign: "center", fontWeight: "700" },
  pickerBottomBar: { position: "absolute", bottom: 24, left: 16, right: 16, maxHeight: "58%", backgroundColor: WH, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: T3 },
  pickerDistanceText: { fontSize: 13, fontWeight: "700", color: T1, textAlign: "center", marginBottom: 12 },
  pickerCancelBtn: { flex: 1, backgroundColor: BG, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  pickerConfirmBtn: { flex: 1, backgroundColor: BL, borderRadius: 14, paddingVertical: 14, alignItems: "center" },

  locationTypeOverlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  locationTypeBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(24, 35, 29, 0.52)" },
  locationTypeCard: { width: "100%", maxWidth: 430, padding: 22, backgroundColor: "#F9F7F1", borderRadius: 24 },
  locationTypeCaption: { marginBottom: 4, fontSize: 12, fontWeight: "800", color: BL },
  locationTypeTitle: { marginBottom: 6, fontSize: 20, fontWeight: "800", color: T0 },
  locationTypeDescription: { marginBottom: 18, fontSize: 12, lineHeight: 18, color: T1 },
  locationTypeOption: { minHeight: 70, marginBottom: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 16 },
  locationTypeEmoji: { marginRight: 12, fontSize: 24 },
  locationTypeOptionText: { flex: 1 },
  locationTypeOptionTitle: { marginBottom: 3, fontSize: 15, fontWeight: "800", color: T0 },
  locationTypeOptionDesc: { fontSize: 11, lineHeight: 16, color: T1 },

  homeArchiveSheet: {
    position: "absolute", right: 0, bottom: 0, left: 0, zIndex: 8, elevation: 8, overflow: "hidden",
    paddingBottom: 88, backgroundColor: "#F9F7F1", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0, borderColor: T3,
  },
  homeArchiveDragArea: { height: 34, alignItems: "center", justifyContent: "center" },
  homeArchiveContent: { flex: 1 },
  homeArchiveScroll: { flex: 1 },
  homeArchiveHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  homeArchiveTabs: { marginHorizontal: 16, padding: 4, flexDirection: "row", backgroundColor: "#E6E4DC", borderRadius: 14 },
  homeArchiveTab: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  homeArchiveTabActive: { backgroundColor: WH },
  homeArchiveTabText: { fontSize: 12, fontWeight: "700", color: T1 },
  homeArchiveTabTextActive: { color: BL, fontWeight: "800" },
  homeArchiveGuide: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, fontSize: 11, color: T1 },
  homeArchiveCaption: { marginBottom: 3, fontSize: 11, color: T2 },
  homeArchiveTitle: { fontSize: 20, fontWeight: "800", color: T0 },
  homeArchiveCountBadge: { minWidth: 32, height: 32, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 16 },
  homeArchiveCountText: { fontSize: 13, fontWeight: "800", color: BL },
  homeArchiveList: { paddingHorizontal: 16, paddingBottom: 110 },
  homeArchiveEmpty: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  homeArchiveEmptyEmoji: { marginBottom: 10, fontSize: 40 },
  homeArchiveEmptyTitle: { marginBottom: 5, fontSize: 15, fontWeight: "800", color: T0 },
  homeArchiveEmptyText: { marginTop: 8, textAlign: "center", fontSize: 12, lineHeight: 18, color: T1 },
  homeRecordCard: { marginBottom: 12, padding: 16, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 18 },
  homeRecordHeader: { marginBottom: 12, flexDirection: "row", alignItems: "center" },
  homeRecordIcon: { width: 38, height: 38, marginRight: 10, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 12 },
  homeRecordIconText: { fontSize: 18 },
  homeRecordHeaderText: { flex: 1 },
  homeRecordDate: { marginBottom: 2, fontSize: 11, color: T2 },
  homeRecordSource: { fontSize: 13, fontWeight: "800", color: T0 },
  homeRecordDelete: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#FCE8E6", borderRadius: 17 },
  homeRecordTags: { marginBottom: 10, flexDirection: "row", flexWrap: "wrap" },
  homeRecordTag: { marginRight: 6, marginBottom: 4, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: BLL, borderRadius: 8 },
  homeRecordTagText: { fontSize: 11, fontWeight: "700", color: BL },
  homeRecordEmotionTag: { marginBottom: 4, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: PINK_LIGHT, borderRadius: 8 },
  homeRecordEmotionText: { fontSize: 11, fontWeight: "700", color: PINK },
  homeRecordContent: { fontSize: 14, lineHeight: 22, color: T0 },

  placeLoadingRow: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  placeLoadingText: { marginLeft: 8, fontSize: 12, color: T1 },
  placeCandidateScroll: { maxHeight: 270, marginBottom: 10 },
  placeCandidateSectionTitle: { marginBottom: 8, fontSize: 13, fontWeight: "800", color: T0 },
  placeCandidateButton: { marginBottom: 8, padding: 12, flexDirection: "row", backgroundColor: BG, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  placeCandidateButtonSelected: { backgroundColor: BLL, borderColor: BL },
  placeCandidateRadio: { width: 18, height: 18, marginTop: 2, marginRight: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: T2, borderRadius: 9 },
  placeCandidateRadioSelected: { borderColor: BL },
  placeCandidateRadioDot: { width: 9, height: 9, backgroundColor: BL, borderRadius: 5 },
  placeCandidateText: { flex: 1 },
  placeCandidateNameRow: { flexDirection: "row", alignItems: "center" },
  placeCandidateName: { flex: 1, marginRight: 8, fontSize: 13, fontWeight: "800", color: T0 },
  placeCandidateDistance: { fontSize: 11, fontWeight: "700", color: BL },
  placeCandidateCategory: { marginTop: 3, fontSize: 11, color: T1 },
  placeCandidateAddress: { marginTop: 2, fontSize: 11, lineHeight: 16, color: T2 },
  placeEmptyText: { marginBottom: 12, textAlign: "center", fontSize: 12, lineHeight: 18, color: T2 },
  pickerActionRow: { flexDirection: "row", gap: 10 },

  selectedLocationBox: { marginBottom: 18, padding: 15, backgroundColor: BLL, borderWidth: 1, borderColor: "#C8D8CF", borderRadius: 16 },
  selectedLocationCaption: { marginBottom: 4, fontSize: 11, fontWeight: "800", color: BL },
  selectedLocationName: { fontSize: 15, fontWeight: "800", color: T0 },
  selectedLocationAddress: { marginTop: 4, fontSize: 11, lineHeight: 16, color: T1 },
  homePrivacyBox: { marginBottom: 20, padding: 14, flexDirection: "row", alignItems: "center", backgroundColor: PINK_LIGHT, borderRadius: 14 },
  homePrivacyText: { flex: 1, marginLeft: 10 },
  homePrivacyTitle: { marginBottom: 3, fontSize: 12, fontWeight: "800", color: PINK },
  homePrivacyDesc: { fontSize: 11, lineHeight: 16, color: T1 },

  shareModalOverlay: { flex: 1, justifyContent: "flex-end" },
  shareModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(24, 35, 29, 0.52)" },
  shareModalCard: { maxHeight: "88%", backgroundColor: "#F9F7F1", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  shareModalHandle: { alignSelf: "center", width: 42, height: 5, marginTop: 10, backgroundColor: "#D7D9DE", borderRadius: 3 },
  shareModalContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34 },
  shareModalHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  shareModalCaption: { marginBottom: 4, fontSize: 12, fontWeight: "800", color: BL },
  shareModalTitle: { paddingRight: 10, fontSize: 19, lineHeight: 26, fontWeight: "800", color: T0 },
  shareModalClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: WH, borderRadius: 18 },

  fieldLabel: { marginBottom: 8, fontSize: 13, fontWeight: "800", color: T0 },
  placeInput: { height: 48, paddingHorizontal: 14, fontSize: 14, color: T0, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14, marginBottom: 18 },
  emotionWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  emotionChip: { marginRight: 8, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 18 },
  emotionChipSelected: { backgroundColor: BLL, borderColor: BL },
  emotionChipText: { fontSize: 12, color: T1 },
  emotionChipTextSelected: { fontWeight: "800", color: BL },
  contentInput: { minHeight: 130, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 13, fontSize: 14, lineHeight: 22, color: T0, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 16 },
  characterCount: { marginTop: 6, marginBottom: 18, textAlign: "right", fontSize: 11, color: T2 },
  photoSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoCountText: { fontSize: 11, color: T2 },
  photoOptionalHint: { fontSize: 11, color: T2, marginTop: 3, marginBottom: 8 },
  photoActionRow: { flexDirection: "row", marginTop: 6, marginBottom: 12 },
  photoActionButton: { flex: 1, minHeight: 48, marginRight: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  photoActionIcon: { marginRight: 6, fontSize: 16 },
  photoActionText: { fontSize: 12, fontWeight: "800", color: T1 },
  photoPreviewWrapper: { position: "relative", width: 92, height: 92, marginRight: 9 },
  photoPreview: { width: "100%", height: "100%", backgroundColor: T3, borderRadius: 14 },
  photoRemoveButton: { position: "absolute", top: 5, right: 5, width: 24, height: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(38,55,46,0.75)", borderRadius: 12 },
  photoRemoveButtonText: { fontSize: 11, fontWeight: "800", color: WH },
  coverPhotoBadge: { position: "absolute", right: 5, bottom: 5, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: BL, borderRadius: 7 },
  coverPhotoBadgeText: { fontSize: 9, fontWeight: "800", color: WH },
  photoHelperText: { marginBottom: 18, fontSize: 11, color: T2 },
  visibilityRow: { flexDirection: "row", marginBottom: 20 },
  visibilityOption: { flex: 1, minHeight: 76, marginRight: 8, padding: 13, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  visibilityOptionSelected: { backgroundColor: BLL, borderColor: BL },
  visibilityOptionTitle: { marginBottom: 4, fontSize: 13, fontWeight: "800", color: T1 },
  visibilityOptionTitleSelected: { color: BL },
  visibilityOptionDesc: { fontSize: 10, lineHeight: 15, color: T2 },
  submitButton: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: BL, borderRadius: 16 },
  submitButtonText: { fontSize: 15, fontWeight: "800", color: WH },
  buttonDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  recordTitleInput: { height: 48, paddingHorizontal: 14, fontSize: 14, color: T0, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  recordTitleCount: { marginTop: 6, marginBottom: 18, textAlign: "right", fontSize: 11, color: T2 },
  pickerSearchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, backgroundColor: WH, borderRadius: 16, borderWidth: 1, borderColor: T3, elevation: 6 },
  pickerSearchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: T0 },
  pickerSearchDropdown: { marginTop: 7, overflow: "hidden", backgroundColor: WH, borderRadius: 16, borderWidth: 1, borderColor: T3, elevation: 8 },
  pickerSearchResult: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EFECE6" },
  pickerSearchResultIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 10 },
  pickerSearchResultName: { fontSize: 13, fontWeight: "800", color: T0 },
  pickerSearchResultAddress: { marginTop: 3, fontSize: 11, color: T2 },
  pickerSearchResultDistance: { fontSize: 11, fontWeight: "700", color: BL },
  pickerSearchEmpty: { padding: 14, textAlign: "center", fontSize: 12, color: T2 },
  homeRecordTitle: { marginTop: 2, marginBottom: 8, fontSize: 16, lineHeight: 22, fontWeight: "800", color: T0 },
  archiveLikeButton: { alignSelf: "flex-end", minWidth: 52, minHeight: 34, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 11, backgroundColor: PINK_LIGHT, borderRadius: 17 },
  archiveLikeText: { fontSize: 11, fontWeight: "800", color: PINK },

  myRecordsSheet: {
    position: "absolute", top: MY_SHEET_TOP, right: 0, left: 0, zIndex: 9, overflow: "hidden",
    backgroundColor: "#F9F7F1", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T3, elevation: 18,
  },
  myRecordsSheetDragArea: { height: 36, alignItems: "center", justifyContent: "center" },
  myRecordsSheetHeader: { paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center" },
  myRecordsSheetCaption: { marginBottom: 2, fontSize: 11, color: T2 },
  myRecordsSheetTitle: { fontSize: 20, fontWeight: "800", color: T0 },
  myRecordsCountBadge: { minWidth: 32, height: 32, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 16 },
  myRecordsCountText: { fontSize: 13, fontWeight: "800", color: BL },
  myRecordsMapSummary: { minHeight: 32, marginHorizontal: 20, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: WH, borderRadius: 16, borderWidth: 1, borderColor: T3 },
  myRecordsMapSummaryText: { marginLeft: 5, fontSize: 11, fontWeight: "800", color: BL },
  myRecordsMapSummaryMuted: { fontSize: 10, color: T2 },
  myRecordsSectionTabs: { position: "relative", height: 52, marginTop: 10, marginHorizontal: MY_RECORD_TAB_HORIZONTAL_MARGIN, marginBottom: 8, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: T3 },
  myRecordsSectionIndicator: { position: "absolute", left: 0, bottom: -1, height: 3, backgroundColor: BL, borderRadius: 2 },
  myRecordsSectionTab: { flex: 1, alignItems: "center", justifyContent: "center" },
  myRecordsSectionTabText: { fontSize: 12, fontWeight: "700", color: T2 },
  myRecordsSectionTabTextSelected: { color: BL, fontWeight: "800" },
  myRecordsSectionCount: { marginTop: 2, fontSize: 10, fontWeight: "700", color: T2 },
  myRecordsSectionCountSelected: { color: BL },
  myRecordsSectionContent: { flex: 1 },
  myRecordsListScroll: { flex: 1 },
  myRecordsList: { paddingHorizontal: 16, paddingBottom: 120 },
  myRecordsEmpty: { flex: 1, minHeight: 250, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  myRecordsEmptyEmoji: { marginBottom: 10, fontSize: 40 },
  myRecordsEmptyTitle: { marginBottom: 5, fontSize: 15, fontWeight: "800", color: T0 },
  myRecordsEmptyText: { marginTop: 8, textAlign: "center", fontSize: 12, lineHeight: 18, color: T1 },
  myRecordCard: { marginBottom: 12, padding: 16, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 18 },
  myRecordCardHeader: { marginBottom: 12, flexDirection: "row", alignItems: "center" },
  myRecordCardPhoto: { width: 42, height: 42, marginRight: 10, borderRadius: 12, backgroundColor: T3 },
  myRecordCardIcon: { width: 42, height: 42, marginRight: 10, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 12 },
  myRecordCardIconText: { fontSize: 20 },
  myRecordCardHeaderText: { flex: 1 },
  myRecordCardDate: { marginBottom: 2, fontSize: 11, color: T2 },
  myRecordCardVisibility: { fontSize: 12, fontWeight: "800", color: T0 },
  myRecordCardActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  myRecordCardOpen: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 17 },
  myRecordCardOpenFocused: { backgroundColor: BL },
  myRecordCardDelete: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#FCE8E6", borderRadius: 17 },
  myRecordCardTitle: { marginBottom: 4, fontSize: 16, lineHeight: 22, fontWeight: "800", color: T0 },
  myRecordCardPlace: { marginBottom: 10, fontSize: 11, color: T1 },
});