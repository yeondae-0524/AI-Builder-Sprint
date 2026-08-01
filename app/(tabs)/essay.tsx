import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createEssayDraft,
  ESSAY_PERSONA_OPTIONS,
  EssayDashboardData,
  EssayDetail,
  EssayPersona,
  EssaySummary,
  generateEssayVersion,
  getEssayById,
  getEssayDashboardData,
  getEssayPersonaLabel,
  publishEssay,
  saveEssayDraft,
} from "../../services/essay.service";

type PersonaModalMode = "create" | "regenerate" | null;

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

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatPeriod(startDate: string, endDate: string | null) {
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "진행 중";
  return `${start} - ${end}`;
}

function getPersonaIcon(persona: EssayPersona) {
  return (
    ESSAY_PERSONA_OPTIONS.find((option) => option.value === persona)?.icon ??
    "document-text-outline"
  ) as keyof typeof Ionicons.glyphMap;
}

function PersonaBadge({ persona }: { persona: EssayPersona }) {
  return (
    <View style={styles.personaBadge}>
      <Ionicons
        name={getPersonaIcon(persona)}
        size={14}
        color="#315C4A"
      />
      <Text style={styles.personaBadgeText}>
        {getEssayPersonaLabel(persona)}
      </Text>
    </View>
  );
}

function EssayCard({
  essay,
  onPress,
}: {
  essay: EssaySummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.essayCard,
        pressed && styles.pressed,
      ]}
    >
      {essay.coverPhotoUrl ? (
        <Image
          source={{ uri: essay.coverPhotoUrl }}
          style={styles.essayCardImage}
        />
      ) : (
        <View style={styles.essayCardPlaceholder}>
          <Ionicons name="book-outline" size={36} color="#6D8579" />
        </View>
      )}

      <View style={styles.essayCardBody}>
        <PersonaBadge persona={essay.persona} />
        <Text style={styles.essayCardTitle} numberOfLines={2}>
          {essay.title}
        </Text>
        <Text style={styles.essayCardPeriod}>
          {formatPeriod(essay.startDate, essay.endDate)}
        </Text>
        <View style={styles.essayCardFooter}>
          <Text style={styles.essayCardMeta}>
            기록 {essay.sourceRecordCount}개 · AI 생성 {essay.generationCount}회
          </Text>
          <View
            style={[
              styles.visibilityPill,
              essay.visibility === "public" && styles.visibilityPillPublic,
            ]}
          >
            <Text
              style={[
                styles.visibilityText,
                essay.visibility === "public" && styles.visibilityTextPublic,
              ]}
            >
              {essay.visibility === "public" ? "공개" : "비공개"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

type PersonaPickerViewProps = {
  mode: Exclude<PersonaModalMode, null>;
  busy: boolean;
  onClose: () => void;
  onSelect: (persona: EssayPersona) => void;
};

function PersonaPickerContent({
  mode,
  busy,
  onClose,
  onSelect,
}: PersonaPickerViewProps) {
  const title = mode === "create"
    ? "내 기록을 누구에게 맡길까요?"
    : "이번에는 누가 읽어볼까요?";

  return (
    <View style={styles.personaModalCard}>
      <View style={styles.modalHeader}>
        <View style={styles.modalHeaderTextWrap}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>
            같은 기록도 AI의 역할에 따라 전혀 다르게 해석돼요.
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          disabled={busy}
          style={styles.iconButton}
        >
          <Ionicons name="close" size={24} color="#25352D" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.personaOptionList}
        showsVerticalScrollIndicator={false}
      >
        {ESSAY_PERSONA_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            disabled={busy}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.personaOption,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <View style={styles.personaOptionIcon}>
              <Ionicons
                name={option.icon as keyof typeof Ionicons.glyphMap}
                size={25}
                color="#315C4A"
              />
            </View>
            <View style={styles.personaOptionTextWrap}>
              <Text style={styles.personaOptionTitle}>{option.title}</Text>
              <Text style={styles.personaOptionDescription}>
                {option.description}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={21}
              color="#819087"
            />
          </Pressable>
        ))}
      </ScrollView>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color="#315C4A" />
          <Text style={styles.busyText}>기록을 읽고 있어요...</Text>
        </View>
      ) : null}
    </View>
  );
}

function PersonaPickerModal({
  visible,
  mode,
  busy,
  onClose,
  onSelect,
}: PersonaPickerViewProps & { visible: boolean }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <PersonaPickerContent
          mode={mode}
          busy={busy}
          onClose={onClose}
          onSelect={onSelect}
        />
      </View>
    </Modal>
  );
}

function PersonaPickerOverlay({
  visible,
  mode,
  busy,
  onClose,
  onSelect,
}: PersonaPickerViewProps & { visible: boolean }) {
  if (!visible) return null;

  return (
    <View style={styles.personaOverlay}>
      <PersonaPickerContent
        mode={mode}
        busy={busy}
        onClose={onClose}
        onSelect={onSelect}
      />
    </View>
  );
}

function InsightSection({ detail }: { detail: EssayDetail }) {
  const meta = detail.selectedMeta;

  if (
    !meta.summary &&
    !meta.verdict &&
    meta.insights.length === 0 &&
    !meta.aiRecommendation
  ) {
    return null;
  }

  return (
    <View style={styles.analysisSection}>
      <Text style={styles.sectionTitle}>AI가 읽은 이번 여정</Text>

      {meta.verdict ? (
        <View style={styles.verdictCard}>
          <Text style={styles.verdictText}>{meta.verdict}</Text>
        </View>
      ) : null}

      {meta.summary ? (
        <Text style={styles.summaryText}>{meta.summary}</Text>
      ) : null}

      {meta.insights.length > 0 ? (
        <View style={styles.insightList}>
          {meta.insights.map((insight, index) => (
            <View
              key={`${insight.keyword}-${index}`}
              style={styles.insightCard}
            >
              <Text style={styles.insightKeyword}>{insight.keyword}</Text>
              <Text style={styles.insightDescription}>
                {insight.description}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {meta.aiRecommendation ? (
        <View style={styles.recommendationCard}>
          <Ionicons name="sparkles" size={18} color="#805D25" />
          <Text style={styles.recommendationText}>
            {meta.aiRecommendation}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function EssayScreen() {
  const [dashboard, setDashboard] = useState<EssayDashboardData | null>(null);
  const [selectedEssay, setSelectedEssay] = useState<EssayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [personaModalMode, setPersonaModalMode] =
    useState<PersonaModalMode>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [recordsExpanded, setRecordsExpanded] = useState(false);

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const data = await getEssayDashboardData();
      setDashboard(data);
    } catch (error) {
      Alert.alert(
        "에세이 불러오기 실패",
        getErrorMessage(error, "에세이 목록을 불러오지 못했습니다."),
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const loadEssayDetail = useCallback(async (essayId: string) => {
    setDetailLoading(true);

    try {
      const detail = await getEssayById(essayId);
      setSelectedEssay(detail);
      setEditTitle(detail.title);
      setEditContent(detail.content);
      return detail;
    } catch (error) {
      Alert.alert(
        "에세이 불러오기 실패",
        getErrorMessage(error, "에세이를 불러오지 못했습니다."),
      );
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (!selectedEssay) return;
    setEditTitle(selectedEssay.title);
    setEditContent(selectedEssay.content);
  }, [selectedEssay]);


  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard(false);

    if (selectedEssay) {
      await loadEssayDetail(selectedEssay.id);
    }

    setRefreshing(false);
  }, [loadDashboard, loadEssayDetail, selectedEssay]);

  const openEssay = useCallback(
    async (essayId: string) => {
      setRecordsExpanded(false);
      await loadEssayDetail(essayId);
    },
    [loadEssayDetail],
  );

  const closeDetail = useCallback(() => {
    if (actionBusy) return;
    setSelectedEssay(null);
    setRecordsExpanded(false);
  }, [actionBusy]);

  const openCreatePicker = useCallback(() => {
    const journey = dashboard?.journey;

    if (!journey) {
      Alert.alert("만들 수 있는 여정이 없어요", "먼저 여정을 진행해주세요.");
      return;
    }

    if (!journey.canCreateEssay) {
      Alert.alert(
        "아직 기록이 더 필요해요",
        `${journey.completedDayCount}/${journey.targetDayCount}일을 기록했어요. 목표 기록을 채우면 AI 에세이를 만들 수 있어요.`,
      );
      return;
    }

    setPersonaModalMode("create");
  }, [dashboard]);

  const handlePersonaSelect = useCallback(
    async (persona: EssayPersona) => {
      if (actionBusy) return;

      setActionBusy(true);

      try {
        if (personaModalMode === "create") {
          const journey = dashboard?.journey;
          if (!journey) throw new Error("에세이를 만들 여정이 없습니다.");

          const essayId = await createEssayDraft(journey.id, { persona });
          setPersonaModalMode(null);
          await loadDashboard(false);
          await loadEssayDetail(essayId);
        } else if (personaModalMode === "regenerate") {
          if (!selectedEssay) throw new Error("에세이를 찾지 못했습니다.");

          await generateEssayVersion(selectedEssay.id, { persona });
          setPersonaModalMode(null);
          await loadEssayDetail(selectedEssay.id);
          await loadDashboard(false);
        }
      } catch (error) {
        Alert.alert(
          "AI 에세이 생성 실패",
          getErrorMessage(error, "AI 에세이를 만들지 못했습니다."),
        );
      } finally {
        setActionBusy(false);
      }
    },
    [
      actionBusy,
      dashboard,
      loadDashboard,
      loadEssayDetail,
      personaModalMode,
      selectedEssay,
    ],
  );

  const handleSave = useCallback(async () => {
    if (!selectedEssay || actionBusy) return;

    setActionBusy(true);
    try {
      await saveEssayDraft(selectedEssay.id, {
        title: editTitle,
        content: editContent,
      });
      await loadEssayDetail(selectedEssay.id);
      await loadDashboard(false);
      Alert.alert("저장 완료", "에세이 수정 내용을 저장했어요.");
    } catch (error) {
      Alert.alert(
        "저장 실패",
        getErrorMessage(error, "에세이를 저장하지 못했습니다."),
      );
    } finally {
      setActionBusy(false);
    }
  }, [
    actionBusy,
    editContent,
    editTitle,
    loadDashboard,
    loadEssayDetail,
    selectedEssay,
  ]);

  const handlePublish = useCallback(() => {
    if (!selectedEssay || actionBusy) return;

    Alert.alert(
      "에세이를 공개할까요?",
      "공개한 에세이는 다른 사용자에게 보일 수 있어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "공개",
          onPress: async () => {
            setActionBusy(true);
            try {
              await saveEssayDraft(selectedEssay.id, {
                title: editTitle,
                content: editContent,
              });
              await publishEssay(selectedEssay.id);
              await loadEssayDetail(selectedEssay.id);
              await loadDashboard(false);
              Alert.alert("공개 완료", "에세이를 공개했어요.");
            } catch (error) {
              Alert.alert(
                "공개 실패",
                getErrorMessage(error, "에세이를 공개하지 못했습니다."),
              );
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  }, [
    actionBusy,
    editContent,
    editTitle,
    loadDashboard,
    loadEssayDetail,
    selectedEssay,
  ]);

  const handleShare = useCallback(async () => {
    if (!selectedEssay) return;

    try {
      await Share.share({
        title: editTitle || selectedEssay.title,
        message: `${editTitle || selectedEssay.title}\n\n${
          editContent || selectedEssay.content
        }`,
      });
    } catch (error) {
      Alert.alert(
        "공유 실패",
        getErrorMessage(error, "에세이를 공유하지 못했습니다."),
      );
    }
  }, [editContent, editTitle, selectedEssay]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#315C4A" />
          <Text style={styles.loadingText}>에세이 책장을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const journey = dashboard?.journey ?? null;
  const essays = dashboard?.essays ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BEGIN AGAIN</Text>
            <Text style={styles.headerTitle}>AI 에세이 책장</Text>
            <Text style={styles.headerDescription}>
              내 기록을 네 가지 관점으로 다시 읽어보세요.
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="library-outline" size={29} color="#315C4A" />
          </View>
        </View>

        {journey ? (
          <View style={styles.journeyCard}>
            <View style={styles.journeyTopRow}>
              <View style={styles.journeyTextWrap}>
                <Text style={styles.journeyLabel}>현재 여정</Text>
                <Text style={styles.journeyTitle}>{journey.title}</Text>
                <Text style={styles.journeyPeriod}>
                  {journey.durationDays}일 여정 · {journey.completedDayCount}/
                  {journey.targetDayCount}일 기록
                </Text>
              </View>
              <View style={styles.progressCircle}>
                <Text style={styles.progressNumber}>
                  {journey.targetDayCount > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (journey.completedDayCount /
                            journey.targetDayCount) *
                            100,
                        ),
                      )
                    : 0}
                </Text>
                <Text style={styles.progressUnit}>%</Text>
              </View>
            </View>

            <Pressable
              onPress={openCreatePicker}
              style={({ pressed }) => [
                styles.primaryButton,
                !journey.canCreateEssay && styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={journey.canCreateEssay ? "sparkles" : "lock-closed"}
                size={18}
                color={journey.canCreateEssay ? "#FFFFFF" : "#315C4A"}
              />
              <Text
                style={[
                  styles.primaryButtonText,
                  !journey.canCreateEssay && styles.secondaryButtonText,
                ]}
              >
                {journey.canCreateEssay
                  ? "AI 에세이 만들기"
                  : "목표 기록을 채워주세요"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyJourneyCard}>
            <Ionicons name="walk-outline" size={30} color="#6D8579" />
            <Text style={styles.emptyJourneyTitle}>진행 중인 여정이 없어요</Text>
            <Text style={styles.emptyJourneyText}>
              새로운 여정을 시작하고 기록을 채우면 AI 에세이를 만들 수 있어요.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>나의 에세이</Text>
          <Text style={styles.sectionCount}>{essays.length}권</Text>
        </View>

        {essays.length > 0 ? (
          <View style={styles.essayList}>
            {essays.map((essay) => (
              <EssayCard
                key={essay.id}
                essay={essay}
                onPress={() => void openEssay(essay.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyShelf}>
            <Ionicons name="book-outline" size={43} color="#A3AEA8" />
            <Text style={styles.emptyShelfTitle}>아직 완성된 책이 없어요</Text>
            <Text style={styles.emptyShelfText}>
              여정의 기록을 채우고 첫 번째 AI 에세이를 만들어보세요.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(selectedEssay)}
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <SafeAreaView style={styles.detailSafeArea}>
          {detailLoading || !selectedEssay ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#315C4A" />
              <Text style={styles.loadingText}>에세이를 펼치는 중...</Text>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={styles.detailKeyboard}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={styles.detailHeader}>
                <Pressable onPress={closeDetail} style={styles.iconButton}>
                  <Ionicons name="chevron-back" size={27} color="#25352D" />
                </Pressable>
                <Text style={styles.detailHeaderTitle} numberOfLines={1}>
                  {selectedEssay.journeyTitle}
                </Text>
                <Pressable onPress={handleShare} style={styles.iconButton}>
                  <Ionicons name="share-outline" size={23} color="#25352D" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailContent}
                keyboardShouldPersistTaps="handled"
              >
                {selectedEssay.coverPhotoUrl ? (
                  <Image
                    source={{ uri: selectedEssay.coverPhotoUrl }}
                    style={styles.coverImage}
                  />
                ) : null}

                <View style={styles.detailMetaRow}>
                  <PersonaBadge persona={selectedEssay.persona} />
                  <Text style={styles.detailPeriod}>
                    {formatPeriod(
                      selectedEssay.startDate,
                      selectedEssay.endDate,
                    )}
                  </Text>
                </View>

                <View style={styles.editorSection}>
                  <Pressable
                    disabled={actionBusy}
                    onPress={() => setPersonaModalMode("regenerate")}
                    style={({ pressed }) => [
                      styles.changeAiButton,
                      pressed && styles.pressed,
                      actionBusy && styles.disabled,
                    ]}
                  >
                    <View style={styles.changeAiButtonTextWrap}>
                      <Text style={styles.changeAiButtonTitle}>
                        다른 AI에게 다시 맡기기
                      </Text>
                      <Text style={styles.changeAiButtonDescription}>
                        이전 결과 대신 새 에세이로 바로 바뀌어요.
                      </Text>
                    </View>
                    <Ionicons
                      name="swap-horizontal"
                      size={22}
                      color="#315C4A"
                    />
                  </Pressable>

                  <Text style={styles.inputLabel}>제목</Text>
                  <TextInput
                    value={editTitle}
                    onChangeText={setEditTitle}
                    style={styles.titleInput}
                    placeholder="에세이 제목"
                    placeholderTextColor="#9AA49F"
                  />

                  <Text style={styles.inputLabel}>본문</Text>
                  <TextInput
                    value={editContent}
                    onChangeText={setEditContent}
                    style={styles.contentInput}
                    placeholder="에세이 본문"
                    placeholderTextColor="#9AA49F"
                    multiline
                    scrollEnabled={false}
                    textAlignVertical="top"
                  />

                  <InsightSection detail={selectedEssay} />

                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={actionBusy}
                      onPress={handleSave}
                      style={({ pressed }) => [
                        styles.outlineActionButton,
                        pressed && styles.pressed,
                        actionBusy && styles.disabled,
                      ]}
                    >
                      <Text style={styles.outlineActionButtonText}>저장</Text>
                    </Pressable>
                    <Pressable
                      disabled={actionBusy}
                      onPress={handlePublish}
                      style={({ pressed }) => [
                        styles.publishButton,
                        pressed && styles.pressed,
                        actionBusy && styles.disabled,
                      ]}
                    >
                      <Text style={styles.publishButtonText}>
                        {selectedEssay.visibility === "public"
                          ? "다시 공개 저장"
                          : "공개하기"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.recordsSection}>
                  <Pressable
                    onPress={() => setRecordsExpanded((value) => !value)}
                    style={styles.recordsHeader}
                  >
                    <View>
                      <Text style={styles.sectionTitle}>에세이에 담긴 기록</Text>
                      <Text style={styles.recordsCount}>
                        총 {selectedEssay.records.length}개의 기록
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        recordsExpanded ? "chevron-up" : "chevron-down"
                      }
                      size={22}
                      color="#52635A"
                    />
                  </Pressable>

                  {recordsExpanded ? (
                    <View style={styles.recordList}>
                      {selectedEssay.records.map((record, index) => (
                        <View key={record.id} style={styles.recordCard}>
                          <View style={styles.recordIndex}>
                            <Text style={styles.recordIndexText}>
                              {index + 1}
                            </Text>
                          </View>
                          <View style={styles.recordBody}>
                            <Text style={styles.recordTitle}>
                              {record.missionTitle}
                            </Text>
                            <Text style={styles.recordMeta}>
                              {[record.categoryName, record.placeName, formatDate(record.recordedAt)]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                            {record.emotion ? (
                              <Text style={styles.recordEmotion}>
                                감정: {record.emotion}
                              </Text>
                            ) : null}
                            <Text style={styles.recordContent}>
                              {record.content}
                            </Text>
                            {record.photoUrls.length > 0 ? (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.recordPhotoRow}
                              >
                                {record.photoUrls.map((url) => (
                                  <Image
                                    key={url}
                                    source={{ uri: url }}
                                    style={styles.recordPhoto}
                                  />
                                ))}
                              </ScrollView>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </ScrollView>

              <PersonaPickerOverlay
                visible={personaModalMode === "regenerate"}
                mode="regenerate"
                busy={actionBusy}
                onClose={() => {
                  if (!actionBusy) setPersonaModalMode(null);
                }}
                onSelect={(persona) => void handlePersonaSelect(persona)}
              />

              {actionBusy ? (
                <View style={styles.actionBusyOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.actionBusyText}>처리 중이에요...</Text>
                </View>
              ) : null}
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>

      <PersonaPickerModal
        visible={personaModalMode === "create"}
        mode="create"
        busy={actionBusy}
        onClose={() => {
          if (!actionBusy) setPersonaModalMode(null);
        }}
        onSelect={(persona) => void handlePersonaSelect(persona)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F2E9",
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: "#52635A",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    color: "#1F3027",
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  headerDescription: {
    color: "#65766D",
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
    backgroundColor: "#315C4A",
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },
  journeyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  journeyTextWrap: {
    flex: 1,
  },
  journeyLabel: {
    color: "#BFD0C7",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 5,
  },
  journeyTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
  },
  journeyPeriod: {
    color: "#D8E2DC",
    fontSize: 13,
    marginTop: 7,
  },
  progressCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderColor: "#9FBAAC",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  progressNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  progressUnit: {
    color: "#D8E2DC",
    fontSize: 11,
    marginTop: 6,
  },
  primaryButton: {
    marginTop: 18,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#F2C96D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#26372E",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#DDE6E0",
  },
  secondaryButtonText: {
    color: "#315C4A",
  },
  emptyJourneyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#E3E3DC",
  },
  emptyJourneyTitle: {
    color: "#26372E",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 10,
  },
  emptyJourneyText: {
    color: "#728078",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },
  sectionTitle: {
    color: "#26372E",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionCount: {
    color: "#728078",
    fontSize: 13,
  },
  essayList: {
    gap: 14,
  },
  essayCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E3E3DC",
    flexDirection: "row",
    minHeight: 154,
  },
  essayCardImage: {
    width: 112,
    height: "100%",
    minHeight: 154,
  },
  essayCardPlaceholder: {
    width: 112,
    minHeight: 154,
    backgroundColor: "#E4EBE6",
    alignItems: "center",
    justifyContent: "center",
  },
  essayCardBody: {
    flex: 1,
    padding: 15,
  },
  personaBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E5EEE8",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  personaBadgeText: {
    color: "#315C4A",
    fontSize: 11,
    fontWeight: "800",
  },
  essayCardTitle: {
    color: "#26372E",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
    marginTop: 9,
  },
  essayCardPeriod: {
    color: "#7B8881",
    fontSize: 11,
    marginTop: 6,
  },
  essayCardFooter: {
    marginTop: "auto",
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  essayCardMeta: {
    color: "#718078",
    fontSize: 11,
    flex: 1,
  },
  visibilityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: "#F0F1EE",
  },
  visibilityPillPublic: {
    backgroundColor: "#FFF0C9",
  },
  visibilityText: {
    color: "#738078",
    fontSize: 10,
    fontWeight: "700",
  },
  visibilityTextPublic: {
    color: "#87631F",
  },
  emptyShelf: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 58,
    paddingHorizontal: 25,
    backgroundColor: "#EEEDE6",
    borderRadius: 22,
  },
  emptyShelfTitle: {
    color: "#44534B",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
  },
  emptyShelfText: {
    color: "#7B8781",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.55,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24, 35, 29, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  personaOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    backgroundColor: "rgba(24, 35, 29, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  personaModalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    backgroundColor: "#F9F7F1",
    borderRadius: 25,
    padding: 19,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 13,
  },
  modalHeaderTextWrap: {
    flex: 1,
  },
  modalTitle: {
    color: "#26372E",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    color: "#728078",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  personaOptionList: {
    gap: 10,
    paddingBottom: 5,
  },
  personaOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E3DC",
    borderRadius: 18,
    padding: 14,
  },
  personaOptionIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: "#E5EEE8",
    alignItems: "center",
    justifyContent: "center",
  },
  personaOptionTextWrap: {
    flex: 1,
  },
  personaOptionTitle: {
    color: "#26372E",
    fontSize: 16,
    fontWeight: "800",
  },
  personaOptionDescription: {
    color: "#6F7D75",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  busyRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    paddingTop: 14,
  },
  busyText: {
    color: "#52635A",
    fontSize: 13,
  },
  detailSafeArea: {
    flex: 1,
    backgroundColor: "#F8F5ED",
  },
  detailKeyboard: {
    flex: 1,
  },
  detailHeader: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E3E1D9",
    backgroundColor: "#F8F5ED",
  },
  detailHeaderTitle: {
    flex: 1,
    textAlign: "center",
    color: "#26372E",
    fontSize: 16,
    fontWeight: "800",
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    paddingBottom: 140,
  },
  coverImage: {
    width: "100%",
    height: 270,
  },
  detailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  detailPeriod: {
    color: "#77847D",
    fontSize: 12,
  },
  versionSection: {
    padding: 20,
    gap: 13,
  },
  versionGuide: {
    color: "#728078",
    fontSize: 13,
    lineHeight: 20,
    marginTop: -5,
  },
  versionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#E0E1DA",
    padding: 17,
  },
  versionCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  versionNumberBadge: {
    width: 34,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#283A31",
    alignItems: "center",
    justifyContent: "center",
  },
  versionNumberText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  versionTitle: {
    color: "#26372E",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 27,
    marginTop: 15,
  },
  versionVerdict: {
    color: "#806126",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 10,
    backgroundColor: "#FFF3D5",
    borderRadius: 12,
    padding: 11,
  },
  versionPreview: {
    color: "#526159",
    fontSize: 14,
    lineHeight: 23,
    marginTop: 12,
  },
  selectVersionButton: {
    height: 45,
    borderRadius: 14,
    backgroundColor: "#315C4A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  selectVersionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  outlineButton: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#315C4A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  outlineButtonText: {
    color: "#315C4A",
    fontSize: 14,
    fontWeight: "800",
  },
  editorSection: {
    paddingHorizontal: 20,
    paddingTop: 19,
  },
  changeAiButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    backgroundColor: "#E8F0EB",
    borderWidth: 1,
    borderColor: "#C8D8CF",
    borderRadius: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 22,
  },
  changeAiButtonTextWrap: {
    flex: 1,
  },
  changeAiButtonTitle: {
    color: "#294A3B",
    fontSize: 15,
    fontWeight: "800",
  },
  changeAiButtonDescription: {
    color: "#66766E",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  inputLabel: {
    color: "#536159",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
  },
  titleInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE0D9",
    borderRadius: 15,
    color: "#26372E",
    fontSize: 20,
    fontWeight: "800",
    paddingHorizontal: 15,
    paddingVertical: 13,
    marginBottom: 17,
  },
  contentInput: {
    minHeight: 320,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE0D9",
    borderRadius: 17,
    color: "#35443C",
    fontSize: 15,
    lineHeight: 26,
    padding: 16,
  },
  analysisSection: {
    marginTop: 25,
    gap: 12,
  },
  verdictCard: {
    backgroundColor: "#2D4F40",
    borderRadius: 17,
    padding: 17,
  },
  verdictText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 24,
  },
  summaryText: {
    color: "#536159",
    fontSize: 14,
    lineHeight: 22,
  },
  insightList: {
    gap: 9,
  },
  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0E1DA",
  },
  insightKeyword: {
    color: "#315C4A",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 5,
  },
  insightDescription: {
    color: "#596860",
    fontSize: 13,
    lineHeight: 20,
  },
  recommendationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: "#FFF0C9",
    borderRadius: 15,
    padding: 14,
  },
  recommendationText: {
    flex: 1,
    color: "#6E521F",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  outlineActionButton: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#315C4A",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineActionButtonText: {
    color: "#315C4A",
    fontWeight: "800",
    fontSize: 14,
  },
  publishButton: {
    flex: 1.5,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#315C4A",
    alignItems: "center",
    justifyContent: "center",
  },
  publishButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  recordsSection: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  recordsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#DFDED7",
  },
  recordsCount: {
    color: "#78847D",
    fontSize: 12,
    marginTop: 4,
  },
  recordList: {
    gap: 12,
    paddingTop: 14,
  },
  recordCard: {
    flexDirection: "row",
    gap: 11,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E1E1DA",
  },
  recordIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E4ECE7",
    alignItems: "center",
    justifyContent: "center",
  },
  recordIndexText: {
    color: "#315C4A",
    fontSize: 12,
    fontWeight: "900",
  },
  recordBody: {
    flex: 1,
  },
  recordTitle: {
    color: "#2A3931",
    fontSize: 15,
    fontWeight: "800",
  },
  recordMeta: {
    color: "#849089",
    fontSize: 11,
    marginTop: 4,
  },
  recordEmotion: {
    color: "#7B5D24",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  recordContent: {
    color: "#56645C",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
  recordPhotoRow: {
    gap: 8,
    paddingTop: 10,
  },
  recordPhoto: {
    width: 92,
    height: 92,
    borderRadius: 12,
  },
  actionBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(29, 47, 38, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  actionBusyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});