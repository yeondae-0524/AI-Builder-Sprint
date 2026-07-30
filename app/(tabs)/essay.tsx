import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import {
  createEssayDraft,
  generateAndSaveEssay,
  getEssayById,
  getMyEssays,
  updateEssay,
} from "../../services/essay.service";
import { getRecordPhotoUrl } from "../../services/storage.service";
import { getChallengeRecommendation } from "../../services/upstage";

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
};

const PHOTOS = {
  cafeWindow:
    "https://images.unsplash.com/photo-1763821019549-541dafc5d439?w=800&h=500&fit=crop&auto=format",

  bench:
    "https://images.unsplash.com/photo-1573493334464-21388936965a?w=400&h=400&fit=crop&auto=format",

  street:
    "https://images.unsplash.com/photo-1768006372397-7b08a0b9d1d3?w=400&h=500&fit=crop&auto=format",

  nightLamp:
    "https://images.unsplash.com/photo-1579114213255-d8d82bfff681?w=400&h=500&fit=crop&auto=format",

  latte:
    "https://images.unsplash.com/photo-1558210834-473f430c09ac?w=400&h=400&fit=crop&auto=format",
};

const BOOK_COLORS = [
  "#1E3A5F",
  "#2D5A4A",
  "#5C3D2E",
  "#3B4A6B",
  "#60435F",
];

type EssayThickness = "thin" | "medium" | "thick";

type Essay = {
  id: string;
  journeyId: string;
  title: string;
  period: string;
  year: string;
  thickness: EssayThickness;
  color: string;
  photo: string;
  coverPhoto: string;
};

type EssayEntry = {
  id: string;
  photo: string;
  mission: string;
  userText: string;
  aiText: string;
};

type JourneyCard = {
  id: string;
  title: string;
  durationDays: number;
  targetRecordCount: number;
  recordCount: number;
  startDate: string;
  endDate: string | null;
  status: "active" | "completed";
  canCreateEssay: boolean;
};

const SPINE_WIDTH: Record<EssayThickness, number> = {
  thin: 24,
  medium: 40,
  thick: 60,
};

const SPINE_HEIGHT = 172;

function getSingleRelation<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getRelationArray<T>(
  value: T | T[] | null | undefined,
): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  return error instanceof Error
    ? error.message
    : fallback;
}

function formatShortDate(
  value: string | null | undefined,
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${date.getMonth() + 1}. ${date.getDate()}`;
}

function formatPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) {
  return `${formatShortDate(startDate)} – ${formatShortDate(
    endDate ?? startDate,
  )}`;
}

function getYear(
  value: string | null | undefined,
) {
  if (!value) {
    return String(new Date().getFullYear());
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(new Date().getFullYear());
  }

  return String(date.getFullYear());
}

function getThickness(
  itemCount: number,
): EssayThickness {
  if (itemCount >= 15) {
    return "thick";
  }

  if (itemCount >= 7) {
    return "medium";
  }

  return "thin";
}

async function resolvePhotoUrl(
  storagePath: string | null | undefined,
  fallback: string,
) {
  if (!storagePath) {
    return fallback;
  }

  if (/^https?:\/\//i.test(storagePath)) {
    return storagePath;
  }

  try {
    return await getRecordPhotoUrl(storagePath);
  } catch (error) {
    console.warn(
      "사진 signed URL 생성 실패:",
      error,
    );
    return fallback;
  }
}

async function mapEssayListItem(
  item: any,
  index: number,
): Promise<Essay> {
  const journey = getSingleRelation<any>(
    item.journeys,
  );

  const itemCount = getRelationArray<any>(
    item.essay_items,
  ).length;

  const coverPhoto = await resolvePhotoUrl(
    item.cover_photo_path,
    PHOTOS.cafeWindow,
  );

  const startDate =
    journey?.start_date ?? item.created_at;

  const endDate =
    journey?.end_date ?? item.updated_at;

  return {
    id: String(item.id),
    journeyId: String(item.journey_id),
    title: item.title ?? "나의 에세이",
    period: formatPeriod(startDate, endDate),
    year: getYear(startDate),
    thickness: getThickness(itemCount),
    color:
      BOOK_COLORS[index % BOOK_COLORS.length],
    photo: coverPhoto,
    coverPhoto,
  };
}

async function mapEssayEntries(
  detail: any,
): Promise<EssayEntry[]> {
  const rawItems = getRelationArray<any>(
    detail.essay_items,
  ).sort(
    (a, b) =>
      Number(a.sort_order ?? 0) -
      Number(b.sort_order ?? 0),
  );

  const mapped = await Promise.all(
    rawItems.map(async (item, index) => {
      const record = getSingleRelation<any>(
        item.records,
      );

      if (!record) {
        return null;
      }

      const missionAttempt =
        getSingleRelation<any>(
          record.mission_attempts,
        );

      const mission = getSingleRelation<any>(
        missionAttempt?.missions,
      );

      const photos = getRelationArray<any>(
        record.record_photos,
      ).sort((a, b) => {
        if (
          Boolean(a.is_cover) !==
          Boolean(b.is_cover)
        ) {
          return a.is_cover ? -1 : 1;
        }

        return (
          Number(a.sort_order ?? 0) -
          Number(b.sort_order ?? 0)
        );
      });

      const photoUrl = await resolvePhotoUrl(
        photos[0]?.storage_path,
        index % 2 === 0
          ? PHOTOS.bench
          : PHOTOS.latte,
      );

      return {
        id: String(item.id),
        photo: photoUrl,
        mission:
          mission?.title ?? "기록한 경험",
        userText:
          record.content ?? "작성된 기록이 없습니다.",
        aiText:
          item.ai_bridge_text ??
          "AI 연결 문장을 준비하고 있습니다.",
      };
    }),
  );

  return mapped.filter(
    (item): item is EssayEntry =>
      item !== null,
  );
}

export default function EssayScreen() {
  const [essays, setEssays] = useState<Essay[]>(
    [],
  );
  const [selectedEssay, setSelectedEssay] =
    useState<Essay | null>(null);
  const [selectedEntries, setSelectedEntries] =
    useState<EssayEntry[]>([]);
  const [journeyCard, setJourneyCard] =
    useState<JourneyCard | null>(null);

  const [screenLoading, setScreenLoading] =
    useState(true);
  const [detailLoading, setDetailLoading] =
    useState(false);
  const [createLoading, setCreateLoading] =
    useState(false);
  const [aiRecommendation, setAiRecommendation] =
    useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const loadScreenData = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setScreenLoading(true);
        }

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

        const [essayRows, journeyResult] =
          await Promise.all([
            getMyEssays(),
            supabase
              .from("journeys")
              .select(`
                id,
                title,
                duration_days,
                target_record_count,
                start_date,
                end_date,
                status,
                created_at,
                records (
                  id
                ),
                essays (
                  id,
                  status
                )
              `)
              .eq("user_id", user.id)
              .in("status", [
                "active",
                "completed",
              ])
              .order("created_at", {
                ascending: false,
              }),
          ]);

        if (journeyResult.error) {
          throw journeyResult.error;
        }

        const completedEssayRows =
          (essayRows ?? []).filter(
            (item: any) =>
              item.status === "completed",
          );

        const mappedEssays = await Promise.all(
          completedEssayRows.map(
            (item, index) =>
              mapEssayListItem(item, index),
          ),
        );

        setEssays(mappedEssays);

        const journeys =
          (journeyResult.data ?? []) as any[];

        const readyJourney = journeys.find(
          (journey) => {
            const linkedEssays =
              getRelationArray<any>(
                journey.essays,
              );

            const completedEssay =
              linkedEssays.some(
                (essay) =>
                  essay.status === "completed",
              );

            return (
              journey.status === "completed" &&
              !completedEssay
            );
          },
        );

        const activeJourney = journeys.find(
          (journey) =>
            journey.status === "active",
        );

        const target =
          readyJourney ?? activeJourney ?? null;

        if (!target) {
          setJourneyCard(null);
          return;
        }

        setJourneyCard({
          id: String(target.id),
          title:
            target.title ?? "나의 Journey",
          durationDays: Number(
            target.duration_days ?? 0,
          ),
          targetRecordCount: Number(
            target.target_record_count ?? 0,
          ),
          recordCount: getRelationArray<any>(
            target.records,
          ).length,
          startDate: target.start_date,
          endDate: target.end_date,
          status: target.status,
          canCreateEssay:
            target.status === "completed" &&
            !getRelationArray<any>(
              target.essays,
            ).some(
              (essay) =>
                essay.status === "completed",
            ),
        });
      } catch (error) {
        Alert.alert(
          "에세이 불러오기 실패",
          getErrorMessage(
            error,
            "에세이 정보를 불러오지 못했습니다.",
          ),
        );
      } finally {
        if (showLoading) {
          setScreenLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadScreenData();
  }, [loadScreenData]);

  const openEssay = async (essay: Essay) => {
    try {
      setSelectedEssay(essay);
      setSelectedEntries([]);
      setAiRecommendation("");
      setDetailLoading(true);

      const detail = await getEssayById(
        essay.id,
      );

      const entries =
        await mapEssayEntries(detail);

      setSelectedEntries(entries);
    } catch (error) {
      setSelectedEssay(null);

      Alert.alert(
        "에세이 상세 조회 실패",
        getErrorMessage(
          error,
          "에세이 내용을 불러오지 못했습니다.",
        ),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateEssay = async () => {
    if (
      !journeyCard ||
      !journeyCard.canCreateEssay
    ) {
      return;
    }

    try {
      setCreateLoading(true);

      const draftTitle =
        `${journeyCard.title}의 기록`;

      const essayId = await createEssayDraft({
        journeyId: journeyCard.id,
        title: draftTitle,
      });

      await generateAndSaveEssay(essayId);

      await updateEssay(essayId, {
        status: "completed",
      });

      const detail = await getEssayById(
        essayId,
      );

      const createdEssay =
        await mapEssayListItem(detail, 0);

      const createdEntries =
        await mapEssayEntries(detail);

      setSelectedEssay(createdEssay);
      setSelectedEntries(createdEntries);
      setAiRecommendation("");

      await loadScreenData(false);
    } catch (error) {
      Alert.alert(
        "에세이 생성 실패",
        getErrorMessage(
          error,
          "에세이를 생성하지 못했습니다.",
        ),
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedEssay) {
      return;
    }

    try {
      await Share.share({
        title: selectedEssay.title,
        message: `${selectedEssay.title}\n${selectedEssay.year}년 ${selectedEssay.period}`,
      });
    } catch {
      Alert.alert(
        "공유 실패",
        "에세이를 공유하지 못했습니다.",
      );
    }
  };

  const handleEdit = () => {
    Alert.alert(
      "에세이 수정",
      "제목과 문장을 수정하는 화면은 추후 연결할 예정입니다.",
    );
  };

  const handlePdf = () => {
    Alert.alert(
      "PDF 저장",
      "PDF 저장 기능은 추후 연결할 예정입니다.",
    );
  };

  const handleAiRecommendation = async () => {
    if (
      !selectedEssay ||
      selectedEntries.length === 0
    ) {
      return;
    }

    try {
      setAiLoading(true);
      setAiRecommendation("");

      const message = selectedEntries
        .map(
          (entry) =>
            `경험: ${entry.mission}\n사용자 기록: ${entry.userText}`,
        )
        .join("\n\n");

      const result =
        await getChallengeRecommendation(message);

      setAiRecommendation(result);
    } catch (error) {
      Alert.alert(
        "AI 추천 실패",
        getErrorMessage(
          error,
          "AI 추천을 불러오지 못했습니다.",
        ),
      );
    } finally {
      setAiLoading(false);
    }
  };

  if (screenLoading) {
    return (
      <SafeAreaView
        style={styles.screenLoading}
        edges={["top"]}
      >
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
        <Text style={styles.screenLoadingText}>
          에세이를 불러오는 중이에요
        </Text>
      </SafeAreaView>
    );
  }

  if (selectedEssay) {
    return (
      <SafeAreaView
        style={styles.safeAreaWhite}
        edges={["top"]}
      >
        <View style={styles.detailScreen}>
          <ScrollView
            style={styles.detailScroll}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{
                uri: selectedEssay.coverPhoto,
              }}
              style={styles.coverImage}
            />

            <View style={styles.detailContent}>
              <Text style={styles.detailPeriod}>
                {selectedEssay.year}년{" "}
                {selectedEssay.period}
              </Text>

              <Text style={styles.detailTitle}>
                {selectedEssay.title}
              </Text>

              {detailLoading ? (
                <View style={styles.detailLoading}>
                  <ActivityIndicator
                    color={COLORS.primary}
                  />
                  <Text
                    style={
                      styles.detailLoadingText
                    }
                  >
                    기록을 불러오는 중이에요
                  </Text>
                </View>
              ) : selectedEntries.length > 0 ? (
                selectedEntries.map((entry) => (
                  <View
                    key={entry.id}
                    style={styles.entryContainer}
                  >
                    <Image
                      source={{
                        uri: entry.photo,
                      }}
                      style={styles.entryImage}
                    />

                    <Text
                      style={styles.entryMission}
                    >
                      {entry.mission}
                    </Text>

                    <Text
                      style={styles.entryUserText}
                    >
                      {entry.userText}
                    </Text>

                    <View style={styles.aiTextBox}>
                      <Text style={styles.aiText}>
                        {entry.aiText}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text
                  style={styles.emptyEntriesText}
                >
                  에세이에 연결된 기록이 없습니다.
                </Text>
              )}

              <View
                style={styles.aiRecommendationCard}
              >
                <Text
                  style={
                    styles.aiRecommendationTitle
                  }
                >
                  다음 작은 경험
                </Text>

                <Text
                  style={
                    styles.aiRecommendationDescription
                  }
                >
                  지금까지의 기록을 바탕으로 AI가 다음
                  챌린지를 추천해드려요.
                </Text>

                <Pressable
                  onPress={handleAiRecommendation}
                  disabled={
                    aiLoading ||
                    selectedEntries.length === 0
                  }
                  style={({ pressed }) => [
                    styles.aiRecommendationButton,
                    pressed &&
                      styles.buttonPressed,
                    (aiLoading ||
                      selectedEntries.length ===
                        0) &&
                      styles.aiRecommendationButtonDisabled,
                  ]}
                >
                  {aiLoading ? (
                    <ActivityIndicator
                      color={COLORS.white}
                    />
                  ) : (
                    <Text
                      style={
                        styles.aiRecommendationButtonText
                      }
                    >
                      AI 추천받기
                    </Text>
                  )}
                </Pressable>

                {aiRecommendation ? (
                  <View
                    style={
                      styles.aiRecommendationResult
                    }
                  >
                    <Ionicons
                      name="sparkles"
                      size={17}
                      color={COLORS.primary}
                    />

                    <Text
                      style={
                        styles.aiRecommendationResultText
                      }
                    >
                      {aiRecommendation}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                style={styles.detailBottomSpace}
              />
            </View>
          </ScrollView>

          <View style={styles.actionBar}>
            <Pressable
              onPress={() => {
                setSelectedEssay(null);
                setSelectedEntries([]);
                setAiRecommendation("");
              }}
              style={({ pressed }) => [
                styles.iconActionButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                name="arrow-back"
                size={19}
                color={COLORS.textSub}
              />
            </Pressable>

            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.shareButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.shareButtonText}>
                공유하기
              </Text>
            </Pressable>

            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [
                styles.smallActionButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.smallActionText}>
                수정
              </Text>
            </Pressable>

            <Pressable
              onPress={handlePdf}
              style={({ pressed }) => [
                styles.smallActionButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.smallActionText}>
                PDF
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const targetCount =
    journeyCard?.targetRecordCount ?? 0;

  const recordCount =
    journeyCard?.recordCount ?? 0;

  const remainingCount = Math.max(
    targetCount - recordCount,
    0,
  );

  const progressPercent =
    targetCount > 0
      ? Math.min(
          Math.max(
            (recordCount / targetCount) * 100,
            0,
          ),
          100,
        )
      : 0;

  const canCreateEssay =
    Boolean(journeyCard?.canCreateEssay);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenContent}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            나의 에세이
          </Text>

          <Text style={styles.headerDescription}>
            경험이 쌓이면 이야기가 됩니다
          </Text>
        </View>

        <View style={styles.bookshelfContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bookRow}
          >
            {journeyCard ? (
              <View style={styles.progressBook}>
                <View
                  style={
                    styles.rotatedLabelWrapper
                  }
                >
                  <Text
                    style={styles.progressBookText}
                  >
                    {canCreateEssay
                      ? "완성 가능"
                      : "진행 중"}
                  </Text>
                </View>
              </View>
            ) : null}

            {essays.map((essay, index) => {
              const bookHeight =
                SPINE_HEIGHT -
                Math.min(index, 5) * 4;

              return (
                <Pressable
                  key={essay.id}
                  onPress={() =>
                    void openEssay(essay)
                  }
                  style={({ pressed }) => [
                    styles.bookSpine,
                    {
                      width:
                        SPINE_WIDTH[
                          essay.thickness
                        ],
                      height: bookHeight,
                      backgroundColor:
                        essay.color,
                    },
                    pressed && styles.bookPressed,
                  ]}
                >
                  <View
                    style={
                      styles.rotatedLabelWrapper
                    }
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.bookSpineTitle,
                        essay.thickness ===
                          "thin" &&
                          styles.thinBookTitle,
                      ]}
                    >
                      {essay.title}
                    </Text>

                    {essay.thickness !==
                      "thin" && (
                      <Text
                        style={
                          styles.bookSpineYear
                        }
                      >
                        {essay.year}
                      </Text>
                    )}
                  </View>

                  <View style={styles.pageEdge} />
                </Pressable>
              );
            })}

            {[20, 26, 22].map(
              (width, index) => (
                <View
                  key={`empty-book-${index}`}
                  style={[
                    styles.emptyBook,
                    {
                      width,
                      height:
                        SPINE_HEIGHT * 0.82 -
                        index * 6,
                    },
                  ]}
                />
              ),
            )}

            <View
              style={styles.bookRowEndSpace}
            />
          </ScrollView>

          <View style={styles.shelf} />
          <View style={styles.wall} />
        </View>

        <View style={styles.body}>
          {journeyCard ? (
            <View style={styles.progressCard}>
              <View
                style={styles.progressCardTop}
              >
                <View style={styles.progressTag}>
                  <Text
                    style={
                      styles.progressTagText
                    }
                  >
                    {canCreateEssay
                      ? "완료"
                      : "진행 중"}
                  </Text>
                </View>

                <Text style={styles.journeyText}>
                  {journeyCard.durationDays}일의
                  여정
                </Text>
              </View>

              <Text
                style={styles.progressEssayTitle}
              >
                {journeyCard.title}
              </Text>

              <Text
                style={styles.progressEssayPeriod}
              >
                {getYear(
                  journeyCard.startDate,
                )}
                . {formatPeriod(
                  journeyCard.startDate,
                  journeyCard.endDate,
                )}
              </Text>

              <View
                style={styles.progressInfoRow}
              >
                <Text
                  style={styles.progressInfoText}
                >
                  {recordCount}개의 경험이 담겼어요
                </Text>

                <Text
                  style={styles.progressCount}
                >
                  {recordCount}/{targetCount}
                </Text>
              </View>

              <View
                style={
                  styles.progressBarBackground
                }
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width:
                        `${progressPercent}%` as `${number}%`,
                    },
                  ]}
                />
              </View>

              <View
                style={styles.remainingNotice}
              >
                <Text
                  style={styles.remainingText}
                >
                  {canCreateEssay ? (
                    <>
                      모든 경험이 모였어요. 이제{" "}
                      <Text
                        style={
                          styles.remainingStrong
                        }
                      >
                        에세이를 만들 수 있어요.
                      </Text>
                    </>
                  ) : (
                    <>
                      완성까지{" "}
                      <Text
                        style={
                          styles.remainingStrong
                        }
                      >
                        {remainingCount}개의 경험
                      </Text>
                      이 더 필요해요
                    </>
                  )}
                </Text>
              </View>

              <Pressable
                onPress={handleCreateEssay}
                disabled={
                  !canCreateEssay ||
                  createLoading
                }
                style={({ pressed }) => [
                  canCreateEssay
                    ? styles.createButton
                    : styles.disabledCreateButton,
                  pressed &&
                    canCreateEssay &&
                    styles.buttonPressed,
                ]}
              >
                {createLoading ? (
                  <ActivityIndicator
                    color={COLORS.white}
                  />
                ) : (
                  <Text
                    style={
                      canCreateEssay
                        ? styles.createButtonText
                        : styles.disabledCreateButtonText
                    }
                  >
                    {canCreateEssay
                      ? "AI 에세이 만들기"
                      : `에세이 만들기 (${remainingCount}개 남음)`}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text
                style={styles.emptyCardTitle}
              >
                진행 중인 Journey가 없어요
              </Text>
              <Text
                style={
                  styles.emptyCardDescription
                }
              >
                Journey를 시작하고 경험을 기록하면
                여기에 에세이 진행 상황이 표시됩니다.
              </Text>
            </View>
          )}

          <Text
            style={styles.completedSectionTitle}
          >
            완성된 에세이 ({essays.length})
          </Text>

          {essays.length > 0 ? (
            essays.map((essay) => (
              <Pressable
                key={essay.id}
                onPress={() =>
                  void openEssay(essay)
                }
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
                        essay.color,
                    },
                  ]}
                />

                <Image
                  source={{ uri: essay.photo }}
                  style={styles.essayThumbnail}
                />

                <View
                  style={styles.essayListText}
                >
                  <Text
                    numberOfLines={1}
                    style={
                      styles.essayListTitle
                    }
                  >
                    {essay.title}
                  </Text>

                  <Text
                    style={
                      styles.essayListPeriod
                    }
                  >
                    {essay.year}년{" "}
                    {essay.period}
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
              <Text
                style={styles.emptyCardTitle}
              >
                아직 완성된 에세이가 없어요
              </Text>
              <Text
                style={
                  styles.emptyCardDescription
                }
              >
                완료된 Journey가 생기면 AI 에세이를
                만들 수 있습니다.
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

  // 책장

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
    width: 30,
    height: SPINE_HEIGHT,

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

    width: SPINE_HEIGHT - 14,

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
    shadowOffset: {
      width: 3,
      height: 0,
    },
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
    color: "rgba(255, 255, 255, 0.92)",
  },

  thinBookTitle: {
    fontSize: 7.5,
  },

  bookSpineYear: {
    marginTop: 4,

    fontSize: 7,
    letterSpacing: 0.5,
    color: "rgba(255, 255, 255, 0.58)",
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
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 8,

    elevation: 5,
  },

  wall: {
    height: 16,
    backgroundColor: COLORS.wall,
  },

  // 진행 카드 및 목록

  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  progressCard: {
    padding: 16,

    backgroundColor: COLORS.white,

    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(61, 90, 254, 0.30)",
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
    width: "57.14%",
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
    minHeight: 66,

    marginBottom: 10,

    flexDirection: "row",
    alignItems: "center",

    overflow: "hidden",

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 14,
  },

  cardPressed: {
    opacity: 0.75,
  },

  essayAccent: {
    alignSelf: "stretch",
    width: 6,
  },

  essayThumbnail: {
    width: 66,
    height: 66,

    backgroundColor: COLORS.border,
  },

  essayListText: {
    flex: 1,

    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  essayListTitle: {
    marginBottom: 3,

    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  essayListPeriod: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  bottomSpace: {
    height: 120,
  },

  // 상세 화면

  detailScreen: {
    flex: 1,

    backgroundColor: COLORS.white,
  },

  detailScroll: {
    flex: 1,
  },

  coverImage: {
    width: "100%",
    height: 220,

    backgroundColor: COLORS.border,
  },

  detailContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },

  detailPeriod: {
    marginBottom: 6,

    fontSize: 11,
    color: COLORS.textMuted,
  },

  detailTitle: {
    marginBottom: 22,

    fontSize: 23,
    lineHeight: 31,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  entryContainer: {
    marginBottom: 30,
  },

  entryImage: {
    width: "100%",
    height: 186,

    marginBottom: 12,

    backgroundColor: COLORS.border,
    borderRadius: 14,
  },

  entryMission: {
    marginBottom: 6,

    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: COLORS.textMuted,
  },

  entryUserText: {
    marginBottom: 10,

    fontSize: 14,
    lineHeight: 24,
    color: COLORS.textMain,
  },

  aiTextBox: {
    paddingHorizontal: 14,
    paddingVertical: 10,

    backgroundColor: "#F6F8FF",

    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryLight,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },

  aiText: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 19,
    color: COLORS.primary,
  },

  aiRecommendationCard: {
    marginTop: 4,
    marginBottom: 24,
    padding: 18,

    backgroundColor: COLORS.primaryLight,

    borderWidth: 1,
    borderColor: "rgba(61, 90, 254, 0.15)",
    borderRadius: 16,
  },

  aiRecommendationTitle: {
    marginBottom: 6,

    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  aiRecommendationDescription: {
    marginBottom: 14,

    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textSub,
  },

  aiRecommendationButton: {
    height: 44,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.primary,
    borderRadius: 11,
  },

  aiRecommendationButtonDisabled: {
    opacity: 0.55,
  },

  aiRecommendationButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },

  aiRecommendationResult: {
    flexDirection: "row",
    alignItems: "flex-start",

    marginTop: 14,
    padding: 13,

    backgroundColor: COLORS.white,
    borderRadius: 11,
  },

  aiRecommendationResultText: {
    flex: 1,

    marginLeft: 8,

    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textSub,
  },

  detailBottomSpace: {
    height: 20,
  },

  actionBar: {
    flexDirection: "row",

    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 100,

    backgroundColor: COLORS.white,

    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  iconActionButton: {
    width: 44,
    height: 44,

    marginRight: 8,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F3F4F6",
    borderRadius: 11,
  },

  shareButton: {
    flex: 1,
    height: 44,

    marginRight: 8,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.primary,
    borderRadius: 11,
  },

  shareButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },

  smallActionButton: {
    minWidth: 48,
    height: 44,

    marginRight: 8,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F3F4F6",
    borderRadius: 11,
  },

  smallActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSub,
  },

  buttonPressed: {
    opacity: 0.72,
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

  detailLoading: {
    paddingVertical: 44,
    alignItems: "center",
  },

  detailLoadingText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  emptyEntriesText: {
    paddingVertical: 28,
    textAlign: "center",
    fontSize: 13,
    color: COLORS.textMuted,
  },

});