import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
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

const KAKAO_REST_API_KEY = "c10a1b62f7bbf1d90e0ff60bb94bdadd";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_CLOSE_POSITION = SCREEN_HEIGHT * 0.6;
const MAX_PHOTOS = 5;
const PICK_RADIUS_M = 100;
const SEARCH_RESULT_RADIUS_KM = 0.5;

const DEFAULT_CENTER = { lat: 35.1795543, lng: 129.0756416 };

const FILTERS = ["가까운 기록", "최근 기록", "내 취향", "새로운 분야", "산책"];

const CATEGORIES = ["음식", "카페 및 디저트", "산책", "배움", "감상", "활동", "휴식", "기타"];

type EmotionValue = "comfortable" | "joyful" | "new" | "uncomfortable" | "unsure";
type RecordVisibility = "private" | "anonymous";

type KakaoPlace = {
  id: string;
  place_name: string;
  address_name: string;
  x: string; // lng
  y: string; // lat
};

const EMOTIONS: Array<{ label: string; value: EmotionValue; emoji: string }> = [
  { label: "편안해요", value: "comfortable", emoji: "😌" },
  { label: "즐거워요", value: "joyful", emoji: "😊" },
  { label: "새로워요", value: "new", emoji: "✨" },
  { label: "불편해요", value: "uncomfortable", emoji: "😣" },
  { label: "잘 모르겠어요", value: "unsure", emoji: "🤔" },
];

// 백엔드 연결 실패 시 대체용 (기존 목업)
const MOCK_BUBBLES = [
  { id: "mock-1", user_id: null, place: "연남동 카페 봄날", lat: 35.1795543, lng: 129.0806416, mission: "조용한 카페에서 30분 독서", time: "2일 전", nick: "소리의 탐험가", emotion: "차분함", note: "창가 자리에서 책 읽으니 딴 세상 같았어요.", likes: 12, category: "휴식", photo: "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=200&h=200&fit=crop" },
  { id: "mock-2", user_id: null, place: "경의선 숲길", lat: 35.1825543, lng: 129.0756416, mission: "공원 산책하며 계절 사진 찍기", time: "1일 전", nick: "산책러", emotion: "상쾌함", note: "노을 질 때가 진짜 예뻐요.", likes: 8, category: "산책", photo: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&h=200&fit=crop" },
];

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function buildBubbleList(posts: any[]) {
  return Promise.all(
    posts.map(async (p) => {
      const cover = p.photos.find((ph) => ph.is_cover) ?? p.photos[0];
      let photoUrl: string | undefined;
      try {
        photoUrl = cover ? await getDiscoverPhotoUrl(cover.storage_path) : undefined;
      } catch (photoUrlError) {
        console.log("사진 URL 가져오기 실패:", photoUrlError instanceof Error ? photoUrlError.message : photoUrlError);
        photoUrl = undefined;
      }
      return {
        id: p.id,
        user_id: p.user_id,
        place: p.place_name,
        lat: p.lat,
        lng: p.lng,
        mission: p.content.slice(0, 20),
        time: new Date(p.created_at).toLocaleDateString("ko-KR"),
        nick: p.visibility === "anonymous" ? "익명" : "작성자",
        emotion: p.emotion,
        note: p.content,
        likes: p.likes_count,
        category: p.category ?? "기타",
        photo: photoUrl,
        real: true,
      };
    })
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { shareMissionToHome } = useMission();

  const [activeFilter, setActiveFilter] = useState("가까운 기록");
  const [bubbles, setBubbles] = useState<any[]>(MOCK_BUBBLES);
  const [activeBubble, setActiveBubble] = useState(null);
  const [sheetBubble, setSheetBubble] = useState(null);
  const [liked, setLiked] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [tryingMission, setTryingMission] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);

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

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

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
    init();
  }, []);

  // 검색어 입력 → 카카오 장소 검색 (디바운스)
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

  const webDragStyle = Platform.OS === "web" ? { touchAction: "none", cursor: "grab" } : undefined;

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
        photoUrl: sheetBubble.photo,
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

  // 검색 결과 선택 → 지도 이동 + 그 주변 기록 다시 불러오기
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

  const openPicker = () => {
    if (!userLocation) {
      Alert.alert("위치 확인 중이에요", "잠시 후 다시 시도해주세요.");
      return;
    }
    setPickedLocation(null);
    setPickerVisible(true);
  };

  const handleMapTapForPicking = (lat: number, lng: number) => {
    setPickedLocation({ lat, lng });
  };

  const pickedDistance =
    pickedLocation && userLocation ? haversineM(userLocation.lat, userLocation.lng, pickedLocation.lat, pickedLocation.lng) : null;

  const confirmPickedLocation = () => {
    if (pickedDistance === null || pickedDistance > PICK_RADIUS_M) {
      Alert.alert("위치를 다시 선택해주세요", `내 위치 반경 ${PICK_RADIUS_M}m 이내에서만 등록할 수 있어요.`);
      return;
    }
    setPickerVisible(false);
    setPlaceName("");
    setCategory("");
    setContent("");
    setEmotion("");
    setVisibility("private");
    setPhotos([]);
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
    if (!placeName.trim()) {
      Alert.alert("장소를 입력해주세요", "어디에서의 경험인지 알려주세요.");
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
    if (!pickedLocation) return;

    setSaving(true);
    try {
      await createDiscoverPost({
        placeName: placeName.trim(),
        lat: pickedLocation.lat,
        lng: pickedLocation.lng,
        category,
        content: content.trim(),
        emotion,
        visibility,
        photos: photos.map((p) => ({ uri: p.uri, mimeType: p.mimeType })),
      });

      Alert.alert("공유 완료", "발견 탭에 등록됐어요.");
      closeRegister(true);

      if (userLocation) {
        try {
          const posts = await getNearbyDiscoverPosts(userLocation.lat, userLocation.lng, 5);
          if (posts.length > 0) {
            setBubbles(await buildBubbleList(posts));
          }
        } catch {}
      }
    } catch (error) {
      Alert.alert(
        "저장 실패",
        "백엔드 함수(discover_posts 테이블 등)가 아직 준비되지 않았을 수 있어요.\n" + (error instanceof Error ? error.message : "")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        userLocation={userLocation}
        markers={bubbles.map((b) => ({
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
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {sheetBubble && (
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={[styles.dragArea, webDragStyle]} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            {sheetBubble.photo ? (
              <Image source={{ uri: sheetBubble.photo }} style={styles.sheetPhoto} />
            ) : (
              <View style={styles.sheetPhoto} />
            )}
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
          <Pressable style={styles.fabBtn} onPress={openPicker}>
            <Ionicons name="create-outline" size={26} color={WH} />
          </Pressable>
        </Animated.View>
      </View>

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={{ flex: 1 }}>
          <KakaoMapView
            latitude={userLocation?.lat ?? DEFAULT_CENTER.lat}
            longitude={userLocation?.lng ?? DEFAULT_CENTER.lng}
            userLocation={userLocation}
            pickedLocation={pickedLocation}
            onMapPress={handleMapTapForPicking}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.pickerTopBar}>
            <Text style={styles.pickerGuide}>내 위치 반경 {PICK_RADIUS_M}m 이내를 탭해서 장소를 선택하세요</Text>
          </View>

          <View style={styles.pickerBottomBar}>
            {pickedLocation && (
              <Text
                style={[styles.pickerDistanceText, pickedDistance !== null && pickedDistance > PICK_RADIUS_M && { color: "#EF4444" }]}
              >
                선택한 위치까지 약 {pickedDistance !== null ? Math.round(pickedDistance) : "-"}m
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={styles.pickerCancelBtn} onPress={() => setPickerVisible(false)}>
                <Text style={{ color: T1, fontSize: 14, fontWeight: "700" }}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.pickerConfirmBtn, !pickedLocation && { opacity: 0.4 }]}
                onPress={confirmPickedLocation}
                disabled={!pickedLocation}
              >
                <Text style={{ color: WH, fontSize: 14, fontWeight: "700" }}>이 위치로 등록</Text>
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

              <Text style={styles.fieldLabel}>장소 이름</Text>
              <TextInput
                value={placeName}
                onChangeText={setPlaceName}
                placeholder="예: 연남동 카페 봄날"
                placeholderTextColor={T2}
                style={styles.placeInput}
              />

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
              <View style={styles.visibilityRow}>
                <Pressable onPress={() => setVisibility("private")} style={[styles.visibilityOption, visibility === "private" && styles.visibilityOptionSelected]}>
                  <Text style={[styles.visibilityOptionTitle, visibility === "private" && styles.visibilityOptionTitleSelected]}>나만 보기</Text>
                  <Text style={styles.visibilityOptionDesc}>내 기록에서만 확인해요</Text>
                </Pressable>
                <Pressable onPress={() => setVisibility("anonymous")} style={[styles.visibilityOption, visibility === "anonymous" && styles.visibilityOptionSelected]}>
                  <Text style={[styles.visibilityOptionTitle, visibility === "anonymous" && styles.visibilityOptionTitleSelected]}>익명 공유</Text>
                  <Text style={styles.visibilityOptionDesc}>이름 없이 발견 탭에 공유해요</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => void handleSubmit()} disabled={saving} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, saving && styles.buttonDisabled]}>
                <Text style={styles.submitButtonText}>{saving ? "저장 중..." : "공유하기"}</Text>
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

  pickerTopBar: { position: "absolute", top: 60, left: 20, right: 20 },
  pickerGuide: { backgroundColor: WH, borderRadius: 12, padding: 12, fontSize: 12, color: T0, textAlign: "center", fontWeight: "600" },
  pickerBottomBar: { position: "absolute", bottom: 40, left: 20, right: 20, backgroundColor: WH, borderRadius: 16, padding: 16 },
  pickerDistanceText: { fontSize: 13, fontWeight: "700", color: T1, textAlign: "center", marginBottom: 10 },
  pickerCancelBtn: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  pickerConfirmBtn: { flex: 1, backgroundColor: PINK, borderRadius: 12, paddingVertical: 13, alignItems: "center" },

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