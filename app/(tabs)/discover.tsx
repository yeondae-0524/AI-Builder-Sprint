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
  generateMissionFromPost,
  getDiscoverPhotoUrl,
  getNearbyDiscoverPosts,
} from "../../services/service_missons";

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
  "MT1",
  "CS2",
  "PS3",
  "SC4",
  "AC5",
  "PK6",
  "OL7",
  "SW8",
  "BK9",
  "CT1",
  "AG2",
  "PO3",
  "AT4",
  "AD5",
  "FD6",
  "CE7",
  "HP8",
  "PM9",
] as const;
const KAKAO_PLACE_SEARCH_RADII_M = [500, 2000] as const;
const KAKAO_PLACE_CANDIDATE_LIMIT = 5;

const DEFAULT_CENTER = { lat: 35.1795543, lng: 129.0756416 };

const FILTERS = ["방 안 기록", "내 기록", "가까운 기록", "최근 기록", "내 취향", "새로운 분야", "산책"];

const CATEGORIES = ["음식", "카페 및 디저트", "산책", "배움", "감상", "활동", "휴식", "기타"];

type EmotionValue = "comfortable" | "joyful" | "new" | "uncomfortable" | "unsure";
type RecordVisibility = "private" | "nickname";
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
  canLike?: boolean;
  canDelete?: boolean;
  user_id: string | null;
  place: string;
  lat: number;
  lng: number;
  mission: string;
  sourceKind: "independent" | "mission";
  time: string;
  nick: string;
  emotion: string;
  note: string;
  likes: number;
  category: string;
  photo?: string;
  real?: boolean;
  multi?: boolean;
  count?: number;
};

const EMOTIONS: Array<{ label: string; value: EmotionValue; emoji: string }> = [
  { label: "편안해요", value: "comfortable", emoji: "😌" },
  { label: "즐거워요", value: "joyful", emoji: "😊" },
  { label: "새로워요", value: "new", emoji: "✨" },
  { label: "불편해요", value: "uncomfortable", emoji: "😣" },
  { label: "잘 모르겠어요", value: "unsure", emoji: "🤔" },
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

async function fetchKakaoCategoryPlaces(
  coordinate: Coordinate,
  categoryCode: string,
  radiusM: number,
): Promise<KakaoPlaceDocument[]> {
  const url =
    "https://dapi.kakao.com/v2/local/search/category.json" +
    `?category_group_code=${encodeURIComponent(categoryCode)}` +
    `&x=${encodeURIComponent(String(coordinate.lng))}` +
    `&y=${encodeURIComponent(String(coordinate.lat))}` +
    `&radius=${radiusM}` +
    "&sort=distance&size=15";

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
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
    "https://dapi.kakao.com/v2/local/search/keyword.json" +
    `?query=${encodeURIComponent(query)}` +
    `&x=${encodeURIComponent(String(coordinate.lng))}` +
    `&y=${encodeURIComponent(String(coordinate.lat))}` +
    `&radius=${radiusM}` +
    "&sort=distance&size=15";

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
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
    "https://dapi.kakao.com/v2/local/geo/coord2address.json" +
    `?x=${encodeURIComponent(String(coordinate.lng))}` +
    `&y=${encodeURIComponent(String(coordinate.lat))}`;

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
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
    .filter((value, index, values) =>
      value.length >= 2 && values.indexOf(value) === index,
    )
    .slice(0, 5);
}

function toPlaceCandidate(
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

  const apiDistanceM = Number(document.distance);
  const distanceM = Number.isFinite(apiDistanceM)
    ? Math.max(0, Math.round(apiDistanceM))
    : Math.max(
        0,
        Math.round(
          haversineM(
            coordinate.lat,
            coordinate.lng,
            latitude,
            longitude,
          ),
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
    categoryDetail:
      document.category_name ||
      document.category_group_name ||
      undefined,
    distanceM,
  };
}

async function searchNearbyKakaoPlaces(
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
        const candidate = toPlaceCandidate(document, coordinate);
        if (!candidate) continue;

        const previous = uniquePlaces.get(candidate.id);
        if (!previous || candidate.distanceM < previous.distanceM) {
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
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, KAKAO_PLACE_CANDIDATE_LIMIT);
}

async function buildBubbleList(posts: any[]): Promise<DiscoverBubble[]> {
  const mapPosts = posts.filter((post) => {
    const lat = Number(post?.lat);
    const lng = Number(post?.lng);
    return (
      post?.place_name !== "내 방" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0)
    );
  });

  const postIds = mapPosts
    .map((post) => String(post?.id ?? ""))
    .filter(Boolean);
  const metadataById = new Map<
    string,
    {
      title: string;
      sourceKind: "independent" | "mission";
      authorNickname: string;
      shareMode: "anonymous" | "nickname";
    }
  >();

  if (postIds.length > 0) {
    const { data: metadataRows, error: metadataError } = await supabase.rpc(
      "get_discover_post_display_metadata",
      { p_post_ids: postIds },
    );

    if (metadataError) {
      console.log("발견 기록 제목 조회 실패:", metadataError.message);
    } else {
      for (const row of metadataRows ?? []) {
        metadataById.set(String(row.id), {
          title: String(row.title ?? "").trim(),
          sourceKind:
            row.source_kind === "mission" ? "mission" : "independent",
          authorNickname:
            String(row.author_nickname ?? "").trim() || "사용자",
          shareMode:
            row.share_mode === "nickname" ? "nickname" : "anonymous",
        });
      }
    }
  }

  return Promise.all(
    mapPosts.map(async (p) => {
      const photos: DiscoverPostPhoto[] = Array.isArray(p.photos)
        ? p.photos
        : [];
      const cover = photos.find((ph) => ph.is_cover) ?? photos[0];
      let photoUrl: string | undefined;

      try {
        photoUrl = cover?.storage_path
          ? await getDiscoverPhotoUrl(cover.storage_path)
          : undefined;
      } catch (photoUrlError) {
        console.log(
          "사진 URL 가져오기 실패:",
          photoUrlError instanceof Error
            ? photoUrlError.message
            : photoUrlError,
        );
        photoUrl = undefined;
      }

      const id = String(p.id);
      const content = String(p.content ?? "");
      const metadata = metadataById.get(id);
      const title =
        metadata?.title ||
        String(p.title ?? "").trim() ||
        content.slice(0, 40) ||
        "기록";

      return {
        id,
        discoverPostId: id,
        canLike: true,
        canDelete: true,
        user_id: p.user_id ? String(p.user_id) : null,
        place: String(p.place_name ?? "장소"),
        lat: Number(p.lat),
        lng: Number(p.lng),
        mission: title,
        sourceKind:
          metadata?.sourceKind ||
          (p.source_kind === "mission" ? "mission" : "independent"),
        time: new Date(p.created_at).toLocaleDateString("ko-KR"),
        nick:
          metadata?.shareMode === "nickname"
            ? metadata.authorNickname
            : "익명",
        emotion: EMOTION_LABEL[p.emotion] ?? String(p.emotion ?? ""),
        note: content,
        likes: Number(p.likes_count ?? 0),
        category: String(p.category ?? "기타"),
        photo: photoUrl,
        real: true,
      };
    }),
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function RecordLocationPickerMap({
  center,
  pickedLocation,
  guideText,
  onSelect,
}: {
  center: Coordinate;
  pickedLocation: Coordinate | null;
  guideText: string;
  onSelect: (coordinate: Coordinate) => void;
}) {
  const webViewRef = useRef<any>(null);
  const mapReadyRef = useRef(false);

  const escapedGuideText = guideText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = useMemo(
    () => `
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
      align-items: center; justify-content: center; background: #f7f8fa;
      color: #5c5f6a; font-family: sans-serif; font-size: 13px;
    }
    #guide {
      position: fixed; top: 10px; left: 50%; z-index: 20;
      max-width: calc(100vw - 28px); padding: 8px 12px;
      transform: translateX(-50%); border-radius: 999px;
      background: rgba(255,255,255,0.96); color: #3d5afe;
      font-family: sans-serif; font-size: 11px; line-height: 15px;
      font-weight: 800; white-space: nowrap;
      box-shadow: 0 3px 12px rgba(0,0,0,0.14);
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
      const map = new kakao.maps.Map(document.getElementById('map'), {
        center: initial,
        level: 4,
      });
      let marker = null;

      const postLocation = function (position) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'recordLocation',
          lat: position.getLat(),
          lng: position.getLng(),
        }));
      };

      window.setPickedLocation = function (lat, lng, shouldPan) {
        lat = Number(lat);
        lng = Number(lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const latLng = new kakao.maps.LatLng(lat, lng);

        if (!marker) {
          marker = new kakao.maps.Marker({
            map: map,
            position: latLng,
            draggable: true,
          });
          kakao.maps.event.addListener(marker, 'dragend', function () {
            postLocation(marker.getPosition());
          });
        } else {
          marker.setPosition(latLng);
          marker.setMap(map);
        }

        if (shouldPan) map.panTo(latLng);
      };

      kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
        const position = mouseEvent.latLng;
        window.setPickedLocation(position.getLat(), position.getLng(), false);
        postLocation(position);
      });

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'recordLocationMapReady',
      }));
    });
  </script>
</body>
</html>`,
    [center.lat, center.lng, escapedGuideText],
  );

  const syncPickedLocation = useCallback(
    (shouldPan: boolean) => {
      if (!mapReadyRef.current || !pickedLocation) return;
      webViewRef.current?.injectJavaScript(`
        if (window.setPickedLocation) {
          window.setPickedLocation(
            ${pickedLocation.lat},
            ${pickedLocation.lng},
            ${shouldPan ? "true" : "false"}
          );
        }
        true;
      `);
    },
    [pickedLocation?.lat, pickedLocation?.lng],
  );

  useEffect(() => {
    syncPickedLocation(true);
  }, [syncPickedLocation]);

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={["*"]}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      onLoadStart={() => {
        mapReadyRef.current = false;
      }}
      onMessage={(event) => {
        try {
          const message = JSON.parse(event.nativeEvent.data) as {
            type?: string;
            lat?: number;
            lng?: number;
          };

          if (message.type === "recordLocationMapReady") {
            mapReadyRef.current = true;
            syncPickedLocation(false);
            return;
          }

          if (
            message.type === "recordLocation" &&
            isFiniteNumber(message.lat) &&
            isFiniteNumber(message.lng)
          ) {
            onSelect({ lat: message.lat, lng: message.lng });
          }
        } catch {
          // 지도 내부의 다른 메시지는 무시합니다.
        }
      }}
      style={styles.recordLocationPickerMap}
    />
  );
}


function inferRecordCategory(text: string): string {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();

  if (/(카페|디저트|베이커리|빵|커피|라떼|케이크|아이스크림)/.test(normalized)) {
    return "카페 및 디저트";
  }
  if (/(음식|식사|맛집|요리|먹기|국밥|라면|국수|분식|한 끼)/.test(normalized)) {
    return "음식";
  }
  if (/(산책|걷기|공원|골목|해변|강변|둘레길|등산|자연)/.test(normalized)) {
    return "산책";
  }
  if (/(독서|책|공부|배움|학습|강의|도서관|서점)/.test(normalized)) {
    return "배움";
  }
  if (/(음악|영화|공연|전시|미술관|박물관|감상|사진|그림|연극)/.test(normalized)) {
    return "감상";
  }
  if (/(운동|체험|만들기|공방|자전거|클라이밍|러닝|요가|춤|볼링)/.test(normalized)) {
    return "활동";
  }
  if (/(휴식|명상|호흡|온천|찜질|낮잠|힐링|쉬기)/.test(normalized)) {
    return "휴식";
  }

  return "기타";
}

function normalizeRecordCategory(
  rawCategory: unknown,
  textForInference: string,
) {
  const category = String(rawCategory ?? "").trim();

  if (CATEGORIES.includes(category)) {
    return category;
  }

  return inferRecordCategory(`${category} ${textForInference}`);
}

type MissionRecordMetadata = {
  title: string;
  category: string;
};

async function getMissionMetadataByAttemptIds(attemptIds: string[]) {
  const result = new Map<string, MissionRecordMetadata>();
  const uniqueAttemptIds = Array.from(new Set(attemptIds.filter(Boolean)));

  if (uniqueAttemptIds.length === 0) return result;

  const { data: attempts, error: attemptsError } = await supabase
    .from("mission_attempts")
    .select("id, mission_id")
    .in("id", uniqueAttemptIds);

  if (attemptsError) {
    console.log("미션 연결 조회 실패:", attemptsError.message);
    return result;
  }

  const missionIds = Array.from(
    new Set((attempts ?? []).map((row) => String(row.mission_id)).filter(Boolean)),
  );
  if (missionIds.length === 0) return result;

  let missionRows: any[] = [];
  const extendedMissionResult = await supabase
    .from("missions")
    .select("id, title, category_id")
    .in("id", missionIds);

  if (extendedMissionResult.error) {
    const basicMissionResult = await supabase
      .from("missions")
      .select("id, title")
      .in("id", missionIds);

    if (basicMissionResult.error) {
      console.log("미션 정보 조회 실패:", basicMissionResult.error.message);
      return result;
    }

    missionRows = basicMissionResult.data ?? [];
  } else {
    missionRows = extendedMissionResult.data ?? [];
  }

  const categoryIds = Array.from(
    new Set(
      missionRows
        .map((row) => String(row.category_id ?? ""))
        .filter(Boolean),
    ),
  );
  const categoryNameById = new Map<string, string>();

  if (categoryIds.length > 0) {
    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", categoryIds);

    if (!categoriesError) {
      for (const category of categories ?? []) {
        categoryNameById.set(
          String(category.id),
          String(category.name ?? ""),
        );
      }
    }
  }

  const metadataByMissionId = new Map<string, MissionRecordMetadata>();

  for (const mission of missionRows) {
    const title = String(mission.title ?? "미션 기록");
    const rawCategory = categoryNameById.get(
      String(mission.category_id ?? ""),
    );
    metadataByMissionId.set(String(mission.id), {
      title,
      category: normalizeRecordCategory(rawCategory, title),
    });
  }

  for (const attempt of attempts ?? []) {
    const metadata = metadataByMissionId.get(String(attempt.mission_id));
    result.set(
      String(attempt.id),
      metadata ?? {
        title: "미션 기록",
        category: "기타",
      },
    );
  }

  return result;
}

async function resolveDiscoverCoverPhoto(row: any) {
  const photos: Array<DiscoverPostPhoto & { sort_order?: number | null }> =
    Array.isArray(row?.photos) ? row.photos : [];
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
  } catch (error) {
    console.log(
      "내 발견 기록 사진 URL 조회 실패:",
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

async function resolveRecordCoverPhoto(row: any) {
  const photos: Array<DiscoverPostPhoto & { sort_order?: number | null }> =
    Array.isArray(row?.record_photos) ? row.record_photos : [];
  const sorted = [...photos].sort((left, right) => {
    if (Boolean(left.is_cover) !== Boolean(right.is_cover)) {
      return left.is_cover ? -1 : 1;
    }
    return Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  });
  const storagePath = String(sorted[0]?.storage_path ?? "").trim();

  if (!storagePath) return undefined;

  const { data, error } = await supabase.storage
    .from("record-photos")
    .createSignedUrl(storagePath, 3600);

  if (error) {
    console.log("내 미션 기록 사진 URL 조회 실패:", error.message);
    return undefined;
  }

  return data.signedUrl;
}

function normalizeInterests(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function normalizeRecordVisibility(value: unknown): "private" | "nickname" {
  return String(value ?? "") === "private" ? "private" : "nickname";
}

function getCategoryEmoji(category: string) {
  const emojis: Record<string, string> = {
    음식: "🍽️",
    "카페 및 디저트": "☕",
    산책: "🌿",
    배움: "📚",
    감상: "🎧",
    활동: "🏃",
    휴식: "🛋️",
    기타: "✨",
  };
  return emojis[category] ?? "✨";
}

function isArchiveFilter(value: string) {
  return value === "방 안 기록";
}

function isPersonalMapFilter(value: string) {
  return value === "내 기록";
}



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
  const [myRecordVisibilityFilter, setMyRecordVisibilityFilter] =
    useState<MyRecordVisibilityFilter>("all");
  const [focusedMyRecordKey, setFocusedMyRecordKey] = useState<string | null>(
    null,
  );
  const [selectedMapBubbleId, setSelectedMapBubbleId] = useState<string | null>(
    null,
  );

  const [registerVisible, setRegisterVisible] = useState(false);
  const [recordTitle, setRecordTitle] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [emotion, setEmotion] = useState<EmotionValue | "">("");
  const [visibility, setVisibility] = useState<RecordVisibility>("private");
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_CLOSE_POSITION)).current;
  const dragStart = useRef(0);
  const homeSheetTranslateY = useRef(
    new Animated.Value(HOME_SHEET_CLOSE_POSITION),
  ).current;
  const homeDragStart = useRef(0);
  const mySheetTranslateY = useRef(
    new Animated.Value(MY_SHEET_CLOSE_POSITION),
  ).current;
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

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const btnScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const loadLikedPostIds = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("discover_post_likes")
      .select("post_id")
      .eq("user_id", userId);

    if (error) {
      console.log("좋아요 상태 조회 실패:", error.message);
      return;
    }

    setLikedPostIds((data ?? []).map((row) => String(row.post_id)));
  }, []);

  const loadHomeRecords = useCallback(async (userId: string) => {
    setHomeRecordsLoading(true);

    try {
      const [homeDiscoverRpcResult, missionResult] = await Promise.all([
        supabase.rpc("get_home_room_discover_posts"),
        supabase
          .from("records")
          .select(
            "id, mission_attempt_id, content, emotion, visibility, recorded_at, created_at, location_type, location_name",
          )
          .eq("user_id", userId)
          .eq("location_type", "home")
          .order("recorded_at", { ascending: false }),
      ]);

      let discoverRows: any[] = [];

      if (homeDiscoverRpcResult.error) {
        console.log(
          "방 안 기록 RPC 조회 실패, 일반 조회로 재시도:",
          homeDiscoverRpcResult.error.message,
        );

        const fallbackResult = await supabase
          .from("discover_posts")
          .select(
            "id, user_id, title, source_kind, content, emotion, category, visibility, likes_count, created_at, place_name",
          )
          .eq("place_name", "내 방")
          .or(`visibility.eq.anonymous,user_id.eq.${userId}`)
          .order("created_at", { ascending: false });

        if (fallbackResult.error) {
          console.log("방 안 기록 조회 실패:", fallbackResult.error.message);
        } else {
          discoverRows = fallbackResult.data ?? [];
        }
      } else {
        discoverRows = Array.isArray(homeDiscoverRpcResult.data)
          ? homeDiscoverRpcResult.data
          : [];
      }

      if (missionResult.error) {
        console.log("내 방 미션 기록 조회 실패:", missionResult.error.message);
      }

      const missionMetadataByAttemptId =
        await getMissionMetadataByAttemptIds(
          (missionResult.data ?? [])
            .map((row) => String(row.mission_attempt_id ?? ""))
            .filter(Boolean),
        );

      const homeDisplayMetadata = new Map<
        string,
        { nickname: string; shareMode: "anonymous" | "nickname" }
      >();
      const homePostIds = discoverRows
        .map((row) => String(row.id ?? ""))
        .filter(Boolean);

      if (homePostIds.length > 0) {
        const { data: displayRows, error: displayError } = await supabase.rpc(
          "get_discover_post_display_metadata",
          { p_post_ids: homePostIds },
        );

        if (displayError) {
          console.log("방 안 기록 닉네임 조회 실패:", displayError.message);
        } else {
          for (const row of displayRows ?? []) {
            homeDisplayMetadata.set(String(row.id), {
              nickname:
                String(row.author_nickname ?? "").trim() || "사용자",
              shareMode:
                row.share_mode === "nickname" ? "nickname" : "anonymous",
            });
          }
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
          emotion:
            EMOTION_LABEL[String(row.emotion ?? "")] ??
            String(row.emotion ?? ""),
          category: String(row.category ?? "기타"),
          visibility: String(row.visibility ?? "private"),
          createdAt: String(row.created_at ?? ""),
          likes: Number(row.likes_count ?? 0),
          sourceKind: row.source_kind === "mission" ? "mission" : "independent",
          nickname:
            displayMetadata?.nickname ??
            (ownerId === userId ? "나" : "익명"),
          shareMode: displayMetadata?.shareMode ?? "anonymous",
        };
      });

      const missionRecords: HomeRoomRecord[] = (missionResult.data ?? []).map(
        (row) => {
          const attemptId = String(row.mission_attempt_id ?? "");
          return {
            id: String(row.id),
            source: "mission",
            userId,
            isMine: true,
            title:
              missionMetadataByAttemptId.get(attemptId)?.title ??
              "미션 기록",
            content: String(row.content ?? ""),
            emotion:
              EMOTION_LABEL[String(row.emotion ?? "")] ??
              String(row.emotion ?? ""),
            category:
              missionMetadataByAttemptId.get(attemptId)?.category ??
              "기타",
            visibility: String(row.visibility ?? "private"),
            createdAt: String(row.recorded_at ?? row.created_at ?? ""),
            likes: 0,
            sourceKind: "mission",
            nickname: "나",
            shareMode: normalizeRecordVisibility(row.visibility),
          };
        },
      );

      const byNewest = (a: HomeRoomRecord, b: HomeRoomRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

      setSharedHomeRecords(
        discoverRecords
          .filter((record) => record.visibility !== "private")
          .sort(byNewest),
      );
      setMyHomeRecords(
        [
          ...discoverRecords.filter((record) => record.isMine),
          ...missionRecords,
        ].sort(byNewest),
      );
    } finally {
      setHomeRecordsLoading(false);
    }
  }, []);

  const loadMyRecords = useCallback(async (userId: string) => {
    setMyRecordsLoading(true);

    try {
      let discoverRows: any[] = [];
      let discoverErrorMessage = "";

      const discoverSelections = [
        `
          id,
          title,
          source_kind,
          content,
          emotion,
          category,
          visibility,
          share_mode,
          likes_count,
          created_at,
          place_name,
          lat,
          lng,
          photos:discover_post_photos (
            storage_path,
            is_cover,
            sort_order
          )
        `,
        `
          id,
          title,
          source_kind,
          content,
          emotion,
          category,
          visibility,
          share_mode,
          likes_count,
          created_at,
          place_name,
          lat,
          lng,
          photos:discover_photos (
            storage_path,
            is_cover,
            sort_order
          )
        `,
        `
          id,
          title,
          source_kind,
          content,
          emotion,
          category,
          visibility,
          share_mode,
          likes_count,
          created_at,
          place_name,
          lat,
          lng,
          photos (
            storage_path,
            is_cover,
            sort_order
          )
        `,
      ];

      for (const selection of discoverSelections) {
        const result = await supabase
          .from("discover_posts")
          .select(selection)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!result.error) {
          discoverRows = result.data ?? [];
          discoverErrorMessage = "";
          break;
        }

        discoverErrorMessage = result.error.message;
      }

      if (discoverRows.length === 0 && discoverErrorMessage) {
        const fallbackDiscoverResult = await supabase
          .from("discover_posts")
          .select(
            "id, title, source_kind, content, emotion, category, visibility, likes_count, created_at, place_name, lat, lng",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (fallbackDiscoverResult.error) {
          console.log(
            "내 발견 기록 조회 실패:",
            fallbackDiscoverResult.error.message,
          );
        } else {
          discoverRows = fallbackDiscoverResult.data ?? [];
        }
      }

      const recordsResult = await supabase
        .from("records")
        .select(`
          id,
          mission_attempt_id,
          content,
          emotion,
          visibility,
          recorded_at,
          created_at,
          location_name,
          location_type,
          location_latitude,
          location_longitude,
          record_photos (
            storage_path,
            is_cover,
            sort_order
          )
        `)
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false });

      if (recordsResult.error) {
        console.log("내 미션 기록 조회 실패:", recordsResult.error.message);
      }

      const missionMetadataByAttemptId =
        await getMissionMetadataByAttemptIds(
          (recordsResult.data ?? [])
            .map((row) => String(row.mission_attempt_id ?? ""))
            .filter(Boolean),
        );

      const independentRecords = await Promise.all(
        discoverRows
          .filter((row) => row.source_kind !== "mission")
          .map(async (row): Promise<MyRecordItem> => {
            const content = String(row.content ?? "");
            const title =
              String(row.title ?? "").trim() ||
              content.slice(0, 40) ||
              "기록";

            return {
              key: `discover-${row.id}`,
              id: String(row.id),
              source: "discover",
              discoverPostId: String(row.id),
              title,
              content,
              placeName: String(row.place_name ?? "장소 정보 없음"),
              emotion:
                EMOTION_LABEL[String(row.emotion ?? "")] ??
                String(row.emotion ?? ""),
              category: normalizeRecordCategory(
                row.category,
                `${title} ${content}`,
              ),
              visibility: normalizeRecordVisibility(
                row.share_mode ?? row.visibility,
              ),
              createdAt: String(row.created_at ?? ""),
              likes: Number(row.likes_count ?? 0),
              lat: Number.isFinite(Number(row.lat)) ? Number(row.lat) : null,
              lng: Number.isFinite(Number(row.lng)) ? Number(row.lng) : null,
              photo: await resolveDiscoverCoverPhoto(row),
            };
          }),
      );

      const missionRecords = await Promise.all(
        (recordsResult.data ?? []).map(
          async (row): Promise<MyRecordItem> => {
            const attemptId = String(row.mission_attempt_id ?? "");
            const metadata = missionMetadataByAttemptId.get(attemptId);
            const content = String(row.content ?? "");
            const title = metadata?.title ?? "미션 기록";

            return {
              key: `mission-${row.id}`,
              id: String(row.id),
              source: "mission",
              discoverPostId: null,
              title,
              content,
              placeName:
                String(row.location_name ?? "").trim() ||
                (row.location_type === "home"
                  ? "내 방"
                  : "장소 정보 없음"),
              emotion:
                EMOTION_LABEL[String(row.emotion ?? "")] ??
                String(row.emotion ?? ""),
              category:
                metadata?.category ??
                inferRecordCategory(`${title} ${content}`),
              visibility: normalizeRecordVisibility(row.visibility),
              createdAt: String(row.recorded_at ?? row.created_at ?? ""),
              likes: 0,
              lat: Number.isFinite(Number(row.location_latitude))
                ? Number(row.location_latitude)
                : null,
              lng: Number.isFinite(Number(row.location_longitude))
                ? Number(row.location_longitude)
                : null,
              photo: await resolveRecordCoverPhoto(row),
            };
          },
        ),
      );

      setMyRecords(
        [...independentRecords, ...missionRecords].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      );
    } finally {
      setMyRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("interests, nickname")
          .eq("id", user.id)
          .maybeSingle();
        setMyInterests(normalizeInterests(profileData?.interests));
        setCurrentNickname(
          String(profileData?.nickname ?? "").trim() || "나",
        );
        await Promise.all([
          loadHomeRecords(user.id),
          loadMyRecords(user.id),
          loadLikedPostIds(user.id),
        ]);
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
        const posts = await getNearbyDiscoverPosts(
          lat,
          lng,
          MAP_AUTO_SEARCH_RADIUS_KM,
        );
        if (posts.length > 0) {
          setBubbles(await buildBubbleList(posts));
        }
      } catch (error) {
        console.log("발견 기록 조회 실패, 목업 사용:", error instanceof Error ? error.message : error);
      }
    };
    void init();
  }, [loadHomeRecords, loadLikedPostIds, loadMyRecords]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const refreshDiscoverPosts = async () => {
        const { lat, lng } = mapCenterRef.current;

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && isActive) {
          setCurrentUserId(user.id);
          await Promise.all([
            loadHomeRecords(user.id),
            loadMyRecords(user.id),
            loadLikedPostIds(user.id),
          ]);
        }

        try {
          const posts = await getNearbyDiscoverPosts(
            lat,
            lng,
            MAP_AUTO_SEARCH_RADIUS_KM,
          );
          const nextBubbles = posts.length > 0 ? await buildBubbleList(posts) : [];

          lastMapSearchCenterRef.current = { lat, lng };

          if (isActive) {
            setMapRefreshAvailable(false);
            setBubbles(nextBubbles);
          }
        } catch (error) {
          console.log(
            "발견 탭 새로고침 실패:",
            error instanceof Error ? error.message : error
          );
        }
      };

      void refreshDiscoverPosts();

      return () => {
        isActive = false;
      };
    }, [loadHomeRecords, loadLikedPostIds, loadMyRecords])
  );

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery.trim())}&size=5`,
          { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }
        );
        const data = await res.json();
        setSearchResults(data.documents ?? []);
      } catch (error) {
        console.log("장소 검색 실패:", error instanceof Error ? error.message : error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (pickerPlaceSearchDebounce.current) {
      clearTimeout(pickerPlaceSearchDebounce.current);
    }

    if (!pickerVisible || pickerMode !== "place" || !pickerPlaceQuery.trim()) {
      setPickerPlaceSearchResults([]);
      setPickerPlaceSearching(false);
      return;
    }

    pickerPlaceSearchDebounce.current = setTimeout(async () => {
      setPickerPlaceSearching(true);
      const center = pickedLocation ?? pickerCenter;

      try {
        const url =
          "https://dapi.kakao.com/v2/local/search/keyword.json" +
          `?query=${encodeURIComponent(pickerPlaceQuery.trim())}` +
          `&x=${encodeURIComponent(String(center.lng))}` +
          `&y=${encodeURIComponent(String(center.lat))}` +
          "&sort=distance&size=8";
        const response = await fetch(url, {
          headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
        });
        const data = (await response.json()) as {
          documents?: KakaoPlaceDocument[];
        };
        const nextResults = (data.documents ?? [])
          .map((document, index): PlaceCandidate | null => {
            const latitude = Number(document.y);
            const longitude = Number(document.x);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return null;
            }
            return {
              id: String(document.id ?? `search-${index}-${latitude}-${longitude}`),
              name: String(document.place_name ?? "장소"),
              latitude,
              longitude,
              address: String(
                document.road_address_name || document.address_name || "",
              ),
              categoryDetail: String(
                document.category_name || document.category_group_name || "장소",
              ),
              distanceM:
                Number(document.distance) ||
                haversineM(center.lat, center.lng, latitude, longitude),
            };
          })
          .filter((place): place is PlaceCandidate => place !== null);
        setPickerPlaceSearchResults(nextResults);
      } catch (error) {
        console.log(
          "기록 장소 검색 실패:",
          error instanceof Error ? error.message : error,
        );
        setPickerPlaceSearchResults([]);
      } finally {
        setPickerPlaceSearching(false);
      }
    }, 350);

    return () => {
      if (pickerPlaceSearchDebounce.current) {
        clearTimeout(pickerPlaceSearchDebounce.current);
      }
    };
  }, [pickerPlaceQuery, pickerVisible, pickerMode, pickerCenter, pickedLocation]);

  useEffect(() => {
    if (activeBubble) {
      setSheetBubble(activeBubble);
      Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }).start();
    }
  }, [activeBubble]);

  const closeSheet = () => {
    Animated.timing(sheetTranslateY, { toValue: SHEET_CLOSE_POSITION, duration: 220, useNativeDriver: true }).start(() => {
      setActiveBubble(null);
      setSheetBubble(null);
    });
  };
  const openSheet = () => {
    Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((v) => (dragStart.current = v));
      },
      onPanResponderMove: (_e, g) => {
        sheetTranslateY.setValue(Math.max(0, dragStart.current + g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(0, dragStart.current + g.dy);
        if (current > 120 || g.vy > 0.6) closeSheet();
        else openSheet();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const openHomeSheet = () => {
    homeSheetTranslateY.stopAnimation();
    Animated.spring(homeSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
    }).start();
  };

  const closeHomeSheet = (nextFilter = "가까운 기록") => {
    homeSheetTranslateY.stopAnimation();
    Animated.timing(homeSheetTranslateY, {
      toValue: HOME_SHEET_CLOSE_POSITION,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setActiveFilter(nextFilter);
    });
  };

  useEffect(() => {
    if (activeFilter === "방 안 기록") {
      openHomeSheet();
    }
  }, [activeFilter]);

  const homePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        homeSheetTranslateY.stopAnimation(
          (value) => (homeDragStart.current = value),
        );
      },
      onPanResponderMove: (_e, g) => {
        homeSheetTranslateY.setValue(
          Math.max(0, homeDragStart.current + g.dy),
        );
      },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(0, homeDragStart.current + g.dy);

        if (current > 120 || g.vy > 0.6) {
          closeHomeSheet();
          return;
        }

        Animated.spring(homeSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
        }).start();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const openMyRecordsSheet = (expanded = false) => {
    mySheetTranslateY.stopAnimation();
    Animated.spring(mySheetTranslateY, {
      toValue: expanded ? 0 : MY_SHEET_COLLAPSED_POSITION,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
    }).start();
  };

  const closeMyRecordsSheet = (callback?: () => void) => {
    mySheetTranslateY.stopAnimation();
    Animated.timing(mySheetTranslateY, {
      toValue: MY_SHEET_CLOSE_POSITION,
      duration: 220,
      useNativeDriver: true,
    }).start(callback);
  };

  useEffect(() => {
    if (activeFilter === "내 기록") {
      openMyRecordsSheet(false);
    }
  }, [activeFilter]);

  const mySheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        mySheetTranslateY.stopAnimation(
          (value) => (mySheetDragStart.current = value),
        );
      },
      onPanResponderMove: (_e, g) => {
        mySheetTranslateY.setValue(
          Math.max(
            0,
            Math.min(
              MY_SHEET_COLLAPSED_POSITION,
              mySheetDragStart.current + g.dy,
            ),
          ),
        );
      },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(
          0,
          Math.min(
            MY_SHEET_COLLAPSED_POSITION,
            mySheetDragStart.current + g.dy,
          ),
        );

        const shouldCollapse =
          g.vy > 0.45 ||
          (g.vy >= -0.45 && current > MY_SHEET_COLLAPSED_POSITION / 2);

        Animated.spring(mySheetTranslateY, {
          toValue: shouldCollapse ? MY_SHEET_COLLAPSED_POSITION : 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
        }).start();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  // React Native 버전에 따라 웹 전용 CSS 속성이 ViewStyle 타입에
  // 포함되지 않을 수 있으므로 웹에서만 명시적으로 타입을 우회합니다.
  const webDragStyle =
    Platform.OS === "web"
      ? ({
          touchAction: "none",
          userSelect: "none",
          cursor: "grab",
        } as any)
      : undefined;

  const handleMapIdle = useCallback((lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const nextCenter = { lat, lng };
    mapCenterRef.current = nextCenter;
    setMapCenter(nextCenter);

    if (
      isArchiveFilter(activeFilterRef.current) ||
      isPersonalMapFilter(activeFilterRef.current)
    ) {
      setMapRefreshAvailable(false);
      return;
    }

    const lastCenter = lastMapSearchCenterRef.current;
    const movedFarEnough =
      !lastCenter ||
      haversineM(lastCenter.lat, lastCenter.lng, lat, lng) >=
        MAP_AUTO_SEARCH_MIN_MOVE_M;

    // 지도 이동만으로는 데이터를 다시 요청하지 않습니다.
    // 마지막 검색 중심에서 충분히 이동했을 때 버튼만 표시합니다.
    setMapRefreshAvailable(movedFarEnough);
  }, []);

  const handleRefreshAtMapCenter = useCallback(async () => {
    if (
      mapRecordsLoading ||
      isArchiveFilter(activeFilterRef.current) ||
      isPersonalMapFilter(activeFilterRef.current)
    ) {
      return;
    }

    const { lat, lng } = mapCenterRef.current;
    const requestId = ++mapSearchSequence.current;
    setMapRecordsLoading(true);

    try {
      const posts = await getNearbyDiscoverPosts(
        lat,
        lng,
        MAP_AUTO_SEARCH_RADIUS_KM,
      );
      const nextBubbles =
        posts.length > 0 ? await buildBubbleList(posts) : [];

      if (requestId !== mapSearchSequence.current) {
        return;
      }

      lastMapSearchCenterRef.current = { lat, lng };
      setBubbles(nextBubbles);
      setMapRefreshAvailable(false);
    } catch (error) {
      if (requestId === mapSearchSequence.current) {
        console.log(
          "현재 지도 위치 기록 조회 실패:",
          error instanceof Error ? error.message : error,
        );
        Alert.alert(
          "새로고침 실패",
          "이 위치의 기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
        );
      }
    } finally {
      if (requestId === mapSearchSequence.current) {
        setMapRecordsLoading(false);
      }
    }
  }, [mapRecordsLoading]);

  const visibleMyRecords = useMemo(
    () =>
      myRecords.filter((record) => {
        if (myRecordVisibilityFilter === "all") return true;
        return record.visibility === myRecordVisibilityFilter;
      }),
    [myRecordVisibilityFilter, myRecords],
  );

  const orderedVisibleMyRecords = useMemo(() => {
    if (!focusedMyRecordKey) {
      return visibleMyRecords;
    }

    const focusedIndex = visibleMyRecords.findIndex(
      (record) => record.key === focusedMyRecordKey,
    );

    if (focusedIndex <= 0) {
      return visibleMyRecords;
    }

    return [
      visibleMyRecords[focusedIndex],
      ...visibleMyRecords.slice(0, focusedIndex),
      ...visibleMyRecords.slice(focusedIndex + 1),
    ];
  }, [focusedMyRecordKey, visibleMyRecords]);

  const myRecordVisibilityCounts = useMemo(
    () => ({
      all: myRecords.length,
      private: myRecords.filter(
        (record) => record.visibility === "private",
      ).length,
      nickname: myRecords.filter(
        (record) => record.visibility === "nickname",
      ).length,
    }),
    [myRecords],
  );

  const changeMyRecordVisibilityFilter = useCallback(
    (nextFilter: MyRecordVisibilityFilter) => {
      if (nextFilter === myRecordVisibilityFilter) {
        return;
      }

      Animated.spring(myRecordFilterIndicator, {
        toValue: MY_RECORD_FILTER_INDEX[nextFilter],
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.8,
      }).start();

      Animated.timing(myRecordContentAnimation, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }).start(() => {
        setMyRecordVisibilityFilter(nextFilter);
        setFocusedMyRecordKey(null);
        setSelectedMapBubbleId(null);
        myRecordsListRef.current?.scrollTo({ y: 0, animated: false });
        myRecordContentAnimation.setValue(0);

        Animated.timing(myRecordContentAnimation, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      });
    },
    [
      myRecordContentAnimation,
      myRecordFilterIndicator,
      myRecordVisibilityFilter,
    ],
  );

  const myRecordBubbles = useMemo<DiscoverBubble[]>(
    () =>
      visibleMyRecords.flatMap((record) => {
        if (
          record.placeName === "내 방" ||
          record.lat === null ||
          record.lng === null ||
          !Number.isFinite(record.lat) ||
          !Number.isFinite(record.lng) ||
          (record.lat === 0 && record.lng === 0)
        ) {
          return [];
        }

        const discoverPostId = record.discoverPostId;

        return [
          {
            id: discoverPostId ?? `mission-record-${record.id}`,
            discoverPostId,
            canLike:
              Boolean(discoverPostId) && record.visibility === "nickname",
            canDelete: Boolean(discoverPostId),
            user_id: currentUserId,
            place: record.placeName,
            lat: record.lat,
            lng: record.lng,
            mission: record.title,
            sourceKind:
              record.source === "mission" ? "mission" : "independent",
            time: record.createdAt
              ? new Date(record.createdAt).toLocaleDateString("ko-KR")
              : "날짜 정보 없음",
            nick: currentNickname,
            emotion: record.emotion,
            note: record.content,
            likes: record.likes,
            category: normalizeRecordCategory(
              record.category,
              `${record.title} ${record.content}`,
            ),
            photo: record.photo,
            real: Boolean(discoverPostId),
          },
        ];
      }),
    [currentNickname, currentUserId, visibleMyRecords],
  );

  const focusMyRecordOnMap = useCallback(
    (record: MyRecordItem) => {
      const markerId =
        record.discoverPostId ?? `mission-record-${record.id}`;
      const bubble = myRecordBubbles.find(
        (item) => String(item.id) === String(markerId),
      );

      if (!bubble) {
        Alert.alert(
          "지도 위치가 없어요",
          "이 기록은 방 안 기록이거나 저장된 위치 정보가 없어 지도에서 볼 수 없어요.",
        );
        return;
      }

      const nextCenter = { lat: bubble.lat, lng: bubble.lng };
      mapCenterRef.current = nextCenter;
      setMapCenter(nextCenter);
      setFocusedMyRecordKey(record.key);
      setSelectedMapBubbleId(String(bubble.id));
      setActiveBubble(null);
      setSheetBubble(null);

      mySheetTranslateY.stopAnimation();
      Animated.spring(mySheetTranslateY, {
        toValue: MY_SHEET_COLLAPSED_POSITION,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
      }).start();

      // 선택한 기록을 목록의 첫 번째로 올린 뒤,
      // 다시 시트를 펼쳤을 때 바로 보이도록 스크롤도 맨 위로 맞춥니다.
      setTimeout(() => {
        myRecordsListRef.current?.scrollTo({ y: 0, animated: true });
      }, 40);
    },
    [myRecordBubbles, mySheetTranslateY],
  );

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
    if (activeFilter === "산책") {
      return bubbles.filter((b) => b.category === "산책");
    }
    // 가까운 기록 / 최근 기록은 조회 시점에 이미 그렇게 정렬/제한되어 있어요
    return bubbles;
  }, [activeFilter, bubbles, myInterests, myRecordBubbles]);

  const visibleHomeRecords =
    homeArchiveTab === "shared" ? sharedHomeRecords : myHomeRecords;

  const applyLikeResult = useCallback(
    (postId: string, liked: boolean, likesCount: number) => {
      setLikedPostIds((current) =>
        liked
          ? current.includes(postId)
            ? current
            : [...current, postId]
          : current.filter((id) => id !== postId),
      );
      setBubbles((current) =>
        current.map((item) =>
          item.id === postId ? { ...item, likes: likesCount } : item,
        ),
      );
      setSheetBubble((current) =>
        current?.id === postId ? { ...current, likes: likesCount } : current,
      );
      setSharedHomeRecords((current) =>
        current.map((item) =>
          item.id === postId ? { ...item, likes: likesCount } : item,
        ),
      );
      setMyHomeRecords((current) =>
        current.map((item) =>
          item.id === postId ? { ...item, likes: likesCount } : item,
        ),
      );
      setMyRecords((current) =>
        current.map((item) =>
          item.discoverPostId === postId
            ? { ...item, likes: likesCount }
            : item,
        ),
      );
    },
    [],
  );

  const handleToggleLike = useCallback(
    async (postId: string) => {
      if (!currentUserId) {
        Alert.alert("로그인이 필요해요", "좋아요를 누르려면 먼저 로그인해주세요.");
        return;
      }
      if (likeUpdatingIds.includes(postId)) return;

      if (postId.startsWith("mock-")) {
        const nextLiked = !likedPostIds.includes(postId);
        const currentCount =
          bubbles.find((item) => item.id === postId)?.likes ?? 0;
        applyLikeResult(
          postId,
          nextLiked,
          Math.max(0, currentCount + (nextLiked ? 1 : -1)),
        );
        return;
      }

      setLikeUpdatingIds((current) => [...current, postId]);
      try {
        const { data, error } = await supabase.rpc(
          "toggle_discover_post_like",
          { p_post_id: postId },
        );
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        applyLikeResult(
          postId,
          Boolean(row?.liked),
          Number(row?.likes_count ?? 0),
        );
      } catch (error) {
        Alert.alert(
          "좋아요 실패",
          error instanceof Error ? error.message : "좋아요를 저장하지 못했어요.",
        );
      } finally {
        setLikeUpdatingIds((current) => current.filter((id) => id !== postId));
      }
    }, [
      applyLikeResult,
      bubbles,
      currentUserId,
      likedPostIds,
      likeUpdatingIds,
    ],
  );

  const handleTryMission = async (targetBubble?: DiscoverBubble) => {
    const bubble = targetBubble ?? sheetBubble;
    if (!bubble) return;

    if (!bubble.real) {
      shareMissionToHome({
        id: bubble.id,
        title: bubble.mission,
        desc: bubble.note,
        instructions: bubble.note,
        recommendationReason: `${bubble.nick}님이 "${bubble.emotion}"을 느낀 곳이에요`,
        time: "20분",
        dist: "-",
        cost: "-",
        cat: bubble.category,
        requiredItems: [],
        placeLat: bubble.lat,
        placeLng: bubble.lng,
        placeName: bubble.place,
      });
      setSelectedMapBubbleId(null);
      closeSheet();
      router.push("/");
      return;
    }

    setTryingMission(true);
    try {
      const mission = await generateMissionFromPost({
        content: bubble.note,
        emotion: bubble.emotion,
        category: bubble.category,
        placeLat: bubble.lat,
        placeLng: bubble.lng,
        placeName: bubble.place,
      });

      shareMissionToHome({
        id: mission.id,
        title: mission.title,
        desc: mission.short_description,
        instructions: mission.instructions,
        recommendationReason: mission.recommendation_reason ?? "",
        time: mission.estimated_duration_min ? `${mission.estimated_duration_min}분` : "-",
        dist: "-",
        cost: mission.estimated_cost === 0 ? "무료" : `${mission.estimated_cost.toLocaleString()}원`,
        cat: mission.category?.name ?? "기타",
        requiredItems: mission.required_items ?? [],
        placeLat: mission.place_lat ?? bubble.lat,
        placeLng: mission.place_lng ?? bubble.lng,
        placeName: mission.place_name ?? bubble.place,
      });

      setSelectedMapBubbleId(null);
      closeSheet();
      router.push("/");
    } catch (error) {
      Alert.alert(
        "미션 생성 실패",
        "AI 미션 생성 함수가 아직 연결되지 않았을 수 있어요.\n" + (error instanceof Error ? error.message : "")
      );
    } finally {
      setTryingMission(false);
    }
  };

  const handleDeletePost = (targetBubble?: DiscoverBubble) => {
    const bubble = targetBubble ?? sheetBubble;
    if (!bubble?.discoverPostId) return;

    Alert.alert("기록을 삭제할까요?", "삭제하면 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteDiscoverPost(bubble.discoverPostId!);
            setSelectedMapBubbleId(null);
            closeSheet();
            if (currentUserId) {
              await loadMyRecords(currentUserId);
            }
            if (userLocation) {
              const posts = await getNearbyDiscoverPosts(
                userLocation.lat,
                userLocation.lng,
                5,
              );
              setBubbles(
                posts.length > 0 ? await buildBubbleList(posts) : [],
              );
            }
          } catch (error) {
            Alert.alert("삭제 실패", error instanceof Error ? error.message : "");
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
    setSearchQuery("");
    setSearchResults([]);
    Keyboard.dismiss();

    try {
      const posts = await getNearbyDiscoverPosts(lat, lng, SEARCH_RESULT_RADIUS_KM);
      setBubbles(posts.length > 0 ? await buildBubbleList(posts) : []);
    } catch (error) {
      console.log("주변 기록 조회 실패:", error instanceof Error ? error.message : error);
      setBubbles([]);
    }
  };

  const resetRecordForm = () => {
    setRecordTitle("");
    setCategory("");
    setContent("");
    setEmotion("");
    setVisibility("private");
    setPhotos([]);
  };

  const openLocationTypePicker = () => {
    setLocationTypeVisible(true);
  };

  const chooseLocationKind = (kind: RecordLocationKind) => {
    placeSearchSequence.current += 1;
    setLocationKind(kind);
    setLocationTypeVisible(false);
    setPickedLocation(null);
    setSelectedPlace(null);
    setPlaceCandidates([]);
    setPickerPlaceQuery("");
    setPickerPlaceSearchResults([]);
    setPickerPlaceSearching(false);
    setPlacesLoading(false);
    resetRecordForm();

    if (kind === "home") {
      setPlaceName("내 방");
      setVisibility("private");
      setRegisterVisible(true);
      return;
    }

    const center = mapCenterRef.current ?? mapCenter ?? userLocation ?? DEFAULT_CENTER;
    setPickerMode(kind);
    setPickerCenter(center);
    setPlaceName(kind === "map" ? "거리" : "");
    setPickerVisible(true);
  };

  const handleMapTapForPicking = async (lat: number, lng: number) => {
    const coordinate = { lat, lng };
    setPickedLocation(coordinate);

    if (pickerMode === "map") {
      return;
    }

    const sequence = ++placeSearchSequence.current;
    setSelectedPlace(null);
    setPlaceCandidates([]);
    setPlacesLoading(true);

    try {
      const candidates = await searchNearbyKakaoPlaces(coordinate);
      if (sequence !== placeSearchSequence.current) return;
      setPlaceCandidates(candidates);

      if (candidates.length === 0) {
        Alert.alert(
          "주변 장소를 찾지 못했어요",
          "다른 위치를 누르거나 장소가 없는 곳이라면 ‘길 위·야외’를 선택해주세요.",
        );
      }
    } catch (error) {
      if (sequence !== placeSearchSequence.current) return;
      Alert.alert(
        "장소 검색에 실패했어요",
        error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      );
    } finally {
      if (sequence === placeSearchSequence.current) {
        setPlacesLoading(false);
      }
    }
  };

  const selectPlaceCandidate = (place: PlaceCandidate) => {
    const coordinate = {
      lat: place.latitude,
      lng: place.longitude,
    };
    setSelectedPlace(place);
    setPickedLocation(coordinate);
  };

  const selectPickerSearchResult = (place: PlaceCandidate) => {
    selectPlaceCandidate(place);
    setPickerCenter({ lat: place.latitude, lng: place.longitude });
    setPlaceCandidates((current) => [
      place,
      ...current.filter((item) => item.id !== place.id),
    ]);
    setPickerPlaceQuery("");
    setPickerPlaceSearchResults([]);
    Keyboard.dismiss();
  };

  const confirmPickedLocation = () => {
    if (pickerMode === "place" && !selectedPlace) {
      Alert.alert(
        "실제 장소를 선택해주세요",
        "지도에서 위치를 누른 뒤 주변 실제 장소 목록에서 한 곳을 골라주세요.",
      );
      return;
    }

    if (pickerMode === "map" && !pickedLocation) {
      Alert.alert(
        "위치를 선택해주세요",
        "지도에서 기록한 위치를 한 번 눌러주세요.",
      );
      return;
    }

    setLocationKind(pickerMode);
    setPlaceName(
      pickerMode === "place"
        ? selectedPlace?.name ?? "선택한 장소"
        : "거리",
    );
    setPickerVisible(false);
    setRegisterVisible(true);
  };

  const closeRegister = (force = false) => {
    if (saving && !force) return;
    setRegisterVisible(false);
  };

  const addPhotos = (newPhotos: ImagePicker.ImagePickerAsset[]) => {
    setPhotos((prev) => {
      const combined = [...prev];
      for (const p of newPhotos) {
        if (!combined.some((x) => x.uri === p.uri)) combined.push(p);
      }
      if (combined.length > MAX_PHOTOS) {
        Alert.alert("사진 개수 제한", `사진은 최대 ${MAX_PHOTOS}장까지 추가할 수 있어요.`);
      }
      return combined.slice(0, MAX_PHOTOS);
    });
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("카메라 권한이 필요해요", "직접 촬영하려면 카메라 접근을 허용해주세요.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled) addPhotos(result.assets);
  };

  const handlePickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("사진 권한이 필요해요", "갤러리 사진을 추가하려면 사진 접근을 허용해주세요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) addPhotos(result.assets);
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p.uri !== uri));

  const handleSubmit = async () => {
    if (!locationKind) {
      Alert.alert(
        "수행 위치를 선택해주세요",
        "실제 장소, 길 위·야외, 내 방 중 하나를 골라주세요.",
      );
      return;
    }
    if (locationKind === "place" && !selectedPlace) {
      Alert.alert("장소를 선택해주세요", "주변 실제 장소 중 한 곳을 골라주세요.");
      return;
    }
    if (locationKind !== "home" && !pickedLocation) {
      Alert.alert("위치를 선택해주세요", "지도에서 기록한 위치를 선택해주세요.");
      return;
    }
    if (!recordTitle.trim()) {
      Alert.alert("제목을 입력해주세요", "이 기록을 한눈에 알아볼 수 있는 제목을 적어주세요.");
      return;
    }
    if (!category) {
      Alert.alert("카테고리를 선택해주세요", "어떤 종류의 경험인지 골라주세요.");
      return;
    }
    if (!content.trim()) {
      Alert.alert("기록을 작성해주세요", "경험한 내용을 한 문장 이상 남겨주세요.");
      return;
    }
    if (!emotion) {
      Alert.alert("감정을 선택해주세요", "이 경험에서 가장 크게 느낀 감정을 골라주세요.");
      return;
    }

    const effectiveVisibility: RecordVisibility = visibility;
    const discoverStorageVisibility =
      effectiveVisibility === "nickname" ? "anonymous" : "private";
    const effectiveCoordinate =
      locationKind === "home"
        ? { lat: 0, lng: 0 }
        : (pickedLocation as Coordinate);
    const effectivePlaceName =
      locationKind === "place"
        ? selectedPlace?.name ?? placeName
        : locationKind === "map"
          ? "거리"
          : "내 방";

    setSaving(true);
    try {
      await createDiscoverPost({
        placeName: effectivePlaceName,
        lat: effectiveCoordinate.lat,
        lng: effectiveCoordinate.lng,
        category,
        content: content.trim(),
        emotion,
        visibility: discoverStorageVisibility as any,
        photos: photos.map((photo) => ({
          uri: photo.uri,
          mimeType: photo.mimeType,
        })),
      });

      const { error: metadataError } = await supabase.rpc(
        "set_latest_discover_post_metadata_v2",
        {
          p_place_name: effectivePlaceName,
          p_content: content.trim(),
          p_title: recordTitle.trim(),
          p_source_kind: "independent",
          p_source_mission_id: null,
          p_share_mode: effectiveVisibility,
        },
      );
      if (metadataError) {
        throw new Error(`기록 제목 저장 실패: ${metadataError.message}`);
      }

      closeRegister(true);

      if (locationKind === "home") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await Promise.all([
            loadHomeRecords(user.id),
            loadMyRecords(user.id),
          ]);
        }
        setHomeArchiveTab(
          effectiveVisibility === "nickname" ? "shared" : "mine",
        );
        setActiveFilter("방 안 기록");
        Alert.alert(
          "저장 완료",
          effectiveVisibility === "nickname"
            ? `${currentNickname} 닉네임으로 방 안 기록 공간에 공유했어요. 지도에는 표시되지 않아요.`
            : "내 방 기록에 저장했어요. 다른 사람에게는 보이지 않아요.",
        );
      } else {
        if (currentUserId) {
          await loadMyRecords(currentUserId);
        }
        Alert.alert("저장 완료", "기록을 저장했어요.");
        if (userLocation) {
          try {
            const posts = await getNearbyDiscoverPosts(
              userLocation.lat,
              userLocation.lng,
              5,
            );
            setBubbles(
              posts.length > 0 ? await buildBubbleList(posts) : [],
            );
          } catch {}
        }
      }
    } catch (error) {
      Alert.alert(
        "저장 실패",
        "기록을 저장하지 못했어요.\n" +
          (error instanceof Error ? error.message : ""),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHomeRecord = (record: HomeRoomRecord) => {
    if (record.source !== "discover" || !record.isMine) return;

    Alert.alert("내 방 기록을 삭제할까요?", "삭제하면 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDiscoverPost(record.id);
            if (currentUserId) {
              await loadHomeRecords(currentUserId);
            }
          } catch (error) {
            Alert.alert(
              "삭제 실패",
              error instanceof Error ? error.message : "기록을 삭제하지 못했어요.",
            );
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
      mapCenterRef.current = nextCenter;
      setMapCenter(nextCenter);
    }
  };

  const handleFilterPress = (nextFilter: string) => {
    if (nextFilter === activeFilter) {
      if (nextFilter === "방 안 기록") {
        openHomeSheet();
      } else if (nextFilter === "내 기록") {
        openMyRecordsSheet(false);
      }
      return;
    }

    closeSheet();
    setMapRefreshAvailable(false);

    if (activeFilter === "방 안 기록") {
      homeSheetTranslateY.stopAnimation();
      Animated.timing(homeSheetTranslateY, {
        toValue: HOME_SHEET_CLOSE_POSITION,
        duration: 220,
        useNativeDriver: true,
      }).start(() => applyFilter(nextFilter));
      return;
    }

    if (activeFilter === "내 기록") {
      closeMyRecordsSheet(() => applyFilter(nextFilter));
      return;
    }

    applyFilter(nextFilter);
  };


  const handleDiscoverMarkerPress = useCallback(
    (id: string | number) => {
      const bubble = filteredBubbles.find(
        (item) => String(item.id) === String(id),
      );
      if (!bubble) return;

      const nextCenter = { lat: bubble.lat, lng: bubble.lng };
      mapCenterRef.current = nextCenter;
      setMapCenter(nextCenter);
      setSelectedMapBubbleId(String(bubble.id));
      setActiveBubble(null);
      setSheetBubble(null);

      if (activeFilter === "내 기록") {
        const matchingRecord = visibleMyRecords.find((record) => {
          const markerId =
            record.discoverPostId ?? `mission-record-${record.id}`;
          return String(markerId) === String(id);
        });

        if (matchingRecord) {
          setFocusedMyRecordKey(matchingRecord.key);
              myRecordsListRef.current?.scrollTo({ y: 0, animated: true });
        }

        openMyRecordsSheet(false);
      }
    },
    [activeFilter, filteredBubbles, visibleMyRecords],
  );

  const handleDiscoverMarkerClose = useCallback(() => {
    setSelectedMapBubbleId(null);
  }, []);

  const handleDiscoverMarkerAction = useCallback(
    (id: string | number) => {
      const bubble = filteredBubbles.find(
        (item) => String(item.id) === String(id),
      );
      if (bubble) {
        void handleTryMission(bubble);
      }
    },
    [filteredBubbles],
  );

  const handleDiscoverMarkerLike = useCallback(
    (id: string | number) => {
      const bubble = filteredBubbles.find(
        (item) => String(item.id) === String(id),
      );
      if (bubble?.discoverPostId) {
        void handleToggleLike(bubble.discoverPostId);
      }
    },
    [filteredBubbles, handleToggleLike],
  );

  const handleDiscoverMarkerDelete = useCallback(
    (id: string | number) => {
      const bubble = filteredBubbles.find(
        (item) => String(item.id) === String(id),
      );
      if (bubble) {
        handleDeletePost(bubble);
      }
    },
    [filteredBubbles],
  );

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        userLocation={userLocation}
        fitAllMarkers={
          activeFilter === "내 기록" && !selectedMapBubbleId
        }
        selectedMarkerId={selectedMapBubbleId}
        markers={filteredBubbles.map((b) => ({
          id: b.id,
          lat: b.lat,
          lng: b.lng,
          photo: b.photo,
          count: b.multi ? b.count : undefined,
          category: b.category,
          cardVariant: "record" as const,
          title: b.mission,
          description: b.note,
          placeName: b.place,
          recordTime: b.time,
          nickname: b.nick,
          emotion: b.emotion,
          likes: b.likes,
          liked: Boolean(
            b.discoverPostId && likedPostIds.includes(b.discoverPostId),
          ),
          canLike: Boolean(
            b.canLike !== false && b.discoverPostId,
          ),
          canDelete: Boolean(
            b.canDelete !== false &&
              b.discoverPostId &&
              b.user_id === currentUserId,
          ),
          likeDisabled: Boolean(
            b.discoverPostId && likeUpdatingIds.includes(b.discoverPostId),
          ),
          actionLabel: tryingMission ? "미션 만드는 중..." : "나도 해볼래요",
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
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="장소나 지역 검색"
              placeholderTextColor={T2}
              style={styles.searchTextInput}
              returnKeyType="search"
            />
          </View>
          <Pressable style={styles.filterIconBtn}>
            <Text style={{ fontSize: 14 }}>≡</Text>
          </Pressable>
        </View>

        {searchQuery.trim().length > 0 && (
          <View style={styles.searchDropdown}>
            {searching ? (
              <Text style={styles.searchEmptyText}>검색 중...</Text>
            ) : searchResults.length > 0 ? (
              searchResults.map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => handleSelectSearchResult(place)}
                  style={({ pressed }) => [styles.searchResultRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.searchResultThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultPlace}>{place.place_name}</Text>
                    <Text style={styles.searchResultMission} numberOfLines={1}>
                      {place.address_name}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.searchEmptyText}>"{searchQuery}"에 대한 검색 결과가 없어요</Text>
            )}
          </View>
        )}

        {searchQuery.trim().length === 0 && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => handleFilterPress(f)}
                  style={[
                    styles.chip,
                    activeFilter === f && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      activeFilter === f && styles.chipTextActive,
                    ]}
                  >
                    {f === "방 안 기록" ? "🛏️ 방 안 기록" : f}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {mapRefreshAvailable &&
              !isArchiveFilter(activeFilter) &&
              !isPersonalMapFilter(activeFilter) && (
              <View style={styles.mapRefreshButtonRow}>
                <Pressable
                  disabled={mapRecordsLoading}
                  onPress={() => void handleRefreshAtMapCenter()}
                  style={({ pressed }) => [
                    styles.mapRefreshButton,
                    pressed && styles.mapRefreshButtonPressed,
                    mapRecordsLoading && styles.mapRefreshButtonDisabled,
                  ]}
                >
                  {mapRecordsLoading ? (
                    <ActivityIndicator size="small" color={BL} />
                  ) : (
                    <Ionicons name="refresh" size={17} color={BL} />
                  )}
                  <Text style={styles.mapRefreshButtonText}>
                    {mapRecordsLoading
                      ? "이 위치의 기록 불러오는 중..."
                      : "이 위치로 새로고침"}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>

      {activeFilter === "방 안 기록" && (
        <Animated.View
          style={[
            styles.homeArchiveSheet,
            {
              height: HOME_SHEET_HEIGHT,
              transform: [{ translateY: homeSheetTranslateY }],
            },
          ]}
        >
          <View
            style={[styles.homeArchiveDragArea, webDragStyle]}
            {...homePanResponder.panHandlers}
          >
            <View style={styles.handle} />
          </View>
          <View style={styles.homeArchiveContent}>
          <View style={styles.homeArchiveHeader}>
            <View>
              <Text style={styles.homeArchiveCaption}>
                위치를 공개하지 않는 기록 공간
              </Text>
              <Text style={styles.homeArchiveTitle}>방 안 기록</Text>
            </View>
            <View style={styles.homeArchiveCountBadge}>
              <Text style={styles.homeArchiveCountText}>
                {visibleHomeRecords.length}
              </Text>
            </View>
          </View>

          <View style={styles.homeArchiveTabs}>
            <Pressable
              onPress={() => setHomeArchiveTab("shared")}
              style={[
                styles.homeArchiveTab,
                homeArchiveTab === "shared" && styles.homeArchiveTabActive,
              ]}
            >
              <Text
                style={[
                  styles.homeArchiveTabText,
                  homeArchiveTab === "shared" &&
                    styles.homeArchiveTabTextActive,
                ]}
              >
                모두의 기록
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setHomeArchiveTab("mine")}
              style={[
                styles.homeArchiveTab,
                homeArchiveTab === "mine" && styles.homeArchiveTabActive,
              ]}
            >
              <Text
                style={[
                  styles.homeArchiveTabText,
                  homeArchiveTab === "mine" &&
                    styles.homeArchiveTabTextActive,
                ]}
              >
                내 기록
              </Text>
            </Pressable>
          </View>

          <Text style={styles.homeArchiveGuide}>
            {homeArchiveTab === "shared"
              ? "닉네임과 함께 공유된 방 안 기록을 볼 수 있어요."
              : "나만 보기와 내가 닉네임으로 공유한 기록을 모아봐요."}
          </Text>

          {homeRecordsLoading ? (
            <View style={styles.homeArchiveEmpty}>
              <ActivityIndicator color={PINK} />
              <Text style={styles.homeArchiveEmptyText}>
                방 안 기록을 불러오는 중...
              </Text>
            </View>
          ) : visibleHomeRecords.length === 0 ? (
            <View style={styles.homeArchiveEmpty}>
              <Text style={styles.homeArchiveEmptyEmoji}>🛏️</Text>
              <Text style={styles.homeArchiveEmptyTitle}>
                {homeArchiveTab === "shared"
                  ? "아직 공유된 방 안 기록이 없어요"
                  : "아직 내 방 기록이 없어요"}
              </Text>
              <Text style={styles.homeArchiveEmptyText}>
                아래 + 버튼을 눌러 방 안에서의 경험을 남겨보세요.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.homeArchiveScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.homeArchiveList}
            >
              {visibleHomeRecords.map((record) => (
                <View
                  key={`${record.source}-${record.id}`}
                  style={styles.homeRecordCard}
                >
                  <View style={styles.homeRecordHeader}>
                    <View style={styles.homeRecordIcon}>
                      <Text style={styles.homeRecordIconText}>🛏️</Text>
                    </View>
                    <View style={styles.homeRecordHeaderText}>
                      <Text style={styles.homeRecordDate}>
                        {record.createdAt
                          ? new Date(record.createdAt).toLocaleDateString(
                              "ko-KR",
                            )
                          : "날짜 정보 없음"}
                      </Text>
                      <Text style={styles.homeRecordSource}>
                        {record.isMine
                          ? record.source === "mission"
                            ? "내 미션 기록"
                            : record.shareMode === "nickname"
                              ? "내 닉네임 공유"
                              : "내 공개 기록"
                          : record.shareMode === "nickname"
                            ? `${record.nickname}님의 기록`
                            : "익명 기록"}
                      </Text>
                    </View>
                    {record.source === "discover" && record.isMine ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() => handleDeleteHomeRecord(record)}
                        style={({ pressed }) => [
                          styles.homeRecordDelete,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#EF4444"
                        />
                      </Pressable>
                    ) : null}
                  </View>

                  <Text style={styles.homeRecordTitle}>{record.title}</Text>

                  <View style={styles.homeRecordTags}>
                    <View style={styles.homeRecordTag}>
                      <Text style={styles.homeRecordTagText}>
                        {record.category}
                      </Text>
                    </View>
                    {record.emotion ? (
                      <View style={styles.homeRecordEmotionTag}>
                        <Text style={styles.homeRecordEmotionText}>
                          {record.emotion}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.homeRecordContent}>
                    {record.content || "작성한 내용이 없어요."}
                  </Text>

                  {record.source === "discover" &&
                  record.visibility !== "private" ? (
                    <Pressable
                      onPress={() => void handleToggleLike(record.id)}
                      disabled={likeUpdatingIds.includes(record.id)}
                      style={({ pressed }) => [
                        styles.archiveLikeButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name={
                          likedPostIds.includes(record.id)
                            ? "heart"
                            : "heart-outline"
                        }
                        size={17}
                        color={PINK}
                      />
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
        <Animated.View
          style={[
            styles.myRecordsSheet,
            {
              height: MY_SHEET_HEIGHT,
              transform: [{ translateY: mySheetTranslateY }],
            },
          ]}
        >
          <View
            style={[styles.myRecordsSheetDragArea, webDragStyle]}
            {...mySheetPanResponder.panHandlers}
          >
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
                <Text style={styles.myRecordsMapSummaryText}>
                  지도에 표시 가능한 내 기록 {myRecordBubbles.length}개
                </Text>
                {visibleMyRecords.length > myRecordBubbles.length ? (
                  <Text style={styles.myRecordsMapSummaryMuted}>
                    · 위치 없는 기록 {visibleMyRecords.length - myRecordBubbles.length}개
                  </Text>
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
                  transform: [
                    {
                      translateX: myRecordFilterIndicator.interpolate({
                        inputRange: [0, 1, 2],
                        outputRange: [
                          0,
                          MY_RECORD_TAB_INDICATOR_WIDTH,
                          MY_RECORD_TAB_INDICATOR_WIDTH * 2,
                        ],
                      }),
                    },
                  ],
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
                <Pressable
                  key={option.value}
                  onPress={() => changeMyRecordVisibilityFilter(option.value)}
                  style={({ pressed }) => [
                    styles.myRecordsSectionTab,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.myRecordsSectionTabText,
                      selected && styles.myRecordsSectionTabTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.myRecordsSectionCount,
                      selected && styles.myRecordsSectionCountSelected,
                    ]}
                  >
                    {option.count}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Animated.View
            style={[
              styles.myRecordsSectionContent,
              {
                opacity: myRecordContentAnimation,
                transform: [
                  {
                    translateX: myRecordContentAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
          {myRecordsLoading ? (
            <View style={styles.myRecordsEmpty}>
              <ActivityIndicator color={BL} />
              <Text style={styles.myRecordsEmptyText}>내 기록을 불러오는 중...</Text>
            </View>
          ) : visibleMyRecords.length === 0 ? (
            <View style={styles.myRecordsEmpty}>
              <Text style={styles.myRecordsEmptyEmoji}>🗺️</Text>
              <Text style={styles.myRecordsEmptyTitle}>이 분류의 기록이 없어요</Text>
              <Text style={styles.myRecordsEmptyText}>
                아래 + 버튼이나 홈의 미션 기록하기에서 경험을 남겨보세요.
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={myRecordsListRef}
              style={styles.myRecordsListScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.myRecordsList}
            >
              {orderedVisibleMyRecords.map((record) => (
                <View key={record.key} style={styles.myRecordCard}>
                  <View style={styles.myRecordCardHeader}>
                    {record.photo ? (
                      <Image source={{ uri: record.photo }} style={styles.myRecordCardPhoto} />
                    ) : (
                      <View style={styles.myRecordCardIcon}>
                        <Text style={styles.myRecordCardIconText}>
                          {getCategoryEmoji(record.category)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.myRecordCardHeaderText}>
                      <Text style={styles.myRecordCardDate}>
                        {record.createdAt
                          ? new Date(record.createdAt).toLocaleDateString("ko-KR")
                          : "날짜 정보 없음"}
                      </Text>
                      <Text style={styles.myRecordCardVisibility}>
                        {record.visibility === "nickname"
                          ? `${currentNickname} · 닉네임 공유`
                          : "나만 보기"}
                      </Text>
                    </View>
                    {record.placeName !== "내 방" &&
                    record.lat !== null &&
                    record.lng !== null &&
                    Number.isFinite(record.lat) &&
                    Number.isFinite(record.lng) &&
                    !(record.lat === 0 && record.lng === 0) ? (
                      <Pressable
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`${record.title} 위치를 지도에서 보기`}
                        onPress={() => focusMyRecordOnMap(record)}
                        style={({ pressed }) => [
                          styles.myRecordCardOpen,
                          focusedMyRecordKey === record.key &&
                            styles.myRecordCardOpenFocused,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name={
                            focusedMyRecordKey === record.key
                              ? "locate"
                              : "locate-outline"
                          }
                          size={17}
                          color={
                            focusedMyRecordKey === record.key ? WH : BL
                          }
                        />
                      </Pressable>
                    ) : null}
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

                  <Text style={styles.homeRecordContent}>
                    {record.content || "작성한 내용이 없어요."}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
          </Animated.View>
        </Animated.View>
      )}

      {sheetBubble && (
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={[styles.dragArea, webDragStyle]} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            {sheetBubble.photo ? (
              <Image source={{ uri: sheetBubble.photo }} style={styles.sheetPhoto} />
            ) : null}
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{sheetBubble.mission}</Text>
                <Text style={styles.sheetMeta}>
                  {sheetBubble.place} · {sheetBubble.time} · {sheetBubble.nick}
                </Text>
              </View>
              {sheetBubble.canLike !== false && sheetBubble.discoverPostId ? (
                <Pressable
                  onPress={() =>
                    void handleToggleLike(sheetBubble.discoverPostId!)
                  }
                  disabled={likeUpdatingIds.includes(
                    sheetBubble.discoverPostId,
                  )}
                  style={{ alignItems: "center" }}
                >
                  <Text style={{ fontSize: 16 }}>
                    {likedPostIds.includes(sheetBubble.discoverPostId)
                      ? "♥"
                      : "♡"}
                  </Text>
                  <Text style={{ fontSize: 11, color: T2 }}>
                    {sheetBubble.likes}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.emotionTag}>
              <Text style={{ fontSize: 11, color: BL, fontWeight: "700" }}>{sheetBubble.emotion}</Text>
            </View>
            <Text style={styles.note}>{sheetBubble.note}</Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable
                style={[styles.primaryBtn, tryingMission && { opacity: 0.6 }]}
                onPress={() => void handleTryMission()}
                disabled={tryingMission}
              >
                <Text style={{ color: WH, fontSize: 13, fontWeight: "700" }}>
                  {tryingMission ? "미션 만드는 중..." : "나도 해볼래요"}
                </Text>
              </Pressable>
              {sheetBubble.canDelete !== false &&
              sheetBubble.discoverPostId &&
              sheetBubble.user_id === currentUserId ? (
                <Pressable
                  style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                  onPress={() => handleDeletePost()}
                  disabled={deleting}
                >
                  <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "700" }}>
                    {deleting ? "삭제 중..." : "삭제"}
                  </Text>
                </Pressable>
              ) : (
                <Pressable style={styles.secondaryBtn}>
                  <Text style={{ color: T1, fontSize: 13 }}>저장</Text>
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

      <Modal
        visible={locationTypeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationTypeVisible(false)}
      >
        <View style={styles.locationTypeOverlay}>
          <Pressable
            style={styles.locationTypeBackdrop}
            onPress={() => setLocationTypeVisible(false)}
          />
          <View style={styles.locationTypeCard}>
            <Text style={styles.locationTypeCaption}>미션 없이 기록하기</Text>
            <Text style={styles.locationTypeTitle}>어디에서 한 경험인가요?</Text>
            <Text style={styles.locationTypeDescription}>
              위치에 맞는 방식을 선택하면 기록이 알맞은 곳에 정리돼요.
            </Text>

            {([
              { value: "place" as const, emoji: "📍", title: "실제 장소", desc: "지도에서 위치를 누르고 주변 장소를 선택해요" },
              { value: "map" as const, emoji: "🌿", title: "길 위·야외", desc: "지도에서 경험한 위치를 직접 표시해요" },
              { value: "home" as const, emoji: "🛏️", title: "내 방", desc: "지도에는 표시하지 않고 내 방 기록함에 모아요" },
            ]).map((option) => (
              <Pressable
                key={option.value}
                onPress={() => chooseLocationKind(option.value)}
                style={({ pressed }) => [
                  styles.locationTypeOption,
                  pressed && styles.pressed,
                ]}
              >
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

      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={{ flex: 1 }}>
          <RecordLocationPickerMap
            center={pickerCenter}
            pickedLocation={pickedLocation}
            guideText={
              pickerMode === "place"
                ? "지도를 눌러 주변 실제 장소를 찾아보세요"
                : "지도를 눌러 길 위·야외 위치를 표시하세요"
            }
            onSelect={(coordinate) =>
              void handleMapTapForPicking(coordinate.lat, coordinate.lng)
            }
          />

          <View style={styles.pickerTopBar}>
            {pickerMode === "place" ? (
              <>
                <View style={styles.pickerSearchBox}>
                  <Ionicons name="search" size={18} color={T2} />
                  <TextInput
                    value={pickerPlaceQuery}
                    onChangeText={setPickerPlaceQuery}
                    placeholder="기록할 실제 장소 검색"
                    placeholderTextColor={T2}
                    returnKeyType="search"
                    style={styles.pickerSearchInput}
                  />
                  {pickerPlaceSearching ? (
                    <ActivityIndicator size="small" color={BL} />
                  ) : pickerPlaceQuery ? (
                    <Pressable onPress={() => setPickerPlaceQuery("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={T2} />
                    </Pressable>
                  ) : null}
                </View>

                {pickerPlaceQuery.trim().length > 0 ? (
                  <View style={styles.pickerSearchDropdown}>
                    {pickerPlaceSearching ? (
                      <Text style={styles.pickerSearchEmpty}>검색 중...</Text>
                    ) : pickerPlaceSearchResults.length > 0 ? (
                      pickerPlaceSearchResults.map((place) => (
                        <Pressable
                          key={`picker-search-${place.id}`}
                          onPress={() => selectPickerSearchResult(place)}
                          style={({ pressed }) => [
                            styles.pickerSearchResult,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.pickerSearchResultIcon}>
                            <Ionicons name="location" size={16} color={BL} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={styles.pickerSearchResultName}>
                              {place.name}
                            </Text>
                            <Text numberOfLines={1} style={styles.pickerSearchResultAddress}>
                              {place.address || place.categoryDetail || "장소"}
                            </Text>
                          </View>
                          <Text style={styles.pickerSearchResultDistance}>
                            {formatDistance(place.distanceM)}
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.pickerSearchEmpty}>검색 결과가 없어요</Text>
                    )}
                  </View>
                ) : null}
              </>
            ) : null}

            <Text style={styles.pickerGuide}>
              {pickerMode === "place"
                ? "장소를 검색하거나 지도에서 경험한 위치를 눌러주세요."
                : "지도에서 경험한 위치를 눌러주세요."}
            </Text>
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
                  <ScrollView
                    style={styles.placeCandidateScroll}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    <Text style={styles.placeCandidateSectionTitle}>주변 실제 장소</Text>
                    {placeCandidates.map((place) => {
                      const selected = selectedPlace?.id === place.id;
                      return (
                        <Pressable
                          key={place.id}
                          onPress={() => selectPlaceCandidate(place)}
                          style={[
                            styles.placeCandidateButton,
                            selected && styles.placeCandidateButtonSelected,
                          ]}
                        >
                          <View
                            style={[
                              styles.placeCandidateRadio,
                              selected && styles.placeCandidateRadioSelected,
                            ]}
                          >
                            {selected ? <View style={styles.placeCandidateRadioDot} /> : null}
                          </View>
                          <View style={styles.placeCandidateText}>
                            <View style={styles.placeCandidateNameRow}>
                              <Text numberOfLines={1} style={styles.placeCandidateName}>
                                {place.name}
                              </Text>
                              <Text style={styles.placeCandidateDistance}>
                                {formatDistance(place.distanceM)}
                              </Text>
                            </View>
                            <Text numberOfLines={1} style={styles.placeCandidateCategory}>
                              {place.categoryDetail ?? "장소"}
                            </Text>
                            <Text numberOfLines={2} style={styles.placeCandidateAddress}>
                              {place.address ?? "주소 정보 없음"}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : pickedLocation ? (
                  <Text style={styles.placeEmptyText}>
                    주변 장소를 찾지 못했어요. 다른 위치를 누르거나 길 위·야외를 선택해주세요.
                  </Text>
                ) : (
                  <Text style={styles.placeEmptyText}>지도에서 위치를 먼저 눌러주세요.</Text>
                )}
              </>
            ) : pickedLocation ? (
              <Text style={styles.pickerDistanceText}>
                선택한 위치가 ‘거리’로 기록돼요.
              </Text>
            ) : (
              <Text style={styles.pickerDistanceText}>지도에서 위치를 한 번 눌러주세요.</Text>
            )}

            <View style={styles.pickerActionRow}>
              <Pressable
                style={styles.pickerCancelBtn}
                onPress={() => setPickerVisible(false)}
              >
                <Text style={{ color: T1, fontSize: 14, fontWeight: "700" }}>취소</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.pickerConfirmBtn,
                  ((pickerMode === "place" && !selectedPlace) ||
                    (pickerMode === "map" && !pickedLocation)) &&
                    styles.buttonDisabled,
                ]}
                onPress={confirmPickedLocation}
                disabled={
                  (pickerMode === "place" && !selectedPlace) ||
                  (pickerMode === "map" && !pickedLocation)
                }
              >
                <Text style={{ color: WH, fontSize: 14, fontWeight: "700" }}>
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
                  <Text style={styles.shareModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.selectedLocationBox}>
                <Text style={styles.selectedLocationCaption}>
                  {locationKind === "place"
                    ? "실제 장소"
                    : locationKind === "map"
                      ? "길 위·야외"
                      : "내 방"}
                </Text>
                <Text style={styles.selectedLocationName}>
                  {locationKind === "home" ? "🛏️ 내 방" : `📍 ${placeName}`}
                </Text>
                {locationKind === "place" && selectedPlace?.address ? (
                  <Text style={styles.selectedLocationAddress}>
                    {selectedPlace.address}
                  </Text>
                ) : locationKind === "home" ? (
                  <Text style={styles.selectedLocationAddress}>
                    지도에 표시되지 않고 내 방 기록함에 저장돼요.
                  </Text>
                ) : null}
              </View>

              <Text style={styles.fieldLabel}>기록 제목</Text>
              <TextInput
                value={recordTitle}
                onChangeText={setRecordTitle}
                maxLength={60}
                placeholder="예: 비 오는 날 발견한 조용한 카페"
                placeholderTextColor={T2}
                style={styles.recordTitleInput}
              />
              <Text style={styles.recordTitleCount}>{recordTitle.length}/60</Text>

              <Text style={styles.fieldLabel}>카테고리</Text>
              <View style={styles.emotionWrap}>
                {CATEGORIES.map((c) => {
                  const isSelected = category === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      style={[styles.emotionChip, isSelected && styles.emotionChipSelected]}
                    >
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
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={1200}
                textAlignVertical="top"
                placeholder="무엇을 보고, 듣고, 느꼈는지 자유롭게 적어보세요."
                placeholderTextColor={T2}
                style={styles.contentInput}
              />
              <Text style={styles.characterCount}>{content.length}/1200</Text>

              <View style={styles.photoSectionHeader}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>사진 추가</Text>
                <Text style={styles.photoCountText}>{photos.length}/{MAX_PHOTOS}</Text>
              </View>
              <Text style={styles.photoOptionalHint}>사진을 안 올리면 지도에는 카테고리 아이콘으로 표시돼요.</Text>

              <View style={styles.photoActionRow}>
                <Pressable
                  onPress={() => void handleTakePhoto()}
                  disabled={saving || photos.length >= MAX_PHOTOS}
                  style={({ pressed }) => [styles.photoActionButton, pressed && styles.pressed, (saving || photos.length >= MAX_PHOTOS) && styles.buttonDisabled]}
                >
                  <Text style={styles.photoActionIcon}>📷</Text>
                  <Text style={styles.photoActionText}>직접 찍기</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handlePickPhotos()}
                  disabled={saving || photos.length >= MAX_PHOTOS}
                  style={({ pressed }) => [styles.photoActionButton, { marginRight: 0 }, pressed && styles.pressed, (saving || photos.length >= MAX_PHOTOS) && styles.buttonDisabled]}
                >
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
                  <Ionicons name="shield-checkmark-outline" size={18} color={PINK} />
                  <View style={styles.homePrivacyText}>
                    <Text style={styles.homePrivacyTitle}>
                      내 방의 실제 위치는 저장하지 않아요
                    </Text>
                    <Text style={styles.homePrivacyDesc}>
                      닉네임 공유를 선택하면 지도 대신 ‘방 안 기록’ 공간에서
                      다른 사람에게 보여요.
                    </Text>
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
                    {locationKind === "home"
                      ? "내 닉네임과 함께 방 안 기록 공간에 공유해요"
                      : "내 닉네임과 함께 발견 탭에 공유해요"}
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
  container: { flex: 1, position: "relative", backgroundColor: "#DFE8F0" },
  topBar: { position: "absolute", top: 66, left: 16, right: 16, zIndex: 10, elevation: 10 },
  searchRow: { flexDirection: "row", gap: 9, marginBottom: 10 },
  searchInput: { minHeight: 48, flex: 1, backgroundColor: WH, borderRadius: 14, paddingHorizontal: 16, justifyContent: "center" },
  searchTextInput: { fontSize: 14, color: T0, paddingVertical: 12 },
  filterIconBtn: { width: 48, minHeight: 48, backgroundColor: WH, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  filterScrollContent: { gap: 7, paddingRight: 6 },
  chip: { minHeight: 34, justifyContent: "center", backgroundColor: WH, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 14 },
  chipActive: { backgroundColor: BL },
  chipText: { fontSize: 12, color: T1, fontWeight: "500" },
  chipTextActive: { color: WH, fontWeight: "700" },
  mapRefreshButtonRow: { alignItems: "center", marginTop: 11 },
  mapRefreshButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 17, paddingVertical: 9, backgroundColor: "rgba(255,255,255,0.97)", borderWidth: 1, borderColor: "rgba(61,90,254,0.18)", borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 8 },
  mapRefreshButtonPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  mapRefreshButtonDisabled: { opacity: 0.75 },
  mapRefreshButtonText: { marginLeft: 7, fontSize: 12, fontWeight: "800", color: BL },
  searchDropdown: { backgroundColor: WH, borderRadius: 12, paddingVertical: 4, maxHeight: 260, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 6 },
  searchResultRow: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  searchResultThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: T3 },
  searchResultPlace: { fontSize: 13, fontWeight: "600", color: T0 },
  searchResultMission: { fontSize: 11, color: T1, marginTop: 2 },
  searchEmptyText: { padding: 14, fontSize: 12, color: T2, textAlign: "center" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: WH, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 100, zIndex: 30, elevation: 30 },
  dragArea: { height: 40, alignItems: "center", justifyContent: "center" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T3 },
  sheetPhoto: { width: "100%", height: 176, borderRadius: 14, backgroundColor: T3, marginBottom: 14 },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: T0, marginBottom: 3 },
  sheetMeta: { fontSize: 11, color: T2 },
  emotionTag: { alignSelf: "flex-start", backgroundColor: BLL, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 9, marginBottom: 10 },
  note: { fontSize: 13, color: T1, lineHeight: 20, marginBottom: 16 },
  primaryBtn: { flex: 1, backgroundColor: BL, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  secondaryBtn: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  deleteBtn: { backgroundColor: "#FEF2F2", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },

  fabWrap: { position: "absolute", right: 26, bottom: 110, width: 60, height: 60, alignItems: "center", justifyContent: "center", zIndex: 10 },
  fabGlow: { position: "absolute", width: 60, height: 60, borderRadius: 30, backgroundColor: PINK },
  fabBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: PINK, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: WH, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 6 },

  recordLocationPickerMap: { flex: 1, backgroundColor: BG },
  pickerTopBar: { position: "absolute", top: 60, left: 20, right: 20 },
  pickerGuide: { marginTop: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(255,255,255,0.82)", borderRadius: 12, fontSize: 11, lineHeight: 16, color: T2, textAlign: "center", fontWeight: "500" },
  pickerBottomBar: { position: "absolute", bottom: 24, left: 16, right: 16, maxHeight: "58%", backgroundColor: WH, borderRadius: 18, padding: 16 },
  pickerDistanceText: { fontSize: 13, fontWeight: "700", color: T1, textAlign: "center", marginBottom: 10 },
  pickerCancelBtn: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  pickerConfirmBtn: { flex: 1, backgroundColor: PINK, borderRadius: 12, paddingVertical: 13, alignItems: "center" },

  locationTypeOverlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  locationTypeBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  locationTypeCard: { width: "100%", maxWidth: 430, padding: 20, backgroundColor: WH, borderRadius: 22 },
  locationTypeCaption: { marginBottom: 4, fontSize: 12, fontWeight: "700", color: PINK },
  locationTypeTitle: { marginBottom: 6, fontSize: 20, fontWeight: "800", color: T0 },
  locationTypeDescription: { marginBottom: 16, fontSize: 12, lineHeight: 18, color: T1 },
  locationTypeOption: { minHeight: 72, marginBottom: 9, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", backgroundColor: BG, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  locationTypeEmoji: { marginRight: 12, fontSize: 25 },
  locationTypeOptionText: { flex: 1 },
  locationTypeOptionTitle: { marginBottom: 3, fontSize: 14, fontWeight: "800", color: T0 },
  locationTypeOptionDesc: { fontSize: 11, lineHeight: 16, color: T1 },

  homeArchiveSheet: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 8,
    elevation: 8,
    overflow: "hidden",
    paddingBottom: 88,
    backgroundColor: "rgba(247,248,250,0.99)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  homeArchiveDragArea: {
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  homeArchiveContent: { flex: 1 },
  homeArchiveScroll: { flex: 1 },
  homeArchiveHeader: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  homeArchiveTabs: { marginHorizontal: 14, padding: 4, flexDirection: "row", backgroundColor: "#ECEEF2", borderRadius: 12 },
  homeArchiveTab: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  homeArchiveTabActive: { backgroundColor: WH },
  homeArchiveTabText: { fontSize: 11, fontWeight: "700", color: T2 },
  homeArchiveTabTextActive: { color: PINK },
  homeArchiveGuide: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, fontSize: 10, lineHeight: 15, color: T2 },
  homeArchiveCaption: { marginBottom: 3, fontSize: 10, color: T2 },
  homeArchiveTitle: { fontSize: 20, fontWeight: "800", color: T0 },
  homeArchiveCountBadge: { minWidth: 32, height: 32, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: PINK_LIGHT, borderRadius: 16 },
  homeArchiveCountText: { fontSize: 13, fontWeight: "800", color: PINK },
  homeArchiveList: { paddingHorizontal: 14, paddingBottom: 110 },
  homeArchiveEmpty: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  homeArchiveEmptyEmoji: { marginBottom: 10, fontSize: 42 },
  homeArchiveEmptyTitle: { marginBottom: 5, fontSize: 15, fontWeight: "800", color: T0 },
  homeArchiveEmptyText: { marginTop: 8, textAlign: "center", fontSize: 12, lineHeight: 18, color: T2 },
  homeRecordCard: { marginBottom: 11, padding: 15, backgroundColor: WH, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 16 },
  homeRecordHeader: { marginBottom: 11, flexDirection: "row", alignItems: "center" },
  homeRecordIcon: { width: 38, height: 38, marginRight: 10, alignItems: "center", justifyContent: "center", backgroundColor: PINK_LIGHT, borderRadius: 12 },
  homeRecordIconText: { fontSize: 20 },
  homeRecordHeaderText: { flex: 1 },
  homeRecordDate: { marginBottom: 2, fontSize: 10, color: T2 },
  homeRecordSource: { fontSize: 12, fontWeight: "700", color: T0 },
  homeRecordDelete: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#FEF2F2", borderRadius: 17 },
  homeRecordTags: { marginBottom: 9, flexDirection: "row", flexWrap: "wrap" },
  homeRecordTag: { marginRight: 6, marginBottom: 4, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: BLL, borderRadius: 8 },
  homeRecordTagText: { fontSize: 10, fontWeight: "700", color: BL },
  homeRecordEmotionTag: { marginBottom: 4, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: PINK_LIGHT, borderRadius: 8 },
  homeRecordEmotionText: { fontSize: 10, fontWeight: "700", color: PINK },
  homeRecordContent: { fontSize: 13, lineHeight: 20, color: T1 },

  placeLoadingRow: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  placeLoadingText: { marginLeft: 8, fontSize: 12, color: T1 },
  placeCandidateScroll: { maxHeight: 270, marginBottom: 10 },
  placeCandidateSectionTitle: { marginBottom: 8, fontSize: 13, fontWeight: "800", color: T0 },
  placeCandidateButton: { marginBottom: 7, padding: 11, flexDirection: "row", backgroundColor: BG, borderWidth: 1, borderColor: T3, borderRadius: 12 },
  placeCandidateButtonSelected: { backgroundColor: BLL, borderColor: BL },
  placeCandidateRadio: { width: 18, height: 18, marginTop: 2, marginRight: 9, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: T2, borderRadius: 9 },
  placeCandidateRadioSelected: { borderColor: BL },
  placeCandidateRadioDot: { width: 9, height: 9, backgroundColor: BL, borderRadius: 5 },
  placeCandidateText: { flex: 1 },
  placeCandidateNameRow: { flexDirection: "row", alignItems: "center" },
  placeCandidateName: { flex: 1, marginRight: 8, fontSize: 12, fontWeight: "800", color: T0 },
  placeCandidateDistance: { fontSize: 10, fontWeight: "700", color: BL },
  placeCandidateCategory: { marginTop: 3, fontSize: 10, color: T1 },
  placeCandidateAddress: { marginTop: 2, fontSize: 10, lineHeight: 15, color: T2 },
  placeEmptyText: { marginBottom: 10, textAlign: "center", fontSize: 11, lineHeight: 17, color: T2 },
  pickerActionRow: { flexDirection: "row", gap: 10 },

  selectedLocationBox: { marginBottom: 18, padding: 14, backgroundColor: BLL, borderWidth: 1, borderColor: "#DCE3FF", borderRadius: 13 },
  selectedLocationCaption: { marginBottom: 4, fontSize: 10, fontWeight: "700", color: BL },
  selectedLocationName: { fontSize: 14, fontWeight: "800", color: T0 },
  selectedLocationAddress: { marginTop: 4, fontSize: 10, lineHeight: 15, color: T1 },
  homePrivacyBox: { marginBottom: 20, padding: 13, flexDirection: "row", alignItems: "center", backgroundColor: PINK_LIGHT, borderRadius: 12 },
  homePrivacyText: { flex: 1, marginLeft: 10 },
  homePrivacyTitle: { marginBottom: 3, fontSize: 12, fontWeight: "800", color: PINK },
  homePrivacyDesc: { fontSize: 10, lineHeight: 15, color: T1 },

  shareModalOverlay: { flex: 1, justifyContent: "flex-end" },
  shareModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.44)" },
  shareModalCard: { maxHeight: "88%", backgroundColor: WH, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  shareModalHandle: { alignSelf: "center", width: 42, height: 5, marginTop: 10, backgroundColor: "#D7D9DE", borderRadius: 3 },
  shareModalContent: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 34 },
  shareModalHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  shareModalCaption: { marginBottom: 5, fontSize: 12, fontWeight: "700", color: PINK },
  shareModalTitle: { paddingRight: 10, fontSize: 18, lineHeight: 25, fontWeight: "800", color: T0 },
  shareModalClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: BG, borderRadius: 18 },
  shareModalCloseText: { fontSize: 14, color: T1 },

  fieldLabel: { marginBottom: 9, fontSize: 13, fontWeight: "700", color: T0 },
  placeInput: { height: 48, paddingHorizontal: 14, fontSize: 14, color: T0, backgroundColor: BG, borderWidth: 1, borderColor: T3, borderRadius: 12, marginBottom: 18 },
  emotionWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  emotionChip: { marginRight: 8, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: BG, borderWidth: 1, borderColor: T3, borderRadius: 18 },
  emotionChipSelected: { backgroundColor: PINK_LIGHT, borderColor: PINK },
  emotionChipText: { fontSize: 12, color: T1 },
  emotionChipTextSelected: { fontWeight: "700", color: PINK },
  contentInput: { minHeight: 130, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 13, fontSize: 14, lineHeight: 22, color: T0, backgroundColor: BG, borderWidth: 1, borderColor: T3, borderRadius: 14 },
  characterCount: { marginTop: 6, marginBottom: 18, textAlign: "right", fontSize: 10, color: T2 },
  photoSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoCountText: { fontSize: 11, color: T2 },
  photoOptionalHint: { fontSize: 10, color: T2, marginTop: 4, marginBottom: 6 },
  photoActionRow: { flexDirection: "row", marginTop: 9, marginBottom: 10 },
  photoActionButton: { flex: 1, minHeight: 48, marginRight: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: BG, borderWidth: 1, borderColor: T3, borderRadius: 12 },
  photoActionIcon: { marginRight: 6, fontSize: 16 },
  photoActionText: { fontSize: 12, fontWeight: "700", color: T1 },
  photoPreviewWrapper: { position: "relative", width: 92, height: 92, marginRight: 9 },
  photoPreview: { width: "100%", height: "100%", backgroundColor: T3, borderRadius: 12 },
  photoRemoveButton: { position: "absolute", top: 5, right: 5, width: 24, height: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,15,15,0.70)", borderRadius: 12 },
  photoRemoveButtonText: { fontSize: 11, fontWeight: "800", color: WH },
  coverPhotoBadge: { position: "absolute", right: 5, bottom: 5, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: PINK, borderRadius: 7 },
  coverPhotoBadgeText: { fontSize: 9, fontWeight: "800", color: WH },
  photoHelperText: { marginBottom: 18, fontSize: 10, color: T2 },
  visibilityRow: { flexDirection: "row", marginBottom: 20 },
  visibilityOption: { flex: 1, minHeight: 76, marginRight: 8, padding: 12, backgroundColor: WH, borderWidth: 1, borderColor: T3, borderRadius: 12 },
  visibilityOptionSelected: { backgroundColor: PINK_LIGHT, borderColor: PINK },
  visibilityOptionTitle: { marginBottom: 4, fontSize: 12, fontWeight: "700", color: T1 },
  visibilityOptionTitleSelected: { color: PINK },
  visibilityOptionDesc: { fontSize: 10, lineHeight: 15, color: T2 },
  submitButton: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: PINK, borderRadius: 14 },
  submitButtonText: { fontSize: 15, fontWeight: "800", color: WH },
  buttonDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  recordTitleInput: { height: 48, paddingHorizontal: 14, fontSize: 14, color: T0, backgroundColor: BG, borderWidth: 1, borderColor: T3, borderRadius: 12 },
  recordTitleCount: { marginTop: 6, marginBottom: 18, textAlign: "right", fontSize: 10, color: T2 },
  pickerSearchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, backgroundColor: WH, borderRadius: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 8 },
  pickerSearchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: T0 },
  pickerSearchDropdown: { marginTop: 7, overflow: "hidden", backgroundColor: WH, borderRadius: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.13, shadowRadius: 10, elevation: 9 },
  pickerSearchResult: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F0F1F4" },
  pickerSearchResultIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 10 },
  pickerSearchResultName: { fontSize: 13, fontWeight: "800", color: T0 },
  pickerSearchResultAddress: { marginTop: 3, fontSize: 10, color: T2 },
  pickerSearchResultDistance: { fontSize: 10, fontWeight: "700", color: BL },
  pickerSearchEmpty: { padding: 14, textAlign: "center", fontSize: 12, color: T2 },
  homeRecordTitle: { marginTop: 2, marginBottom: 8, fontSize: 16, lineHeight: 22, fontWeight: "800", color: T0 },
  archiveLikeButton: { alignSelf: "flex-end", minWidth: 52, minHeight: 34, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 11, backgroundColor: PINK_LIGHT, borderRadius: 17 },
  archiveLikeText: { fontSize: 11, fontWeight: "800", color: PINK },
  myRecordsSheet: {
    position: "absolute",
    top: MY_SHEET_TOP,
    right: 0,
    left: 0,
    zIndex: 9,
    overflow: "hidden",
    backgroundColor: "rgba(247,248,250,0.99)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 18,
  },
  myRecordsSheetDragArea: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  myRecordsSheetHeader: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  myRecordsSheetCaption: { marginBottom: 2, fontSize: 10, color: T2 },
  myRecordsSheetTitle: { fontSize: 20, fontWeight: "800", color: T0 },
  myRecordsCountBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLL,
    borderRadius: 16,
  },
  myRecordsCountText: { fontSize: 13, fontWeight: "800", color: BL },
  myRecordsMapSummary: {
    minHeight: 32,
    marginHorizontal: 18,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 16,
  },
  myRecordsMapSummaryText: {
    marginLeft: 5,
    fontSize: 11,
    fontWeight: "700",
    color: BL,
  },
  myRecordsMapSummaryMuted: { fontSize: 10, color: T2 },
  myRecordsSectionTabs: {
    position: "relative",
    height: 58,
    marginTop: 8,
    marginHorizontal: MY_RECORD_TAB_HORIZONTAL_MARGIN,
    marginBottom: 8,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEEF2",
  },
  myRecordsSectionIndicator: {
    position: "absolute",
    left: 0,
    bottom: -1,
    height: 3,
    backgroundColor: BL,
    borderRadius: 2,
  },
  myRecordsSectionTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  myRecordsSectionTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: T2,
  },
  myRecordsSectionTabTextSelected: { color: BL },
  myRecordsSectionCount: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "700",
    color: T2,
  },
  myRecordsSectionCountSelected: { color: BL },
  myRecordsSectionContent: { flex: 1 },
  myRecordsListScroll: { flex: 1 },
  myRecordsList: { paddingHorizontal: 14, paddingBottom: 120 },
  myRecordsEmpty: {
    flex: 1,
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  myRecordsEmptyEmoji: { marginBottom: 10, fontSize: 40 },
  myRecordsEmptyTitle: { marginBottom: 5, fontSize: 15, fontWeight: "800", color: T0 },
  myRecordsEmptyText: { marginTop: 8, textAlign: "center", fontSize: 12, lineHeight: 18, color: T2 },
  myRecordCard: {
    marginBottom: 11,
    padding: 15,
    backgroundColor: WH,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
  },
  myRecordCardHeader: { marginBottom: 11, flexDirection: "row", alignItems: "center" },
  myRecordCardPhoto: { width: 42, height: 42, marginRight: 10, borderRadius: 12, backgroundColor: T3 },
  myRecordCardIcon: { width: 42, height: 42, marginRight: 10, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 12 },
  myRecordCardIconText: { fontSize: 21 },
  myRecordCardHeaderText: { flex: 1 },
  myRecordCardDate: { marginBottom: 2, fontSize: 10, color: T2 },
  myRecordCardVisibility: { fontSize: 12, fontWeight: "700", color: T0 },
  myRecordCardOpen: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 17 },
  myRecordCardOpenFocused: { backgroundColor: BL },
  myRecordCardTitle: { marginBottom: 5, fontSize: 16, lineHeight: 22, fontWeight: "800", color: T0 },
  myRecordCardPlace: { marginBottom: 9, fontSize: 11, color: T1 },
  myRecordIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: BLL, borderRadius: 12 },
  myRecordPlace: { marginBottom: 10, fontSize: 11, color: T1 },

});