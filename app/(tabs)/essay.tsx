import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

// 🌿 파스텔 & 우드 감성 컬러 팔레트
const COLORS = {
  primary: "#315C4A",
  primaryLight: "#E5EEE8",
  accent: "#F2C96D",
  pink: "#E07A5F",
  pinkLight: "#F4EAE1",
  textMain: "#26372E",
  textSub: "#65766D",
  textMuted: "#9AA49F",
  border: "#E2E3DC",
  white: "#FFFFFF",
  background: "#F5F2E9",

  woodDark: "#5C3A21",
  woodMain: "#825432",
  woodLight: "#A06C42",
  woodBorder: "#422815",

  bookThemes: [
    { bg: "#315C4A", text: "#F2C96D", line: "#234739" },
    { bg: "#8C3B30", text: "#F9F6F0", line: "#6D2D25" },
    { bg: "#2D4A60", text: "#E5EEE8", line: "#1E3444" },
    { bg: "#B8860B", text: "#FFFFFF", line: "#8B6508" },
    { bg: "#5A4B6E", text: "#F2C96D", line: "#423752" },
  ],
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const GENERATE_ESSAY_URL =
  "https://najkutamgxdagbkxhwhs.supabase.co/functions/v1/generate-essay";

type PersonaType =
  | "emotion_interpreter"
  | "strict_teacher"
  | "record_detective"
  | "entertainment_pd";

type JourneyStatus = "active" | "completed_pending_essay" | "completed" | "finished" | "cancelled";

type ActiveJourney = {
  id: string;
  title: string;
  status: JourneyStatus;
  duration_days: number;
  target_record_count: number;
  start_date: string;
  end_date: string;
  goal?: string | null;
};

type JourneyRecordItem = {
  id: string;
  indexNum: number;
  missionTitle: string;
  missionDescription: string;
  category: string;
  recordedAt: string;
  emotion: string;
  content: string;
  photoUrls: string[];
};

type ComicPanel = {
  panelNumber: number;
  dialogue: string;
  caption: string;
};

type EssayInsight = {
  keyword: string;
  description: string;
};

type DraftEssay = {
  journeyTitle: string;
  goal?: string;
  dateRangeText: string;
  durationDays: number;
  coverImage: string | null;
  title: string;
  content: string;
  summary: string;
  verdict: string;
  insights: EssayInsight[];
  aiRecommendation: string;
  comic: { episodeTitle: string; panels: ComicPanel[] } | null;
  persona: PersonaType;
  records: JourneyRecordItem[];
  aiSummary: string;
};

type CompletedEssay = {
  id: string;
  title: string;
  content: string;
  journeyGoal?: string;
  dateRangeText: string;
  durationDays: number;
  created_at: string;
  themeIndex: number;
  persona: PersonaType;
  coverImage?: string | null;
};

const PERSONA_LABEL: Record<PersonaType, string> = {
  emotion_interpreter: "감정 통역사",
  strict_teacher: "팩트 폭격 담임",
  record_detective: "기록 탐정",
  entertainment_pd: "인생 예능 PD",
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function EssayScreen() {
  const router = useRouter();

  const [journey, setJourney] = useState<ActiveJourney | null>(null);
  const [completedDayCount, setCompletedDayCount] = useState(0);
  const [rawRecords, setRawRecords] = useState<JourneyRecordItem[]>([]);
  const [draftEssay, setDraftEssay] = useState<DraftEssay | null>(null);
  const [essays, setEssays] = useState<CompletedEssay[]>([]);
  const [essayJourneyIds, setEssayJourneyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingCover, setSavingCover] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [writerModalVisible, setPersonaWriterModalVisible] = useState(false);
  const [personaPickerVisible, setPersonaPickerVisible] = useState(false);
  const [selectedEssay, setSelectedEssay] = useState<CompletedEssay | null>(null);
  const [recordsFolded, setRecordsFolded] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

  const { data: journeyRows } = await supabase
    .from("journeys")
    .select("id, title, status, duration_days, target_record_count, start_date, end_date, goal")
    .eq("user_id", user.id)
    .in("status", ["active", "completed_pending_essay", "completed", "finished"])
    .order("start_date", { ascending: false });

  const journeyData =
    (journeyRows ?? []).find((row) => row.status === "active") ??
    (journeyRows ?? []).find((row) => row.status === "completed_pending_essay" || row.status === "completed") ??
    (journeyRows ?? [])[0] ??
    null;

      if (!journeyData) {
        setJourney(null);
        setDraftEssay(null);
      } else {
        const j = journeyData as ActiveJourney;
        setJourney(j);

        const { data: journeyRecords, error: recordsError } = await supabase
          .from("records")
          .select(`
            id,
            content,
            emotion,
            recorded_at,
            mission_attempts (
              mission_id,
              missions ( title, short_description, category_id, mission_categories ( name ) )
            ),
            record_photos ( storage_path, sort_order, is_cover )
          `)
          .eq("user_id", user.id)
          .eq("journey_id", j.id)
          .order("recorded_at", { ascending: true });

        if (recordsError) {
          console.error("여정 기록 조회 실패:", recordsError.message);
        }

        const uniqueDays = new Set(
          (journeyRecords ?? []).map((r: any) => String(r.recorded_at).slice(0, 10)),
        ).size;
        setCompletedDayCount(uniqueDays);

        const items: JourneyRecordItem[] = await Promise.all(
          (journeyRecords ?? []).map(async (r: any, idx: number) => {
            const attempt = normalizeRelation(r.mission_attempts);
            const mission = normalizeRelation(attempt?.missions);
            const category = normalizeRelation(mission?.mission_categories);

            const photos = (Array.isArray(r.record_photos) ? r.record_photos : [])
              .slice()
              .sort((a: any, b: any) => {
                if (Boolean(a.is_cover) !== Boolean(b.is_cover)) return a.is_cover ? -1 : 1;
                return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
              });

            const photoUrls = (
              await Promise.all(
                photos.map(async (photo: any) => {
                  const path = String(photo.storage_path ?? "");
                  if (!path) return null;
                  const { data, error } = await supabase.storage
                    .from("record-photos")
                    .createSignedUrl(path, 3600);
                  if (error) return null;
                  return data.signedUrl;
                }),
              )
            ).filter((url): url is string => Boolean(url));

            return {
              id: String(r.id),
              indexNum: idx + 1,
              missionTitle: mission?.title ?? "기록",
              missionDescription: mission?.short_description ?? "",
              category: category?.name ?? "기타",
              recordedAt: String(r.recorded_at ?? "").slice(0, 10),
              emotion: r.emotion ?? "",
              content: r.content ?? "",
              photoUrls,
            };
          }),
        );

        setRawRecords(items);

        if ((j.status === "completed_pending_essay" || j.status === "completed") && items.length > 0) {
          setDraftEssay((prev) =>
            prev && prev.journeyTitle === j.title
              ? prev
              : {
                  journeyTitle: j.title,
                  goal: j.goal ?? undefined,
                  dateRangeText: `${j.start_date} ~ ${j.end_date}`,
                  durationDays: j.duration_days,
                  coverImage: null,
                  title: "",
                  content: "",
                  summary: "",
                  verdict: "",
                  insights: [],
                  aiRecommendation: "",
                  comic: null,
                  persona: "emotion_interpreter",
                  records: items,
                },
          );
        } else if (j.status !== "completed_pending_essay" && j.status !== "completed") {
          setDraftEssay(null);
        }
      }

      const { data: essayRows } = await supabase
        .from("essays")
        .select("id, title, content, created_at, journey_id, cover_photo_path, selected_payload")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setEssayJourneyIds(new Set((essayRows ?? []).map((row: any) => row.journey_id)));

      const parsed: CompletedEssay[] = await Promise.all(
        (essayRows ?? []).map(async (row: any, idx: number) => {
          const payload = row.selected_payload ?? {};
          let coverImage: string | null = null;

          if (row.cover_photo_path) {
            const { data } = supabase.storage
              .from("essay-covers")
              .getPublicUrl(row.cover_photo_path);
            coverImage = data.publicUrl;
          }

          return {
            id: row.id,
            title: row.title ?? "제목 없는 에세이",
            content: row.content ?? "",
            journeyGoal: payload.goal ?? undefined,
            dateRangeText: payload.dateRangeText ?? "",
            durationDays: Number(payload.durationDays ?? 7),
            created_at: row.created_at,
            themeIndex: idx % COLORS.bookThemes.length,
            persona: (payload.persona as PersonaType) ?? "emotion_interpreter",
            coverImage,
          };
        }),
      );

      setEssays(parsed);
    } catch (error) {
      console.error("에세이 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const getBookSpineWidth = (durationDays: number) => {
    if (durationDays >= 30) return 68;
    if (durationDays >= 14) return 54;
    return 44;
  };

  const shelves = useMemo<CompletedEssay[][]>(() => {
    const shelfList: CompletedEssay[][] = [];
    let currentShelf: CompletedEssay[] = [];
    let currentWidthSum = 0;
    const MAX_SHELF_WIDTH = SCREEN_WIDTH - 84;

    essays.forEach((essay) => {
      const bookWidth = getBookSpineWidth(essay.durationDays) + 10;
      if (currentWidthSum + bookWidth > MAX_SHELF_WIDTH && currentShelf.length > 0) {
        shelfList.push(currentShelf);
        currentShelf = [essay];
        currentWidthSum = bookWidth;
      } else {
        currentShelf.push(essay);
        currentWidthSum += bookWidth;
      }
    });

    if (currentShelf.length > 0) shelfList.push(currentShelf);
    return shelfList;
  }, [essays]);

  // 🚀 실제 AI 에세이 생성
  const generateEssay = async (persona: PersonaType) => {
    if (!draftEssay || rawRecords.length === 0) return;

    setGenerating(true);
    setPersonaPickerVisible(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await fetch(GENERATE_ESSAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken ?? ""}`,
        },
        body: JSON.stringify({
          persona,
          nickname: user?.user_metadata?.nickname ?? "사용자",
          journeyTitle: draftEssay.journeyTitle,
          durationDays: draftEssay.durationDays,
          records: rawRecords.map((r) => ({
            missionTitle: r.missionTitle,
            missionDescription: r.missionDescription,
            category: r.category,
            recordedAt: r.recordedAt,
            userContent: r.content,
            emotion: r.emotion,
            placeName: null,
            photoUrls: r.photoUrls,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error ?? "에세이 생성에 실패했습니다.");
      }

      setDraftEssay({
        ...draftEssay,
        persona,
        title: result.title,
        content: result.content,
        summary: result.summary,
        verdict: result.verdict,
        insights: result.insights ?? [],
        aiRecommendation: result.aiRecommendation,
        comic: result.comic
          ? { episodeTitle: result.comic.episodeTitle, panels: result.comic.panels }
          : null,
      });
    } catch (error) {
      Alert.alert(
        "에세이 생성 실패",
        error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const openWriter = async () => {
    setPersonaWriterModalVisible(true);
    if (draftEssay && !draftEssay.content) {
      await generateEssay("emotion_interpreter");
    }
  };

  const handleSelectPersona = (persona: PersonaType) => {
    void generateEssay(persona);
  };

  // 🚀 표지 사진 추가/변경
  const handlePickCoverPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("사진 권한이 필요해요", "사진 접근을 허용해주세요.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });

    if (result.canceled || !draftEssay) return;

    setSavingCover(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const extension = (asset.mimeType?.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${user.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("essay-covers")
        .upload(path, arrayBuffer, { contentType: asset.mimeType || "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("essay-covers").getPublicUrl(path);
      setDraftEssay({ ...draftEssay, coverImage: publicUrlData.publicUrl });
    } catch (error) {
      Alert.alert("사진 저장 실패", error instanceof Error ? error.message : "");
    } finally {
      setSavingCover(false);
    }
  };

  const handleRemoveCoverPhoto = () => {
    if (!draftEssay) return;
    setDraftEssay({ ...draftEssay, coverImage: null });
  };

  // 🚀 에세이 집필 완료 → 실제 DB 저장
  const handleFinishWritingEssay = () => {
    if (!draftEssay || !journey) return;

    if (!draftEssay.title || !draftEssay.content) {
      Alert.alert("아직 완성되지 않았어요", "먼저 AI 역할을 선택해 에세이를 생성해주세요.");
      return;
    }

    Alert.alert(
      "에세이 집필 완료",
      "완료 후에는 더 이상 에세이를 수정할 수 없습니다.\n집필을 완료하고 책장에 꽂으시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "완료하기",
          onPress: async () => {
            setFinishing(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error("로그인이 필요합니다.");

              const coverPath = draftEssay.coverImage
                ? draftEssay.coverImage.split("/essay-covers/")[1] ?? null
                : null;

              const { error: insertError } = await supabase.from("essays").insert({
                user_id: user.id,
                journey_id: journey.id,
                title: draftEssay.title,
                content: draftEssay.content,
                cover_photo_path: coverPath,
                visibility: "private",
                status: "completed",
                essay_type: "taste_report",
                generation_count: 1,
                selected_version_no: 1,
                generation_state: "idle",
                published_at: null,
                selected_payload: {
                  persona: draftEssay.persona,
                  summary: draftEssay.summary,
                  verdict: draftEssay.verdict,
                  insights: draftEssay.insights,
                  aiRecommendation: draftEssay.aiRecommendation,
                  comic: draftEssay.comic,
                  goal: draftEssay.goal ?? null,
                  dateRangeText: draftEssay.dateRangeText,
                  durationDays: draftEssay.durationDays,
                },
              });

              if (insertError) throw insertError;

              setPersonaWriterModalVisible(false);
              setDraftEssay(null);
              await loadData();

              Alert.alert("집필 완료!", "축하합니다! 완결된 에세이가 서재 책꽂이 맨 앞자리에 들어갔습니다. 📚");
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : typeof error === "object" && error !== null && "message" in error
                      ? String((error as any).message)
                      : JSON.stringify(error);
                console.error("에세이 저장 실패 상세:", error);
                Alert.alert("저장 실패", message);
              } finally {
                setFinishing(false);
              }
          },
        },
      ]
    );
  };

  const handleShareEssay = async (essay: CompletedEssay) => {
    try {
      await Share.share({
        title: essay.title,
        message: `📖 [오롯이 에세이] ${essay.title}\n🎯 목표: ${essay.journeyGoal ?? "목표 달성"}\n🗓️ 기간: ${essay.dateRangeText}\n\n${essay.content}\n\n- 오롯이(Orosi) 서재에서 작성됨`,
      });
    } catch (error) {
      Alert.alert("공유 실패", "에세이를 공유하는 중 오류가 발생했습니다.");
    }
  };

  const targetCount = journey?.target_record_count ?? 4;
  const progressPercent = Math.min(Math.round((completedDayCount / targetCount) * 100), 100);

  const hasEssayForJourney = journey ? essayJourneyIds.has(journey.id) : false;
  const isPendingEssay =
    (journey?.status === "completed_pending_essay" || journey?.status === "completed") &&
    !hasEssayForJourney;
  const isFinished =
    (journey?.status === "completed_pending_essay" || journey?.status === "completed") &&
    hasEssayForJourney;
  const isJourneyActive = journey?.status === "active";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* 🌿 헤더 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MY ESSAY LIBRARY</Text>
            <Text style={styles.headerTitle}>에세이 서재</Text>
            <Text style={styles.headerDescription}>
              완성된 에세이 책들을 펼쳐보고 소중한 사람들과 공유해보세요.
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="book-outline" size={26} color={COLORS.primary} />
          </View>
        </View>

        {isFinished ? (
          <View style={[styles.journeyCard, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.journeyLabel}>✨ 에세이가 완성되었습니다!</Text>
            <Text style={styles.journeyTitle}>새로운 여정을 다시 떠나보아요~ 🌿</Text>
            <Text style={[styles.progressDescription, { marginTop: 6, marginBottom: 16 }]}>
              서재 책꽂이에 새 책이 꽂혔습니다. 캘린더에서 또 다른 멋진 여정을 시작해 보세요!
            </Text>

            <Pressable
              style={styles.startWritingBtn}
              onPress={() => router.push("/(tabs)/calendar")}
            >
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.startWritingBtnText}>새 여정 시작하러 가기 🗓️</Text>
            </Pressable>
          </View>
        ) : isPendingEssay ? (
          <View style={[styles.journeyCard, { backgroundColor: COLORS.woodMain }]}>
            <Text style={styles.journeyLabel}>🎉 여정이 정상적으로 끝났습니다!</Text>
            <Text style={styles.journeyTitle}>에세이 집필하기</Text>
            <Text style={[styles.progressDescription, { marginTop: 4, marginBottom: 14 }]}>
              수집된 기록들을 바탕으로 AI와 함께 나만의 양장본 책을 집필해 보세요.
            </Text>

            <Pressable
              style={styles.startWritingBtn}
              onPress={() => void openWriter()}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
              <Text style={styles.startWritingBtnText}>집필 시작하기 ✍️</Text>
            </Pressable>
          </View>
        ) : isJourneyActive ? (
          <View style={styles.journeyCard}>
            <View style={styles.journeyTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.journeyLabel}>{journey?.title ?? "여정"}</Text>
                <Text style={styles.journeyTitle}>목표 기록을 채워주세요!</Text>
                {journey?.goal && (
                  <View style={styles.activeGoalBadge}>
                    <Text style={styles.activeGoalText}>🎯 목표: {journey.goal}</Text>
                  </View>
                )}
              </View>
              <View style={styles.percentBadge}>
                <Text style={styles.percentText}>{progressPercent}%</Text>
              </View>
            </View>

            <View style={styles.progressInfoRow}>
              <Text style={styles.progressDescription}>여정이 끝날 때까지 기록을 차곡차곡 모아보세요.</Text>
              <Text style={styles.progressCount}>{completedDayCount}/{targetCount}</Text>
            </View>

            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        ) : (
          <View style={styles.journeyCard}>
            <Text style={styles.journeyLabel}>여정이 없어요</Text>
            <Text style={styles.journeyTitle}>캘린더에서 새 여정을 시작해보세요</Text>
          </View>
        )}

        <View style={styles.bookshelfSection}>
          <View style={styles.bookshelfHeader}>
            <Text style={styles.bookshelfTitle}>🪵 나의 완결 에세이 서재</Text>
            <Text style={styles.bookshelfCount}>총 {essays.length}권 · {shelves.length}층 책장</Text>
          </View>

          <View style={styles.woodCabinet}>
            <View style={styles.woodTopFrame} />

            {shelves.length > 0 ? (
              shelves.map((shelfItems: CompletedEssay[], shelfIndex: number) => (
                <View key={`shelf-${shelfIndex}`} style={styles.shelfTier}>
                  <View style={styles.shelfBookRow}>
                    {shelfItems.map((item: CompletedEssay) => {
                      const width = getBookSpineWidth(item.durationDays);
                      const theme = COLORS.bookThemes[item.themeIndex];

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setSelectedEssay(item)}
                          style={({ pressed }) => [
                            styles.bookSpine,
                            {
                              width,
                              backgroundColor: theme.bg,
                              borderColor: theme.line,
                            },
                            pressed && styles.bookPressed,
                          ]}
                        >
                          <View style={[styles.bookGoldLine, { backgroundColor: theme.line }]} />

                          <View style={styles.rotatedTitleContainer}>
                            <Text numberOfLines={2} style={[styles.rotatedTitleText, { color: theme.text }]}>
                              {item.title}
                            </Text>
                            <Text style={[styles.rotatedDateText, { color: theme.text }]}>
                              {item.dateRangeText}
                            </Text>
                          </View>

                          <View style={styles.bookBottomInfo}>
                            <View style={[styles.bookGoldLine, { backgroundColor: theme.line }]} />
                            <Text style={[styles.bookDurationText, { color: theme.text }]}>
                              {item.durationDays}D
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.woodenPlank}>
                    <View style={styles.woodenPlankHighlight} />
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyNotice}>
                <Text style={styles.emptyNoticeText}>
                  책꽂이가 비어있어요. 여정을 완주하고 집필을 마치면 나만의 책이 차곡차곡 꽂힙니다!
                </Text>
              </View>
            )}

            <View style={styles.woodBottomFrame} />
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ✍️ 에세이 집필하기 편집 모달 */}
      <Modal
        visible={writerModalVisible}
        animationType="slide"
        onRequestClose={() => setPersonaWriterModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F1" }}>
          {draftEssay && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
              
              <View style={styles.screenHeaderBar}>
                <Pressable
                  onPress={() => setPersonaWriterModalVisible(false)}
                  hitSlop={20}
                  style={styles.backButtonTouch}
                >
                  <Ionicons name="chevron-back" size={28} color={COLORS.textMain} />
                </Pressable>
                <Text style={styles.screenHeaderTitle}>{draftEssay.journeyTitle}</Text>
                <View style={{ width: 28 }} />
              </View>

              <View style={styles.editorImageFrame}>
                {draftEssay.coverImage ? (
                  <Image source={{ uri: draftEssay.coverImage }} style={styles.editorCoverImage} />
                ) : (
                  <View style={[styles.editorCoverImage, styles.editorCoverPlaceholder]}>
                    <Ionicons name="image-outline" size={30} color={COLORS.textMuted} />
                    <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 6 }}>
                      사진이나 동영상을 추가해주세요
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 10 }}>
                <Pressable
                  style={styles.coverPhotoBtn}
                  onPress={() => void handlePickCoverPhoto()}
                  disabled={savingCover}
                >
                  {savingCover ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.coverPhotoBtnText}>
                      {draftEssay.coverImage ? "사진 변경" : "사진 추가"}
                    </Text>
                  )}
                </Pressable>
                {draftEssay.coverImage && (
                  <Pressable style={styles.coverPhotoRemoveBtn} onPress={handleRemoveCoverPhoto}>
                    <Text style={styles.coverPhotoRemoveBtnText}>삭제</Text>
                  </Pressable>
                )}
              </View>

              <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <View style={styles.personaBadgeTag}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.personaBadgeTagText}>{PERSONA_LABEL[draftEssay.persona]}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{draftEssay.dateRangeText}</Text>
                </View>

                <Pressable
                  style={styles.reAiCard}
                  onPress={() => {
                    console.log("🔥 다른 AI 버튼 눌림, generating:", generating);
                    setPersonaPickerVisible(true);
                  }}
                >
                  <View>
                    <Text style={styles.reAiTitle}>다른 AI에게 다시 맡기기</Text>
                    <Text style={styles.reAiSub}>이전 결과 대신 새 에세이로 바로 바뀌어요.</Text>
                  </View>
                  <Ionicons name="swap-horizontal" size={22} color={COLORS.primary} />
                </Pressable>

                {generating ? (
                  <View style={{ alignItems: "center", paddingVertical: 50 }}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={{ marginTop: 12, color: COLORS.textSub, fontSize: 13 }}>
                      AI가 여정을 읽고 에세이를 쓰는 중이에요...
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.inputSectionLabel}>제목</Text>
                    <TextInput
                      value={draftEssay.title}
                      onChangeText={(text) => setDraftEssay({ ...draftEssay, title: text })}
                      style={styles.editorTitleInput}
                    />

                    <Text style={styles.inputSectionLabel}>본문</Text>
                    <TextInput
                      value={draftEssay.content}
                      onChangeText={(text) => setDraftEssay({ ...draftEssay, content: text })}
                      multiline
                      style={styles.editorBodyInput}
                    />

                    {draftEssay.comic && (
                      <View style={styles.aiInsightBox}>
                        <Text style={styles.aiInsightTitle}>{draftEssay.comic.episodeTitle}</Text>
                        {draftEssay.comic.panels.map((panel) => (
                          <View key={panel.panelNumber} style={styles.insightCardItem}>
                            <Text style={styles.insightCardTitle}>{panel.panelNumber}컷</Text>
                            <Text style={styles.insightCardDesc}>{panel.dialogue}</Text>
                            <Text style={[styles.insightCardDesc, { fontWeight: "700", marginTop: 3 }]}>
                              자막: {panel.caption}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {draftEssay.insights.length > 0 && (
                      <View style={styles.aiInsightBox}>
                        <Text style={styles.aiInsightTitle}>AI가 읽은 이번 여정</Text>
                        <Text style={styles.aiInsightSub}>{draftEssay.summary}</Text>

                        {draftEssay.insights.map((insight) => (
                          <View key={insight.keyword} style={styles.insightCardItem}>
                            <Text style={styles.insightCardTitle}>{insight.keyword}</Text>
                            <Text style={styles.insightCardDesc}>{insight.description}</Text>
                          </View>
                        ))}

                        <Text style={[styles.aiInsightSub, { marginTop: 4, fontWeight: "700" }]}>
                          {draftEssay.verdict}
                        </Text>
                        <Text style={[styles.aiInsightSub, { marginTop: 4 }]}>
                          {draftEssay.aiRecommendation}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                <View style={{ marginTop: 24 }}>
                  <Pressable
                    style={styles.recordsFoldHeader}
                    onPress={() => setRecordsFolded(!recordsFolded)}
                  >
                    <View>
                      <Text style={styles.recordsFoldTitle}>에세이에 담긴 기록</Text>
                      <Text style={styles.recordsFoldCount}>총 {draftEssay.records.length}개의 기록</Text>
                    </View>
                    <Ionicons name={recordsFolded ? "chevron-down" : "chevron-up"} size={20} color={COLORS.textMain} />
                  </Pressable>

                  {!recordsFolded && (
                    <View style={{ gap: 12, marginTop: 12 }}>
                      {draftEssay.records.map((rec) => (
                        <View key={rec.id} style={styles.recordItemCard}>
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            <View style={styles.recordIndexBadge}><Text style={styles.recordIndexText}>{rec.indexNum}</Text></View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.recordItemTitle}>{rec.missionTitle}</Text>
                              <Text style={styles.recordItemMeta}>{rec.category} · {rec.recordedAt}</Text>
                              <Text style={styles.recordItemEmotion}>감정: {rec.emotion}</Text>
                              <Text style={styles.recordItemContent}>{rec.content}</Text>
                            </View>
                          </View>
                          {rec.photoUrls.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                              {rec.photoUrls.map((url, photoIndex) => (
                                <Image
                                  key={`${rec.id}-${photoIndex}`}
                                  source={{ uri: url }}
                                  style={{ width: 110, height: 110, borderRadius: 10, marginRight: 8 }}
                                />
                              ))}
                            </ScrollView>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <Pressable
                  style={[styles.submitWritingBtn, (generating || finishing) && { opacity: 0.6 }]}
                  onPress={handleFinishWritingEssay}
                  disabled={generating || finishing}
                >
                  {finishing ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitWritingBtnText}>집필 완료하고 책장에 꽂기 📚</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* 🎭 이번에는 누가 읽어볼까요? */}
      <Modal
        visible={personaPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPersonaPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPersonaPickerVisible(false)} />
          <View style={styles.personaPopupCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <View>
                <Text style={styles.personaPopupTitle}>이번에는 누가 읽어볼까요?</Text>
                <Text style={styles.personaPopupSub}>같은 기록도 AI의 역할에 따라 전혀 다르게 해석돼요.</Text>
              </View>
              <Pressable onPress={() => setPersonaPickerVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={COLORS.textMain} />
              </Pressable>
            </View>

            <View style={{ gap: 10 }}>
              <Pressable style={styles.personaSelectItem} onPress={() => handleSelectPersona("emotion_interpreter")}>
                <View style={styles.personaIconCircle}><Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaSelectTitle}>감정 통역사</Text>
                  <Text style={styles.personaSelectSub}>기록 속 마음의 움직임을 다정한 언어로 정리해요.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </Pressable>

              <Pressable style={styles.personaSelectItem} onPress={() => handleSelectPersona("strict_teacher")}>
                <View style={styles.personaIconCircle}><Ionicons name="school-outline" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaSelectTitle}>팩트 폭격 담임</Text>
                  <Text style={styles.personaSelectSub}>목표와 실제 행동이 어긋난 부분을 솔직하게 짚어요.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </Pressable>

              <Pressable style={styles.personaSelectItem} onPress={() => handleSelectPersona("record_detective")}>
                <View style={styles.personaIconCircle}><Ionicons name="finger-print-outline" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaSelectTitle}>기록 탐정</Text>
                  <Text style={styles.personaSelectSub}>기록 속 단서를 연결해 숨은 행동 패턴을 추리해요.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </Pressable>

              <Pressable style={styles.personaSelectItem} onPress={() => handleSelectPersona("entertainment_pd")}>
                <View style={styles.personaIconCircle}><Ionicons name="videocam-outline" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaSelectTitle}>인생 예능 PD</Text>
                  <Text style={styles.personaSelectSub}>여정의 웃픈 명장면을 4컷 웹툰으로 편집해요.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📖 완성된 에세이 펼쳐보기 모달 */}
      <Modal
        visible={selectedEssay !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEssay(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedEssay(null)} />
          <View style={styles.bookOpenCard}>
            {selectedEssay && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bookOpenContent}>
                <View style={styles.bookOpenHeader}>
                  <Text style={styles.bookOpenCaption}>✨ 완성된 완결 에세이</Text>
                  <Pressable onPress={() => setSelectedEssay(null)} hitSlop={10}>
                    <Ionicons name="close" size={22} color={COLORS.textSub} />
                  </Pressable>
                </View>

                {selectedEssay.coverImage && (
                  <Image source={{ uri: selectedEssay.coverImage }} style={{ width: "100%", height: 170, borderRadius: 14, marginBottom: 14 }} />
                )}

                <Text style={styles.bookOpenTitle}>{selectedEssay.title}</Text>
                
                {selectedEssay.journeyGoal && (
                  <View style={styles.modalGoalBadge}>
                    <Text style={styles.modalGoalText}>🎯 여정 목표: {selectedEssay.journeyGoal}</Text>
                  </View>
                )}

                <Text style={styles.bookOpenDate}>
                  여정 기간: {selectedEssay.dateRangeText} ({selectedEssay.durationDays}일간)
                </Text>

                <View style={styles.divider} />

                <Text style={styles.bookOpenBody}>{selectedEssay.content}</Text>

                <View style={styles.saveShareActionRow}>
                  <Pressable
                    style={styles.saveBtn}
                    onPress={() => Alert.alert("이미지 저장", "에세이가 이미지 앨범에 저장되었습니다.")}
                  >
                    <Text style={styles.saveBtnText}>저장</Text>
                  </Pressable>

                  <Pressable
                    style={styles.publishBtn}
                    onPress={() => handleShareEssay(selectedEssay)}
                  >
                    <Text style={styles.publishBtnText}>공유하기</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.closeButton}
                  onPress={() => setSelectedEssay(null)}
                >
                  <Text style={styles.closeButtonText}>책 덮기</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  eyebrow: {
    color: "#789083",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  headerTitle: {
    color: COLORS.textMain,
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  headerDescription: {
    color: COLORS.textSub,
    fontSize: 14,
    marginTop: 7,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#E1E9E3",
    alignItems: "center",
    justifyContent: "center",
  },

  journeyCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
  },
  journeyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  journeyLabel: {
    color: "#BFD0C7",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  journeyTitle: {
    color: COLORS.white,
    fontSize: 20,
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
  percentBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  percentText: {
    color: COLORS.textMain,
    fontSize: 16,
    fontWeight: "900",
  },
  progressInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressDescription: {
    fontSize: 12,
    color: "#D8E2DC",
  },
  progressCount: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.accent,
  },
  progressBarBackground: {
    height: 7,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },

  startWritingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderRadius: 14,
  },
  startWritingBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },

  bookshelfSection: {
    marginBottom: 20,
  },
  bookshelfHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bookshelfTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  bookshelfCount: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSub,
  },

  woodCabinet: {
    backgroundColor: COLORS.woodDark,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: COLORS.woodBorder,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  woodTopFrame: {
    height: 14,
    backgroundColor: COLORS.woodMain,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.woodBorder,
  },
  woodBottomFrame: {
    height: 14,
    backgroundColor: COLORS.woodMain,
    borderTopWidth: 2,
    borderTopColor: COLORS.woodBorder,
  },

  shelfTier: {
    backgroundColor: "#3A2111",
    justifyContent: "flex-end",
  },
  shelfBookRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 10,
  },

  bookSpine: {
    height: 165,
    borderRadius: 4,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  bookPressed: {
    transform: [{ translateY: -8 }],
    opacity: 0.9,
  },
  bookGoldLine: {
    width: "100%",
    height: 3,
    borderRadius: 1,
  },

  rotatedTitleContainer: {
    flex: 1,
    width: 135,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "90deg" }],
  },
  rotatedTitleText: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 14,
  },
  rotatedDateText: {
    fontSize: 8,
    fontWeight: "600",
    marginTop: 2,
    opacity: 0.85,
  },

  bookBottomInfo: {
    width: "100%",
    alignItems: "center",
    gap: 4,
  },
  bookDurationText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  woodenPlank: {
    height: 16,
    backgroundColor: COLORS.woodMain,
    borderTopWidth: 3,
    borderTopColor: COLORS.woodLight,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.woodBorder,
    marginTop: 2,
  },
  woodenPlankHighlight: {
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },

  emptyNotice: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyNoticeText: {
    color: "#C2A38E",
    fontSize: 13,
    textAlign: "center",
  },

  screenHeaderBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#F9F7F1",
  },
  backButtonTouch: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  screenHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  editorImageFrame: {
    width: "100%",
    height: 220,
    backgroundColor: COLORS.border,
  },
  editorCoverImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  editorCoverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  coverPhotoBtn: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },
  coverPhotoBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  coverPhotoRemoveBtn: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  coverPhotoRemoveBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  personaBadgeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
  },
  personaBadgeTagText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  reAiCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    marginBottom: 20,
  },
  reAiTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },
  reAiSub: {
    fontSize: 11,
    color: COLORS.textSub,
    marginTop: 2,
  },
  inputSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSub,
    marginBottom: 6,
  },
  editorTitleInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 16,
  },
  editorBodyInput: {
    minHeight: 180,
    padding: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textMain,
    marginBottom: 20,
  },

  aiInsightBox: {
    padding: 16,
    backgroundColor: "#F3F1E7",
    borderRadius: 16,
    marginBottom: 16,
  },
  aiInsightTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 4,
  },
  aiInsightSub: {
    fontSize: 12,
    color: COLORS.textSub,
    lineHeight: 18,
    marginBottom: 14,
  },
  insightCardItem: {
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 8,
  },
  insightCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary,
    marginBottom: 2,
  },
  insightCardDesc: {
    fontSize: 11,
    color: COLORS.textSub,
    lineHeight: 16,
  },

  recordsFoldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recordsFoldTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  recordsFoldCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  recordItemCard: {
    padding: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  recordIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  recordIndexText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  recordItemTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  recordItemMeta: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  recordItemEmotion: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.pink,
    marginTop: 4,
  },
  recordItemContent: {
    fontSize: 12,
    color: COLORS.textSub,
    marginTop: 4,
    lineHeight: 17,
  },

  submitWritingBtn: {
    paddingVertical: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
  },
  submitWritingBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(38, 55, 46, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  personaPopupCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FBF9F3",
    borderRadius: 22,
    padding: 20,
  },
  personaPopupTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  personaPopupSub: {
    fontSize: 12,
    color: COLORS.textSub,
    marginTop: 2,
  },
  personaSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  personaIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  personaSelectTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  personaSelectSub: {
    fontSize: 11,
    color: COLORS.textSub,
    marginTop: 2,
  },

  bookOpenCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "82%",
    backgroundColor: "#FBF9F3",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 12,
  },
  bookOpenContent: {
    paddingBottom: 10,
  },
  bookOpenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bookOpenCaption: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  bookOpenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 6,
  },
  modalGoalBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  modalGoalText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  bookOpenDate: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  bookOpenBody: {
    fontSize: 15,
    lineHeight: 26,
    color: COLORS.textMain,
    marginBottom: 24,
  },

  saveShareActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  saveBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },
  publishBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  publishBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
  },

  closeButton: {
    minHeight: 48,
    backgroundColor: "#E2E3DC",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: "800",
  },
});