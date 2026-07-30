import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const COLORS = {
  primary: "#3D5AFE",
  primaryLight: "#EEF1FF",

  textMain: "#171719",
  textSub: "#5C5F6A",
  textMuted: "#9EA3AE",

  border: "#E4E6EA",
  background: "#F7F8FA",
  white: "#FFFFFF",

  success: "#10B981",
};

type BadgeLevel =
  | "bronze"
  | "silver"
  | "gold"
  | "prism"
  | "locked";

type Badge = {
  id: number;
  name: string;
  category: string;
  level: BadgeLevel;
  count: number;
  nextAt: number;
  emoji: string;
  color: string;
  backgroundColor: string;
  title?: string;
};

type StatItem = {
  label: string;
  value: string;
};

type SettingItem = {
  label: string;
  description: string;
};

type ActiveJourney = {
  id: string;
  title: string;
  target_record_count: number;
  start_date: string;
  end_date: string;
  status: string;
};

type MyRecord = {
  id: string;
  place_id: string | null;
  journey_id: string | null;
  content: string | null;
  emotion: string | null;
  recorded_at: string;
};

type AiKeywordResponse = {
  answer?: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function normalizeStringArray(
  value: unknown,
): string[] {
  if (Array.isArray(value)) {
    return value
      .filter(
        (item): item is string =>
          typeof item === "string",
      )
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return normalizeStringArray(parsed);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function parseAiKeywords(answer: string) {
  const arrayText = answer.match(/\[[\s\S]*\]/)?.[0];

  if (arrayText) {
    try {
      const parsed: unknown = JSON.parse(arrayText);
      const keywords = normalizeStringArray(parsed);

      if (keywords.length > 0) {
        return keywords.slice(0, 3);
      }
    } catch {
      // JSON 형식이 아니면 아래 일반 문자열 처리로 이동
    }
  }

  return answer
    .replace(/```json|```/g, "")
    .split(/[,\n#]/)
    .map((item) =>
      item
        .replace(/^[-\d.)\s]+/, "")
        .replace(/["[\]]/g, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 3);
}

const BADGES: Badge[] = [
  {
    id: 1,
    name: "산책 수집가",
    category: "산책",
    level: "gold",
    count: 8,
    nextAt: 12,
    emoji: "🥾",
    color: "#D97706",
    backgroundColor: "#FEF3C7",
  },
  {
    id: 2,
    name: "소리 탐험가",
    category: "음악",
    level: "prism",
    count: 15,
    nextAt: 0,
    emoji: "🎵",
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    title: "소리의 탐험가",
  },
  {
    id: 3,
    name: "책방 여행자",
    category: "독서",
    level: "silver",
    count: 4,
    nextAt: 8,
    emoji: "📖",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
  },
  {
    id: 4,
    name: "새로운 맛 발견자",
    category: "휴식",
    level: "bronze",
    count: 2,
    nextAt: 4,
    emoji: "🍞",
    color: "#92400E",
    backgroundColor: "#FEF3C7",
  },
  {
    id: 5,
    name: "작은 관찰자",
    category: "관찰",
    level: "locked",
    count: 0,
    nextAt: 4,
    emoji: "🔍",
    color: COLORS.textMuted,
    backgroundColor: COLORS.background,
  },
  {
    id: 6,
    name: "로컬 탐험가",
    category: "발견",
    level: "locked",
    count: 0,
    nextAt: 4,
    emoji: "📍",
    color: COLORS.textMuted,
    backgroundColor: COLORS.background,
  },
];

const LEVEL_LABEL: Record<BadgeLevel, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  prism: "PRISM",
  locked: "잠김",
};

const SETTINGS: SettingItem[] = [
  {
    label: "미션 조건 설정",
    description: "이동 거리 · 시간 · 비용 · 실내외",
  },
  {
    label: "알림 설정",
    description: "추천 미션 · 근처 기록 · 에세이 완성",
  },
  {
    label: "기록 공개 범위",
    description: "익명으로 공유",
  },
  {
    label: "계정 및 개인정보",
    description: "로그인 정보 · 기록 내보내기",
  },
];

function ProgressBar({
  value,
  total,
  color = COLORS.primary,
}: {
  value: number;
  total: number;
  color?: string;
}) {
  const percentage =
    total > 0 ? `${Math.min((value / total) * 100, 100)}%` : "0%";

  return (
    <View style={styles.progressBarBackground}>
      <View
        style={[
          styles.progressBarFill,
          {
            width: percentage,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

function LevelTag({
  text,
  color = COLORS.primary,
  backgroundColor = COLORS.primaryLight,
}: {
  text: string;
  color?: string;
  backgroundColor?: string;
}) {
  return (
    <View
      style={[
        styles.levelTag,
        {
          backgroundColor,
        },
      ]}
    >
      <Text
        style={[
          styles.levelTagText,
          {
            color,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export default function MyScreen() {
  const [nickname, setNickname] = useState("사용자");
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [journey, setJourney] =
    useState<ActiveJourney | null>(null);

  const [
    journeyRecordCount,
    setJourneyRecordCount,
  ] = useState(0);

  const [
    initialInterests,
    setInitialInterests,
  ] = useState<string[]>([]);

  const [
    discoveredInterests,
    setDiscoveredInterests,
  ] = useState<string[]>([]);

  const [
    isAiInterestLoading,
    setIsAiInterestLoading,
  ] = useState(true);

  const [stats, setStats] = useState<StatItem[]>([
    { label: "완료 미션", value: "0" },
    { label: "기록 경험", value: "0" },
    { label: "발견 장소", value: "0" },
    { label: "완성 에세이", value: "0" },
    { label: "받은 좋아요", value: "0" },
    { label: "획득 뱃지", value: "0" },
  ]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadMyData = async () => {
        setIsUserLoading(true);
        setIsAiInterestLoading(true);

        try {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user) {
            throw new Error(
              userError?.message ??
                "로그인 정보를 확인할 수 없습니다.",
            );
          }

          if (!isMounted) {
            return;
          }

          /*
          * 회원가입 때 profiles.interests에 저장된
          * 관심사를 가져옵니다.
          *
          * 기본 저장 키는 interests로 사용하고,
          * 기존 코드와의 호환을 위해 다른 이름도 확인합니다.
          */
          const {
            data: profileData,
            error: profileError,
          } = await supabase
            .from("profiles")
            .select("nickname, interests")
            .eq("id", user.id)
            .single();

          if (profileError) {
  console.error(
    "프로필 조회 실패:",
    profileError.message,
  );

  setNickname(
    user.user_metadata.nickname ?? "사용자",
  );

  setInitialInterests([]);
} else {
  setNickname(
    profileData.nickname ??
      user.user_metadata.nickname ??
      "사용자",
  );

  setInitialInterests(
    normalizeStringArray(
      profileData.interests,
    ),
  );
}

          const now = new Date();

          const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );

          const todayKey = toDateKey(todayStart);

          const [
            completedMissionsResult,
            recordsResult,
            completedEssaysResult,
            badgesResult,
            journeyResult,
          ] = await Promise.all([
            supabase
              .from("mission_attempts")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("user_id", user.id)
              .not("completed_at", "is", null),

            supabase
              .from("records")
              .select(
                `
                id,
                place_id,
                journey_id,
                content,
                emotion,
                recorded_at
                `,
              )
              .eq("user_id", user.id)
              .order("recorded_at", {
                ascending: false,
              }),

            supabase
              .from("essays")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("user_id", user.id)
              .eq("status", "completed"),

            supabase
              .from("user_badges")
              .select("badge_id")
              .eq("user_id", user.id),

            /*
            * 캘린더에서 설정한 현재 진행 중인 여정을
            * 동일한 journeys 테이블에서 조회합니다.
            */
            supabase
              .from("journeys")
              .select(
                `
                id,
                title,
                target_record_count,
                start_date,
                end_date,
                status
                `,
              )
              .eq("user_id", user.id)
              .eq("status", "active")
              .lte("start_date", todayKey)
              .gte("end_date", todayKey)
              .order("start_date", {
                ascending: false,
              })
              .limit(1)
              .maybeSingle(),
          ]);

          if (!isMounted) {
            return;
          }

          const queryErrors = [
            completedMissionsResult.error,
            recordsResult.error,
            completedEssaysResult.error,
            badgesResult.error,
            journeyResult.error,
          ].filter(Boolean);

          queryErrors.forEach((error) => {
            console.error(
              "MY 데이터 조회 실패:",
              error?.message,
            );
          });

          const records =
            (recordsResult.data ?? []) as MyRecord[];

          const activeJourney =
            (journeyResult.data ??
              null) as ActiveJourney | null;

          setJourney(activeJourney);

          const journeyCompletedDayCount =
  activeJourney
    ? new Set(
        records
          .filter(
            (record) =>
              record.journey_id ===
              activeJourney.id,
          )
          .map((record) => record.recorded_at),
      ).size
    : 0;

setJourneyRecordCount(
  journeyCompletedDayCount,
);

          const recordIds = records.map(
            (record) => record.id,
          );

          const discoveredPlaceCount =
            new Set(
              records
                .map((record) => record.place_id)
                .filter(Boolean),
            ).size;

          const badgeCount =
            new Set(
              (badgesResult.data ?? []).map(
                (badge) => badge.badge_id,
              ),
            ).size;

          let receivedLikesCount = 0;

          if (recordIds.length > 0) {
            const {
              count,
              error: likesError,
            } = await supabase
              .from("record_likes")
              .select("id", {
                count: "exact",
                head: true,
              })
              .in("record_id", recordIds);

            if (likesError) {
              console.error(
                "받은 좋아요 조회 실패:",
                likesError.message,
              );
            } else {
              receivedLikesCount = count ?? 0;
            }
          }

          if (!isMounted) {
            return;
          }

          setStats([
            {
              label: "완료 미션",
              value: String(
                completedMissionsResult.count ?? 0,
              ),
            },
            {
              label: "기록 경험",
              value: String(records.length),
            },
            {
              label: "발견 장소",
              value: String(
                discoveredPlaceCount,
              ),
            },
            {
              label: "완성 에세이",
              value: String(
                completedEssaysResult.count ?? 0,
              ),
            },
            {
              label: "받은 좋아요",
              value: String(
                receivedLikesCount,
              ),
            },
            {
              label: "획득 뱃지",
              value: String(badgeCount),
            },
          ]);

          /*
          * 가장 최근 기록 최대 20개를 AI에게 보내
          * 경험에서 나타난 취향 키워드 3개를 받습니다.
          */
          const recordsForAi = records
            .filter(
              (record) =>
                typeof record.content === "string" &&
                record.content.trim().length > 0,
            )
            .slice(0, 20);

          if (recordsForAi.length === 0) {
            setDiscoveredInterests([]);
            return;
          }

          const experienceText =
            recordsForAi
              .map(
                (record, index) =>
                  `${index + 1}. 감정: ${
                    record.emotion ?? "미입력"
                  }\n기록: ${record.content}`,
              )
              .join("\n\n");

          const aiPrompt = `
  다음은 한 사용자가 직접 작성한 경험 기록이다.

  ${experienceText}

  이 기록에서 반복적으로 나타나는 활동, 공간, 시간대, 분위기, 행동 성향을 분석해 사용자의 취향을 나타내는 한국어 키워드 3개를 뽑아라.

  규칙:
  - 각 키워드는 2~10자 정도의 짧은 명사구
  - 서로 의미가 겹치지 않게 작성
  - 평가나 진단을 하지 말 것
  - 설명을 쓰지 말 것
  - 반드시 JSON 문자열 배열 하나만 반환할 것

  출력 예시:
  ["조용한 공간", "저녁 산책", "혼자 하는 활동"]
          `.trim();

          const {
            data: aiData,
            error: aiError,
          } =
            await supabase.functions.invoke<AiKeywordResponse>(
              "upstage-test",
              {
                body: {
                  message: aiPrompt,
                },
              },
            );

          if (!isMounted) {
            return;
          }

          if (aiError) {
            console.error(
              "AI 취향 분석 실패:",
              aiError.message,
            );

            setDiscoveredInterests([]);
            return;
          }

          setDiscoveredInterests(
            aiData?.answer
              ? parseAiKeywords(aiData.answer)
              : [],
          );
        } catch (error) {
          if (!isMounted) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : "MY 정보를 불러오지 못했습니다.";

          console.error("MY 화면 로딩 실패:", message);
        } finally {
          if (isMounted) {
            setIsUserLoading(false);
            setIsAiInterestLoading(false);
          }
        }
      };

      void loadMyData();

      return () => {
        isMounted = false;
      };
    }, []),
  );

  const today = new Date();

const todayStart = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
);

const journeyDday =
  journey === null
    ? null
    : Math.max(
        0,
        Math.ceil(
          (parseDateKey(
            journey.end_date,
          ).getTime() -
            todayStart.getTime()) /
            DAY_IN_MS,
        ),
      );

const journeyDdayText =
  journeyDday === null
    ? "--"
    : journeyDday === 0
      ? "D-DAY"
      : `D-${journeyDday}`;

  const [selectedBadge, setSelectedBadge] =
    useState<Badge | null>(null);

  const handleProfileEdit = () => {
    Alert.alert(
      "프로필 수정",
      "프로필 이미지, 닉네임, 소개를 수정하는 화면은 추후 연결할 예정입니다.",
    );
  };

  const handleSettingPress = (setting: SettingItem) => {
    Alert.alert(
      setting.label,
      `${setting.description}\n\n설정 상세 화면은 추후 연결할 예정입니다.`,
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "로그아웃",
      "정말 로그아웃하시겠어요?",
      [
        {
          text: "취소",
          style: "cancel",
        },
        {
          text: "로그아웃",
          style: "destructive",
          onPress: async () => {
            const { error } =
              await supabase.auth.signOut();

            if (error) {
              Alert.alert(
                "로그아웃 실패",
                error.message,
              );
              return;
            }
          },
        },
      ],
    );
  };

  if (selectedBadge) {
    const isPrism = selectedBadge.level === "prism";
    const isLocked = selectedBadge.level === "locked";

    const remainingCount =
      selectedBadge.nextAt - selectedBadge.count;

    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.badgeDetailContent}
        >
          <Pressable
            onPress={() => setSelectedBadge(null)}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={COLORS.textMain}
            />

            <Text style={styles.backButtonText}>
              뱃지 보관함
            </Text>
          </Pressable>

          <View style={styles.badgeDetailHeader}>
            <View
              style={[
                styles.largeBadgeCircle,
                {
                  backgroundColor:
                    selectedBadge.backgroundColor,
                  borderColor: isLocked
                    ? COLORS.textMuted
                    : selectedBadge.color,
                  opacity: isLocked ? 0.4 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.largeBadgeEmoji,
                  isLocked && styles.lockedEmoji,
                ]}
              >
                {selectedBadge.emoji}
              </Text>
            </View>

            <Text style={styles.badgeDetailName}>
              {selectedBadge.name}
            </Text>

            <LevelTag
              text={LEVEL_LABEL[selectedBadge.level]}
              color={
                isLocked
                  ? COLORS.textMuted
                  : selectedBadge.color
              }
              backgroundColor={
                selectedBadge.backgroundColor
              }
            />

            {isPrism && selectedBadge.title && (
              <View style={styles.titleEarnedRow}>
                <Ionicons
                  name="sparkles"
                  size={15}
                  color={COLORS.primary}
                />

                <Text style={styles.titleEarnedText}>
                  칭호 &quot;{selectedBadge.title}&quot; 획득
                </Text>
              </View>
            )}
          </View>

          <View style={styles.badgeProgressCard}>
            <View style={styles.badgeInfoRow}>
              <Text style={styles.badgeInfoLabel}>
                완료한 미션
              </Text>

              <Text style={styles.badgeInfoValue}>
                {selectedBadge.count}회
              </Text>
            </View>

            {!isPrism && !isLocked && (
              <>
                <View style={styles.badgeInfoRow}>
                  <Text style={styles.badgeInfoLabel}>
                    다음 단계까지
                  </Text>

                  <Text
                    style={[
                      styles.badgeRemainingValue,
                      {
                        color: selectedBadge.color,
                      },
                    ]}
                  >
                    {remainingCount}회
                  </Text>
                </View>

                <ProgressBar
                  value={selectedBadge.count}
                  total={selectedBadge.nextAt}
                  color={selectedBadge.color}
                />
              </>
            )}

            {isPrism && (
              <View style={styles.completeRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={17}
                  color={COLORS.success}
                />

                <Text style={styles.completeText}>
                  최고 단계 달성
                </Text>
              </View>
            )}

            {isLocked && (
              <View style={styles.lockedInformation}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={COLORS.textMuted}
                />

                <Text style={styles.lockedInformationText}>
                  관련 미션을 {selectedBadge.nextAt}회 완료하면
                  브론즈 뱃지가 열려요.
                </Text>
              </View>
            )}
          </View>

          {isPrism && selectedBadge.title && (
            <Pressable
              onPress={() =>
                Alert.alert(
                  "대표 칭호 설정",
                  `"${selectedBadge.title}" 칭호를 프로필에 설정했습니다.`,
                )
              }
              style={({ pressed }) => [
                styles.equipTitleButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.equipTitleButtonText}>
                대표 칭호로 설정
              </Text>
            </Pressable>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenContent}
      >
        {/* 프로필 */}
        <View style={styles.profileSection}>
          <View style={styles.profileImage}>
            <Text style={styles.profileEmoji}>🧑</Text>
          </View>

          <View style={styles.profileTextArea}>
            <Text style={styles.profileName}>
              {isUserLoading ? "불러오는 중..." : nickname}
            </Text>

            <LevelTag text="소리의 탐험가" />

            <Text style={styles.profileDescription}>
              📍 서울 마포구 · 조용한 공간을 좋아해요
            </Text>
          </View>

          <Pressable
            onPress={handleProfileEdit}
            style={({ pressed }) => [
              styles.profileEditButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.profileEditButtonText}>
              수정
            </Text>
          </Pressable>
        </View>

        {/* 진행 중인 여정 */}
        <View style={styles.journeyCard}>
          <View style={styles.journeyHeader}>
            <View>
              <Text style={styles.journeyCaption}>
                진행 중인 여정
              </Text>

              <Text style={styles.journeyTitle}>
                {isUserLoading
                  ? "불러오는 중..."
                  : journey?.title ??
                    "진행 중인 여정이 없어요"}
              </Text>
            </View>

            <LevelTag text={journeyDdayText} />
          </View>

          {journey ? (
            <>
              <ProgressBar
                value={journeyRecordCount}
                total={journey.target_record_count}
              />

              <Text style={styles.journeyProgressText}>
                {journey.target_record_count}번 중{" "}
                {journeyRecordCount}번 완료
              </Text>
            </>
          ) : (
            <>
              <ProgressBar value={0} total={1} />

              <Text style={styles.journeyProgressText}>
                캘린더에서 새 여정을 시작해 주세요.
              </Text>
            </>
          )}
        </View>

        {/* 활동 통계 */}
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={styles.statCard}
            >
              <Text style={styles.statValue}>
                {stat.value}
              </Text>

              <Text style={styles.statLabel}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 취향 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>취향</Text>

          <View style={styles.interestGroup}>
            <Text style={styles.interestCaption}>
              처음 선택한 관심사
            </Text>

            <View style={styles.chipContainer}>
              {initialInterests.length > 0 ? (
                initialInterests.map((interest) => (
                  <View
                    key={interest}
                    style={styles.basicChip}
                  >
                    <Text style={styles.basicChipText}>
                      {interest}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.interestNotice}>
                  회원가입 때 선택한 관심사가 없어요.
                </Text>
              )}
            </View>
          </View>

          <View style={styles.interestGroup}>
            <Text style={styles.interestCaption}>
              경험에서 나타난 취향
            </Text>

            <View style={styles.chipContainer}>
              {isAiInterestLoading ? (
                <Text style={styles.interestNotice}>
                  AI가 최근 경험을 분석하는 중이에요.
                </Text>
              ) : discoveredInterests.length > 0 ? (
                discoveredInterests.map((interest) => (
                  <View
                    key={interest}
                    style={styles.discoveredChip}
                  >
                    <Text style={styles.discoveredChipText}>
                      {interest}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.interestNotice}>
                  기록이 쌓이면 AI가 취향을 발견해줘요.
                </Text>
              )}
            </View>
          </View>

          <Text style={styles.interestNotice}>
            최근 기록에서 자주 나타난 모습이에요.
          </Text>
        </View>

        {/* 뱃지 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            뱃지 보관함
          </Text>

          <View style={styles.badgeGrid}>
            {BADGES.map((badge) => {
              const isLocked = badge.level === "locked";
              const isPrism = badge.level === "prism";

              return (
                <Pressable
                  key={badge.id}
                  onPress={() => setSelectedBadge(badge)}
                  style={({ pressed }) => [
                    styles.badgeCard,
                    {
                      backgroundColor:
                        badge.backgroundColor,
                      borderColor: isPrism
                        ? COLORS.primary
                        : "transparent",
                      opacity: isLocked ? 0.4 : 1,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeEmoji,
                      isLocked && styles.lockedEmoji,
                    ]}
                  >
                    {badge.emoji}
                  </Text>

                  <Text
                    style={[
                      styles.badgeLevel,
                      {
                        color: badge.color,
                      },
                    ]}
                  >
                    {LEVEL_LABEL[badge.level]}
                  </Text>

                  <Text
                    numberOfLines={2}
                    style={styles.badgeName}
                  >
                    {badge.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 설정 */}
        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderText}>
              설정
            </Text>
          </View>

          {SETTINGS.map((setting, index) => (
            <Pressable
              key={setting.label}
              onPress={() =>
                handleSettingPress(setting)
              }
              style={({ pressed }) => [
                styles.settingRow,
                index < SETTINGS.length - 1 &&
                  styles.settingRowBorder,
                pressed && styles.settingPressed,
              ]}
            >
              <View style={styles.settingTextArea}>
                <Text style={styles.settingLabel}>
                  {setting.label}
                </Text>

                <Text style={styles.settingDescription}>
                  {setting.description}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textMuted}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.logoutText}>
            로그아웃
          </Text>
        </Pressable>

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

  screenContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  pressed: {
    opacity: 0.7,
  },

  /* 프로필 */

  profileSection: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 20,
  },

  profileImage: {
    width: 68,
    height: 68,

    marginRight: 16,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#DCE3FF",

    borderWidth: 2,
    borderColor: COLORS.primaryLight,
    borderRadius: 34,
  },

  profileEmoji: {
    fontSize: 28,
  },

  profileTextArea: {
    flex: 1,
    alignItems: "flex-start",
  },

  profileName: {
    marginBottom: 4,

    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  profileDescription: {
    marginTop: 5,

    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textMuted,
  },

  profileEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },

  profileEditButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textSub,
  },

  /* 공통 태그 */

  levelTag: {
    alignSelf: "flex-start",

    paddingHorizontal: 8,
    paddingVertical: 4,

    borderRadius: 7,
  },

  levelTagText: {
    fontSize: 10,
    fontWeight: "700",
  },

  /* 진행 카드 */

  journeyCard: {
    marginBottom: 14,
    padding: 15,

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    borderRadius: 16,
  },

  journeyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",

    marginBottom: 10,
  },

  journeyCaption: {
    marginBottom: 2,

    fontSize: 11,
    color: COLORS.textMuted,
  },

  journeyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  journeyProgressText: {
    marginTop: 6,

    fontSize: 11,
    color: COLORS.textMuted,
  },

  progressBarBackground: {
    height: 5,

    overflow: "hidden",

    backgroundColor: "#ECEEF2",
    borderRadius: 3,
  },

  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  /* 통계 */

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",

    marginHorizontal: -4,
    marginBottom: 10,
  },

  statCard: {
    width: "31.33%",

    marginHorizontal: "1%",
    marginBottom: 8,
    paddingVertical: 12,

    alignItems: "center",

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 12,
  },

  statValue: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  statLabel: {
    marginTop: 3,

    fontSize: 10,
    color: COLORS.textMuted,
  },

  /* 공통 섹션 */

  sectionCard: {
    marginBottom: 14,
    padding: 15,

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 16,
  },

  sectionTitle: {
    marginBottom: 12,

    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  /* 취향 */

  interestGroup: {
    marginBottom: 10,
  },

  interestCaption: {
    marginBottom: 6,

    fontSize: 11,
    color: COLORS.textMuted,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  basicChip: {
    marginRight: 6,
    marginBottom: 6,

    paddingHorizontal: 10,
    paddingVertical: 5,

    backgroundColor: COLORS.background,
    borderRadius: 8,
  },

  basicChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textSub,
  },

  discoveredChip: {
    marginRight: 6,
    marginBottom: 6,

    paddingHorizontal: 10,
    paddingVertical: 5,

    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },

  discoveredChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },

  interestNotice: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  /* 뱃지 목록 */

  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",

    marginHorizontal: -5,
  },

  badgeCard: {
    width: "30.33%",

    minHeight: 100,

    marginHorizontal: "1.5%",
    marginBottom: 10,
    paddingHorizontal: 7,
    paddingVertical: 13,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1.5,
    borderRadius: 14,
  },

  badgeEmoji: {
    marginBottom: 5,

    fontSize: 24,
  },

  lockedEmoji: {
    opacity: 0.6,
  },

  badgeLevel: {
    marginBottom: 5,

    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  badgeName: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    color: COLORS.textSub,
  },

  /* 설정 */

  settingsCard: {
    marginBottom: 14,

    overflow: "hidden",

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 16,
  },

  settingsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 13,

    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },

  settingsHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: COLORS.textMuted,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },

  settingPressed: {
    backgroundColor: "#F9FAFB",
  },

  settingTextArea: {
    flex: 1,
    marginRight: 12,
  },

  settingLabel: {
    marginBottom: 2,

    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMain,
  },

  settingDescription: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  logoutButton: {
    alignItems: "center",
    paddingVertical: 10,
  },

  logoutText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  bottomSpace: {
    height: 120,
  },

  /* 뱃지 상세 */

  badgeDetailContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  backButton: {
    alignSelf: "flex-start",

    flexDirection: "row",
    alignItems: "center",

    marginBottom: 20,
  },

  backButtonText: {
    marginLeft: 8,

    fontSize: 14,
    color: COLORS.textMain,
  },

  badgeDetailHeader: {
    alignItems: "center",

    paddingTop: 20,
    paddingBottom: 24,
  },

  largeBadgeCircle: {
    width: 80,
    height: 80,

    marginBottom: 12,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 2.5,
    borderRadius: 40,
  },

  largeBadgeEmoji: {
    fontSize: 34,
  },

  badgeDetailName: {
    marginBottom: 7,

    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  titleEarnedRow: {
    flexDirection: "row",
    alignItems: "center",

    marginTop: 9,
  },

  titleEarnedText: {
    marginLeft: 5,

    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },

  badgeProgressCard: {
    marginBottom: 12,
    padding: 16,

    backgroundColor: COLORS.white,
    borderRadius: 14,
  },

  badgeInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",

    marginBottom: 10,
  },

  badgeInfoLabel: {
    fontSize: 13,
    color: COLORS.textSub,
  },

  badgeInfoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  badgeRemainingValue: {
    fontSize: 13,
    fontWeight: "700",
  },

  completeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  completeText: {
    marginLeft: 5,

    fontSize: 12,
    fontWeight: "600",
    color: COLORS.success,
  },

  lockedInformation: {
    flexDirection: "row",
    alignItems: "center",

    padding: 10,

    backgroundColor: COLORS.background,
    borderRadius: 9,
  },

  lockedInformationText: {
    flex: 1,

    marginLeft: 7,

    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textMuted,
  },

  equipTitleButton: {
    alignItems: "center",

    paddingVertical: 13,

    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },

  equipTitleButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
});