import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_CLOSE_POSITION = SCREEN_HEIGHT * 0.6;
const MAX_SHARE_PHOTOS = 5;

const DEFAULT_CENTER = { lat: 35.1795543, lng: 129.0756416 };

const FILTERS = ["가까운 기록", "최근 기록", "내 취향", "새로운 분야", "산책"];

type EmotionValue = "comfortable" | "joyful" | "new" | "uncomfortable" | "unsure";
type RecordVisibility = "private" | "anonymous";

const EMOTIONS: Array<{ label: string; value: EmotionValue; emoji: string }> = [
  { label: "편안해요", value: "comfortable", emoji: "😌" },
  { label: "즐거워요", value: "joyful", emoji: "😊" },
  { label: "새로워요", value: "new", emoji: "✨" },
  { label: "불편해요", value: "uncomfortable", emoji: "😣" },
  { label: "잘 모르겠어요", value: "unsure", emoji: "🤔" },
];

// TODO: place.service.ts 완성되면 이 하드코딩 데이터를 실제 기록 조회로 교체
const BUBBLES = [
  {
    id: "bubble-1",
    place: "연남동 카페 봄날",
    lat: 35.1795543,
    lng: 129.0806416,
    mission: "조용한 카페에서 30분 독서",
    time: "2일 전",
    nick: "소리의 탐험가",
    emotion: "차분함",
    note: "창가 자리에서 책 읽으니 딴 세상 같았어요.",
    likes: 12,
    category: "휴식",
    photo: "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=200&h=200&fit=crop",
  },
  {
    id: "bubble-2",
    place: "경의선 숲길",
    lat: 35.1825543,
    lng: 129.0756416,
    mission: "공원 산책하며 계절 사진 찍기",
    time: "1일 전",
    nick: "산책러",
    emotion: "상쾌함",
    note: "노을 질 때가 진짜 예뻐요.",
    likes: 8,
    category: "산책",
    photo: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=200&h=200&fit=crop",
  },
  {
    id: "bubble-3",
    place: "망원동 책방",
    lat: 35.1765543,
    lng: 129.0716416,
    mission: "동네 책방에서 한 페이지 읽기",
    time: "3시간 전",
    nick: "책방순례자",
    emotion: "설렘",
    note: "사장님이 추천해주신 책이 취향저격.",
    likes: 21,
    multi: true,
    count: 3,
    category: "배움",
    photo: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=200&h=200&fit=crop",
  },
  {
    id: "bubble-4",
    place: "홍대 거리",
    lat: 35.1815543,
    lng: 129.0806416,
    mission: "버스킹 공연 5분 이상 감상하기",
    time: "5시간 전",
    nick: "귀호강",
    emotion: "즐거움",
    note: "우연히 들은 버스킹인데 목소리가 좋았어요.",
    likes: 15,
    category: "감상",
    photo: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop",
  },
];

function getPhotoExtension(photo: ImagePicker.ImagePickerAsset) {
  const fileNameExtension = photo.fileName?.split(".").pop()?.toLowerCase();
  if (fileNameExtension) return fileNameExtension === "jpeg" ? "jpg" : fileNameExtension;

  const mimeExtension = photo.mimeType?.split("/")[1]?.split("+")[0]?.toLowerCase();
  if (mimeExtension) return mimeExtension === "jpeg" ? "jpg" : mimeExtension;

  return "jpg";
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { shareMissionToHome } = useMission();

  const [activeFilter, setActiveFilter] = useState("가까운 기록");
  const [activeBubble, setActiveBubble] = useState(null);
  const [sheetBubble, setSheetBubble] = useState(null);
  const [liked, setLiked] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

  // 장소 공유 모달 상태 (홈 탭 기록 모달과 동일한 구성)
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharePlaceName, setSharePlaceName] = useState("");
  const [shareContent, setShareContent] = useState("");
  const [shareEmotion, setShareEmotion] = useState<EmotionValue | "">("");
  const [shareVisibility, setShareVisibility] = useState<RecordVisibility>("private");
  const [sharePhotos, setSharePhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [shareSaving, setShareSaving] = useState(false);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_CLOSE_POSITION)).current;
  const dragStart = useRef(0);

  // 핑크 버튼 반짝임 애니메이션
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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return BUBBLES.filter((b) => b.place.includes(searchQuery.trim()));
  }, [searchQuery]);

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
  }, [activeBubble]);

  const closeSheet = () => {
    Animated.timing(sheetTranslateY, {
      toValue: SHEET_CLOSE_POSITION,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setActiveBubble(null);
      setSheetBubble(null);
    });
  };

  const openSheet = () => {
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((v) => {
          dragStart.current = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        const next = Math.max(0, dragStart.current + g.dy);
        sheetTranslateY.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const current = Math.max(0, dragStart.current + g.dy);
        if (current > 120 || g.vy > 0.6) {
          closeSheet();
        } else {
          openSheet();
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const webDragStyle = Platform.OS === "web" ? { touchAction: "none", cursor: "grab" } : undefined;

  const handleTryMission = () => {
    if (!sheetBubble) return;

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
  };

  const handleSelectSearchResult = (bubble) => {
    setMapCenter({ lat: bubble.lat, lng: bubble.lng });
    setActiveBubble(bubble);
    setSearchQuery("");
    Keyboard.dismiss();
  };

  // ── 장소 공유 모달 ──

  const openShareModal = () => {
    setSharePlaceName("");
    setShareContent("");
    setShareEmotion("");
    setShareVisibility("private");
    setSharePhotos([]);
    setShareModalVisible(true);
  };

  const closeShareModal = (force = false) => {
    if (shareSaving && !force) return;
    setShareModalVisible(false);
  };

  const addSharePhotos = (photos: ImagePicker.ImagePickerAsset[]) => {
    setSharePhotos((prev) => {
      const combined = [...prev];
      for (const photo of photos) {
        if (!combined.some((p) => p.uri === photo.uri)) combined.push(photo);
      }
      if (combined.length > MAX_SHARE_PHOTOS) {
        Alert.alert("사진 개수 제한", `사진은 최대 ${MAX_SHARE_PHOTOS}장까지 추가할 수 있어요.`);
      }
      return combined.slice(0, MAX_SHARE_PHOTOS);
    });
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("카메라 권한이 필요해요", "직접 촬영하려면 카메라 접근을 허용해주세요.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled) addSharePhotos(result.assets);
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
    if (!result.canceled) addSharePhotos(result.assets);
  };

  const removeSharePhoto = (uri: string) => {
    setSharePhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  const handleShareSubmit = async () => {
    if (!sharePlaceName.trim()) {
      Alert.alert("장소를 입력해주세요", "어디에서의 경험인지 알려주세요.");
      return;
    }
    if (!shareContent.trim()) {
      Alert.alert("기록을 작성해주세요", "경험한 내용을 한 문장 이상 남겨주세요.");
      return;
    }
    if (!shareEmotion) {
      Alert.alert("감정을 선택해주세요", "이 경험에서 가장 크게 느낀 감정을 골라주세요.");
      return;
    }

    setShareSaving(true);
    try {
      // TODO: place.service.ts / records.service.ts에
      // "미션 없이 자유 기록 생성" 함수가 추가되면 여기서 실제 저장 로직 연결
      // (place: sharePlaceName, content: shareContent, emotion: shareEmotion,
      //  visibility: shareVisibility, photos: sharePhotos)
      await new Promise((resolve) => setTimeout(resolve, 400));
      Alert.alert("준비 중이에요", "장소 공유 저장 기능은 백엔드 연동 후 활성화돼요.");
      closeShareModal(true);
    } finally {
      setShareSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <KakaoMapView
        latitude={mapCenter.lat}
        longitude={mapCenter.lng}
        markers={BUBBLES.map((b) => ({
          id: b.id,
          lat: b.lat,
          lng: b.lng,
          photo: b.photo,
          count: b.multi ? b.count : undefined,
        }))}
        onMarkerPress={(id) => {
          const bubble = BUBBLES.find((b) => b.id === id);
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
            {searchResults.length > 0 ? (
              searchResults.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => handleSelectSearchResult(b)}
                  style={({ pressed }) => [styles.searchResultRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.searchResultThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultPlace}>{b.place}</Text>
                    <Text style={styles.searchResultMission}>{b.mission}</Text>
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
              <Pressable
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[styles.chip, activeFilter === f && styles.chipActive]}
              >
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
            <View style={styles.sheetPhoto} />
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
                <Text style={{ fontSize: 11, color: T2 }}>
                  {sheetBubble.likes + (liked.includes(sheetBubble.id) ? 1 : 0)}
                </Text>
              </Pressable>
            </View>
            <View style={styles.emotionTag}>
              <Text style={{ fontSize: 11, color: BL, fontWeight: "700" }}>{sheetBubble.emotion}</Text>
            </View>
            <Text style={styles.note}>"{sheetBubble.note}"</Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable style={styles.primaryBtn} onPress={handleTryMission}>
                <Text style={{ color: WH, fontSize: 13, fontWeight: "700" }}>나도 해볼래요</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn}>
                <Text style={{ color: T1, fontSize: 13 }}>저장</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Animated.View style={[styles.fabGlow, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable style={styles.fabBtn} onPress={openShareModal}>
            <Ionicons name="search" size={26} color={WH} />
          </Pressable>
        </Animated.View>
      </View>

      {/* 장소 공유 모달 — 홈 탭 기록 모달과 동일한 구성 */}
      <Modal visible={shareModalVisible} transparent animationType="slide" onRequestClose={() => closeShareModal()}>
        <KeyboardAvoidingView
          style={styles.shareModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.shareModalBackdrop} onPress={() => closeShareModal()} />

          <View style={styles.shareModalCard}>
            <View style={styles.shareModalHandle} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.shareModalContent}
            >
              <View style={styles.shareModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareModalCaption}>장소 공유하기</Text>
                  <Text style={styles.shareModalTitle}>이곳에서의 경험을 남겨보세요</Text>
                </View>
                <Pressable
                  onPress={() => closeShareModal()}
                  hitSlop={10}
                  style={({ pressed }) => [styles.shareModalClose, pressed && styles.pressed]}
                >
                  <Text style={styles.shareModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>장소 이름</Text>
              <TextInput
                value={sharePlaceName}
                onChangeText={setSharePlaceName}
                placeholder="예: 연남동 카페 봄날"
                placeholderTextColor={T2}
                style={styles.placeInput}
              />

              <Text style={styles.fieldLabel}>어떤 감정이 가장 컸나요?</Text>
              <View style={styles.emotionWrap}>
                {EMOTIONS.map((emotion) => {
                  const isSelected = shareEmotion === emotion.value;
                  return (
                    <Pressable
                      key={emotion.value}
                      onPress={() => setShareEmotion(emotion.value)}
                      style={[styles.emotionChip, isSelected && styles.emotionChipSelected]}
                    >
                      <Text style={[styles.emotionChipText, isSelected && styles.emotionChipTextSelected]}>
                        {emotion.emoji} {emotion.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>이곳에서의 경험을 남겨주세요</Text>
              <TextInput
                value={shareContent}
                onChangeText={setShareContent}
                multiline
                maxLength={1200}
                textAlignVertical="top"
                placeholder="무엇을 보고, 듣고, 느꼈는지 자유롭게 적어보세요."
                placeholderTextColor={T2}
                style={styles.contentInput}
              />
              <Text style={styles.characterCount}>{shareContent.length}/1200</Text>

              <View style={styles.photoSectionHeader}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>사진 추가</Text>
                <Text style={styles.photoCountText}>{sharePhotos.length}/{MAX_SHARE_PHOTOS}</Text>
              </View>

              <View style={styles.photoActionRow}>
                <Pressable
                  onPress={() => void handleTakePhoto()}
                  disabled={shareSaving || sharePhotos.length >= MAX_SHARE_PHOTOS}
                  style={({ pressed }) => [
                    styles.photoActionButton,
                    pressed && styles.pressed,
                    (shareSaving || sharePhotos.length >= MAX_SHARE_PHOTOS) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.photoActionIcon}>📷</Text>
                  <Text style={styles.photoActionText}>직접 찍기</Text>
                </Pressable>

                <Pressable
                  onPress={() => void handlePickPhotos()}
                  disabled={shareSaving || sharePhotos.length >= MAX_SHARE_PHOTOS}
                  style={({ pressed }) => [
                    styles.photoActionButton,
                    { marginRight: 0 },
                    pressed && styles.pressed,
                    (shareSaving || sharePhotos.length >= MAX_SHARE_PHOTOS) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.photoActionIcon}>🖼️</Text>
                  <Text style={styles.photoActionText}>갤러리에서 선택</Text>
                </Pressable>
              </View>

              {sharePhotos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 17 }}
                  contentContainerStyle={{ paddingRight: 8 }}
                >
                  {sharePhotos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`} style={styles.photoPreviewWrapper}>
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                      <Pressable
                        onPress={() => removeSharePhoto(photo.uri)}
                        disabled={shareSaving}
                        hitSlop={8}
                        style={({ pressed }) => [styles.photoRemoveButton, pressed && styles.pressed]}
                      >
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
                <Pressable
                  onPress={() => setShareVisibility("private")}
                  style={[styles.visibilityOption, shareVisibility === "private" && styles.visibilityOptionSelected]}
                >
                  <Text style={[styles.visibilityOptionTitle, shareVisibility === "private" && styles.visibilityOptionTitleSelected]}>
                    나만 보기
                  </Text>
                  <Text style={styles.visibilityOptionDesc}>내 기록에서만 확인해요</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShareVisibility("anonymous")}
                  style={[styles.visibilityOption, shareVisibility === "anonymous" && styles.visibilityOptionSelected]}
                >
                  <Text style={[styles.visibilityOptionTitle, shareVisibility === "anonymous" && styles.visibilityOptionTitleSelected]}>
                    익명 공유
                  </Text>
                  <Text style={styles.visibilityOptionDesc}>이름 없이 발견 탭에 공유해요</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => void handleShareSubmit()}
                disabled={shareSaving}
                style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, shareSaving && styles.buttonDisabled]}
              >
                <Text style={styles.submitButtonText}>{shareSaving ? "저장 중..." : "공유하기"}</Text>
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
  searchDropdown: {
    backgroundColor: WH,
    borderRadius: 12,
    paddingVertical: 4,
    maxHeight: 260,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  searchResultRow: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  searchResultThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: T3 },
  searchResultPlace: { fontSize: 13, fontWeight: "600", color: T0 },
  searchResultMission: { fontSize: 11, color: T1, marginTop: 2 },
  searchEmptyText: { padding: 14, fontSize: 12, color: T2, textAlign: "center" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WH,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 100,
  },
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

  fabWrap: {
    position: "absolute",
    right: 26,
    bottom: 110,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  fabGlow: { position: "absolute", width: 60, height: 60, borderRadius: 30, backgroundColor: PINK },
  fabBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: WH,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },

  // 공유 모달 (홈 탭 기록 모달과 동일한 톤)
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
  placeInput: {
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    color: T0,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: T3,
    borderRadius: 12,
    marginBottom: 18,
  },
  emotionWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
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
  emotionChipSelected: { backgroundColor: PINK_LIGHT, borderColor: PINK },
  emotionChipText: { fontSize: 12, color: T1 },
  emotionChipTextSelected: { fontWeight: "700", color: PINK },
  contentInput: {
    minHeight: 130,
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
  characterCount: { marginTop: 6, marginBottom: 18, textAlign: "right", fontSize: 10, color: T2 },
  photoSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoCountText: { fontSize: 11, color: T2 },
  photoActionRow: { flexDirection: "row", marginTop: 9, marginBottom: 10 },
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
  photoActionIcon: { marginRight: 6, fontSize: 16 },
  photoActionText: { fontSize: 12, fontWeight: "700", color: T1 },
  photoPreviewWrapper: { position: "relative", width: 92, height: 92, marginRight: 9 },
  photoPreview: { width: "100%", height: "100%", backgroundColor: T3, borderRadius: 12 },
  photoRemoveButton: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,15,15,0.70)",
    borderRadius: 12,
  },
  photoRemoveButtonText: { fontSize: 11, fontWeight: "800", color: WH },
  coverPhotoBadge: { position: "absolute", right: 5, bottom: 5, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: PINK, borderRadius: 7 },
  coverPhotoBadgeText: { fontSize: 9, fontWeight: "800", color: WH },
  photoHelperText: { marginBottom: 18, fontSize: 10, color: T2 },
  visibilityRow: { flexDirection: "row", marginBottom: 20 },
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
  visibilityOptionSelected: { backgroundColor: PINK_LIGHT, borderColor: PINK },
  visibilityOptionTitle: { marginBottom: 4, fontSize: 12, fontWeight: "700", color: T1 },
  visibilityOptionTitleSelected: { color: PINK },
  visibilityOptionDesc: { fontSize: 10, lineHeight: 15, color: T2 },
  submitButton: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: PINK, borderRadius: 14 },
  submitButtonText: { fontSize: 15, fontWeight: "800", color: WH },
  buttonDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});