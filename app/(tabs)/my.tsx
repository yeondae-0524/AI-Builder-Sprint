import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

const INITIAL_INTERESTS = ["산책", "음악", "휴식"];

const DISCOVERED_INTERESTS = [
  "조용한 공간",
  "저녁 산책",
  "혼자 하는 활동",
];

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

  const [stats, setStats] = useState<StatItem[]>([
    { label: "완료 미션", value: "0" },
    { label: "기록 경험", value: "0" },
    { label: "발견 장소", value: "0" },
    { label: "완성 에세이", value: "0" },
    { label: "받은 좋아요", value: "0" },
    { label: "획득 뱃지", value: "0" },
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadMyData = async () => {
      setIsUserLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError || !user) {
        console.error(
          "사용자 정보 불러오기 실패:",
          userError?.message,
        );
        setIsUserLoading(false);
        return;
      }

      setNickname(
        user.user_metadata.nickname ?? "사용자",
      );

      const [
        completedMissionsResult,
        recordsResult,
        completedEssaysResult,
        badgesResult,
      ] = await Promise.all([
        // 완료한 미션
        supabase
          .from("mission_attempts")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id)
          .not("completed_at", "is", null),

        // 사용자의 기록과 방문 장소
        supabase
          .from("records")
          .select("id, place_id")
          .eq("user_id", user.id),

        // 완성된 에세이
        supabase
          .from("essays")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id)
          .eq("status", "completed"),

        // 획득한 뱃지
        supabase
          .from("user_badges")
          .select("badge_id")
          .eq("user_id", user.id),
      ]);

      if (!isMounted) {
        return;
      }

      if (completedMissionsResult.error) {
        console.error(
          "완료 미션 조회 실패:",
          completedMissionsResult.error.message,
        );
      }

      if (recordsResult.error) {
        console.error(
          "기록 조회 실패:",
          recordsResult.error.message,
        );
      }

      if (completedEssaysResult.error) {
        console.error(
          "에세이 조회 실패:",
          completedEssaysResult.error.message,
        );
      }

      if (badgesResult.error) {
        console.error(
          "뱃지 조회 실패:",
          badgesResult.error.message,
        );
      }

      const records = recordsResult.data ?? [];

      const recordIds = records.map(
        (record) => record.id,
      );

      // records의 place_id 중 중복을 제거
      const discoveredPlaceCount = new Set(
        records
          .map((record) => record.place_id)
          .filter(Boolean),
      ).size;

      // badge_id 중 중복을 제거
      const badgeCount = new Set(
        (badgesResult.data ?? []).map(
          (badge) => badge.badge_id,
        ),
      ).size;

      let receivedLikesCount = 0;

      // 사용자가 작성한 기록에 달린 좋아요 개수
      if (recordIds.length > 0) {
        const { count, error: likesError } =
          await supabase
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
          value: String(discoveredPlaceCount),
        },
        {
          label: "완성 에세이",
          value: String(
            completedEssaysResult.count ?? 0,
          ),
        },
        {
          label: "받은 좋아요",
          value: String(receivedLikesCount),
        },
        {
          label: "획득 뱃지",
          value: String(badgeCount),
        },
      ]);

      setIsUserLoading(false);
    };

    loadMyData();

    return () => {
      isMounted = false;
    };
  }, []);
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
                14일의 여정
              </Text>
            </View>

            <LevelTag text="D-5" />
          </View>

          <ProgressBar value={4} total={7} />

          <Text style={styles.journeyProgressText}>
            7번 중 4번 완료
          </Text>
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
              {INITIAL_INTERESTS.map((interest) => (
                <View
                  key={interest}
                  style={styles.basicChip}
                >
                  <Text style={styles.basicChipText}>
                    {interest}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.interestGroup}>
            <Text style={styles.interestCaption}>
              경험에서 나타난 취향
            </Text>

            <View style={styles.chipContainer}>
              {DISCOVERED_INTERESTS.map((interest) => (
                <View
                  key={interest}
                  style={styles.discoveredChip}
                >
                  <Text style={styles.discoveredChipText}>
                    {interest}
                  </Text>
                </View>
              ))}
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