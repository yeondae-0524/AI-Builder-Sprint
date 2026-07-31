import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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

import { supabase } from "../../lib/supabase";
import {
  createEssayDraft,
  EssayDashboardData,
  EssayDetail,
  EssayRecord,
  EssayStyle,
  EssaySummary,
  generateEssayVersion,
  getBookWidthByDuration,
  getEssayById,
  getEssayDashboardData,
  getStableBookHeight,
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

const STYLE_OPTIONS: Array<{
  value: EssayStyle;
  label: string;
  description: string;
}> = [
  {
    value: "plain",
    label: "더 담백하게",
    description: "행동과 사실 중심, 감정 표현은 최소화해요.",
  },
  {
    value: "balanced",
    label: "기본 균형",
    description: "담담한 사실에 은은한 분위기를 더해요.",
  },
  {
    value: "emotional",
    label: "조금 더 감성적으로",
    description: "분위기와 여운을 늘리되 과장하지 않아요.",
  },
];

const EMOTION_LABELS: Record<string, string> = {
  comfortable: "😌 편안해요",
  joyful: "😊 즐거워요",
  new: "✨ 새로워요",
  uncomfortable: "😣 불편해요",
  unsure: "🤔 잘 모르겠어요",
};

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

function getStyleLabel(style: EssayStyle) {
  return (
    STYLE_OPTIONS.find((option) => option.value === style)?.label ??
    "기본 균형"
  );
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

export default function EssayScreen() {
  const [dashboard, setDashboard] =
    useState<EssayDashboardData | null>(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  const [selectedEssay, setSelectedEssay] =
    useState<EssayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [activeVersionNo, setActiveVersionNo] = useState<1 | 2>(1);

  const [versionGenerating, setVersionGenerating] = useState(false);
  const [styleModalVisible, setStyleModalVisible] = useState(false);
  const [selectedStyle, setSelectedStyle] =
    useState<EssayStyle>("plain");
  const [versionSelecting, setVersionSelecting] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [recordDetail, setRecordDetail] =
    useState<EssayRecord | null>(null);

  const loadDashboard = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setScreenLoading(true);
      const data = await withJwtRetry(() => getEssayDashboardData());
      setDashboard(data);
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
      const detail = await withJwtRetry(() => getEssayById(essayId));
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

  const reloadSelectedEssay = async () => {
    if (!selectedEssay) return;
    const detail = await withJwtRetry(() => getEssayById(selectedEssay.id));
    setSelectedEssay(detail);
    setEditTitle(detail.title);
    setEditContent(detail.content);
    setActiveVersionNo(detail.versions[0]?.versionNo ?? 1);
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

  const handleCreateEssay = async () => {
    const journey = dashboard?.journey;

    if (!journey?.canCreateEssay || createLoading) return;

    Alert.alert(
      "AI 에세이를 만들까요?",
      "이 여정의 아직 사용되지 않은 기록을 날짜순으로 모아 버전 1을 만들어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "만들기",
          onPress: async () => {
            try {
              setCreateLoading(true);
              const essayId = await withJwtRetry(() => createEssayDraft(journey.id));
              await loadDashboard(false);
              await openEssay(essayId);
            } catch (error) {
              Alert.alert(
                "에세이 생성 실패",
                getErrorMessage(
                  error,
                  "AI 에세이를 생성하지 못했습니다.",
                ),
              );
              await loadDashboard(false);
            } finally {
              setCreateLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleRetryFirstVersion = async () => {
    if (!selectedEssay || versionGenerating) return;

    try {
      setVersionGenerating(true);
      await withJwtRetry(() => generateEssayVersion(selectedEssay.id, "balanced"));
      await reloadSelectedEssay();
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

  const handleGenerateSecondVersion = async () => {
    if (!selectedEssay || versionGenerating) return;

    try {
      setStyleModalVisible(false);
      setVersionGenerating(true);
      await withJwtRetry(() => generateEssayVersion(selectedEssay.id, selectedStyle));
      await reloadSelectedEssay();
      await loadDashboard(false);
    } catch (error) {
      Alert.alert(
        "AI로 다시 만들기 실패",
        getErrorMessage(error, "버전 2를 만들지 못했습니다."),
      );
    } finally {
      setVersionGenerating(false);
    }
  };

  const handleSelectVersion = (versionNo: 1 | 2) => {
    if (!selectedEssay || versionSelecting) return;

    Alert.alert(
      `버전 ${versionNo}을 선택할까요?`,
      "이 버전을 선택하면 다른 버전은 삭제됩니다. 선택한 버전으로 편집을 시작하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "선택하고 편집하기",
          onPress: async () => {
            try {
              setVersionSelecting(true);
              await withJwtRetry(() => selectEssayVersion(selectedEssay.id, versionNo));
              const detail = await withJwtRetry(() => getEssayById(selectedEssay.id));
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
      const detail = await withJwtRetry(() => getEssayById(selectedEssay.id));
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
              const detail = await withJwtRetry(() => getEssayById(selectedEssay.id));
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
      await Share.share({
        title: selectedEssay.title,
        message: `${selectedEssay.title}\n${selectedEssay.nickname} · ${formatPeriod(
          selectedEssay.startDate,
          selectedEssay.endDate,
        )}\n\n${selectedEssay.content}`,
      });
    } catch {
      Alert.alert("공유 실패", "에세이를 공유하지 못했습니다.");
    }
  };

  const selectedVersion = useMemo(() => {
    return selectedEssay?.versions.find(
      (version) => version.versionNo === activeVersionNo,
    );
  }, [activeVersionNo, selectedEssay]);

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
                    : selectedEssay.visibility === "public"
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
                  <View style={styles.versionTabs}>
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
                            style={[
                              styles.versionTabStyle,
                              selected && styles.versionTabStyleSelected,
                            ]}
                          >
                            {getStyleLabel(version.style)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

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

                    <Text style={styles.versionTitle}>
                      {selectedVersion?.title}
                    </Text>
                    <Text style={styles.versionBody}>
                      {selectedVersion?.content}
                    </Text>

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
                      onPress={() => setStyleModalVisible(true)}
                      disabled={
                        selectedEssay.versions.length >= 2 ||
                        versionGenerating
                      }
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.buttonPressed,
                        (selectedEssay.versions.length >= 2 ||
                          versionGenerating) && styles.disabledButton,
                      ]}
                    >
                      {versionGenerating ? (
                        <ActivityIndicator color={COLORS.primary} />
                      ) : (
                        <Text style={styles.secondaryButtonText}>
                          {selectedEssay.versions.length >= 2
                            ? "AI로 다시 만들기 사용 완료"
                            : "AI로 다시 만들기"}
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
              >
                <CoverVisual uri={selectedEssay.coverPhotoUrl} height={220} />

                <View style={styles.detailContent}>
                  <View style={styles.publicationRow}>
                    <View
                      style={[
                        styles.publicationBadge,
                        selectedEssay.visibility === "public"
                          ? styles.publicBadge
                          : styles.privateBadge,
                      ]}
                    >
                      <Ionicons
                        name={
                          selectedEssay.visibility === "public"
                            ? "globe-outline"
                            : "lock-closed-outline"
                        }
                        size={13}
                        color={
                          selectedEssay.visibility === "public"
                            ? COLORS.green
                            : COLORS.primary
                        }
                      />
                      <Text
                        style={[
                          styles.publicationBadgeText,
                          selectedEssay.visibility === "public"
                            ? styles.publicBadgeText
                            : styles.privateBadgeText,
                        ]}
                      >
                        {selectedEssay.visibility === "public"
                          ? "공개"
                          : "비공개 초안"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.detailTitle}>
                    {selectedEssay.title}
                  </Text>
                  <Text style={styles.detailByline}>
                    {selectedEssay.nickname} · {formatPeriod(
                      selectedEssay.startDate,
                      selectedEssay.endDate,
                    )}
                  </Text>

                  <Text style={styles.essayBodyText}>
                    {selectedEssay.content}
                  </Text>

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
                  selectedEssay.visibility === "public" ? (
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
          visible={styleModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setStyleModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setStyleModalVisible(false)}
            />
            <View style={styles.styleModalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.styleModalCaption}>버전 2 생성</Text>
              <Text style={styles.styleModalTitle}>
                어떤 문체로 다시 만들까요?
              </Text>
              <Text style={styles.styleModalDescription}>
                선택한 문체는 제목과 본문 전체에 적용돼요.
              </Text>

              {STYLE_OPTIONS.map((option) => {
                const selected = selectedStyle === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSelectedStyle(option.value)}
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
                        {option.label}
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

              <Pressable
                onPress={() => void handleGenerateSecondVersion()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  이 문체로 버전 2 만들기
                </Text>
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
            진행한 여정을 하나의 글로 모아봐요
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
                      ? "AI 에세이 만들기"
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
                        essay.visibility === "public"
                          ? styles.listStatusPublic
                          : styles.listStatusPrivate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.listStatusText,
                          essay.visibility === "public"
                            ? styles.listStatusPublicText
                            : styles.listStatusPrivateText,
                        ]}
                      >
                        {essay.selectedVersionNo === null
                          ? essay.generationState === "generating"
                            ? "생성 중"
                            : "버전 선택"
                          : essay.visibility === "public"
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
                    {essay.durationDays}일 여정 · 기록 {essay.sourceRecordCount}개
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
                여정을 완료하면 AI가 일상의 기록을 블로그형 글로 정리해줘요.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
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
  versionTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: COLORS.background,
  },
  versionTab: {
    flex: 1,
    minHeight: 58,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
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