import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getMyBadges } from "../../services/badge.service";
import { updateMyProfile } from "../../services/profile.service";

// 🌿 에세이, 캘린더, 발견 탭과 동일한 톤앤매너 팔레트
const COLORS = {
  primary: "#315C4A",        // 메인 다크 그린
  primaryLight: "#E5EEE8",   // 연한 그린 (배경/태그용)
  primaryDark: "#26372E",    // 메인 텍스트 그린
  accent: "#F2C96D",         // 골드/노랑 포인트

  textMain: "#26372E",
  textSub: "#65766D",
  textMuted: "#9AA49F",

  border: "#E2E3DC",
  background: "#F5F2E9",     // 전체 따뜻한 베이지 배경
  white: "#FFFFFF",

  success: "#315C4A",
};

type BadgeLevel = "bronze" | "silver" | "gold" | "prism";

type Badge = {
  id: string;
  name: string;
  category: string;
  level: BadgeLevel;
  count: number;
  nextAt: number;
  emoji: string;
  color: string;
  backgroundColor: string;
  title?: string;
  titleHistory: string[];
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
  goal?: string | null;
};

type MyRecord = {
  id: string;
  place_id: string | null;
  journey_id: string | null;
  content: string | null;
  emotion: string | null;
  recorded_at: string;
  location_type: "place" | "map" | "home" | null;
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
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
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
    } catch {}
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

const CATEGORY_COLORS: Record<string, { color: string; backgroundColor: string }> = {
  "음식": { color: "#85511A", backgroundColor: "#F7ECE1" },
  "카페 및 디저트": { color: "#6E521F", backgroundColor: "#FFF0C9" },
  "산책": { color: "#315C4A", backgroundColor: "#E5EEE8" },
  "배움": { color: "#2B506E", backgroundColor: "#E2ECF5" },
  "감상": { color: COLORS.primary, backgroundColor: COLORS.primaryLight },
  "활동": { color: "#85511A", backgroundColor: "#F7ECE1" },
  "휴식": { color: "#453D6E", backgroundColor: "#EAE7F2" },
  "기타": { color: "#65766D", backgroundColor: "#EAEAE3" },
};

const TIER_LABEL_KO: Record<Exclude<BadgeLevel, "prism">, string> = {
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
};

const TIER_ORDER: BadgeLevel[] = ["bronze", "silver", "gold", "prism"];

const TIER_NEXT_POINTS: Record<BadgeLevel, number> = {
  bronze: 3,
  silver: 7,
  gold: 15,
  prism: 30,
};

function normalizeBadgeLevel(value: unknown): BadgeLevel {
  const level = String(value ?? "bronze").toLowerCase();
  if (level === "silver" || level === "gold" || level === "prism") {
    return level;
  }
  return "bronze";
}

function buildTitlesForBadge(
  name: string,
  level: BadgeLevel,
  finalTitle: string | null,
): string[] {
  const currentIndex = TIER_ORDER.indexOf(level);
  const titles: string[] = [];

  for (let i = 0; i <= currentIndex; i += 1) {
    const tier = TIER_ORDER[i];
    if (tier === "prism") {
      if (finalTitle) titles.push(finalTitle);
    } else {
      titles.push(`${TIER_LABEL_KO[tier]} ${name}`);
    }
  }

  return titles;
}

const LEVEL_LABEL: Record<BadgeLevel, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  prism: "PRISM",
};

const SETTINGS: SettingItem[] = [
  {
    label: "알림 설정",
    description: "추천 미션 · 근처 기록 · 에세이 완성",
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
  const percentage = (
    total > 0 ? `${Math.min((value / total) * 100, 100)}%` : "0%"
  ) as `${number}%`;

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
    <View style={[styles.levelTag, { backgroundColor }]}>
      <Text style={[styles.levelTagText, { color }]}>{text}</Text>
    </View>
  );
}

function BadgeCard({ badge, onPress }: { badge: Badge; onPress: () => void }) {
  const isPrism = badge.level === "prism";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.badgeCard, pressed && styles.pressed]}
    >
      {isPrism ? (
        <LinearGradient
          colors={["#E2D9F3", "#FCE7F3", "#D9ECF7", "#FDE68A", "#E2D9F3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badgeCardInner}
        >
          <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
          <Text style={[styles.badgeLevel, { color: "#453D6E" }]}>{LEVEL_LABEL[badge.level]}</Text>
          <Text numberOfLines={2} style={[styles.badgeName, { color: "#26372E", fontWeight: "800" }]}>
            {badge.name}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.badgeCardInner,
            { backgroundColor: badge.backgroundColor, borderWidth: 1, borderColor: COLORS.border },
          ]}
        >
          <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
          <Text style={[styles.badgeLevel, { color: badge.color }]}>{LEVEL_LABEL[badge.level]}</Text>
          <Text numberOfLines={2} style={styles.badgeName}>
            {badge.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function MyScreen() {
  const [nickname, setNickname] = useState("사용자");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  const [journey, setJourney] = useState<ActiveJourney | null>(null);
  const [journeyRecordCount, setJourneyRecordCount] = useState(0);

  const [initialInterests, setInitialInterests] = useState<string[]>([]);
  const [discoveredInterests, setDiscoveredInterests] = useState<string[]>([]);
  const [isAiInterestLoading, setIsAiInterestLoading] = useState(true);

  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [draftNickname, setDraftNickname] = useState("");
  const [draftAvatarUri, setDraftAvatarUri] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const modalPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 5;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          setProfileModalVisible(false);
        }
      },
    })
  ).current;

  const [stats, setStats] = useState<StatItem[]>([
    { label: "좋아요", value: "0" },
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
            throw new Error(userError?.message ?? "로그인 정보를 확인할 수 없습니다.");
          }

          if (!isMounted) return;

          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select(`nickname, interests, avatar_url, selected_title`)
            .eq("id", user.id)
            .single();

          if (profileError) {
            console.error("프로필 조회 실패:", profileError.message);
            setNickname(user.user_metadata.nickname ?? "사용자");
            setInitialInterests([]);
            setAvatarUrl(null);
            setSelectedTitle(null);
          } else {
            setNickname(profileData.nickname ?? user.user_metadata.nickname ?? "사용자");
            setInitialInterests(normalizeStringArray(profileData.interests));
            setAvatarUrl(profileData.avatar_url ?? null);
            setSelectedTitle(profileData.selected_title ?? null);
          }

          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const todayKey = toDateKey(todayStart);

          const [
            completedMissionsResult,
            recordsResult,
            completedEssaysResult,
            discoverPostsResult,
            badgesResult,
            journeyResult,
          ] = await Promise.all([
            supabase
              .from("mission_attempts")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .not("completed_at", "is", null),

            supabase
              .from("records")
              .select("id, place_id, journey_id, content, emotion, recorded_at, location_type")
              .eq("user_id", user.id)
              .order("recorded_at", { ascending: false }),

            supabase
              .from("essays")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("status", "completed"),

            supabase
              .from("discover_posts")
              .select("likes_count, source_kind, source_mission_id")
              .eq("user_id", user.id),

            getMyBadges()
              .then((data) => ({ data, error: null as null }))
              .catch((error) => ({ data: [] as Awaited<ReturnType<typeof getMyBadges>>, error })),

            supabase
              .from("journeys")
              .select("id, title, target_record_count, start_date, end_date, status, goal")
              .eq("user_id", user.id)
              .eq("status", "active")
              .lte("start_date", todayKey)
              .gte("end_date", todayKey)
              .order("start_date", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          if (!isMounted) return;

          const records = (recordsResult.data ?? []) as MyRecord[];
          const activeJourney = (journeyResult.data ?? null) as ActiveJourney | null;

          setJourney(activeJourney);

          const journeyCompletedDayCount = activeJourney
            ? new Set(
                records
                  .filter((record) => record.journey_id === activeJourney.id)
                  .map((record) => record.recorded_at),
              ).size
            : 0;

          setJourneyRecordCount(journeyCompletedDayCount);

          const myBadgeRows = badgesResult.data ?? [];
          const earnedBadgeList: Badge[] = myBadgeRows
            .filter((row) => row.tier !== "LOCKED")
            .map((row) => {
              const level = normalizeBadgeLevel(row.tier);
              const palette =
                CATEGORY_COLORS[row.badge_id] ??
                { color: COLORS.primary, backgroundColor: COLORS.primaryLight };

              const titleHistory = buildTitlesForBadge(
                row.badge.name,
                level,
                row.badge.title,
              );

              return {
                id: row.badge_id,
                name: row.badge.name,
                category: row.badge_id,
                level,
                count: row.points,
                nextAt: level === "prism" ? 0 : TIER_NEXT_POINTS[level],
                emoji: row.badge.icon,
                color: palette.color,
                backgroundColor: palette.backgroundColor,
                title: titleHistory[titleHistory.length - 1],
                titleHistory,
              };
            });

          setEarnedBadges(earnedBadgeList);

          const discoveredPlaceCount = records.filter(
            (record) => record.location_type === "place" || Boolean(record.place_id),
          ).length;

          const myDiscoverPosts = discoverPostsResult.data ?? [];
          const independentDiscoverRecordCount = myDiscoverPosts.filter(
            (post) => post.source_kind !== "mission" && !post.source_mission_id,
          ).length;
          const totalExperienceRecordCount = records.length + independentDiscoverRecordCount;
          const receivedLikesCount = myDiscoverPosts.reduce(
            (sum, post) => sum + Math.max(0, Number(post.likes_count ?? 0)),
            0,
          );

          if (!isMounted) return;

          setStats([
            { label: "좋아요", value: String(completedMissionsResult.count ?? 0) },
            { label: "기록 경험", value: String(totalExperienceRecordCount) },
            { label: "발견 장소", value: String(discoveredPlaceCount) },
            { label: "완성 에세이", value: String(completedEssaysResult.count ?? 0) },
            { label: "받은 좋아요", value: String(receivedLikesCount) },
            { label: "획득 뱃지", value: String(earnedBadgeList.length) },
          ]);

          const recordsForAi = records
            .filter((record) => typeof record.content === "string" && record.content.trim().length > 0)
            .slice(0, 20);

          if (recordsForAi.length === 0) {
            setDiscoveredInterests([]);
            return;
          }

          const experienceText = recordsForAi
            .map((record, index) => `${index + 1}. 감정: ${record.emotion ?? "미입력"}\n기록: ${record.content}`)
            .join("\n\n");

          const aiPrompt = `다음은 한 사용자가 직접 작성한 경험 기록이다.\n\n${experienceText}\n\n이 기록에서 반복적으로 나타나는 활동, 공간, 시간대, 분위기, 행동 성향을 분석해 사용자의 취향을 나타내는 한국어 키워드 3개를 뽑아라.\n\n규칙:\n- 각 키워드는 2~10자 정도의 짧은 명사구\n- 서로 의미가 겹치지 않게 작성\n- 평가나 진단을 하지 말 것\n- 설명을 쓰지 말 것\n- 반드시 JSON 문자열 배열 하나만 반환할 것\n\n출력 예시:\n["조용한 공간", "저녁 산책", "혼자 하는 활동"]`.trim();

          const { data: aiData, error: aiError } = await supabase.functions.invoke<AiKeywordResponse>("upstage-test", {
            body: { message: aiPrompt },
          });

          if (!isMounted) return;

          if (aiError) {
            console.error("AI 취향 분석 실패:", aiError.message);
            setDiscoveredInterests([]);
            return;
          }

          setDiscoveredInterests(aiData?.answer ? parseAiKeywords(aiData.answer) : []);
        } catch (error) {
          if (!isMounted) return;
          console.error("MY 화면 로딩 실패:", error);
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
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const journeyDday =
    journey === null
      ? null
      : Math.max(
          0,
          Math.ceil(
            (parseDateKey(journey.end_date).getTime() - todayStart.getTime()) / DAY_IN_MS,
          ),
        );

  const journeyDdayText =
    journeyDday === null
      ? "--"
      : journeyDday === 0
        ? "D-DAY"
        : `D-${journeyDday}`;

  const titleOptions = useMemo(
    () => Array.from(new Set(earnedBadges.flatMap((badge) => badge.titleHistory))),
    [earnedBadges],
  );

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("사진 권한이 필요해요", "프로필 사진을 바꾸려면 사진 접근을 허용해주세요.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setDraftAvatarUri(result.assets[0].uri);
    }
  };

  const handleProfileEdit = () => {
    setDraftNickname(nickname);
    setDraftAvatarUri(null);
    setDraftTitle(selectedTitle);
    setProfileModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!draftNickname.trim()) {
      Alert.alert("닉네임을 입력해주세요", "닉네임은 비워둘 수 없어요.");
      return;
    }

    setProfileSaving(true);
    try {
      let newAvatarUrl = avatarUrl;

      if (draftAvatarUri) {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const response = await fetch(draftAvatarUri);
          const arrayBuffer = await response.arrayBuffer();
          const path = `${user.id}/avatar-${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("profile-photos")
            .upload(path, arrayBuffer, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from("profile-photos")
            .getPublicUrl(path);

          newAvatarUrl = publicUrlData.publicUrl;
        }
      }

      await updateMyProfile({
        nickname: draftNickname.trim(),
        avatar_url: newAvatarUrl ?? undefined,
        selected_title: draftTitle,
      } as any);

      setNickname(draftNickname.trim());
      setAvatarUrl(newAvatarUrl);
      setSelectedTitle(draftTitle);
      setProfileModalVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "프로필을 저장하지 못했습니다.";
      Alert.alert("프로필 저장 실패", message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSettingPress = (setting: SettingItem) => {
    Alert.alert(
      setting.label,
      `${setting.description}\n\n설정 상세 화면은 추후 연결할 예정입니다.`,
    );
  };

  const handleEquipTitle = async (badge: Badge) => {
    if (!badge.title) {
      Alert.alert("칭호 없음", "이 뱃지에서 획득한 칭호가 없어요.");
      return;
    }

    try {
      await updateMyProfile({
        selected_title: badge.title,
      } as any);

      setSelectedTitle(badge.title);

      Alert.alert("대표 칭호 설정", `"${badge.title}" 칭호를 대표 칭호로 설정했어요.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "대표 칭호를 설정하지 못했습니다.";
      Alert.alert("대표 칭호 설정 실패", message);
    }
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "정말 로그아웃하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert("로그아웃 실패", error.message);
        },
      },
    ]);
  };

  if (selectedBadge) {
    const isPrism = selectedBadge.level === "prism";
    const remainingCount = Math.max(selectedBadge.nextAt - selectedBadge.count, 0);

    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.badgeDetailContent}
        >
          <Pressable
            onPress={() => setSelectedBadge(null)}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
            <Text style={styles.backButtonText}>뱃지 보관함</Text>
          </Pressable>

          <View style={styles.badgeDetailHeader}>
            <View
              style={[
                styles.largeBadgeCircle,
                {
                  backgroundColor: selectedBadge.backgroundColor,
                  borderColor: selectedBadge.color,
                },
              ]}
            >
              <Text style={styles.largeBadgeEmoji}>{selectedBadge.emoji}</Text>
            </View>

            <Text style={styles.badgeDetailName}>{selectedBadge.name}</Text>

            <LevelTag
              text={LEVEL_LABEL[selectedBadge.level]}
              color={selectedBadge.color}
              backgroundColor={selectedBadge.backgroundColor}
            />

            {selectedBadge.title && (
              <View style={styles.titleEarnedRow}>
                <Ionicons name="sparkles" size={15} color={COLORS.primary} />
                <Text style={styles.titleEarnedText}>
                  칭호 &quot;{selectedBadge.title}&quot; 획득
                </Text>
              </View>
            )}
          </View>

          <View style={styles.badgeProgressCard}>
            <View style={styles.badgeInfoRow}>
              <Text style={styles.badgeInfoLabel}>누적 포인트</Text>
              <Text style={styles.badgeInfoValue}>{selectedBadge.count}</Text>
            </View>

            {!isPrism && selectedBadge.nextAt > 0 && (
              <>
                <View style={styles.badgeInfoRow}>
                  <Text style={styles.badgeInfoLabel}>다음 단계까지</Text>
                  <Text style={[styles.badgeRemainingValue, { color: selectedBadge.color }]}>
                    {remainingCount}점
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
                <Ionicons name="checkmark-circle" size={17} color={COLORS.success} />
                <Text style={styles.completeText}>최고 단계 달성</Text>
              </View>
            )}
          </View>

          {selectedBadge.title && (
            <Pressable
              onPress={() => handleEquipTitle(selectedBadge)}
              style={({ pressed }) => [styles.equipTitleButton, pressed && styles.pressed]}
            >
              <Text style={styles.equipTitleButtonText}>
                {selectedTitle === selectedBadge.title ? "현재 대표 칭호" : "대표 칭호로 설정"}
              </Text>
            </Pressable>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenContent}
      >
        {/* 🌿 헤더 영역 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MY PROFILE</Text>
            <Text style={styles.headerTitle}>마이페이지</Text>
            <Text style={styles.headerDescription}>
              나의 경험 자산과 취향 분석을 확인해보세요.
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="person-outline" size={28} color={COLORS.primary} />
          </View>
        </View>

        {/* 🌿 프로필 섹션 */}
        <View style={styles.profileCard}>
          <View style={styles.profileSection}>
            <View style={styles.profileImage}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.profileEmoji}>🧑</Text>
              )}
            </View>

            <View style={styles.profileTextArea}>
              <Text style={styles.profileName}>
                {isUserLoading ? "불러오는 중..." : nickname}
              </Text>

              {selectedTitle ? (
                <LevelTag text={selectedTitle} />
              ) : (
                <LevelTag
                  text="대표 칭호 없음"
                  color={COLORS.textMuted}
                  backgroundColor={COLORS.background}
                />
              )}
            </View>

            <Pressable
              onPress={handleProfileEdit}
              style={({ pressed }) => [
                styles.profileEditButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.profileEditButtonText}>수정</Text>
            </Pressable>
          </View>
        </View>

        {/* 🌿 진행 중인 여정 카드 (에세이 탭의 journeyCard 스타일 다크 그린 적용) */}
        <View style={styles.journeyCard}>
          <View style={styles.journeyHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.journeyCaption}>진행 중인 여정</Text>
              <Text style={styles.journeyTitle}>
                {isUserLoading ? "불러오는 중..." : journey?.title ?? "진행 중인 여정이 없어요"}
              </Text>
              {journey?.goal && (
                <View style={styles.activeGoalBadge}>
                  <Text style={styles.activeGoalText}>🎯 {journey.goal}</Text>
                </View>
              )}
            </View>

            <LevelTag
              text={journeyDdayText}
              color={COLORS.accent}
              backgroundColor="rgba(255, 255, 255, 0.15)"
            />
          </View>

          {journey ? (
            <>
              <ProgressBar
                value={journeyRecordCount}
                total={journey.target_record_count}
                color={COLORS.accent}
              />
              <Text style={styles.journeyProgressText}>
                {journey.target_record_count}일 중 {journeyRecordCount}일 완료
              </Text>
            </>
          ) : (
            <>
              <ProgressBar value={0} total={1} color={COLORS.accent} />
              <Text style={styles.journeyProgressText}>
                캘린더에서 새 여정을 시작해 주세요.
              </Text>
            </>
          )}
        </View>

        {/* 🌿 활동 통계 */}
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <Pressable
              key={stat.label}
              onPress={() => {
                switch (stat.label) {
                  case "좋아요":
                    router.push("/my/likes");
                    break;
                  case "기록 경험":
                    router.push("/my/records");
                    break;
                  case "발견 장소":
                    router.push("/my/places");
                    break;
                  case "완성 에세이":
                    router.push("/(tabs)/essay");
                    break;
                  case "받은 좋아요":
                    return;
                  case "획득 뱃지":
                    scrollViewRef.current?.scrollTo({ y: 700, animated: true });
                    break;
                }
              }}
              style={({ pressed }) => [
                styles.statCard,
                stat.label !== "받은 좋아요" && pressed && styles.pressed,
              ]}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 🌿 취향 섹션 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>취향 분석</Text>

          <View style={styles.interestGroup}>
            <Text style={styles.interestCaption}>처음 선택한 관심사</Text>
            <View style={styles.chipContainer}>
              {initialInterests.length > 0 ? (
                initialInterests.map((interest) => (
                  <View key={interest} style={styles.basicChip}>
                    <Text style={styles.basicChipText}>{interest}</Text>
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
            <Text style={styles.interestCaption}>경험에서 나타난 AI 분석 취향</Text>
            <View style={styles.chipContainer}>
              {isAiInterestLoading ? (
                <Text style={styles.interestNotice}>
                  AI가 최근 경험을 분석하는 중이에요.
                </Text>
              ) : discoveredInterests.length > 0 ? (
                discoveredInterests.map((interest) => (
                  <View key={interest} style={styles.discoveredChip}>
                    <Text style={styles.discoveredChipText}>✨ {interest}</Text>
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
            최근 기록된 경험들에서 자주 나타난 행동 성향이에요.
          </Text>
        </View>

        {/* 🌿 뱃지 보관함 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>뱃지 보관함</Text>

          {earnedBadges.length > 0 ? (
            <View style={styles.badgeGrid}>
              {earnedBadges.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  onPress={() => setSelectedBadge(badge)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyBadgeArea}>
              <Ionicons
                name="ribbon-outline"
                size={32}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyBadgeText}>
                아직 획득한 뱃지가 없어요.
              </Text>
              <Text style={styles.emptyBadgeDescription}>
                미션을 완료하면 새로운 뱃지가 열려요.
              </Text>
            </View>
          )}
        </View>

        {/* 🌿 설정 */}
        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderText}>설정</Text>
          </View>

          {SETTINGS.map((setting, index) => (
            <Pressable
              key={setting.label}
              onPress={() => handleSettingPress(setting)}
              style={({ pressed }) => [
                styles.settingRow,
                index < SETTINGS.length - 1 && styles.settingRowBorder,
                pressed && styles.settingPressed,
              ]}
            >
              <View style={styles.settingTextArea}>
                <Text style={styles.settingLabel}>{setting.label}</Text>
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

        {/* 🌿 로그아웃 */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* 🌿 프로필 수정 모달 */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.profileModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.profileModalBackdrop}
            onPress={() => setProfileModalVisible(false)}
          />
          <View style={styles.profileModalCard}>
            <View style={styles.profileModalHandleWrap} {...modalPanResponder.panHandlers}>
              <View style={styles.profileModalHandle} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.profileModalContent}
            >
              <Text style={styles.profileModalTitle}>프로필 수정</Text>

              <Pressable onPress={handlePickAvatar} style={styles.avatarPickerWrapper}>
                <View style={styles.avatarPicker}>
                  {draftAvatarUri || avatarUrl ? (
                    <Image
                      source={{ uri: draftAvatarUri ?? avatarUrl ?? undefined }}
                      style={styles.avatarPickerImage}
                    />
                  ) : (
                    <Text style={styles.profileEmoji}>🧑</Text>
                  )}
                </View>
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={14} color={COLORS.white} />
                </View>
              </Pressable>

              <Text style={styles.profileModalLabel}>닉네임</Text>
              <TextInput
                value={draftNickname}
                onChangeText={setDraftNickname}
                placeholder="닉네임을 입력해주세요"
                placeholderTextColor={COLORS.textMuted}
                style={styles.profileModalInput}
                maxLength={20}
              />

              <Text style={styles.profileModalLabel}>대표 칭호</Text>
              {titleOptions.length > 0 ? (
                <View style={styles.titleOptionWrap}>
                  <Pressable
                    onPress={() => setDraftTitle(null)}
                    style={[
                      styles.titleOptionChip,
                      draftTitle === null && styles.titleOptionChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.titleOptionText,
                        draftTitle === null && styles.titleOptionTextSelected,
                      ]}
                    >
                      없음
                    </Text>
                  </Pressable>
                  {titleOptions.map((titleOption) => (
                    <Pressable
                      key={titleOption}
                      onPress={() => setDraftTitle(titleOption)}
                      style={[
                        styles.titleOptionChip,
                        draftTitle === titleOption && styles.titleOptionChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.titleOptionText,
                          draftTitle === titleOption && styles.titleOptionTextSelected,
                        ]}
                      >
                        {titleOption}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.interestNotice}>
                  아직 획득한 칭호가 없어요. 미션을 완료해서 뱃지를 모아보세요.
                </Text>
              )}

              <Pressable
                onPress={() => void handleSaveProfile()}
                disabled={profileSaving}
                style={({ pressed }) => [
                  styles.profileSaveButton,
                  pressed && styles.pressed,
                  profileSaving && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.profileSaveButtonText}>
                  {profileSaving ? "저장 중..." : "저장하기"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setProfileModalVisible(false)}
                style={{ alignItems: "center", marginTop: 14 }}
              >
                <Text style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: "600" }}>취소</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  pressed: {
    opacity: 0.76,
  },

  // 🌿 상단 타이틀
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

  // 🌿 프로필 카드
  profileCard: {
    padding: 18,
    marginBottom: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
  },

  profileSection: {
    flexDirection: "row",
    alignItems: "center",
  },

  profileImage: {
    width: 64,
    height: 68,
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 34,
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  profileEmoji: {
    fontSize: 28,
  },

  profileTextArea: {
    flex: 1,
    alignItems: "flex-start",
  },

  profileName: {
    marginBottom: 5,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  profileEditButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },

  profileEditButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },

  levelTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },

  levelTagText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // 🌿 진행 중인 여정 카드 (에세이 탭 다크 그린 #315C4A 톤앤매너)
  journeyCard: {
    marginBottom: 14,
    padding: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
  },

  journeyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  journeyCaption: {
    marginBottom: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#BFD0C7",
  },

  journeyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.white,
  },

  activeGoalBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 6,
    alignSelf: "flex-start",
  },

  activeGoalText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E1E9E3",
  },

  journeyProgressText: {
    marginTop: 8,
    fontSize: 12,
    color: "#D8E2DC",
  },

  progressBarBackground: {
    height: 6,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 3,
  },

  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // 🌿 활동 통계
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
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },

  statValue: {
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  statLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSub,
  },

  // 🌿 섹션 카드 공통
  sectionCard: {
    marginBottom: 14,
    padding: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
  },

  sectionTitle: {
    marginBottom: 14,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  interestGroup: {
    marginBottom: 12,
  },

  interestCaption: {
    marginBottom: 7,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSub,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  basicChip: {
    marginRight: 6,
    marginBottom: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },

  basicChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSub,
  },

  discoveredChip: {
    marginRight: 6,
    marginBottom: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },

  discoveredChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },

  interestNotice: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // 🌿 뱃지
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },

  badgeCard: {
    width: "30.33%",
    minHeight: 104,
    marginHorizontal: "1.5%",
    marginBottom: 10,
  },

  badgeCardInner: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    overflow: "hidden",
  },

  badgeEmoji: {
    marginBottom: 6,
    fontSize: 24,
  },

  badgeLevel: {
    marginBottom: 4,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  badgeName: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    fontWeight: "700",
    color: COLORS.textMain,
  },

  emptyBadgeArea: {
    alignItems: "center",
    paddingVertical: 24,
  },

  emptyBadgeText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  emptyBadgeDescription: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // 🌿 설정 카드
  settingsCard: {
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
  },

  settingsHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },

  settingsHeaderText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: COLORS.textSub,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },

  settingPressed: {
    backgroundColor: COLORS.background,
  },

  settingTextArea: {
    flex: 1,
    marginRight: 12,
  },

  settingLabel: {
    marginBottom: 2,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  settingDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  logoutButton: {
    alignItems: "center",
    paddingVertical: 12,
  },

  logoutText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
  },

  bottomSpace: {
    height: 120,
  },

  // 🌿 뱃지 상세 모달
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
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textMain,
  },

  badgeDetailHeader: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 24,
  },

  largeBadgeCircle: {
    width: 84,
    height: 84,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderRadius: 42,
  },

  largeBadgeEmoji: {
    fontSize: 36,
  },

  badgeDetailName: {
    marginBottom: 8,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  titleEarnedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  titleEarnedText: {
    marginLeft: 5,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },

  badgeProgressCard: {
    marginBottom: 14,
    padding: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
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
    fontWeight: "800",
    color: COLORS.textMain,
  },

  badgeRemainingValue: {
    fontSize: 13,
    fontWeight: "800",
  },

  completeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  completeText: {
    marginLeft: 5,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.success,
  },

  equipTitleButton: {
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },

  equipTitleButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },

  // 🌿 프로필 수정 모달
  profileModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  profileModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24, 35, 29, 0.52)",
  },

  profileModalCard: {
    maxHeight: "85%",
    backgroundColor: "#F9F7F1",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  profileModalHandleWrap: {
    width: "100%",
    paddingVertical: 15,
    alignItems: "center",
  },

  profileModalHandle: {
    width: 42,
    height: 5,
    backgroundColor: "#D7D9DE",
    borderRadius: 3,
  },

  profileModalContent: {
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 34,
    alignItems: "center",
  },

  profileModalTitle: {
    alignSelf: "flex-start",
    marginBottom: 18,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  avatarPickerWrapper: {
    position: "relative",
    width: 88,
    height: 88,
    marginBottom: 20,
  },

  avatarPicker: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 44,
    overflow: "hidden",
  },

  avatarPickerImage: {
    width: "100%",
    height: "100%",
  },

  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  profileModalLabel: {
    alignSelf: "flex-start",
    marginBottom: 9,
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  profileModalInput: {
    width: "100%",
    height: 48,
    marginBottom: 18,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.textMain,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
  },

  titleOptionWrap: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },

  titleOptionChip: {
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
  },

  titleOptionChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },

  titleOptionText: {
    fontSize: 12,
    color: COLORS.textSub,
  },

  titleOptionTextSelected: {
    fontWeight: "800",
    color: COLORS.primary,
  },

  profileSaveButton: {
    width: "100%",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },

  profileSaveButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },
});