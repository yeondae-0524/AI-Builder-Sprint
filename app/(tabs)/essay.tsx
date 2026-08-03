import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
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

const ESSAY_FUNCTION_NAME =
  String(
    process.env.EXPO_PUBLIC_ESSAY_FUNCTION_NAME ?? "generate-essay",
  ).trim() || "generate-essay";

type PersonaType =
  | "emotion_interpreter"
  | "strict_teacher"
  | "record_detective"
  | "entertainment_pd";

type PersonaPickerMode = "start" | "regenerate" | null;

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
  photoPaths: string[];
};

type ComicBackground =
  | "street"
  | "restaurant"
  | "exhibition"
  | "bookstore"
  | "workshop"
  | "home"
  | "cafe"
  | "park"
  | "transit"
  | "generic";

type ComicExpression =
  | "determined"
  | "nervous"
  | "flustered"
  | "blank"
  | "relieved"
  | "proud"
  | "shocked"
  | "thinking";


const BEGINI_EXPRESSION_IMAGES: Record<ComicExpression, number> = {
  determined: require("../../assets/begini/expressions/begini_determined.png"),
  nervous: require("../../assets/begini/expressions/begini_nervous.png"),
  flustered: require("../../assets/begini/expressions/begini_flustered.png"),
  blank: require("../../assets/begini/expressions/begini_blank.png"),
  relieved: require("../../assets/begini/expressions/begini_relieved.png"),
  proud: require("../../assets/begini/expressions/begini_proud.png"),
  shocked: require("../../assets/begini/expressions/begini_shocked.png"),
  thinking: require("../../assets/begini/expressions/begini_thinking.png"),
};

type ComicPose =
  | "standing"
  | "walking"
  | "sitting"
  | "holding"
  | "pointing"
  | "hiding"
  | "celebrating"
  | "frozen";

type ComicEffect =
  | "none"
  | "sweat"
  | "shock"
  | "zoom"
  | "silence"
  | "black_and_white"
  | "sparkle"
  | "question_marks"
  | "speed_lines";

type ComicPanel = {
  panelNumber: number;
  background: ComicBackground;
  expression: ComicExpression;
  pose: ComicPose;
  effect: ComicEffect;
  dialogue: string;
  caption: string;
  recordIndexes: number[];
  characterImageUrl?: string | null;
  backgroundImageUrl?: string | null;
};

type EntertainmentComic = {
  episodeTitle: string;
  comedyStyle?: string;
  panels: ComicPanel[];
  highlightCaption?: string;
  nextEpisode?: string;
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
  coverSourcePath: string | null;
  title: string;
  content: string;
  summary: string;
  verdict: string;
  insights: EssayInsight[];
  aiRecommendation: string;
  comic: EntertainmentComic | null;
  persona: PersonaType;
  records: JourneyRecordItem[];
};

type CompletedEssay = {
  id: string;
  journeyId: string;
  title: string;
  content: string;
  journeyGoal?: string;
  dateRangeText: string;
  durationDays: number;
  created_at: string;
  themeIndex: number;
  persona: PersonaType;
  summary: string;
  verdict: string;
  insights: EssayInsight[];
  aiRecommendation: string;
  comic: DraftEssay["comic"];
  generationCount: number;
  coverImage?: string | null;
};

const PERSONA_LABEL: Record<PersonaType, string> = {
  emotion_interpreter: "감정 통역사",
  strict_teacher: "팩트 폭격 담임",
  record_detective: "기록 탐정",
  entertainment_pd: "인생 예능 PD",
};

const EMOTION_LABELS: Record<string, string> = {
  comfortable: "편안해요",
  joyful: "즐거워요",
  new: "새로워요",
  uncomfortable: "불편해요",
  unsure: "잘 모르겠어요",
};

function getEmotionLabel(value: unknown) {
  const emotion = String(value ?? "").trim();
  return EMOTION_LABELS[emotion] ?? emotion;
}

function formatEssayForReadability(value: unknown) {
  const normalized = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return "";

  const existingParagraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (existingParagraphs.length >= 3) {
    return existingParagraphs.join("\n\n");
  }

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 3) {
    return lines.join("\n\n");
  }

  const sentences = (
    normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) ?? []
  )
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 3) return normalized;

  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(" "));
  }

  return paragraphs.join("\n\n");
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = String(
      (error as { message?: unknown }).message ?? "",
    ).trim();

    if (message) return message;
  }

  return fallback;
}

async function getFunctionInvokeErrorMessage(error: unknown) {
  const fallback = getErrorMessage(
    error,
    "Edge Function 호출에 실패했습니다.",
  );

  if (!error || typeof error !== "object" || !("context" in error)) {
    return fallback;
  }

  try {
    const context = (error as { context?: unknown }).context as
      | {
          clone?: () => { text?: () => Promise<string> };
          text?: () => Promise<string>;
        }
      | undefined;
    const responseLike = context?.clone?.() ?? context;
    const raw = await responseLike?.text?.();

    if (!raw?.trim()) return fallback;

    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const detail = String(
        payload.error ??
          payload.message ??
          payload.details ??
          "",
      ).trim();

      if (detail) return detail;
    } catch {
      return raw.trim();
    }
  } catch {
    // 응답 본문을 읽지 못하면 기본 오류 문구를 사용한다.
  }

  return fallback;
}

async function getFreshAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  if (!data.session) throw new Error("로그인이 필요합니다.");

  const expiresAtMs = (data.session.expires_at ?? 0) * 1000;
  const shouldRefresh = expiresAtMs <= Date.now() + 60_000;

  if (!shouldRefresh) {
    return data.session.access_token;
  }

  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession();

  if (refreshError) throw refreshError;
  if (!refreshed.session) {
    throw new Error("로그인 정보를 새로고침하지 못했습니다.");
  }

  return refreshed.session.access_token;
}


const COMIC_BACKGROUNDS: ComicBackground[] = [
  "street",
  "restaurant",
  "exhibition",
  "bookstore",
  "workshop",
  "home",
  "cafe",
  "park",
  "transit",
  "generic",
];

const COMIC_EXPRESSIONS: ComicExpression[] = [
  "determined",
  "nervous",
  "flustered",
  "blank",
  "relieved",
  "proud",
  "shocked",
  "thinking",
];

const COMIC_POSES: ComicPose[] = [
  "standing",
  "walking",
  "sitting",
  "holding",
  "pointing",
  "hiding",
  "celebrating",
  "frozen",
];

const COMIC_EFFECTS: ComicEffect[] = [
  "none",
  "sweat",
  "shock",
  "zoom",
  "silence",
  "black_and_white",
  "sparkle",
  "question_marks",
  "speed_lines",
];

function normalizeComicEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const normalized = String(value ?? "").trim() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeComicPanel(
  value: unknown,
  index: number,
): ComicPanel | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const dialogue = String(raw.dialogue ?? "").trim();
  const caption = String(raw.caption ?? "").trim();

  if (!dialogue || !caption) return null;

  return {
    panelNumber: Number(raw.panelNumber ?? index + 1),
    background: normalizeComicEnum(
      raw.background,
      COMIC_BACKGROUNDS,
      "generic",
    ),
    expression: normalizeComicEnum(
      raw.expression,
      COMIC_EXPRESSIONS,
      "thinking",
    ),
    pose: normalizeComicEnum(
      raw.pose,
      COMIC_POSES,
      "standing",
    ),
    effect: normalizeComicEnum(
      raw.effect,
      COMIC_EFFECTS,
      "none",
    ),
    dialogue,
    caption,
    recordIndexes: Array.isArray(raw.recordIndexes)
      ? raw.recordIndexes
          .map(Number)
          .filter((item) => Number.isInteger(item) && item >= 0)
      : [],
    characterImageUrl:
      typeof raw.characterImageUrl === "string"
        ? raw.characterImageUrl
        : null,
    backgroundImageUrl:
      typeof raw.backgroundImageUrl === "string"
        ? raw.backgroundImageUrl
        : null,
  };
}

function normalizeEntertainmentComic(
  value: unknown,
): EntertainmentComic | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const panels = (Array.isArray(raw.panels) ? raw.panels : [])
    .map(normalizeComicPanel)
    .filter((item): item is ComicPanel => item !== null)
    .slice(0, 4);

  if (panels.length !== 4) return null;

  return {
    episodeTitle:
      String(raw.episodeTitle ?? "오늘의 4컷").trim() ||
      "오늘의 4컷",
    comedyStyle:
      typeof raw.comedyStyle === "string"
        ? raw.comedyStyle
        : undefined,
    panels,
    highlightCaption:
      typeof raw.highlightCaption === "string"
        ? raw.highlightCaption
        : undefined,
    nextEpisode:
      typeof raw.nextEpisode === "string"
        ? raw.nextEpisode
        : undefined,
  };
}

const COMIC_BACKGROUND_META: Record<
  ComicBackground,
  { color: string; emoji: string; label: string }
> = {
  street: { color: "#DCEAF1", emoji: "🏙️", label: "거리" },
  restaurant: { color: "#F6E2CF", emoji: "🍽️", label: "식당" },
  exhibition: { color: "#EEE8F7", emoji: "🖼️", label: "전시" },
  bookstore: { color: "#E9E1D4", emoji: "📚", label: "서점" },
  workshop: { color: "#F2E3CF", emoji: "🧶", label: "공방" },
  home: { color: "#F1E8DA", emoji: "🏠", label: "집" },
  cafe: { color: "#E8D8C8", emoji: "☕", label: "카페" },
  park: { color: "#DCECD7", emoji: "🌳", label: "공원" },
  transit: { color: "#DFE5EC", emoji: "🚌", label: "이동 중" },
  generic: { color: "#E8EEE9", emoji: "✨", label: "일상" },
};

const COMIC_EFFECT_TEXT: Record<ComicEffect, string> = {
  none: "",
  sweat: "💦",
  shock: "‼",
  zoom: "🔍",
  silence: "……",
  black_and_white: "흑백",
  sparkle: "✨",
  question_marks: "???",
  speed_lines: "슝—",
};

function getPoseTransform(pose: ComicPose) {
  switch (pose) {
    case "walking":
      return [{ rotate: "-5deg" as const }, { translateX: -4 }];
    case "sitting":
      return [{ translateY: 12 }, { scaleY: 0.9 }];
    case "pointing":
      return [{ rotate: "4deg" as const }, { translateX: 4 }];
    case "hiding":
      return [{ translateX: 24 }, { scale: 0.92 }];
    case "celebrating":
      return [{ translateY: -7 }, { scale: 1.05 }];
    case "frozen":
      return [{ scale: 0.96 }];
    case "holding":
      return [{ rotate: "-2deg" as const }];
    case "standing":
    default:
      return [];
  }
}

function BiginiCharacter({
  expression,
  pose,
  imageUrl,
  panelNumber,
}: {
  expression: ComicExpression;
  pose: ComicPose;
  imageUrl?: string | null;
  panelNumber?: number;
}) {
  const source = imageUrl
    ? { uri: imageUrl }
    : BEGINI_EXPRESSION_IMAGES[expression] ??
      BEGINI_EXPRESSION_IMAGES.thinking;

  return (
    <View
      style={[
        styles.comicCharacterPositioner,
        panelNumber === 3 && styles.comicCharacterPositionerThird,
      ]}
    >
      <Image
        source={source}
        resizeMode="contain"
        style={[
          styles.comicCharacterImage,
          { transform: getPoseTransform(pose) },
        ]}
      />
    </View>
  );
}

function ComicStrip({
  comic,
  compact = false,
}: {
  comic: EntertainmentComic;
  compact?: boolean;
}) {
  // flexWrap에 맡기지 않고 두 줄로 직접 나눠서,
  // 화면과 이미지 캡처 모두 항상 2 × 2 배열을 유지한다.
  const panelRows = [
    comic.panels.slice(0, 2),
    comic.panels.slice(2, 4),
  ];

  return (
    <View
      style={[
        styles.comicStrip,
        compact && styles.comicStripCompact,
      ]}
    >
      <View style={styles.comicStripHeader}>
        <Text numberOfLines={2} style={styles.comicStripTitle}>
          {comic.episodeTitle}
        </Text>
      </View>

      <View style={styles.comicGrid}>
        {panelRows.map((row, rowIndex) => (
          <View key={`comic-row-${rowIndex}`} style={styles.comicRow}>
            {row.map((panel) => {
              const background =
                COMIC_BACKGROUND_META[panel.background] ??
                COMIC_BACKGROUND_META.generic;
              const effectText = COMIC_EFFECT_TEXT[panel.effect];

              return (
                <View
                  key={`${panel.panelNumber}-${panel.caption}`}
                  style={[
                    styles.comicPanel,
                    { backgroundColor: background.color },
                  ]}
                >
                  {panel.backgroundImageUrl ? (
                    <Image
                      source={{ uri: panel.backgroundImageUrl }}
                      resizeMode="cover"
                      style={styles.comicPanelBackgroundImage}
                    />
                  ) : null}

                  <View style={styles.comicPanelTopRow}>
                    <View style={styles.comicPanelNumber}>
                      <Text style={styles.comicPanelNumberText}>
                        {panel.panelNumber}
                      </Text>
                    </View>
                    <Text style={styles.comicPanelScene}>
                      {background.emoji} {background.label}
                    </Text>
                  </View>

                  <View style={styles.comicDialogueBubble}>
                    <Text
                      numberOfLines={3}
                      style={styles.comicDialogueText}
                    >
                      {panel.dialogue}
                    </Text>
                    <View style={styles.comicDialogueTail} />
                  </View>

                  <View style={styles.comicScene}>
                    {effectText ? (
                      <Text style={styles.comicEffectText}>
                        {effectText}
                      </Text>
                    ) : null}

                    <BiginiCharacter
                      expression={panel.expression}
                      pose={panel.pose}
                      imageUrl={panel.characterImageUrl}
                      panelNumber={panel.panelNumber}
                    />
                  </View>

                  <View style={styles.comicCaptionBar}>
                    <Text
                      numberOfLines={2}
                      style={styles.comicCaptionText}
                    >
                      {panel.caption}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function EssayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
  const [sharingEssayId, setSharingEssayId] = useState<string | null>(null);
  const sharedComicRef = useRef<View | null>(null);

  const [writerModalVisible, setPersonaWriterModalVisible] = useState(false);
  const [personaPickerVisible, setPersonaPickerVisible] = useState(false);
  const [personaPickerMode, setPersonaPickerMode] =
    useState<PersonaPickerMode>(null);
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

            const photoPaths = photos
              .map((photo: any) => String(photo.storage_path ?? "").trim())
              .filter(Boolean);
            const photoUrls = (
              await Promise.all(
                photoPaths.map(async (path: string) => {
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
              emotion: getEmotionLabel(r.emotion),
              content: r.content ?? "",
              photoUrls,
              photoPaths,
            };
          }),
        );

        setRawRecords(items);

        const canCreateEssay =
          j.target_record_count > 0 && uniqueDays >= j.target_record_count;

        if (canCreateEssay && items.length > 0) {
          const firstPhotoRecord = items.find(
            (item) => item.photoUrls.length > 0 && item.photoPaths.length > 0,
          );

          setDraftEssay((prev) =>
            prev && prev.journeyTitle === j.title
              ? {
                  ...prev,
                  records: items,
                  coverImage:
                    prev.coverImage ?? firstPhotoRecord?.photoUrls[0] ?? null,
                  coverSourcePath:
                    prev.coverSourcePath ?? firstPhotoRecord?.photoPaths[0] ?? null,
                }
              : {
                  journeyTitle: j.title,
                  goal: j.goal ?? undefined,
                  dateRangeText: `${j.start_date} ~ ${j.end_date}`,
                  durationDays: j.duration_days,
                  coverImage: firstPhotoRecord?.photoUrls[0] ?? null,
                  coverSourcePath: firstPhotoRecord?.photoPaths[0] ?? null,
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
        } else {
          setDraftEssay(null);
        }
      }

      const { data: essayRows } = await supabase
        .from("essays")
        .select("id, title, content, created_at, journey_id, cover_photo_path, selected_payload, generation_count, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const completedEssayRows = (essayRows ?? []).filter(
        (row: any) =>
          row.status === "completed" &&
          String(row.content ?? "").trim().length > 0,
      );

      setEssayJourneyIds(
        new Set(completedEssayRows.map((row: any) => row.journey_id)),
      );

      const parsed: CompletedEssay[] = await Promise.all(
        completedEssayRows.map(async (row: any, idx: number) => {
          const payload = row.selected_payload ?? {};
          let coverImage: string | null = null;

          if (row.cover_photo_path) {
            const { data: signedCover } = await supabase.storage
              .from("essay-covers")
              .createSignedUrl(String(row.cover_photo_path), 3600);

            if (signedCover?.signedUrl) {
              coverImage = signedCover.signedUrl;
            } else {
              const { data: publicCover } = supabase.storage
                .from("essay-covers")
                .getPublicUrl(String(row.cover_photo_path));
              coverImage = publicCover.publicUrl;
            }
          }

          const parsedInsights = Array.isArray(payload.insights)
            ? payload.insights
                .map((item: unknown) => {
                  if (!item || typeof item !== "object") return null;
                  const raw = item as Record<string, unknown>;
                  const keyword = String(raw.keyword ?? "").trim();
                  const description = String(raw.description ?? "").trim();
                  return keyword && description
                    ? { keyword, description }
                    : null;
                })
                .filter((item: EssayInsight | null): item is EssayInsight => item !== null)
            : [];

          const parsedComic =
            normalizeEntertainmentComic(payload.comic);

          return {
            id: String(row.id),
            journeyId: String(row.journey_id),
            title: row.title ?? "제목 없는 에세이",
            content: formatEssayForReadability(row.content),
            journeyGoal: payload.goal ?? undefined,
            dateRangeText: payload.dateRangeText ?? "",
            durationDays: Number(payload.durationDays ?? 7),
            created_at: row.created_at,
            themeIndex: idx % COLORS.bookThemes.length,
            persona: (payload.persona as PersonaType) ?? "emotion_interpreter",
            summary: String(payload.summary ?? ""),
            verdict: String(payload.verdict ?? ""),
            insights: parsedInsights,
            aiRecommendation: String(payload.aiRecommendation ?? ""),
            comic: parsedComic,
            generationCount: Number(row.generation_count ?? 1),
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

  // 여정 기간에 따라 책등 폭을 3단계로 나눈다.
  // 1주 여정 < 2주 여정 < 한 달 여정 순으로 두꺼워진다.
  const getBookSpineWidth = (durationDays: number) => {
    if (durationDays >= 30) return 68;
    if (durationDays >= 14) return 56;
    return 44;
  };

  // 렌더링할 때마다 높이가 바뀌지 않도록 essay id를 이용해
  // 152~178px 범위 안에서 책마다 고정된 높이를 만든다.
  const getStableBookSpineHeight = (essayId: string) => {
    let hash = 0;

    for (let index = 0; index < essayId.length; index += 1) {
      hash = (hash * 31 + essayId.charCodeAt(index)) | 0;
    }

    const MIN_HEIGHT = 152;
    const HEIGHT_RANGE = 27;

    return MIN_HEIGHT + (Math.abs(hash) % HEIGHT_RANGE);
  };

  const getBookSpineTitle = (title: string) => {
    const normalized = String(title ?? "")
    .replace(/\s+/g, " ")
    .trim();
      
    if (normalized.length <= 11) {
      return normalized;
    }
      
    return `${normalized.slice(0, 11)}…`;
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
    if (!draftEssay) {
      Alert.alert("에세이 준비 실패", "집필할 여정 정보를 불러오지 못했습니다.");
      return;
    }

    if (rawRecords.length === 0) {
      Alert.alert("에세이 준비 실패", "에세이에 담을 기록이 없습니다.");
      return;
    }

    setGenerating(true);
    setDraftEssay((previous) =>
      previous ? { ...previous, persona } : previous,
    );

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("로그인이 필요합니다.");

      const accessToken = await getFreshAccessToken();
      const records = rawRecords.map((record) => {
        const content = record.content.trim();
        const missionDescription = record.missionDescription.trim();
        const fallbackContent = [
          missionDescription,
          record.emotion ? `기록 당시 감정: ${getEmotionLabel(record.emotion)}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        return {
          missionTitle: record.missionTitle,
          missionDescription: record.missionDescription,
          category: record.category,
          recordedAt: record.recordedAt,
          userContent:
            content ||
            fallbackContent ||
            `${record.missionTitle} 미션을 완료한 기록입니다.`,
          emotion: getEmotionLabel(record.emotion) || null,
          placeName: null,
          photoUrls: record.photoUrls,
        };
      });

      const { data, error } =
        await supabase.functions.invoke<Record<string, unknown>>(
          ESSAY_FUNCTION_NAME,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: {
              persona,
              nickname: user.user_metadata?.nickname ?? "사용자",
              journeyTitle: draftEssay.journeyTitle,
              durationDays: draftEssay.durationDays,
              records,
            },
          },
        );

      if (error) {
        throw new Error(await getFunctionInvokeErrorMessage(error));
      }

      if (!data) {
        throw new Error("AI 생성 결과가 없습니다.");
      }

      if (typeof data.error === "string" && data.error.trim()) {
        throw new Error(data.error);
      }

      const result = data as {
        title?: unknown;
        content?: unknown;
        summary?: unknown;
        verdict?: unknown;
        insights?: unknown;
        aiRecommendation?: unknown;
        comic?: unknown;
      };
      const title = String(result.title ?? "").trim();
      const content = formatEssayForReadability(result.content);

      if (!title || !content) {
        throw new Error("AI가 에세이 제목이나 본문을 반환하지 않았습니다.");
      }

      const insights = Array.isArray(result.insights)
        ? result.insights
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const raw = item as Record<string, unknown>;
              const keyword = String(raw.keyword ?? "").trim();
              const description = String(raw.description ?? "").trim();
              return keyword && description
                ? { keyword, description }
                : null;
            })
            .filter((item): item is EssayInsight => item !== null)
        : [];
      const normalizedComic =
        normalizeEntertainmentComic(result.comic);

      setDraftEssay((previous) =>
        previous
          ? {
              ...previous,
              persona,
              title,
              content,
              summary: String(result.summary ?? "").trim(),
              verdict: String(result.verdict ?? "").trim(),
              insights,
              aiRecommendation: String(
                result.aiRecommendation ?? "",
              ).trim(),
              comic: normalizedComic,
            }
          : previous,
      );
    } catch (error) {
      console.error("에세이 생성 실패 상세:", error);
      Alert.alert(
        "에세이 생성 실패",
        getErrorMessage(error, "잠시 후 다시 시도해주세요."),
      );
    } finally {
      setGenerating(false);
    }
  };

  const closePersonaPicker = () => {
    if (generating) return;
    setPersonaPickerVisible(false);
    setPersonaPickerMode(null);
  };

  const openWriter = () => {
    if (!draftEssay) {
      Alert.alert("에세이 준비 실패", "목표 기록 수를 채운 여정 정보를 불러오지 못했습니다.");
      return;
    }

    if (rawRecords.length === 0) {
      Alert.alert("에세이 준비 실패", "에세이에 담을 기록이 없습니다.");
      return;
    }

    setPersonaPickerMode("start");
    setPersonaPickerVisible(true);
  };

  const closeWriter = () => {
    if (finishing) return;
    setPersonaPickerVisible(false);
    setPersonaPickerMode(null);
    setPersonaWriterModalVisible(false);
  };

  const handleSelectPersona = async (persona: PersonaType) => {
    if (generating) return;

    const mode = personaPickerMode;
    setPersonaPickerVisible(false);
    setPersonaPickerMode(null);

    if (mode === "start") {
      setPersonaWriterModalVisible(true);
    }

    await generateEssay(persona);
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

      const { data: signedCover } = await supabase.storage
        .from("essay-covers")
        .createSignedUrl(path, 3600);
      const fallbackPublicUrl = supabase.storage
        .from("essay-covers")
        .getPublicUrl(path).data.publicUrl;

      setDraftEssay({
        ...draftEssay,
        coverImage: signedCover?.signedUrl ?? fallbackPublicUrl,
        coverSourcePath: null,
      });
    } catch (error) {
      Alert.alert("사진 저장 실패", error instanceof Error ? error.message : "");
    } finally {
      setSavingCover(false);
    }
  };

  const handleRemoveCoverPhoto = () => {
    if (!draftEssay) return;
    setDraftEssay({
      ...draftEssay,
      coverImage: null,
      coverSourcePath: null,
    });
  };

  const resolveEssayCoverPath = async (userId: string) => {
    if (!draftEssay?.coverImage) return null;

    const existingEssayCoverPath =
      draftEssay.coverImage.split("/essay-covers/")[1]?.split("?")[0] ?? null;
    if (existingEssayCoverPath) return decodeURIComponent(existingEssayCoverPath);

    if (!draftEssay.coverSourcePath) return null;

    const response = await fetch(draftEssay.coverImage);
    if (!response.ok) {
      throw new Error("기록 사진을 에세이 표지로 불러오지 못했습니다.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const extension =
      draftEssay.coverSourcePath.split(".").pop()?.toLowerCase() || "jpg";
    const safeExtension = extension === "jpeg" ? "jpg" : extension;
    const path = `${userId}/${journey?.id ?? "journey"}-${Date.now()}.${safeExtension}`;
    const contentType = safeExtension === "jpg"
      ? "image/jpeg"
      : `image/${safeExtension}`;

    const { error } = await supabase.storage
      .from("essay-covers")
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) throw error;
    return path;
  };

  // 🚀 에세이 집필 완료 → 실제 DB 저장
  // 실제 에세이 저장 처리
const executeFinishWritingEssay = async () => {
  if (!draftEssay || !journey || finishing) {
    return;
  }

  setFinishing(true);

  try {
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

    const coverPath =
      await resolveEssayCoverPath(user.id);

    const selectedPayload = {
      persona: draftEssay.persona,
      summary: draftEssay.summary,
      verdict: draftEssay.verdict,
      insights: draftEssay.insights,
      aiRecommendation:
        draftEssay.aiRecommendation,
      comic: draftEssay.comic,
      goal: draftEssay.goal ?? null,
      dateRangeText:
        draftEssay.dateRangeText,
      durationDays:
        draftEssay.durationDays,
      sourcePhotoCount:
        draftEssay.records.reduce(
          (count, record) =>
            count + record.photoUrls.length,
          0,
        ),
    };

    const {
      data: insertedEssay,
      error: insertError,
    } = await supabase
      .from("essays")
      .insert({
        user_id: user.id,
        journey_id: journey.id,
        title: draftEssay.title.trim(),
        content: draftEssay.content.trim(),
        cover_photo_path: coverPath,
        visibility: "private",
        status: "completed",
        essay_type: "taste_report",
        generation_count: 1,
        selected_version_no: 1,
        generation_state: "idle",
        published_at: null,
        selected_payload: selectedPayload,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    if (!insertedEssay) {
      throw new Error(
        "저장된 에세이 정보를 확인하지 못했습니다.",
      );
    }

    const { error: essayItemsError } =
      await supabase
        .from("essay_items")
        .insert(
          draftEssay.records.map(
            (record, index) => ({
              essay_id: insertedEssay.id,
              record_id: record.id,
              sort_order: index,
              ai_bridge_text: "",
            }),
          ),
        );

    if (essayItemsError) {
      await supabase
        .from("essays")
        .delete()
        .eq("id", insertedEssay.id);

      throw new Error(
        `에세이와 원본 기록을 연결하지 못했습니다: ${essayItemsError.message}`,
      );
    }

    const {
      error: journeyCompleteError,
    } = await supabase.rpc(
      "complete_journey_after_essay",
      {
        p_journey_id: journey.id,
        p_essay_id: insertedEssay.id,
      },
    );

    if (journeyCompleteError) {
      throw new Error(
        `에세이는 저장됐지만 여정 종료에 실패했습니다: ${journeyCompleteError.message}`,
      );
    }

    setPersonaWriterModalVisible(false);
    setPersonaPickerVisible(false);
    setPersonaPickerMode(null);
    setDraftEssay(null);

    await loadData();

    if (Platform.OS === "web") {
      window.alert(
        "집필이 완료되었습니다!\n선택한 분석 결과가 서재에 저장되고 여정이 종료됐습니다.",
      );
    } else {
      Alert.alert(
        "집필 완료!",
        "선택한 분석 결과가 서재에 저장되고 여정이 종료됐습니다. 📚",
      );
    }
  } catch (error) {
    const message = getErrorMessage(
      error,
      "에세이를 저장하지 못했습니다.",
    );

    console.error(
      "에세이 저장 실패 상세:",
      error,
    );

    if (Platform.OS === "web") {
      window.alert(`저장 실패\n${message}`);
    } else {
      Alert.alert("저장 실패", message);
    }
  } finally {
    setFinishing(false);
  }
};

// 집필 완료 버튼 클릭 처리
const handleFinishWritingEssay = () => {
  if (!draftEssay || !journey) {
    return;
  }

  if (
    !draftEssay.title.trim() ||
    !draftEssay.content.trim()
  ) {
    const message =
      "먼저 AI 역할을 선택해 분석 글을 생성해주세요.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert(
        "아직 완성되지 않았어요",
        message,
      );
    }

    return;
  }

  const confirmMessage =
    "책장에 꽂은 뒤에는 같은 여정으로 다시 만들 수 없습니다.\n현재 분석 결과로 완료하시겠습니까?";

  if (Platform.OS === "web") {
    const confirmed =
      window.confirm(confirmMessage);

    if (confirmed) {
      void executeFinishWritingEssay();
    }

    return;
  }

  Alert.alert(
    "에세이 집필 완료",
    confirmMessage,
    [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "완료하기",
        onPress: () => {
          void executeFinishWritingEssay();
        },
      },
    ],
  );
};

  const shareEssayAsText = async (essay: CompletedEssay) => {
    await Share.share({
      title: essay.title,
      message: `📖 [오롯이 에세이] ${essay.title}\n🎯 목표: ${essay.journeyGoal ?? "목표 달성"}\n🗓️ 기간: ${essay.dateRangeText}\n\n${essay.content}\n\n- 오롯이(Orosi) 서재에서 작성됨`,
    });
  };

  const handleShareEssay = async (essay: CompletedEssay) => {
    if (sharingEssayId) return;

    setSharingEssayId(essay.id);

    try {
      // 4컷이 없는 일반 에세이는 기존처럼 텍스트로 공유한다.
      if (!essay.comic) {
        await shareEssayAsText(essay);
        return;
      }

      // 웹에서는 로컬 임시 이미지 파일 공유가 제한되므로 텍스트 공유로 대체한다.
      if (Platform.OS === "web") {
        await shareEssayAsText(essay);
        return;
      }

      if (!sharedComicRef.current) {
        throw new Error("공유할 4컷 만화 화면을 찾지 못했습니다.");
      }

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        await shareEssayAsText(essay);
        return;
      }

      // 글꼴과 로컬 캐릭터 이미지가 화면에 완전히 반영된 뒤 캡처한다.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 80);
      });

      const imageUri = await captureRef(sharedComicRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      await Sharing.shareAsync(imageUri, {
        dialogTitle: `${essay.title} 4컷 만화 공유`,
        mimeType: "image/png",
        UTI: "public.png",
      });
    } catch (error) {
      console.error("4컷 만화 이미지 공유 실패:", error);
      Alert.alert(
        "공유 실패",
        getErrorMessage(
          error,
          "4컷 만화를 이미지로 만드는 중 오류가 발생했습니다.",
        ),
      );
    } finally {
      setSharingEssayId(null);
    }
  };

  const targetCount = journey?.target_record_count ?? 4;
  const progressPercent = Math.min(Math.round((completedDayCount / targetCount) * 100), 100);

  const hasEssayForJourney = journey ? essayJourneyIds.has(journey.id) : false;
  const hasReachedEssayTarget =
    Boolean(journey) && targetCount > 0 && completedDayCount >= targetCount;
  const isPendingEssay = hasReachedEssayTarget && !hasEssayForJourney;
  const isFinished = hasEssayForJourney;
  const isJourneyActive = journey?.status === "active" && !hasReachedEssayTarget;

  const renderPersonaPickerCard = () => (
    <View style={styles.personaPopupCard}>
      <View style={styles.personaPopupHeader}>
        <View style={styles.personaPopupHeaderText}>
          <Text style={styles.personaPopupTitle}>
            {personaPickerMode === "start"
              ? "내 기록을 누구에게 맡길까요?"
              : "이번에는 누가 다시 분석할까요?"}
          </Text>
          <Text style={styles.personaPopupSub}>
            같은 기록도 AI의 관점에 따라 서로 다른 성향 분석이 나와요.
          </Text>
        </View>
        <Pressable onPress={closePersonaPicker} hitSlop={10} disabled={generating}>
          <Ionicons name="close" size={22} color={COLORS.textMain} />
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <Pressable
          style={styles.personaSelectItem}
          onPress={() => void handleSelectPersona("emotion_interpreter")}
        >
          <View style={styles.personaIconCircle}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personaSelectTitle}>감정 통역사</Text>
            <Text style={styles.personaSelectSub}>감정이 편안해지거나 움츠러드는 조건을 분석해요.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>

        <Pressable
          style={styles.personaSelectItem}
          onPress={() => void handleSelectPersona("strict_teacher")}
        >
          <View style={styles.personaIconCircle}>
            <Ionicons name="school-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personaSelectTitle}>팩트 폭격 담임</Text>
            <Text style={styles.personaSelectSub}>목표와 실제 행동의 차이를 근거로 짚어요.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>

        <Pressable
          style={styles.personaSelectItem}
          onPress={() => void handleSelectPersona("record_detective")}
        >
          <View style={styles.personaIconCircle}>
            <Ionicons name="finger-print-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personaSelectTitle}>기록 탐정</Text>
            <Text style={styles.personaSelectSub}>여러 기록을 연결해 반복되는 선택 패턴을 추리해요.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>

        <Pressable
          style={styles.personaSelectItem}
          onPress={() => void handleSelectPersona("entertainment_pd")}
        >
          <View style={styles.personaIconCircle}>
            <Ionicons name="videocam-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personaSelectTitle}>인생 예능 PD</Text>
            <Text style={styles.personaSelectSub}>행동 성향을 분석하고 웃픈 장면은 4컷으로 편집해요.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* 🌿 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerTextArea}>
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
            <Text style={styles.journeyTitle}>완성된 분석이 서재에 저장됐어요 🌿</Text>
            <Text style={[styles.progressDescription, { marginTop: 6, marginBottom: 16 }]}>
              이 여정의 에세이는 확정됐어요. 새로운 분석은 다음 여정에서 만들 수 있어요.
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
            <Text style={styles.journeyLabel}>🎉 목표 기록 수를 모두 채웠습니다!</Text>
            <Text style={styles.journeyTitle}>에세이 집필하기</Text>
            <Text style={[styles.progressDescription, { marginTop: 4, marginBottom: 14 }]}>
              여정은 아직 진행 중이며, 에세이를 책장에 꽂는 순간 종료돼요. 저장 전에는 다른 AI로 다시 분석할 수 있어요.
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
                      const height = getStableBookSpineHeight(item.id);
                      const theme = COLORS.bookThemes[item.themeIndex];

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setSelectedEssay(item)}
                          style={({ pressed }) => [
                            styles.bookSpine,
                            {
                              width,
                              height,
                              backgroundColor: theme.bg,
                              borderColor: theme.line,
                            },
                            pressed && styles.bookPressed,
                          ]}
                        >
                          <View style={[styles.bookGoldLine, { backgroundColor: theme.line }]} />

                          <View style={styles.rotatedTitleContainer}>
                            <Text 
                              numberOfLines={1} 
                              ellipsizeMode="clip" 
                              style={[
                                styles.rotatedTitleText,
                                { color: theme.text }
                              ]}
                            >
                              {getBookSpineTitle(item.title)}
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
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeWriter}
      >
        <View
          style={[
            styles.writerSafeArea,
            {
              paddingTop: Math.max(insets.top, 18),
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {draftEssay && (
            <>
              <View style={styles.screenHeaderBar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="에세이 편집 화면 닫기"
                  onPress={() => closeWriter()}
                  disabled={finishing}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={({ pressed }) => [
                    styles.backButtonTouch,
                    pressed && styles.backButtonPressed,
                    finishing && styles.backButtonDisabled,
                  ]}
                >
                  <Ionicons name="chevron-back" size={26} color={COLORS.textMain} />
                </Pressable>

                <Text
                  numberOfLines={1}
                  style={styles.screenHeaderTitle}
                >
                  {draftEssay.journeyTitle}
                </Text>

                <View style={styles.screenHeaderSideSpacer} />
              </View>

              <ScrollView
                style={styles.writerScrollView}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.writerScrollContent}
              >
              <View style={styles.editorImageFrame}>
                {draftEssay.coverImage ? (
                  <Image source={{ uri: draftEssay.coverImage }} style={styles.editorCoverImage} />
                ) : (
                  <View style={[styles.editorCoverImage, styles.editorCoverPlaceholder]}>
                    <Ionicons name="image-outline" size={30} color={COLORS.textMuted} />
                    <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 6 }}>
                      기록 사진이 있으면 자동으로 대표 사진이 들어가요
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

              {draftEssay.records.some((record) => record.photoUrls.length > 0) ? (
                <Text style={styles.sourcePhotoNotice}>
                  기록에 담긴 사진 {draftEssay.records.reduce(
                    (count, record) => count + record.photoUrls.length,
                    0,
                  )}장이 에세이 원본 자료에 포함돼요.
                </Text>
              ) : null}

              <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <View style={styles.personaBadgeTag}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.personaBadgeTagText}>{PERSONA_LABEL[draftEssay.persona]}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{draftEssay.dateRangeText}</Text>
                </View>

                <Pressable
                  style={[styles.reAiCard, generating && { opacity: 0.55 }]}
                  disabled={generating}
                  onPress={() => {
                    if (generating) return;
                    setPersonaPickerMode("regenerate");
                    setPersonaPickerVisible(true);
                  }}
                >
                  <View>
                    <Text style={styles.reAiTitle}>다른 AI에게 다시 맡기기</Text>
                    <Text style={styles.reAiSub}>같은 기록을 다른 관점으로 다시 분석해요.</Text>
                  </View>
                  <Ionicons name="swap-horizontal" size={22} color={COLORS.primary} />
                </Pressable>

                {generating ? (
                  <View style={{ alignItems: "center", paddingVertical: 50 }}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={{ marginTop: 12, color: COLORS.textSub, fontSize: 13 }}>
                      AI가 기록을 읽고 성향을 분석하는 중이에요...
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

                    <Text style={styles.inputSectionLabel}>AI 성향 분석 글</Text>
                    <TextInput
                      value={draftEssay.content}
                      onChangeText={(text) => setDraftEssay({ ...draftEssay, content: text })}
                      multiline
                      style={styles.editorBodyInput}
                    />

                    {draftEssay.comic ? (
                      <ComicStrip comic={draftEssay.comic} />
                    ) : null}

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
                              <Text style={styles.recordItemEmotion}>감정: {getEmotionLabel(rec.emotion)}</Text>
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
            </>
          )}

          {personaPickerVisible ? (
            <View style={styles.writerPersonaOverlay}>
              <Pressable
                style={styles.modalBackdrop}
                onPress={closePersonaPicker}
              />
              {renderPersonaPickerCard()}
            </View>
          ) : null}
        </View>
      </Modal>

      {/* 🎭 집필 시작 전 AI 선택 */}
      <Modal
        visible={personaPickerVisible && !writerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePersonaPicker}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closePersonaPicker} />
          {renderPersonaPickerCard()}
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
    <>
      <ScrollView
        style={styles.bookOpenScroll}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        contentContainerStyle={styles.bookOpenContent}
      >
        <View style={styles.bookOpenHeader}>
          <Text style={styles.bookOpenCaption}>
            ✨ 완성된 완결 에세이
          </Text>

          <Pressable
            onPress={() => setSelectedEssay(null)}
            hitSlop={10}
          >
            <Ionicons
              name="close"
              size={22}
              color={COLORS.textSub}
            />
          </Pressable>
        </View>

        {selectedEssay.coverImage ? (
          <Image
            source={{ uri: selectedEssay.coverImage }}
            style={styles.bookOpenCover}
          />
        ) : null}

        <Text
          style={styles.bookOpenTitle}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {selectedEssay.title}
        </Text>

        {selectedEssay.journeyGoal ? (
          <View style={styles.modalGoalBadge}>
            <Text style={styles.modalGoalText}>
              🎯 여정 목표: {selectedEssay.journeyGoal}
            </Text>
          </View>
        ) : null}

        <Text style={styles.bookOpenDate}>
          여정 기간: {selectedEssay.dateRangeText}
          {" "}
          ({selectedEssay.durationDays}일간)
        </Text>

        <View style={styles.divider} />

        {selectedEssay.comic ? (
          <View
            ref={sharedComicRef}
            collapsable={false}
            renderToHardwareTextureAndroid
            style={styles.comicShareCapture}
          >
            <ComicStrip
              comic={selectedEssay.comic}
              compact
            />
          </View>
        ) : null}

        <Text selectable style={styles.bookOpenBody}>
          {selectedEssay.content}
        </Text>
      </ScrollView>

      <View style={styles.bookOpenActions}>
        <View style={styles.saveShareActionRow}>
  <Pressable
    style={[
      styles.publishBtn,
      sharingEssayId === selectedEssay.id &&
        styles.shareButtonDisabled,
    ]}
    onPress={() => void handleShareEssay(selectedEssay)}
    disabled={sharingEssayId === selectedEssay.id}
  >
    {sharingEssayId === selectedEssay.id ? (
      <View style={styles.shareButtonLoadingContent}>
        <ActivityIndicator
          size="small"
          color={COLORS.white}
        />
        <Text style={styles.publishBtnText}>
          이미지 만드는 중
        </Text>
      </View>
    ) : (
      <Text style={styles.publishBtnText}>
        공유하기
      </Text>
    )}
  </Pressable>
</View>

        <Pressable
          style={styles.closeButton}
          onPress={() => setSelectedEssay(null)}
        >
          <Text style={styles.closeButtonText}>
            책 덮기
          </Text>
        </Pressable>
      </View>
    </>
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
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  headerTextArea: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
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
    flexShrink: 1,
    color: COLORS.textSub,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  headerIcon: {
    flexShrink: 0,
    width: 54,
    height: 54,
    marginLeft: 10,
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
  secondaryJourneyButton: {
    marginTop: 10,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
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
  width: 125,
  height: 42,
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

  writerSafeArea: {
    flex: 1,
    backgroundColor: "#F9F7F1",
  },
  writerScrollView: {
    flex: 1,
  },
  writerScrollContent: {
    paddingBottom: 60,
  },
  screenHeaderBar: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#F9F7F1",
    zIndex: 20,
    elevation: 20,
  },
  backButtonTouch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
    elevation: 30,
  },
  backButtonPressed: {
    backgroundColor: COLORS.primaryLight,
    transform: [{ scale: 0.96 }],
  },
  backButtonDisabled: {
    opacity: 0.45,
  },
  screenHeaderTitle: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textMain,
    textAlign: "center",
  },
  screenHeaderSideSpacer: {
    width: 48,
    height: 48,
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
  sourcePhotoNotice: {
    marginTop: 8,
    paddingHorizontal: 20,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textMuted,
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
    minHeight: 240,
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    fontSize: 15,
    lineHeight: 25,
    color: COLORS.textMain,
    textAlignVertical: "top",
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

  comicStrip: {
    width: "100%",
    aspectRatio: 4 / 5,
    marginBottom: 18,
    padding: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#D8D0C2",
    borderRadius: 16,
    backgroundColor: "#FFFDF8",
  },
  comicStripCompact: {
    marginTop: 0,
    marginBottom: 0,
    padding: 10,
  },
  comicStripHeader: {
    minHeight: 38,
    marginBottom: 7,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  comicStripTitle: {
    color: COLORS.textMain,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  comicGrid: {
    flex: 1,
    minHeight: 0,
    flexDirection: "column",
    gap: 6,
  },
  comicRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    gap: 6,
  },
  comicPanel: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#26372E",
    borderRadius: 8,
  },
  comicPanelBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.42,
  },
  comicPanelTopRow: {
    zIndex: 2,
    paddingHorizontal: 5,
    paddingTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  comicPanelNumber: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#26372E",
  },
  comicPanelNumberText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  comicPanelScene: {
    color: "#26372E",
    fontSize: 7.5,
    fontWeight: "800",
  },
  comicDialogueBubble: {
    position: "absolute",
    top: 23,
    left: 7,
    right: 7,
    zIndex: 6,
    minHeight: 24,
    maxHeight: 35,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.1,
    borderColor: "#26372E",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  comicDialogueText: {
    color: "#26372E",
    fontSize: 7.4,
    lineHeight: 9.3,
    fontWeight: "800",
    textAlign: "center",
  },
  comicDialogueTail: {
    position: "absolute",
    left: "47%",
    bottom: -4,
    width: 7,
    height: 7,
    borderRightWidth: 1.1,
    borderBottomWidth: 1.1,
    borderColor: "#26372E",
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
  comicScene: {
    zIndex: 2,
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 0,
  },
  comicEffectText: {
    position: "absolute",
    right: 6,
    top: 7,
    zIndex: 5,
    color: "#E07A5F",
    fontSize: 12,
    fontWeight: "900",
  },
  comicCharacterPositioner: {
    transform: [{ translateY: 10 }],
  },
  comicCharacterPositionerThird: {
    transform: [{ translateY: -4 }],
  },
  comicCharacterImage: {
    width: 82,
    height: 88,
  },
  comicCaptionBar: {
    zIndex: 3,
    minHeight: 24,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#26372E",
  },
  comicCaptionText: {
    color: "#FFFFFF",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    textAlign: "center",
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
  writerPersonaOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(38, 55, 46, 0.55)",
  },
  personaPopupCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FBF9F3",
    borderRadius: 22,
    padding: 20,
  },
  personaPopupHeader: {
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  personaPopupHeaderText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
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
  maxWidth: 520,
  height: "88%",
  maxHeight: 820,
  backgroundColor: "#FBF9F3",
  borderRadius: 22,
  borderWidth: 2,
  borderColor: COLORS.border,
  overflow: "hidden",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.25,
  shadowRadius: 15,
  elevation: 12,
},
  bookOpenContent: {
  paddingHorizontal: 22,
  paddingTop: 22,
  paddingBottom: 30,
},
bookOpenActions: {
  flexShrink: 0,
  paddingHorizontal: 22,
  paddingTop: 14,
  paddingBottom: 18,
  borderTopWidth: 1,
  borderTopColor: COLORS.border,
  backgroundColor: "#FBF9F3",
},
bookOpenCover: {
  width: "100%",
  height: 170,
  borderRadius: 14,
  marginBottom: 14,
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
  lineHeight: 29,
  fontWeight: "800",
  color: COLORS.textMain,
  marginBottom: 8,
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
  lineHeight: 28,
  color: COLORS.textMain,
},
bookOpenScroll: {
  flex: 1,
  minHeight: 0,
},
  comicShareCapture: {
    width: "100%",
    aspectRatio: 4 / 5,
    marginBottom: 14,
    backgroundColor: "#FFFDF8",
  },
  shareButtonDisabled: {
    opacity: 0.68,
  },
  shareButtonLoadingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  saveShareActionRow: {
  flexDirection: "row",
  gap: 12,
  marginBottom: 10,
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