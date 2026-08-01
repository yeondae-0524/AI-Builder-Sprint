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
const SHEET_CLOSE_POSITION = SCREEN_HEIGHT * 0.6;
const MAX_PHOTOS = 5;
const SEARCH_RESULT_RADIUS_KM = 0.5;
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

const FILTERS = ["방 안 기록", "가까운 기록", "최근 기록", "내 취향", "새로운 분야", "산책"];

const CATEGORIES = ["음식", "카페 및 디저트", "산책", "배움", "감상", "활동", "휴식", "기타"];

type EmotionValue = "comfortable" | "joyful" | "new" | "uncomfortable" | "unsure";
type RecordVisibility = "private" | "anonymous";
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

type HomeRoomRecord = {
  id: string;
  source: "discover" | "mission";
  userId: string | null;
  isMine: boolean;
  content: string;
  emotion: string;
  category: string;
  visibility: string;
  createdAt: string;
};

type DiscoverPostPhoto = {
  is_cover?: boolean | null;
  storage_path?: string | null;
};

type DiscoverBubble = {
  id: string;
  user_id: string | null;
  place: string;
  lat: number;
  lng: number;
  mission: string;
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
  { id: "mock-1", user_id: null, place: "연남동 카페 봄날", lat: 35.1795543, lng: 129.0806416, mission: "조용한 카페에서 30분 독서", time: "2일 전", nick: "소리의 탐험가", emotion: "차분함", note: "창가 자리에서 책 읽으니 딴 세상 같았어요.", likes: 12, category: "휴식", photo: "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=200&h=200&fit=crop" },
  { id: "mock-2", user_id: null, place: "경의선 숲길", lat: 35.1825543, lng: 129.0756416, mission: "공원 산책하며 계절 사진 찍기", time: "1일 전", nick: "산책러", emotion: "상쾌함", note: "노을 질 때가 진짜 예뻐요.", likes: 8, category: "산책", photo: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&h=200&fit=crop" },
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

      return {
        id: String(p.id),
        user_id: p.user_id ? String(p.user_id) : null,
        place: String(p.place_name ?? "장소"),
        lat: Number(p.lat),
        lng: Number(p.lng),
        mission: String(p.content ?? "").slice(0, 20),
        time: new Date(p.created_at).toLocaleDateString("ko-KR"),
        nick: p.visibility === "anonymous" ? "익명" : "작성자",
        emotion: EMOTION_LABEL[p.emotion] ?? String(p.emotion ?? ""),
        note: String(p.content ?? ""),
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

function normalizeInterests(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { shareMissionToHome } = useMission();

  const [activeFilter, setActiveFilter] = useState("가까운 기록");
  const [bubbles, setBubbles] = useState<DiscoverBubble[]>(MOCK_BUBBLES);
  const [activeBubble, setActiveBubble] = useState<DiscoverBubble | null>(null);
  const [sheetBubble, setSheetBubble] = useState<DiscoverBubble | null>(null);
  const [liked, setLiked] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [tryingMission, setTryingMission] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  const [sharedHomeRecords, setSharedHomeRecords] = useState<HomeRoomRecord[]>([]);
  const [myHomeRecords, setMyHomeRecords] = useState<HomeRoomRecord[]>([]);
  const [homeArchiveTab, setHomeArchiveTab] = useState<HomeArchiveTab>("shared");
  const [homeRecordsLoading, setHomeRecordsLoading] = useState(false);

  const [registerVisible, setRegisterVisible] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [emotion, setEmotion] = useState<EmotionValue | "">("");
  const [visibility, setVisibility] = useState<RecordVisibility>("private");
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_CLOSE_POSITION)).current;
  const dragStart = useRef(0);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeSearchSequence = useRef(0);

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

  const loadHomeRecords = useCallback(async (userId: string) => {
    setHomeRecordsLoading(true);

    try {
      const [homeDiscoverRpcResult, missionResult] = await Promise.all([
        supabase.rpc("get_home_room_discover_posts"),
        supabase
          .from("records")
          .select(
            "id, content, emotion, visibility, recorded_at, created_at, location_type, location_name",
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
            "id, user_id, content, emotion, category, visibility, created_at, place_name",
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

      const discoverRecords: HomeRoomRecord[] = discoverRows.map((row) => {
        const ownerId = row.user_id ? String(row.user_id) : null;

        return {
          id: String(row.id),
          source: "discover",
          userId: ownerId,
          isMine: ownerId === userId,
          content: String(row.content ?? ""),
          emotion:
            EMOTION_LABEL[String(row.emotion ?? "")] ??
            String(row.emotion ?? ""),
          category: String(row.category ?? "기타"),
          visibility: String(row.visibility ?? "private"),
          createdAt: String(row.created_at ?? ""),
        };
      });

      const missionRecords: HomeRoomRecord[] = (missionResult.data ?? []).map(
        (row) => ({
          id: String(row.id),
          source: "mission",
          userId,
          isMine: true,
          content: String(row.content ?? ""),
          emotion:
            EMOTION_LABEL[String(row.emotion ?? "")] ??
            String(row.emotion ?? ""),
          category: "미션 기록",
          visibility: String(row.visibility ?? "private"),
          createdAt: String(row.recorded_at ?? row.created_at ?? ""),
        }),
      );

      const byNewest = (a: HomeRoomRecord, b: HomeRoomRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

      setSharedHomeRecords(
        discoverRecords
          .filter((record) => record.visibility === "anonymous")
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

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("interests")
          .eq("id", user.id)
          .maybeSingle();
        setMyInterests(normalizeInterests(profileData?.interests));
        await loadHomeRecords(user.id);
      }

      let lat = DEFAULT_CENTER.lat;
      let lng = DEFAULT_CENTER.lng;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setUserLocation({ lat, lng });
        setMapCenter({ lat, lng });
      }

      try {
        const posts = await getNearbyDiscoverPosts(lat, lng, 5);
        if (posts.length > 0) {
          setBubbles(await buildBubbleList(posts));
        }
      } catch (error) {
        console.log("발견 기록 조회 실패, 목업 사용:", error instanceof Error ? error.message : error);
      }
    };
    void init();
  }, [loadHomeRecords]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const refreshDiscoverPosts = async () => {
        const lat = userLocation?.lat ?? DEFAULT_CENTER.lat;
        const lng = userLocation?.lng ?? DEFAULT_CENTER.lng;

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && isActive) {
          setCurrentUserId(user.id);
          await loadHomeRecords(user.id);
        }

        try {
          const posts = await getNearbyDiscoverPosts(lat, lng, 5);
          const nextBubbles = posts.length > 0 ? await buildBubbleList(posts) : [];

          if (isActive) {
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
    }, [loadHomeRecords, userLocation?.lat, userLocation?.lng])
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

  const filteredBubbles = useMemo(() => {
    if (activeFilter === "방 안 기록") return [];
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
  }, [activeFilter, bubbles, myInterests]);

  const visibleHomeRecords =
    homeArchiveTab === "shared" ? sharedHomeRecords : myHomeRecords;

  const handleTryMission = async () => {
    if (!sheetBubble) return;

    if (!sheetBubble.real) {
      shareMissionToHome({
        id: sheetBubble.id,
        title: sheetBubble.mission,
        desc: sheetBubble.note,
        instructions: sheetBubble.note,
        recommendationReason: `${sheetBubble.nick}님이 "${sheetBubble.emotion}"을 느낀 곳이에요`,
        time: "20분",
        dist: "-",
        cost: "-",
        cat: sheetBubble.category,
        requiredItems: [],
        placeLat: sheetBubble.lat,
        placeLng: sheetBubble.lng,
        placeName: sheetBubble.place,
      });
      closeSheet();
      router.push("/");
      return;
    }

    setTryingMission(true);
    try {
      const mission = await generateMissionFromPost({
        content: sheetBubble.note,
        emotion: sheetBubble.emotion,
        category: sheetBubble.category,
        placeLat: sheetBubble.lat,
        placeLng: sheetBubble.lng,
        placeName: sheetBubble.place,
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
        placeLat: mission.place_lat ?? sheetBubble.lat,
        placeLng: mission.place_lng ?? sheetBubble.lng,
        placeName: mission.place_name ?? sheetBubble.place,
      });

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

  const handleDeletePost = () => {
    if (!sheetBubble) return;
    Alert.alert("기록을 삭제할까요?", "삭제하면 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteDiscoverPost(sheetBubble.id);
            closeSheet();
            if (userLocation) {
              const posts = await getNearbyDiscoverPosts(userLocation.lat, userLocation.lng, 5);
              setBubbles(posts.length > 0 ? await buildBubbleList(posts) : MOCK_BUBBLES);
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

    setMapCenter({ lat, lng });
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
    setPlacesLoading(false);
    resetRecordForm();

    if (kind === "home") {
      setPlaceName("내 방");
      setVisibility("private");
      setRegisterVisible(true);
      return;
    }

    const center = userLocation ?? mapCenter ?? DEFAULT_CENTER;
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
        visibility: effectiveVisibility,
        photos: photos.map((photo) => ({
          uri: photo.uri,
          mimeType: photo.mimeType,
        })),
      });

      closeRegister(true);

      if (locationKind === "home") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await loadHomeRecords(user.id);
        }
        setHomeArchiveTab(
          effectiveVisibility === "anonymous" ? "shared" : "mine",
        );
        setActiveFilter("방 안 기록");
        Alert.alert(
          "저장 완료",
          effectiveVisibility === "anonymous"
            ? "방 안 기록 공간에 익명으로 공유했어요. 지도에는 표시되지 않아요."
            : "내 방 기록에 저장했어요. 다른 사람에게는 보이지 않아요.",
        );
      } else {
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


  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        userLocation={userLocation}
        markers={filteredBubbles.map((b) => ({
          id: b.id,
          lat: b.lat,
          lng: b.lng,
          photo: b.photo,
          count: b.multi ? b.count : undefined,
          category: b.category,
        }))}
        onMarkerPress={(id) => {
          const bubble = bubbles.find((b) => b.id === id);
          if (bubble) setActiveBubble(bubble);
        }}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {FILTERS.map((f) => (
              <Pressable key={f} onPress={() => setActiveFilter(f)} style={[styles.chip, activeFilter === f && styles.chipActive]}>
                <Text style={{ fontSize: 11, color: activeFilter === f ? WH : T1, fontWeight: activeFilter === f ? "700" : "400" }}>
                  {f === "방 안 기록" ? "🛏️ 방 안 기록" : f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {activeFilter === "방 안 기록" && (
        <View style={styles.homeArchive}>
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
                모두의 익명 기록
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
              ? "익명 공유를 선택한 방 안 기록을 함께 볼 수 있어요."
              : "나만 보기와 내가 익명으로 공유한 기록을 모아봐요."}
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
                            : record.visibility === "anonymous"
                              ? "내 익명 공유"
                              : "나만 보기"
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
                </View>
              ))}
            </ScrollView>
          )}
        </View>
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
              <Pressable
                onPress={() =>
                  setLiked((l) => (l.includes(sheetBubble.id) ? l.filter((x) => x !== sheetBubble.id) : [...l, sheetBubble.id]))
                }
                style={{ alignItems: "center" }}
              >
                <Text style={{ fontSize: 16 }}>{liked.includes(sheetBubble.id) ? "♥" : "♡"}</Text>
                <Text style={{ fontSize: 11, color: T2 }}>{sheetBubble.likes + (liked.includes(sheetBubble.id) ? 1 : 0)}</Text>
              </Pressable>
            </View>
            <View style={styles.emotionTag}>
              <Text style={{ fontSize: 11, color: BL, fontWeight: "700" }}>{sheetBubble.emotion}</Text>
            </View>
            <Text style={styles.note}>"{sheetBubble.note}"</Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable
                style={[styles.primaryBtn, tryingMission && { opacity: 0.6 }]}
                onPress={handleTryMission}
                disabled={tryingMission}
              >
                <Text style={{ color: WH, fontSize: 13, fontWeight: "700" }}>
                  {tryingMission ? "미션 만드는 중..." : "나도 해볼래요"}
                </Text>
              </Pressable>
              {sheetBubble.real && sheetBubble.user_id === currentUserId ? (
                <Pressable
                  style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                  onPress={handleDeletePost}
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
            <Text style={styles.pickerGuide}>
              {pickerMode === "place"
                ? "지도에서 경험한 위치를 눌러주세요. 주변 실제 장소를 거리순으로 보여드려요."
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
                      익명 공유를 선택하면 지도 대신 ‘방 안 기록’ 공간에서
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
                <Pressable onPress={() => setVisibility("anonymous")} style={[styles.visibilityOption, visibility === "anonymous" && styles.visibilityOptionSelected]}>
                  <Text style={[styles.visibilityOptionTitle, visibility === "anonymous" && styles.visibilityOptionTitleSelected]}>익명 공유</Text>
                  <Text style={styles.visibilityOptionDesc}>
                    {locationKind === "home"
                      ? "방 안 기록 공간에 익명으로 공유해요"
                      : "이름 없이 발견 탭에 공유해요"}
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
  topBar: { position: "absolute", top: 52, left: 16, right: 16, zIndex: 10, elevation: 10 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, backgroundColor: WH, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" },
  searchTextInput: { fontSize: 13, color: T0, paddingVertical: 10 },
  filterIconBtn: { width: 44, backgroundColor: WH, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chip: { backgroundColor: WH, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  chipActive: { backgroundColor: BL },
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
  pickerGuide: { backgroundColor: WH, borderRadius: 12, padding: 12, fontSize: 12, color: T0, textAlign: "center", fontWeight: "600" },
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

  homeArchive: { position: "absolute", top: 132, right: 12, bottom: 88, left: 12, zIndex: 8, overflow: "hidden", backgroundColor: "rgba(247,248,250,0.98)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" },
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
});