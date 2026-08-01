import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

import { supabase } from "../../lib/supabase";
import {
  createEssayDraft,
  EssayDashboardData,
  EssayDetail,
  EssayGenerationMeta,
  EssayKind,
  EssayRecord,
  EssayStyle,
  EssaySummary,
  EssayVersionNo,
  generateEssayVersion,
  getBookWidthByDuration,
  getEssayById,
  getEssayDashboardData,
  getStableBookHeight,
  PostcardFormat,
  publishEssay,
  saveEssayDraft,
  selectEssayVersion,
} from "../../services/essay.service";

const COLORS = {
  primary: "#3D5AFE",
  primaryLight: "#EEF1FF",
  textMain: "#0F0F0F",
  textSub: "#5C5F6A",
  textMuted: "#9EA3AE",
  border: "#E4E6EA",
  background: "#F7F8FA",
  white: "#FFFFFF",
  shelfBackground: "#F0EAE0",
  shelf: "#A89070",
  wall: "#E8E2D8",
  green: "#10B981",
  greenLight: "#ECFDF5",
  pink: "#EC4899",
  pinkLight: "#FCE7F3",
};

const BOOK_COLORS = [
  "#1E3A5F",
  "#2D5A4A",
  "#5C3D2E",
  "#3B4A6B",
  "#60435F",
  "#7A4A35",
];


const EMOTION_LABELS: Record<string, string> = {
  comfortable: "😌 편안해요",
  joyful: "😊 즐거워요",
  new: "✨ 새로워요",
  uncomfortable: "😣 불편해요",
  unsure: "🤔 잘 모르겠어요",
};

const ESSAY_STYLE_OPTIONS: Array<{
  value: EssayStyle;
  title: string;
  description: string;
}> = [
  {
    value: "plain",
    title: "더 담백하게",
    description: "과장 없이 기록과 사실을 중심으로 차분하게 정리해요.",
  },
  {
    value: "balanced",
    title: "기본 균형",
    description: "기록의 흐름과 감정을 자연스럽고 균형 있게 담아요.",
  },
  {
    value: "emotional",
    title: "조금 더 감성적으로",
    description: "기록 속 감정과 분위기를 조금 더 선명하게 표현해요.",
  },
];

type DetailMode = "view" | "edit" | "versions";

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

    if (message) return message;
  }

  return fallback;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) {
  return `${formatShortDate(startDate)} – ${formatShortDate(
    endDate ?? startDate,
  )}`;
}

function getYear(value: string | null | undefined) {
  if (!value) return String(new Date().getFullYear());

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 4)
    : String(date.getFullYear());
}


function getDisplayNickname(value: string | null | undefined) {
  const nickname = String(value ?? "").trim().replace(/님$/u, "");
  return nickname || "나";
}

function getWeekLabel(durationDays: number) {
  return `${Math.max(1, Math.ceil(durationDays / 7))}주`;
}

function personalizeTasteReportTitle(
  title: string,
  nickname: string,
  durationDays: number,
) {
  const displayNickname = getDisplayNickname(nickname);
  const fallbackTitle =
    `AI가 분석한 ${displayNickname}님의 ${getWeekLabel(durationDays)}`;
  const normalizedTitle = String(title ?? "").trim();

  if (!normalizedTitle) return fallbackTitle;

  const replaced = normalizedTitle
    .replace(/\[?\s*닉네임\s*\]?\s*님?/gu, `${displayNickname}님`)
    .replace(/(?:사용자|유저)\s*님/gu, `${displayNickname}님`)
    .replace(/AI가 분석한\s+나의\s+(\d+주)/gu, `AI가 분석한 ${displayNickname}님의 $1`)
    .replace(/님님/gu, "님");

  return replaced || fallbackTitle;
}

function formatEssayParagraphs(value: string) {
  const normalized = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!normalized) return "";

  const existingParagraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter(Boolean);

  if (existingParagraphs.length > 1) {
    return existingParagraphs.join("\n\n");
  }

  const sentences = normalized
    .replace(/\n+/g, " ")
    .match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];

  if (sentences.length <= 1) return normalized;

  return sentences.join("\n\n");
}

function prepareEssaySummaryForDisplay(
  essay: EssaySummary,
  nickname: string,
): EssaySummary {
  if (essay.kind !== "taste_report") return essay;

  return {
    ...essay,
    title: personalizeTasteReportTitle(
      essay.title,
      nickname,
      essay.durationDays,
    ),
    content: formatEssayParagraphs(essay.content),
  };
}

function prepareEssayDetailForDisplay(detail: EssayDetail): EssayDetail {
  return {
    ...detail,
    title:
      detail.kind === "taste_report"
        ? personalizeTasteReportTitle(
            detail.title,
            detail.nickname,
            detail.durationDays,
          )
        : detail.title,
    content:
      detail.kind === "taste_report"
        ? formatEssayParagraphs(detail.content)
        : detail.content,
    versions: detail.versions.map((version) =>
      version.kind === "taste_report"
        ? {
            ...version,
            title: personalizeTasteReportTitle(
              version.title,
              detail.nickname,
              detail.durationDays,
            ),
            content: formatEssayParagraphs(version.content),
          }
        : version,
    ),
  };
}

function prepareDashboardForDisplay(
  data: EssayDashboardData,
): EssayDashboardData {
  return {
    ...data,
    essays: data.essays.map((essay) =>
      prepareEssaySummaryForDisplay(essay, data.nickname)
    ),
  };
}

function CoverVisual({
  uri,
  height,
  compact = false,
}: {
  uri: string | null;
  height: number;
  compact?: boolean;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={[styles.coverImage, { height }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.coverPlaceholder,
        { height },
        compact && styles.coverPlaceholderCompact,
      ]}
    >
      <Ionicons
        name="book-outline"
        size={compact ? 20 : 34}
        color={COLORS.primary}
      />
      {!compact ? (
        <Text style={styles.coverPlaceholderText}>
          이 여정에는 대표 사진이 없어요
        </Text>
      ) : null}
    </View>
  );
}


function getEssayKindLabel(kind: EssayKind) {
  return kind === "postcard" ? "SNS 공유용 엽서" : "AI 취향 리포트";
}

function getPostcardFormatLabel(format: PostcardFormat | null) {
  return format === "square" ? "게시물 1:1" : "스토리 9:16";
}

function PhotoCollage({
  photoUrls,
  compact = false,
}: {
  photoUrls: string[];
  compact?: boolean;
}) {
  const photos = photoUrls.slice(0, 4);

  if (photos.length === 0) {
    return (
      <View style={[styles.collageEmpty, compact && styles.collageEmptyCompact]}>
        <Ionicons
          name="images-outline"
          size={compact ? 24 : 34}
          color={COLORS.textMuted}
        />
        <Text style={styles.collageEmptyText}>이 여정에는 사진이 없어요</Text>
      </View>
    );
  }

  if (photos.length === 1) {
    return (
      <Image
        source={{ uri: photos[0] }}
        resizeMode="cover"
        style={styles.collageSingleImage}
      />
    );
  }

  if (photos.length === 2) {
    return (
      <View style={styles.collageRow}>
        {photos.map((url, index) => (
          <Image
            key={`${url}-${index}`}
            source={{ uri: url }}
            resizeMode="cover"
            style={[
              styles.collageHalfImage,
              index === 0 && styles.collageImageGapRight,
            ]}
          />
        ))}
      </View>
    );
  }

  if (photos.length === 3) {
    return (
      <View style={styles.collageRow}>
        <Image
          source={{ uri: photos[0] }}
          resizeMode="cover"
          style={[styles.collageHalfImage, styles.collageImageGapRight]}
        />
        <View style={styles.collageColumn}>
          <Image
            source={{ uri: photos[1] }}
            resizeMode="cover"
            style={[styles.collageQuarterImage, styles.collageImageGapBottom]}
          />
          <Image
            source={{ uri: photos[2] }}
            resizeMode="cover"
            style={styles.collageQuarterImage}
          />
        </View>
      </View>
    );
  }

  const remainingCount = Math.max(photoUrls.length - 4, 0);

  return (
    <View style={styles.collageGrid}>
      {[0, 1].map((row) => (
        <View key={`row-${row}`} style={styles.collageGridRow}>
          {[0, 1].map((column) => {
            const photoIndex = row * 2 + column;
            const url = photos[photoIndex];

            return (
              <View
                key={`${url}-${photoIndex}`}
                style={[
                  styles.collageGridCell,
                  column === 0 && styles.collageImageGapRight,
                  row === 0 && styles.collageImageGapBottom,
                ]}
              >
                <Image
                  source={{ uri: url }}
                  resizeMode="cover"
                  style={styles.collageGridImage}
                />
                {photoIndex === 3 && remainingCount > 0 ? (
                  <View style={styles.collageMoreOverlay}>
                    <Text style={styles.collageMoreText}>+{remainingCount}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function PostcardCanvas({
  title,
  content,
  meta,
  photoUrls,
  journeyTitle,
  format,
}: {
  title: string;
  content: string;
  meta: EssayGenerationMeta;
  photoUrls: string[];
  journeyTitle: string;
  format: PostcardFormat | null;
}) {
  const actualFormat = format ?? "story";

  return (
    <View
      style={[
        styles.postcardCanvas,
        {
          aspectRatio: actualFormat === "square" ? 1 : 9 / 16,
          backgroundColor: meta.themeColor,
        },
      ]}
    >
      <View style={styles.postcardPhotoArea}>
        <PhotoCollage photoUrls={photoUrls} compact />
      </View>

      <View style={styles.postcardTextArea}>
        <View
          style={[
            styles.postcardAccentLine,
            { backgroundColor: meta.accentColor },
          ]}
        />
        <Text style={styles.postcardJourneyLabel}>{journeyTitle}</Text>
        <Text style={styles.postcardTitle}>{title}</Text>
        <Text style={styles.postcardBody}>{content}</Text>
        {meta.hashtags.length > 0 ? (
          <Text style={[styles.postcardHashtags, { color: meta.accentColor }]}>
            {meta.hashtags.join("  ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function TasteReportPreview({
  title,
  content,
  meta,
  photoUrls,
  nickname,
  period,
  compact = false,
}: {
  title: string;
  content: string;
  meta: EssayGenerationMeta;
  photoUrls: string[];
  nickname: string;
  period: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.reportCard, compact && styles.reportCardCompact]}>
      <View style={compact ? styles.reportPhotosCompact : styles.reportPhotos}>
        <PhotoCollage photoUrls={photoUrls} compact={compact} />
      </View>

      <View style={styles.reportContent}>
        <Text style={styles.reportEyebrow}>AI TASTE REPORT</Text>
        <Text style={[styles.reportTitle, compact && styles.reportTitleCompact]}>
          {title}
        </Text>
        <Text style={styles.reportByline}>{nickname} · {period}</Text>
        <Text style={[styles.reportBody, compact && styles.reportBodyCompact]}>
          {content}
        </Text>

        {meta.insights.length > 0 ? (
          <View style={styles.insightList}>
            {meta.insights.map((insight, index) => (
              <View key={`${insight.keyword}-${index}`} style={styles.insightItem}>
                <Text style={styles.insightKeyword}>{insight.keyword}</Text>
                <Text style={styles.insightDescription}>{insight.description}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function EssayScreen() {
  const [dashboard, setDashboard] =
    useState<EssayDashboardData | null>(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  const [selectedEssay, setSelectedEssay] =
    useState<EssayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [activeVersionNo, setActiveVersionNo] = useState<EssayVersionNo>(1);

  const [versionGenerating, setVersionGenerating] = useState(false);
  const [regenerateModalVisible, setRegenerateModalVisible] = useState(false);
  const [versionSelecting, setVersionSelecting] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [recordDetail, setRecordDetail] =
    useState<EssayRecord | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedEssayKind, setSelectedEssayKind] =
    useState<EssayKind>("taste_report");
  const [selectedPostcardFormat, setSelectedPostcardFormat] =
    useState<PostcardFormat>("story");
  const [selectedEssayStyle, setSelectedEssayStyle] =
    useState<EssayStyle>("balanced");
  const postcardShotRef = useRef<ViewShot | null>(null);

  const loadDashboard = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setScreenLoading(true);
      const data = await withJwtRetry(() => getEssayDashboardData());
      setDashboard(prepareDashboardForDisplay(data));
    } catch (error) {
      const details = error as {
        code?: unknown;
        message?: unknown;
        details?: unknown;
        hint?: unknown;
      };

      console.error("에세이 불러오기 실패:", {
        code: details?.code,
        message: details?.message,
        details: details?.details,
        hint: details?.hint,
      });

      Alert.alert(
        "에세이 불러오기 실패",
        getErrorMessage(error, "에세이 정보를 불러오지 못했습니다."),
      );
    } finally {
      if (showLoading) setScreenLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const openEssay = async (summary: EssaySummary | string) => {
    try {
      setDetailLoading(true);
      const essayId = typeof summary === "string" ? summary : summary.id;
      const rawDetail = await withJwtRetry(() => getEssayById(essayId));
      const detail = prepareEssayDetailForDisplay(rawDetail);
      setSelectedEssay(detail);
      setActiveVersionNo(detail.versions[0]?.versionNo ?? 1);
      setDetailMode(
        detail.selectedVersionNo === null ? "versions" : "view",
      );
      setEditTitle(detail.title);
      setEditContent(detail.content);
    } catch (error) {
      Alert.alert(
        "에세이 열기 실패",
        getErrorMessage(error, "에세이 내용을 불러오지 못했습니다."),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const reloadSelectedEssay = async (
    preferredVersionNo?: EssayVersionNo,
  ) => {
    if (!selectedEssay) return;
    const rawDetail = await withJwtRetry(() => getEssayById(selectedEssay.id));
    const detail = prepareEssayDetailForDisplay(rawDetail);
    setSelectedEssay(detail);
    setEditTitle(detail.title);
    setEditContent(detail.content);
    setActiveVersionNo(
      preferredVersionNo ?? detail.versions[0]?.versionNo ?? 1,
    );
    setDetailMode(
      detail.selectedVersionNo === null ? "versions" : "view",
    );
  };

  const closeEssay = () => {
    if (detailMode === "edit") {
      const isDirty =
        editTitle.trim() !== selectedEssay?.title.trim() ||
        editContent.trim() !== selectedEssay?.content.trim();

      if (isDirty) {
        Alert.alert(
          "수정 내용을 저장할까요?",
          "저장하지 않고 나가면 수정한 내용이 사라져요.",
          [
            { text: "계속 편집", style: "cancel" },
            {
              text: "저장하지 않고 나가기",
              style: "destructive",
              onPress: () => {
                setSelectedEssay(null);
                setDetailMode("view");
              },
            },
          ],
        );
        return;
      }
    }

    setSelectedEssay(null);
    setDetailMode("view");
    setRecordDetail(null);
  };

  const handleCreateEssay = () => {
    const journey = dashboard?.journey;

    if (!journey?.canCreateEssay || createLoading) return;
    setSelectedEssayKind("taste_report");
    setSelectedPostcardFormat("story");
    setCreateModalVisible(true);
  };

  const handleConfirmCreateEssay = async () => {
    const journey = dashboard?.journey;

    if (!journey?.canCreateEssay || createLoading) return;

    try {
      setCreateLoading(true);
      setCreateModalVisible(false);
      const essayId = await withJwtRetry(() =>
        createEssayDraft(journey.id, {
          kind: selectedEssayKind,
          postcardFormat:
            selectedEssayKind === "postcard"
              ? selectedPostcardFormat
              : null,
        }),
      );
      await loadDashboard(false);
      await openEssay(essayId);
    } catch (error) {
      Alert.alert(
        "에세이 생성 실패",
        getErrorMessage(error, "AI 에세이를 생성하지 못했습니다."),
      );
      await loadDashboard(false);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRetryFirstVersion = async () => {
    if (!selectedEssay || versionGenerating) return;

    try {
      setVersionGenerating(true);
      const generated = await withJwtRetry(() =>
        generateEssayVersion(selectedEssay.id, {
          kind: selectedEssay.kind,
          postcardFormat: selectedEssay.postcardFormat,
        }),
      );
      await reloadSelectedEssay(generated.versionNo);
      await loadDashboard(false);
    } catch (error) {
      Alert.alert(
        "AI 에세이 생성 실패",
        getErrorMessage(error, "버전 1을 만들지 못했습니다."),
      );
    } finally {
      setVersionGenerating(false);
    }
  };

  const openRegenerateModal = () => {
    if (!selectedEssay || versionGenerating) return;

    const currentVersion = selectedEssay.versions.find(
      (version) => version.versionNo === activeVersionNo,
    );

    setSelectedEssayKind(
      currentVersion?.kind ?? selectedEssay.kind,
    );
    setSelectedPostcardFormat(
      currentVersion?.postcardFormat ??
        selectedEssay.postcardFormat ??
        "story",
    );
    setSelectedEssayStyle(currentVersion?.style ?? "balanced");
    setRegenerateModalVisible(true);
  };

  const handleGenerateNextVersion = async () => {
    if (!selectedEssay || versionGenerating) return;

    try {
      setRegenerateModalVisible(false);
      setVersionGenerating(true);
      const generated = await withJwtRetry(() =>
        generateEssayVersion(selectedEssay.id, {
          kind: selectedEssayKind,
          postcardFormat:
            selectedEssayKind === "postcard"
              ? selectedPostcardFormat
              : null,
          style: selectedEssayStyle,
        }),
      );
      await reloadSelectedEssay(generated.versionNo);
      await loadDashboard(false);
    } catch (error) {
      Alert.alert(
        "AI로 다시 만들기 실패",
        getErrorMessage(error, "새 버전을 만들지 못했습니다."),
      );
    } finally {
      setVersionGenerating(false);
    }
  };

  const handleSelectVersion = (versionNo: EssayVersionNo) => {
    if (!selectedEssay || versionSelecting) return;

    Alert.alert(
      `버전 ${versionNo}을 선택할까요?`,
      "이 버전을 최종 초안으로 채택하고 제목과 내용을 직접 다듬을 수 있어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "선택하고 편집하기",
          onPress: async () => {
            try {
              setVersionSelecting(true);
              await withJwtRetry(() => selectEssayVersion(selectedEssay.id, versionNo));
              const rawDetail = await withJwtRetry(() => getEssayById(selectedEssay.id));
              const detail = prepareEssayDetailForDisplay(rawDetail);
              setSelectedEssay(detail);
              setEditTitle(detail.title);
              setEditContent(detail.content);
              setDetailMode("edit");
              await loadDashboard(false);
            } catch (error) {
              Alert.alert(
                "버전 선택 실패",
                getErrorMessage(error, "버전을 선택하지 못했습니다."),
              );
            } finally {
              setVersionSelecting(false);
            }
          },
        },
      ],
    );
  };

  const enterEditMode = () => {
    if (!selectedEssay?.isOwner) return;
    setEditTitle(selectedEssay.title);
    setEditContent(selectedEssay.content);
    setDetailMode("edit");
  };

  const handleSaveDraft = async () => {
    if (!selectedEssay || editSaving) return;

    try {
      setEditSaving(true);
      await withJwtRetry(() => saveEssayDraft(selectedEssay.id, {
        title: editTitle,
        content: editContent,
      }));
      const rawDetail = await withJwtRetry(() => getEssayById(selectedEssay.id));
      const detail = prepareEssayDetailForDisplay(rawDetail);
      setSelectedEssay(detail);
      setEditTitle(detail.title);
      setEditContent(detail.content);
      setDetailMode("view");
      await loadDashboard(false);
      Alert.alert("초안 저장", "수정한 제목과 본문을 저장했어요.");
    } catch (error) {
      Alert.alert(
        "초안 저장 실패",
        getErrorMessage(error, "수정 내용을 저장하지 못했습니다."),
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handlePublish = () => {
    if (!selectedEssay?.isOwner) return;

    Alert.alert(
      "에세이를 공개할까요?",
      "공개하면 다른 사용자가 에세이와 이 글에 연결된 원본 기록·사진을 볼 수 있어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "공개하기",
          onPress: async () => {
            try {
              await withJwtRetry(() => publishEssay(selectedEssay.id));
              const rawDetail = await withJwtRetry(() => getEssayById(selectedEssay.id));
              const detail = prepareEssayDetailForDisplay(rawDetail);
              setSelectedEssay(detail);
              await loadDashboard(false);
              Alert.alert("공개 완료", "에세이가 공개됐어요.");
            } catch (error) {
              Alert.alert(
                "공개 실패",
                getErrorMessage(error, "에세이를 공개하지 못했습니다."),
              );
            }
          },
        },
      ],
    );
  };

  const handleShare = async () => {
    if (!selectedEssay) return;

    try {
      if (selectedEssay.kind === "postcard") {
        const canShare = await Sharing.isAvailableAsync();

        if (!canShare) {
          Alert.alert("공유 불가", "이 기기에서는 이미지 공유를 사용할 수 없어요.");
          return;
        }

        const uri = await postcardShotRef.current?.capture?.();

        if (!uri) {
          throw new Error("엽서 이미지를 만들지 못했습니다.");
        }

        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "SNS 엽서 공유",
          UTI: "public.png",
        });
        return;
      }

      await Share.share({
        title: selectedEssay.title,
        message: `${selectedEssay.title}
${selectedEssay.nickname} · ${formatPeriod(
          selectedEssay.startDate,
          selectedEssay.endDate,
        )}

${selectedEssay.content}`,
      });
    } catch (error) {
      Alert.alert(
        "공유 실패",
        getErrorMessage(error, "에세이를 공유하지 못했습니다."),
      );
    }
  };

  const selectedVersion = useMemo(() => {
    return selectedEssay?.versions.find(
      (version) => version.versionNo === activeVersionNo,
    );
  }, [activeVersionNo, selectedEssay]);

  const selectedEssayPhotoUrls = useMemo(() => {
    return Array.from(
      new Set(
        (selectedEssay?.records ?? []).flatMap((record) => record.photoUrls),
      ),
    );
  }, [selectedEssay]);

  if (screenLoading) {
    return (
      <SafeAreaView style={styles.screenLoading} edges={["top"]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.screenLoadingText}>
          에세이를 불러오는 중이에요
        </Text>
      </SafeAreaView>
    );
  }

  if (selectedEssay) {
    return (
      <SafeAreaView style={styles.safeAreaWhite} edges={["top"]}>
        <View style={styles.detailScreen}>
          <View style={styles.detailTopBar}>
            <Pressable
              onPress={closeEssay}
              style={({ pressed }) => [
                styles.topIconButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={COLORS.textSub}
              />
            </Pressable>

            <View style={styles.detailTopBarText}>
              <Text style={styles.detailTopBarTitle} numberOfLines={1}>
                {detailMode === "versions"
                  ? "AI 버전 비교"
                  : detailMode === "edit"
                    ? "에세이 편집"
                    : selectedEssay.visibility !== "private"
                      ? "공개 에세이"
                      : "비공개 초안"}
              </Text>
            </View>

            {detailMode === "view" && selectedEssay.isOwner ? (
              <Pressable
                onPress={enterEditMode}
                style={({ pressed }) => [
                  styles.topTextButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.topTextButtonText}>수정하기</Text>
              </Pressable>
            ) : (
              <View style={styles.topBarSpacer} />
            )}
          </View>

          {detailLoading ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.detailLoadingText}>
                에세이를 불러오는 중이에요
              </Text>
            </View>
          ) : detailMode === "versions" ? (
            <View style={styles.versionScreen}>
              {selectedEssay.versions.length > 0 ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.versionTabsScroll}
                    contentContainerStyle={styles.versionTabs}
                  >
                    {selectedEssay.versions.map((version) => {
                      const selected = activeVersionNo === version.versionNo;

                      return (
                        <Pressable
                          key={version.id}
                          onPress={() => setActiveVersionNo(version.versionNo)}
                          style={[
                            styles.versionTab,
                            selected && styles.versionTabSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.versionTabText,
                              selected && styles.versionTabTextSelected,
                            ]}
                          >
                            버전 {version.versionNo}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.versionTabStyle,
                              selected && styles.versionTabStyleSelected,
                            ]}
                          >
                            {version.kind === "postcard"
                              ? getPostcardFormatLabel(version.postcardFormat)
                              : ESSAY_STYLE_OPTIONS.find(
                                  (option) => option.value === version.style,
                                )?.title ?? "기본 균형"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.versionContent}
                  >
                    <View style={styles.versionBadge}>
                      <Ionicons
                        name="sparkles"
                        size={14}
                        color={COLORS.primary}
                      />
                      <Text style={styles.versionBadgeText}>
                        AI 원본 · 비교 단계에서는 직접 수정하지 않아요
                      </Text>
                    </View>

                    {selectedVersion ? (
                      selectedVersion.kind === "postcard" ? (
                        <PostcardCanvas
                          title={selectedVersion.title}
                          content={selectedVersion.content}
                          meta={selectedVersion.meta}
                          photoUrls={selectedEssayPhotoUrls}
                          journeyTitle={selectedEssay.journeyTitle}
                          format={selectedVersion.postcardFormat}
                        />
                      ) : (
                        <TasteReportPreview
                          title={selectedVersion.title}
                          content={selectedVersion.content}
                          meta={selectedVersion.meta}
                          photoUrls={selectedEssayPhotoUrls}
                          nickname={selectedEssay.nickname}
                          period={formatPeriod(
                            selectedEssay.startDate,
                            selectedEssay.endDate,
                          )}
                          compact
                        />
                      )
                    ) : null}

                    <Pressable
                      onPress={() => handleSelectVersion(activeVersionNo)}
                      disabled={versionSelecting}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.buttonPressed,
                        versionSelecting && styles.disabledButton,
                      ]}
                    >
                      {versionSelecting ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          이 버전으로 편집하기
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={openRegenerateModal}
                      disabled={versionGenerating}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.buttonPressed,
                        versionGenerating && styles.disabledButton,
                      ]}
                    >
                      {versionGenerating ? (
                        <ActivityIndicator color={COLORS.primary} />
                      ) : (
                        <Text style={styles.secondaryButtonText}>
                          AI로 새 버전 만들기
                        </Text>
                      )}
                    </Pressable>
                  </ScrollView>
                </>
              ) : (
                <View style={styles.generationErrorState}>
                  <Ionicons
                    name="document-text-outline"
                    size={42}
                    color={COLORS.primary}
                  />
                  <Text style={styles.generationErrorTitle}>
                    버전 1이 아직 준비되지 않았어요
                  </Text>
                  <Text style={styles.generationErrorDescription}>
                    앱이 종료되었거나 AI 생성 중 오류가 있었다면 다시 시도할 수
                    있어요.
                  </Text>
                  <Pressable
                    onPress={() => void handleRetryFirstVersion()}
                    disabled={versionGenerating}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                      versionGenerating && styles.disabledButton,
                    ]}
                  >
                    {versionGenerating ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        버전 1 다시 만들기
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          ) : detailMode === "edit" ? (
            <KeyboardAvoidingView
              style={styles.editScreen}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.editContent}
              >
                <Text style={styles.inputLabel}>제목</Text>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  maxLength={100}
                  placeholder="에세이 제목"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.titleInput}
                />
                <Text style={styles.characterCount}>
                  {editTitle.length}/100
                </Text>

                <Text style={styles.inputLabel}>본문</Text>
                <TextInput
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  maxLength={4000}
                  textAlignVertical="top"
                  placeholder="에세이 본문"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.contentInput}
                />
                <Text style={styles.characterCount}>
                  {editContent.length}/4000
                </Text>

                <View style={styles.privateDraftNotice}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.privateDraftNoticeText}>
                    수정 내용은 비공개 초안으로 저장돼요.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.editFooter}>
                <Pressable
                  onPress={() => {
                    setEditTitle(selectedEssay.title);
                    setEditContent(selectedEssay.content);
                    setDetailMode("view");
                  }}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleSaveDraft()}
                  disabled={editSaving}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.buttonPressed,
                    editSaving && styles.disabledButton,
                  ]}
                >
                  {editSaving ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>초안 저장</Text>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          ) : (
            <View style={styles.detailScreen}>
              <ScrollView
                style={styles.detailScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailScrollContent}
              >
                <View style={styles.detailContent}>
                  <View style={styles.publicationRow}>
                    <View
                      style={[
                        styles.publicationBadge,
                        selectedEssay.visibility !== "private"
                          ? styles.publicBadge
                          : styles.privateBadge,
                      ]}
                    >
                      <Ionicons
                        name={
                          selectedEssay.visibility !== "private"
                            ? "globe-outline"
                            : "lock-closed-outline"
                        }
                        size={13}
                        color={
                          selectedEssay.visibility !== "private"
                            ? COLORS.green
                            : COLORS.primary
                        }
                      />
                      <Text
                        style={[
                          styles.publicationBadgeText,
                          selectedEssay.visibility !== "private"
                            ? styles.publicBadgeText
                            : styles.privateBadgeText,
                        ]}
                      >
                        {selectedEssay.visibility !== "private"
                          ? "공개"
                          : "비공개 초안"}
                      </Text>
                    </View>
                    <View style={styles.kindBadge}>
                      <Text style={styles.kindBadgeText}>
                        {getEssayKindLabel(selectedEssay.kind)}
                      </Text>
                    </View>
                  </View>

                  {selectedEssay.kind === "postcard" ? (
                    <>
                      <Text style={styles.postcardFormatGuide}>
                        {getPostcardFormatLabel(selectedEssay.postcardFormat)} · 이미지로 바로 공유할 수 있어요
                      </Text>
                      <ViewShot
                        ref={postcardShotRef}
                        style={styles.postcardShot}
                        options={{
                          format: "png",
                          quality: 1,
                          result: "tmpfile",
                        }}
                      >
                        <PostcardCanvas
                          title={selectedEssay.title}
                          content={selectedEssay.content}
                          meta={selectedEssay.selectedMeta}
                          photoUrls={selectedEssayPhotoUrls}
                          journeyTitle={selectedEssay.journeyTitle}
                          format={selectedEssay.postcardFormat}
                        />
                      </ViewShot>
                    </>
                  ) : (
                    <TasteReportPreview
                      title={selectedEssay.title}
                      content={selectedEssay.content}
                      meta={selectedEssay.selectedMeta}
                      photoUrls={selectedEssayPhotoUrls}
                      nickname={selectedEssay.nickname}
                      period={formatPeriod(
                        selectedEssay.startDate,
                        selectedEssay.endDate,
                      )}
                    />
                  )}

                  <View style={styles.sourceSection}>
                    <Text style={styles.sourceSectionTitle}>
                      이 글에 담긴 기록
                    </Text>
                    <Text style={styles.sourceSectionDescription}>
                      기록을 누르면 원문과 감정, 장소, 사진을 확인할 수 있어요.
                    </Text>

                    {selectedEssay.records.map((record) => (
                      <Pressable
                        key={record.id}
                        onPress={() => setRecordDetail(record)}
                        style={({ pressed }) => [
                          styles.sourceRecordRow,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <Text style={styles.sourceRecordDate}>
                          {formatShortDate(record.recordedAt)}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={styles.sourceRecordTitle}
                        >
                          {record.missionTitle}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={17}
                          color={COLORS.textMuted}
                        />
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.detailBottomSpace} />
                </View>
              </ScrollView>

              <View style={styles.actionBar}>
                <Pressable
                  onPress={() => void handleShare()}
                  style={({ pressed }) => [
                    styles.shareButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons
                    name="share-outline"
                    size={17}
                    color={COLORS.primary}
                  />
                  <Text style={styles.shareButtonText}>공유</Text>
                </Pressable>

                {selectedEssay.isOwner ? (
                  selectedEssay.visibility !== "private" ? (
                    <Pressable
                      onPress={enterEditMode}
                      style={({ pressed }) => [
                        styles.publishButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.publishButtonText}>수정하기</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handlePublish}
                      style={({ pressed }) => [
                        styles.publishButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.publishButtonText}>공개하기</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            </View>
          )}
        </View>

        <Modal
          visible={regenerateModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setRegenerateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setRegenerateModalVisible(false)}
            />
            <View style={styles.creationModalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.creationModalCaption}>
                버전 {selectedEssay.versions.length + 1} 생성
              </Text>
              <Text style={styles.creationModalTitle}>
                새 버전은 어떤 형식으로 만들까요?
              </Text>
              <Text style={styles.creationModalDescription}>
                기존 결과는 그대로 보관돼요. 취향 리포트와 SNS 엽서 중에서 다시 선택할 수 있어요.
              </Text>

              <Pressable
                onPress={() => setSelectedEssayKind("taste_report")}
                style={[
                  styles.creationOption,
                  selectedEssayKind === "taste_report" &&
                    styles.creationOptionSelected,
                ]}
              >
                <View style={styles.creationOptionIcon}>
                  <Ionicons
                    name="analytics-outline"
                    size={24}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.creationOptionText}>
                  <Text style={styles.creationOptionTitle}>
                    AI 취향 리포트
                  </Text>
                  <Text style={styles.creationOptionDescription}>
                    기록을 분석해 이번 여정의 취향과 다음 추천을 정리해요.
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    selectedEssayKind === "taste_report" &&
                      styles.radioCircleSelected,
                  ]}
                >
                  {selectedEssayKind === "taste_report" ? (
                    <View style={styles.radioDot} />
                  ) : null}
                </View>
              </Pressable>

              <Pressable
                onPress={() => setSelectedEssayKind("postcard")}
                style={[
                  styles.creationOption,
                  selectedEssayKind === "postcard" &&
                    styles.creationOptionSelected,
                ]}
              >
                <View style={styles.creationOptionIcon}>
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={COLORS.pink}
                  />
                </View>
                <View style={styles.creationOptionText}>
                  <Text style={styles.creationOptionTitle}>
                    SNS 공유용 엽서
                  </Text>
                  <Text style={styles.creationOptionDescription}>
                    사진 콜라주와 짧은 글을 SNS에 올리기 좋은 형태로 만들어요.
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    selectedEssayKind === "postcard" &&
                      styles.radioCircleSelected,
                  ]}
                >
                  {selectedEssayKind === "postcard" ? (
                    <View style={styles.radioDot} />
                  ) : null}
                </View>
              </Pressable>

              {selectedEssayKind === "taste_report" ? (
                <View style={styles.formatSection}>
                  <Text style={styles.formatSectionTitle}>글의 문체</Text>
                  {ESSAY_STYLE_OPTIONS.map((option) => {
                    const selected = selectedEssayStyle === option.value;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setSelectedEssayStyle(option.value)}
                        style={[
                          styles.styleOption,
                          selected && styles.styleOptionSelected,
                        ]}
                      >
                        <View style={styles.styleOptionTextArea}>
                          <Text
                            style={[
                              styles.styleOptionTitle,
                              selected && styles.styleOptionTitleSelected,
                            ]}
                          >
                            {option.title}
                          </Text>
                          <Text style={styles.styleOptionDescription}>
                            {option.description}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radioCircle,
                            selected && styles.radioCircleSelected,
                          ]}
                        >
                          {selected ? <View style={styles.radioDot} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {selectedEssayKind === "postcard" ? (
                <View style={styles.formatSection}>
                  <Text style={styles.formatSectionTitle}>엽서 비율</Text>
                  <View style={styles.formatRow}>
                    <Pressable
                      onPress={() => setSelectedPostcardFormat("story")}
                      style={[
                        styles.formatOption,
                        selectedPostcardFormat === "story" &&
                          styles.formatOptionSelected,
                      ]}
                    >
                      <Ionicons
                        name="phone-portrait-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                      <Text style={styles.formatOptionTitle}>스토리</Text>
                      <Text style={styles.formatOptionMeta}>9:16 세로형</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setSelectedPostcardFormat("square")}
                      style={[
                        styles.formatOption,
                        selectedPostcardFormat === "square" &&
                          styles.formatOptionSelected,
                      ]}
                    >
                      <Ionicons
                        name="square-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                      <Text style={styles.formatOptionTitle}>게시물</Text>
                      <Text style={styles.formatOptionMeta}>1:1 정사각형</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={() => void handleGenerateNextVersion()}
                disabled={versionGenerating}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  versionGenerating && styles.disabledButton,
                ]}
              >
                {versionGenerating ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    새 버전 만들기
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={recordDetail !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setRecordDetail(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setRecordDetail(null)}
            />
            <View style={styles.recordModalCard}>
              <View style={styles.modalHandle} />
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.recordModalContent}
              >
                <View style={styles.recordModalHeader}>
                  <View style={styles.recordModalHeaderText}>
                    <Text style={styles.recordModalCaption}>원본 기록</Text>
                    <Text style={styles.recordModalTitle}>
                      {recordDetail?.missionTitle}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setRecordDetail(null)}
                    style={styles.recordModalClose}
                  >
                    <Text style={styles.recordModalCloseText}>✕</Text>
                  </Pressable>
                </View>

                {recordDetail ? (
                  <>
                    <Text style={styles.recordDate}>
                      {getYear(recordDetail.recordedAt)}. {formatShortDate(
                        recordDetail.recordedAt,
                      )}
                    </Text>

                    <View style={styles.recordMetaRow}>
                      {recordDetail.emotion ? (
                        <View style={styles.emotionTag}>
                          <Text style={styles.emotionTagText}>
                            {EMOTION_LABELS[recordDetail.emotion] ??
                              recordDetail.emotion}
                          </Text>
                        </View>
                      ) : null}
                      {recordDetail.placeName ? (
                        <View style={styles.placeTag}>
                          <Text style={styles.placeTagText}>
                            📍 {recordDetail.placeName}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {recordDetail.photoUrls.length > 0 ? (
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={styles.recordPhotoScroll}
                      >
                        {recordDetail.photoUrls.map((url) => (
                          <Image
                            key={url}
                            source={{ uri: url }}
                            resizeMode="cover"
                            style={styles.recordPhoto}
                          />
                        ))}
                      </ScrollView>
                    ) : null}

                    <View style={styles.recordTextBox}>
                      <Text style={styles.recordText}>
                        {recordDetail.content || "작성한 내용이 없어요."}
                      </Text>
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  const essays = dashboard?.essays ?? [];
  const journey = dashboard?.journey ?? null;
  const targetCount = journey?.targetDayCount ?? 0;
  const completedDayCount = journey?.completedDayCount ?? 0;
  const remainingDayCount = Math.max(targetCount - completedDayCount, 0);
  const progressPercent =
    targetCount > 0
      ? Math.min((completedDayCount / targetCount) * 100, 100)
      : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenContent}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>나의 에세이</Text>
          <Text style={styles.headerDescription}>
            여정을 취향 리포트나 SNS 엽서로 남겨봐요
          </Text>
        </View>

        <View style={styles.bookshelfContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bookRow}
          >
            {journey ? (
              <View
                style={[
                  styles.progressBook,
                  {
                    width: getBookWidthByDuration(journey.durationDays),
                    height: 164,
                  },
                ]}
              >
                <View style={styles.rotatedLabelWrapper}>
                  <Text style={styles.progressBookText}>
                    {journey.canCreateEssay ? "완성 가능" : "진행 중"}
                  </Text>
                </View>
              </View>
            ) : null}

            {essays.map((essay, index) => {
              const width = getBookWidthByDuration(essay.durationDays);
              const height = getStableBookHeight(essay.id);

              return (
                <Pressable
                  key={essay.id}
                  onPress={() => void openEssay(essay)}
                  style={({ pressed }) => [
                    styles.bookSpine,
                    {
                      width,
                      height,
                      backgroundColor:
                        BOOK_COLORS[index % BOOK_COLORS.length],
                    },
                    pressed && styles.bookPressed,
                  ]}
                >
                  <View style={styles.rotatedLabelWrapper}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.bookSpineTitle,
                        width <= 30 && styles.thinBookTitle,
                      ]}
                    >
                      {essay.title}
                    </Text>
                    <Text style={styles.bookSpineYear}>
                      {getYear(essay.startDate)}
                    </Text>
                  </View>
                  <View style={styles.pageEdge} />
                </Pressable>
              );
            })}

            {[22, 28, 20].map((width, index) => (
              <View
                key={`empty-book-${index}`}
                style={[
                  styles.emptyBook,
                  {
                    width,
                    height: 142 + index * 7,
                  },
                ]}
              />
            ))}
            <View style={styles.bookRowEndSpace} />
          </ScrollView>

          <View style={styles.shelf} />
          <View style={styles.wall} />
        </View>

        <View style={styles.body}>
          {journey ? (
            <View style={styles.progressCard}>
              <View style={styles.progressCardTop}>
                <View style={styles.progressTag}>
                  <Text style={styles.progressTagText}>
                    {journey.canCreateEssay ? "완료" : "진행 중"}
                  </Text>
                </View>
                <Text style={styles.journeyText}>{journey.title}</Text>
              </View>

              <Text style={styles.progressEssayTitle}>
                여정이 진행중이에요
              </Text>
              <Text style={styles.progressEssayPeriod}>
                {getYear(journey.startDate)}. {formatPeriod(
                  journey.startDate,
                  journey.endDate,
                )}
              </Text>

              <View style={styles.progressInfoRow}>
                <Text style={styles.progressInfoText}>
                  {completedDayCount}일의 경험이 담겼어요
                </Text>
                <Text style={styles.progressCount}>
                  {completedDayCount}/{targetCount}
                </Text>
              </View>

              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%` as `${number}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.remainingNotice}>
                <Text style={styles.remainingText}>
                  {journey.canCreateEssay ? (
                    <>
                      모든 경험이 모였어요. 이제{" "}
                      <Text style={styles.remainingStrong}>
                        에세이를 만들 수 있어요.
                      </Text>
                    </>
                  ) : (
                    <>
                      완성까지{" "}
                      <Text style={styles.remainingStrong}>
                        {remainingDayCount}일의 경험
                      </Text>
                      이 더 필요해요
                    </>
                  )}
                </Text>
              </View>

              <Pressable
                onPress={() => void handleCreateEssay()}
                disabled={!journey.canCreateEssay || createLoading}
                style={({ pressed }) => [
                  journey.canCreateEssay
                    ? styles.createButton
                    : styles.disabledCreateButton,
                  pressed &&
                    journey.canCreateEssay &&
                    styles.buttonPressed,
                  createLoading && styles.disabledButton,
                ]}
              >
                {createLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text
                    style={
                      journey.canCreateEssay
                        ? styles.createButtonText
                        : styles.disabledCreateButtonText
                    }
                  >
                    {journey.canCreateEssay
                      ? "에세이 만들기"
                      : `에세이 만들기 (${remainingDayCount}일 남음)`}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardTitle}>
                에세이로 만들 새 여정이 없어요
              </Text>
              <Text style={styles.emptyCardDescription}>
                이미 에세이로 만든 여정의 기록은 다시 생성 대상에 포함되지
                않아요.
              </Text>
            </View>
          )}

          <Text style={styles.completedSectionTitle}>
            내 에세이 ({essays.length})
          </Text>

          {essays.length > 0 ? (
            essays.map((essay, index) => (
              <Pressable
                key={essay.id}
                onPress={() => void openEssay(essay)}
                style={({ pressed }) => [
                  styles.essayListCard,
                  pressed && styles.cardPressed,
                ]}
              >
                <View
                  style={[
                    styles.essayAccent,
                    {
                      backgroundColor:
                        BOOK_COLORS[index % BOOK_COLORS.length],
                    },
                  ]}
                />

                <View style={styles.essayThumbnailWrapper}>
                  <CoverVisual
                    uri={essay.coverPhotoUrl}
                    height={66}
                    compact
                  />
                </View>

                <View style={styles.essayListText}>
                  <View style={styles.essayListStatusRow}>
                    <Text
                      numberOfLines={1}
                      style={styles.essayListTitle}
                    >
                      {essay.title}
                    </Text>
                    <View
                      style={[
                        styles.listStatusBadge,
                        essay.visibility !== "private"
                          ? styles.listStatusPublic
                          : styles.listStatusPrivate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.listStatusText,
                          essay.visibility !== "private"
                            ? styles.listStatusPublicText
                            : styles.listStatusPrivateText,
                        ]}
                      >
                        {essay.selectedVersionNo === null
                          ? essay.generationState === "generating"
                            ? "생성 중"
                            : "버전 선택"
                          : essay.visibility !== "private"
                            ? "공개"
                            : "초안"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.essayListPeriod}>
                    {getYear(essay.startDate)}년 {formatPeriod(
                      essay.startDate,
                      essay.endDate,
                    )}
                  </Text>
                  <Text style={styles.essayListMeta}>
                    {getEssayKindLabel(essay.kind)} · 기록 {essay.sourceRecordCount}개
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textMuted}
                />
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardTitle}>
                아직 만든 에세이가 없어요
              </Text>
              <Text style={styles.emptyCardDescription}>
                여정을 완료하면 AI가 기록을 취향 리포트나 SNS 엽서로 정리해줘요.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setCreateModalVisible(false)}
          />
          <View style={styles.creationModalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.creationModalCaption}>에세이 형식 선택</Text>
            <Text style={styles.creationModalTitle}>
              이번 여정을 어떻게 남길까요?
            </Text>
            <Text style={styles.creationModalDescription}>
              사진은 두 형식 모두에 함께 들어가고, 작성한 기록은 AI 분석에 사용돼요.
            </Text>

            <Pressable
              onPress={() => setSelectedEssayKind("taste_report")}
              style={[
                styles.creationOption,
                selectedEssayKind === "taste_report" &&
                  styles.creationOptionSelected,
              ]}
            >
              <View style={styles.creationOptionIcon}>
                <Ionicons name="analytics-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.creationOptionText}>
                <Text style={styles.creationOptionTitle}>AI 취향 리포트</Text>
                <Text style={styles.creationOptionDescription}>
                  기록의 활동·감정·카테고리를 분석해 이번 여정의 취향과 다음 추천을 정리해요.
                </Text>
              </View>
              <View
                style={[
                  styles.radioCircle,
                  selectedEssayKind === "taste_report" &&
                    styles.radioCircleSelected,
                ]}
              >
                {selectedEssayKind === "taste_report" ? (
                  <View style={styles.radioDot} />
                ) : null}
              </View>
            </Pressable>

            <Pressable
              onPress={() => setSelectedEssayKind("postcard")}
              style={[
                styles.creationOption,
                selectedEssayKind === "postcard" &&
                  styles.creationOptionSelected,
              ]}
            >
              <View style={styles.creationOptionIcon}>
                <Ionicons name="image-outline" size={24} color={COLORS.pink} />
              </View>
              <View style={styles.creationOptionText}>
                <Text style={styles.creationOptionTitle}>SNS 공유용 엽서</Text>
                <Text style={styles.creationOptionDescription}>
                  여정 사진을 콜라주로 배치하고 기록 속 문장을 짧고 감성적으로 담아요.
                </Text>
              </View>
              <View
                style={[
                  styles.radioCircle,
                  selectedEssayKind === "postcard" &&
                    styles.radioCircleSelected,
                ]}
              >
                {selectedEssayKind === "postcard" ? (
                  <View style={styles.radioDot} />
                ) : null}
              </View>
            </Pressable>

            {selectedEssayKind === "postcard" ? (
              <View style={styles.formatSection}>
                <Text style={styles.formatSectionTitle}>엽서 비율</Text>
                <View style={styles.formatRow}>
                  <Pressable
                    onPress={() => setSelectedPostcardFormat("story")}
                    style={[
                      styles.formatOption,
                      selectedPostcardFormat === "story" &&
                        styles.formatOptionSelected,
                    ]}
                  >
                    <Ionicons name="phone-portrait-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.formatOptionTitle}>스토리</Text>
                    <Text style={styles.formatOptionMeta}>9:16 세로형</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSelectedPostcardFormat("square")}
                    style={[
                      styles.formatOption,
                      selectedPostcardFormat === "square" &&
                        styles.formatOptionSelected,
                    ]}
                  >
                    <Ionicons name="square-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.formatOptionTitle}>게시물</Text>
                    <Text style={styles.formatOptionMeta}>1:1 정사각형</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() => void handleConfirmCreateEssay()}
              disabled={createLoading}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                createLoading && styles.disabledButton,
              ]}
            >
              {createLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  이 형식으로 만들기
                </Text>
              )}
            </Pressable>
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
  safeAreaWhite: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  screenContent: {
    paddingTop: 18,
  },
  screenLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  screenLoadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textSub,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  headerTitle: {
    marginBottom: 3,
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  headerDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  bookshelfContainer: {
    paddingTop: 28,
    backgroundColor: COLORS.shelfBackground,
  },
  bookRow: {
    height: 190,
    alignItems: "flex-end",
    paddingHorizontal: 20,
  },
  progressBook: {
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    borderRadius: 5,
  },
  rotatedLabelWrapper: {
    position: "absolute",
    width: 156,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "90deg" }],
  },
  progressBookText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: COLORS.primary,
  },
  bookSpine: {
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 5,
    shadowColor: "#000000",
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 4,
  },
  bookPressed: {
    opacity: 0.78,
  },
  bookSpineTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.94)",
  },
  thinBookTitle: {
    fontSize: 7.5,
  },
  bookSpineYear: {
    marginTop: 4,
    fontSize: 7,
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.60)",
  },
  pageEdge: {
    position: "absolute",
    top: 3,
    right: 0,
    bottom: 3,
    width: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  emptyBook: {
    marginRight: 4,
    backgroundColor: "#C9BFB2",
    borderRadius: 5,
    opacity: 0.28,
  },
  bookRowEndSpace: {
    width: 18,
  },
  shelf: {
    height: 10,
    backgroundColor: COLORS.shelf,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  wall: {
    height: 16,
    backgroundColor: COLORS.wall,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  progressCard: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(61,90,254,0.30)",
    borderRadius: 16,
  },
  progressCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTag: {
    marginRight: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 7,
  },
  progressTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
  },
  journeyText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  progressEssayTitle: {
    marginBottom: 3,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  progressEssayPeriod: {
    marginBottom: 13,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  progressInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  progressInfoText: {
    fontSize: 12,
    color: COLORS.textSub,
  },
  progressCount: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  progressBarBackground: {
    height: 5,
    overflow: "hidden",
    backgroundColor: "#ECEEF2",
    borderRadius: 3,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  remainingNotice: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  remainingText: {
    fontSize: 12,
    color: COLORS.textSub,
  },
  remainingStrong: {
    fontWeight: "700",
    color: COLORS.primary,
  },
  createButton: {
    marginTop: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 11,
  },
  createButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },
  disabledCreateButton: {
    marginTop: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 11,
  },
  disabledCreateButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  completedSectionTitle: {
    marginTop: 21,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSub,
  },
  essayListCard: {
    minHeight: 72,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderRadius: 14,
  },
  essayAccent: {
    alignSelf: "stretch",
    width: 6,
  },
  essayThumbnailWrapper: {
    width: 66,
    height: 66,
    overflow: "hidden",
    marginLeft: 3,
    borderRadius: 10,
  },
  coverImage: {
    width: "100%",
    backgroundColor: COLORS.border,
  },
  coverPlaceholder: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
  },
  coverPlaceholderCompact: {
    borderRadius: 10,
  },
  coverPlaceholderText: {
    marginTop: 8,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  essayListText: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  essayListStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  essayListTitle: {
    flex: 1,
    marginRight: 7,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  listStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  listStatusPublic: {
    backgroundColor: COLORS.greenLight,
  },
  listStatusPrivate: {
    backgroundColor: COLORS.primaryLight,
  },
  listStatusText: {
    fontSize: 9,
    fontWeight: "700",
  },
  listStatusPublicText: {
    color: COLORS.green,
  },
  listStatusPrivateText: {
    color: COLORS.primary,
  },
  essayListPeriod: {
    marginTop: 3,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  essayListMeta: {
    marginTop: 3,
    fontSize: 10,
    color: COLORS.textSub,
  },
  emptyCard: {
    padding: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  emptyCardTitle: {
    marginBottom: 5,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  emptyCardDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textMuted,
  },
  bottomSpace: {
    height: 120,
  },
  detailScreen: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  detailTopBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topIconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderRadius: 11,
  },
  detailTopBarText: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  detailTopBarTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  topTextButton: {
    minWidth: 68,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },
  topTextButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  topBarSpacer: {
    width: 68,
  },
  detailLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLoadingText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  publicationRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  publicationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  publicBadge: {
    backgroundColor: COLORS.greenLight,
  },
  privateBadge: {
    backgroundColor: COLORS.primaryLight,
  },
  publicationBadgeText: {
    marginLeft: 5,
    fontSize: 10,
    fontWeight: "700",
  },
  publicBadgeText: {
    color: COLORS.green,
  },
  privateBadgeText: {
    color: COLORS.primary,
  },
  detailTitle: {
    marginBottom: 7,
    fontSize: 24,
    lineHeight: 33,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  detailByline: {
    marginBottom: 24,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  essayBodyText: {
    fontSize: 15,
    lineHeight: 27,
    color: COLORS.textMain,
  },
  sourceSection: {
    marginTop: 32,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sourceSectionTitle: {
    marginBottom: 5,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  sourceSectionDescription: {
    marginBottom: 14,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textMuted,
  },
  sourceRecordRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  sourceRecordDate: {
    width: 48,
    marginRight: 8,
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
  },
  sourceRecordTitle: {
    flex: 1,
    marginRight: 8,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: COLORS.textMain,
  },
  detailBottomSpace: {
    height: 30,
  },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 96,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  shareButton: {
    minWidth: 86,
    height: 46,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
  },
  shareButtonText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  publishButton: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  publishButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.white,
  },
  versionScreen: {
    flex: 1,
  },
  versionTabsScroll: {
    flexGrow: 0,
    backgroundColor: COLORS.background,
  },
  versionTabs: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  versionTab: {
    width: 126,
    minHeight: 58,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  versionTabSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  versionTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSub,
  },
  versionTabTextSelected: {
    color: COLORS.primary,
  },
  versionTabStyle: {
    marginTop: 3,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  versionTabStyleSelected: {
    color: COLORS.primary,
  },
  versionContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 120,
  },
  versionBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 9,
  },
  versionBadgeText: {
    marginLeft: 5,
    fontSize: 10,
    color: COLORS.primary,
  },
  versionTitle: {
    marginBottom: 18,
    fontSize: 23,
    lineHeight: 32,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  versionBody: {
    marginBottom: 26,
    fontSize: 15,
    lineHeight: 27,
    color: COLORS.textMain,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 13,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.white,
  },
  secondaryButton: {
    minHeight: 50,
    marginTop: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(61,90,254,0.20)",
    borderRadius: 13,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  generationErrorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  generationErrorTitle: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  generationErrorDescription: {
    marginBottom: 22,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textMuted,
  },
  editScreen: {
    flex: 1,
  },
  editContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 30,
  },
  inputLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  titleInput: {
    minHeight: 52,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  contentInput: {
    minHeight: 430,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 14,
    lineHeight: 25,
    color: COLORS.textMain,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  characterCount: {
    marginTop: 6,
    marginBottom: 16,
    textAlign: "right",
    fontSize: 10,
    color: COLORS.textMuted,
  },
  privateDraftNotice: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 11,
  },
  privateDraftNoticeText: {
    marginLeft: 7,
    fontSize: 11,
    color: COLORS.primary,
  },
  editFooter: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 96,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    minWidth: 88,
    height: 48,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSub,
  },
  saveButton: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.44)",
  },
  styleModalCard: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    marginBottom: 17,
    backgroundColor: "#D7D9DE",
    borderRadius: 3,
  },
  styleModalCaption: {
    marginBottom: 4,
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  styleModalTitle: {
    marginBottom: 6,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  styleModalDescription: {
    marginBottom: 17,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  styleOption: {
    minHeight: 70,
    marginBottom: 9,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
  },
  styleOptionSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  styleOptionTextArea: {
    flex: 1,
    marginRight: 10,
  },
  styleOptionTitle: {
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSub,
  },
  styleOptionTitleSelected: {
    color: COLORS.primary,
  },
  styleOptionDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.textMuted,
  },
  radioCircle: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    borderRadius: 10,
  },
  radioCircleSelected: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  recordModalCard: {
    maxHeight: "88%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  recordModalContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  recordModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recordModalHeaderText: {
    flex: 1,
  },
  recordModalCaption: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.green,
  },
  recordModalTitle: {
    paddingRight: 10,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  recordModalClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderRadius: 18,
  },
  recordModalCloseText: {
    fontSize: 14,
    color: COLORS.textSub,
  },
  recordDate: {
    marginBottom: 10,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  recordMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  emotionTag: {
    marginRight: 7,
    marginBottom: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.pinkLight,
    borderRadius: 9,
  },
  emotionTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.pink,
  },
  placeTag: {
    marginBottom: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 9,
  },
  placeTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  recordPhotoScroll: {
    marginBottom: 16,
  },
  recordPhoto: {
    width: 320,
    height: 240,
    marginRight: 8,
    backgroundColor: COLORS.border,
    borderRadius: 16,
  },
  recordTextBox: {
    padding: 17,
    backgroundColor: COLORS.background,
    borderRadius: 15,
  },
  recordText: {
    fontSize: 14,
    lineHeight: 24,
    color: COLORS.textMain,
  },
  detailScrollContent: {
    paddingBottom: 12,
  },
  kindBadge: {
    marginLeft: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textSub,
  },
  collageEmpty: {
    flex: 1,
    minHeight: 190,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECEEF3",
  },
  collageEmptyCompact: {
    minHeight: 140,
  },
  collageEmptyText: {
    marginTop: 7,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  collageSingleImage: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.border,
  },
  collageRow: {
    flex: 1,
    flexDirection: "row",
  },
  collageColumn: {
    flex: 1,
  },
  collageHalfImage: {
    flex: 1,
    height: "100%",
    backgroundColor: COLORS.border,
  },
  collageQuarterImage: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.border,
  },
  collageImageGapRight: {
    marginRight: 3,
  },
  collageImageGapBottom: {
    marginBottom: 3,
  },
  collageGrid: {
    flex: 1,
  },
  collageGridRow: {
    flex: 1,
    flexDirection: "row",
  },
  collageGridCell: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  collageGridImage: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.border,
  },
  collageMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,15,15,0.46)",
  },
  collageMoreText: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
  },
  postcardShot: {
    width: "100%",
  },
  postcardCanvas: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 18,
  },
  postcardPhotoArea: {
    flex: 1.25,
    overflow: "hidden",
  },
  postcardTextArea: {
    flex: 0.75,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  postcardAccentLine: {
    width: 36,
    height: 3,
    marginBottom: 10,
    borderRadius: 2,
  },
  postcardJourneyLabel: {
    marginBottom: 5,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "rgba(15,15,15,0.54)",
  },
  postcardTitle: {
    marginBottom: 8,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900",
    color: COLORS.textMain,
  },
  postcardBody: {
    fontSize: 10,
    lineHeight: 17,
    color: "rgba(15,15,15,0.76)",
  },
  postcardHashtags: {
    marginTop: 10,
    fontSize: 8,
    lineHeight: 13,
    fontWeight: "700",
  },
  postcardFormatGuide: {
    marginBottom: 10,
    textAlign: "center",
    fontSize: 11,
    color: COLORS.textMuted,
  },
  reportCard: {
    overflow: "hidden",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  reportCardCompact: {
    marginBottom: 22,
  },
  reportPhotos: {
    height: 230,
    overflow: "hidden",
  },
  reportPhotosCompact: {
    height: 170,
    overflow: "hidden",
  },
  reportContent: {
    paddingHorizontal: 20,
    paddingVertical: 21,
  },
  reportEyebrow: {
    marginBottom: 8,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: COLORS.primary,
  },
  reportTitle: {
    marginBottom: 7,
    fontSize: 23,
    lineHeight: 32,
    fontWeight: "900",
    color: COLORS.textMain,
  },
  reportTitleCompact: {
    fontSize: 20,
    lineHeight: 28,
  },
  reportByline: {
    marginBottom: 18,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  reportBody: {
    fontSize: 15,
    lineHeight: 28,
    color: COLORS.textMain,
    letterSpacing: -0.1,
  },
  reportBodyCompact: {
    fontSize: 14,
    lineHeight: 24,
  },
  insightList: {
    marginTop: 20,
  },
  insightItem: {
    marginBottom: 8,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
  },
  insightKeyword: {
    marginBottom: 4,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  insightDescription: {
    fontSize: 11,
    lineHeight: 18,
    color: COLORS.textSub,
  },
  creationModalCard: {
    maxHeight: "92%",
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  creationModalCaption: {
    marginBottom: 5,
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  creationModalTitle: {
    marginBottom: 7,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "900",
    color: COLORS.textMain,
  },
  creationModalDescription: {
    marginBottom: 18,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textSub,
  },
  creationOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    padding: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
  },
  creationOptionSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  creationOptionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  creationOptionText: {
    flex: 1,
    paddingRight: 10,
  },
  creationOptionTitle: {
    marginBottom: 4,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  creationOptionDescription: {
    fontSize: 10,
    lineHeight: 16,
    color: COLORS.textSub,
  },
  formatSection: {
    marginBottom: 17,
    paddingTop: 4,
  },
  formatSectionTitle: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  formatRow: {
    flexDirection: "row",
  },
  formatOption: {
    flex: 1,
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
  },
  formatOptionSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  formatOptionTitle: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  formatOptionMeta: {
    marginTop: 2,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  cardPressed: {
    opacity: 0.78,
  },
});