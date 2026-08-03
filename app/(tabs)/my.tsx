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
import {
  acceptFriendRequest,
  FriendProfile,
  FriendPublicProfile,
  getFriendList,
  getFriendPublicProfile,
  getFriendStatusMap,
  getIncomingRequests,
  rejectFriendRequest,
  removeFriend,
  searchUserByNickname,
  sendFriendRequest,
} from "../../services/friend.service";
import { updateMyProfile } from "../../services/profile.service";

const COLORS = {
  primary: "#315C4A",
  primaryLight: "#E5EEE8",
  primaryDark: "#26372E",
  accent: "#F2C96D",
  textMain: "#26372E",
  textSub: "#65766D",
  textMuted: "#9AA49F",
  border: "#E2E3DC",
  background: "#F5F2E9",
  white: "#FFFFFF",
  success: "#315C4A",
};

type BadgeLevel = "locked" | "bronze" | "silver" | "gold" | "prism";

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

const TIER_LABEL_KO: Record<Exclude<BadgeLevel, "prism" | "locked">, string> = {
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
};

const TIER_ORDER: Exclude<BadgeLevel, "locked">[] = ["bronze", "silver", "gold", "prism"];

const TIER_NEXT_POINTS: Record<Exclude<BadgeLevel, "locked">, number> = {
  bronze: 3,
  silver: 7,
  gold: 15,
  prism: 30,
};

function normalizeBadgeLevel(value: unknown): Exclude<BadgeLevel, "locked"> {
  const level = String(value ?? "bronze").toLowerCase();
  if (level === "silver" || level === "gold" || level === "prism") {
    return level;
  }
  return "bronze";
}

function buildTitlesForBadge(
  name: string,
  level: Exclude<BadgeLevel, "locked">,
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
  locked: "LOCKED",
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  prism: "PRISM",
};

const SETTINGS: SettingItem[] = [
  {
    label: "계정 및 개인정보",
    description: "로그인 정보 · 기록 내보내기 · 회원관리",
  }
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
  const isLocked = badge.level === "locked";

  if (isLocked) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.badgeCard, pressed && styles.pressed]}
      >
        <View style={[styles.badgeCardInner, styles.badgeCardLocked]}>
          <View style={styles.lockIconWrap}>
            <Ionicons name="lock-closed" size={16} color={COLORS.textMuted} />
          </View>
          <Text style={[styles.badgeEmoji, styles.badgeEmojiLocked]}>{badge.emoji}</Text>
          <Text numberOfLines={2} style={[styles.badgeName, { color: COLORS.textMuted }]}>
            {badge.name}
          </Text>
        </View>
      </Pressable>
    );
  }

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
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [draftNickname, setDraftNickname] = useState("");
  const [draftAvatarUri, setDraftAvatarUri] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const [friendModalVisible, setFriendModalVisible] = useState(false);
  const [friendTab, setFriendTab] = useState<"list" | "search" | "requests">("list");
  const [friendList, setFriendList] = useState<
  (FriendProfile & { relationId: string })[]
>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<FriendProfile[]>([]);
  const [friendStatusMap, setFriendStatusMap] = useState<Record<string, string>>({});
  const [friendLoading, setFriendLoading] = useState(false);
  const [viewingFriend, setViewingFriend] = useState<FriendPublicProfile | null>(null);
  const [friendProfileLoading, setFriendProfileLoading] = useState(false);

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
            .select(`nickname, interests, avatar_url, selected_title, ai_interests, ai_interests_essay_count`)
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
            recordsResult,
            completedEssaysResult,
            discoverPostsResult,
            likeCountResult,
            badgesResult,
            journeyResult,
          ] = await Promise.all([
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
            supabase
              .from("discover_post_likes")
              .select("post_id", { count: "exact", head: true })
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

          const badgeList: Badge[] = myBadgeRows.map((row) => {
            const palette =
              CATEGORY_COLORS[row.badge_id] ??
              { color: COLORS.primary, backgroundColor: COLORS.primaryLight };

            if (row.tier === "LOCKED") {
              return {
                id: row.badge_id,
                name: row.badge.name,
                category: row.badge_id,
                level: "locked" as const,
                count: row.points,
                nextAt: TIER_NEXT_POINTS.bronze,
                emoji: row.badge.icon,
                color: palette.color,
                backgroundColor: palette.backgroundColor,
                title: undefined,
                titleHistory: [],
              };
            }

            const level = normalizeBadgeLevel(row.tier);
            const titleHistory = buildTitlesForBadge(row.badge.name, level, row.badge.title);

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

          setAllBadges(badgeList);

          const earnedBadgeCount = badgeList.filter((b) => b.level !== "locked").length;

          const discoveredPlaceCount = records.filter(
            (record) => record.location_type === "place" || Boolean(record.place_id),
          ).length;

          const myDiscoverPosts = discoverPostsResult.data ?? [];
          const totalExperienceRecordCount = records.length;
          const receivedLikesCount = myDiscoverPosts.reduce(
            (sum, post) => sum + Math.max(0, Number(post.likes_count ?? 0)),
            0,
          );

          if (!isMounted) return;

          setStats([
            { label: "좋아요", value: String(likeCountResult.count ?? 0) },
            { label: "기록 경험", value: String(totalExperienceRecordCount) },
            { label: "발견 장소", value: String(discoveredPlaceCount) },
            { label: "완성 에세이", value: String(completedEssaysResult.count ?? 0) },
            { label: "받은 좋아요", value: String(receivedLikesCount) },
            { label: "획득 뱃지", value: String(earnedBadgeCount) },
          ]);

          const currentEssayCount = completedEssaysResult.count ?? 0;
          const storedEssayCount = profileData?.ai_interests_essay_count ?? 0;
          const storedInterests = normalizeStringArray(profileData?.ai_interests);

          if (storedInterests.length > 0 && currentEssayCount === storedEssayCount) {
            setDiscoveredInterests(storedInterests);
            return;
          }

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
          const newInterests = aiData?.answer ? parseAiKeywords(aiData.answer) : [];
          setDiscoveredInterests(newInterests);

          if (newInterests.length > 0) {
            await supabase
              .from("profiles")
              .update({
                ai_interests: newInterests,
                ai_interests_essay_count: currentEssayCount,
              })
              .eq("id", user.id);
          }
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
    () => Array.from(new Set(allBadges.flatMap((badge) => badge.titleHistory))),
    [allBadges],
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
    if (setting.label === "계정 및 개인정보") {
      router.push("/my/account");
      return;
    }
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

  const loadFriendData = async () => {
    setFriendLoading(true);
    try {
      const [list, requests] = await Promise.all([
        getFriendList(),
        getIncomingRequests(),
      ]);
      setFriendList(list as any);
      setIncomingRequests(requests);
    } catch (error) {
      console.error("친구 데이터 조회 실패:", error);
    } finally {
      setFriendLoading(false);
    }
  };

  const openFriendModal = () => {
    setFriendTab("list");
    setFriendModalVisible(true);
    void loadFriendData();
  };

  const closeFriendModal = () => {
    setFriendModalVisible(false);
    setViewingFriend(null);
    setFriendProfileLoading(false);
  };

  const handleFriendSearch = async (text: string) => {
    setFriendSearchQuery(text);
    if (!text.trim()) {
      setFriendSearchResults([]);
      return;
    }
    try {
      const results = await searchUserByNickname(text);
      setFriendSearchResults(results);
      const statusMap = await getFriendStatusMap(results.map((r) => r.id));
      setFriendStatusMap(statusMap);
    } catch (error) {
      console.error("친구 검색 실패:", error);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await sendFriendRequest(userId);
      setFriendStatusMap((prev) => ({ ...prev, [userId]: "pending_sent" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "친구 요청을 보내지 못했습니다.";
      Alert.alert("요청 실패", message);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      await loadFriendData();
    } catch (error) {
      Alert.alert("수락 실패", error instanceof Error ? error.message : "");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      await loadFriendData();
    } catch (error) {
      Alert.alert("거절 실패", error instanceof Error ? error.message : "");
    }
  };

  const handleRemoveFriend = (relationId: string) => {
    Alert.alert("친구 삭제", "정말 친구를 삭제하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFriend(relationId);
            await loadFriendData();
          } catch (error) {
            Alert.alert("삭제 실패", error instanceof Error ? error.message : "");
          }
        },
      },
    ]);
  };

  const handleViewFriendProfile = async (userId: string) => {
    setFriendModalVisible(false);
    setFriendProfileLoading(true);
    try {
      const profile = await getFriendPublicProfile(userId);
      setViewingFriend(profile);
    } catch (error) {
      Alert.alert("불러오기 실패", error instanceof Error ? error.message : "");
    } finally {
      setFriendProfileLoading(false);
    }
  };

  if (selectedBadge) {
    const isPrism = selectedBadge.level === "prism";
    const isLocked = selectedBadge.level === "locked";
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
            <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
            <Text style={styles.backButtonText}>뱃지 보관함</Text>
          </Pressable>
          <View style={styles.badgeDetailHeader}>
            <View
              style={[
                styles.largeBadgeCircle,
                isLocked
                  ? { backgroundColor: COLORS.background, borderColor: COLORS.border }
                  : {
                      backgroundColor: selectedBadge.backgroundColor,
                      borderColor: selectedBadge.color,
                    },
              ]}
            >
              {isLocked ? (
                <Ionicons name="lock-closed" size={30} color={COLORS.textMuted} />
              ) : (
                <Text style={styles.largeBadgeEmoji}>{selectedBadge.emoji}</Text>
              )}
            </View>
            <Text style={[styles.badgeDetailName, isLocked && { color: COLORS.textMuted }]}>
              {selectedBadge.name}
            </Text>
            <LevelTag
              text={LEVEL_LABEL[selectedBadge.level]}
              color={isLocked ? COLORS.textMuted : selectedBadge.color}
              backgroundColor={isLocked ? COLORS.background : selectedBadge.backgroundColor}
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
                  <Text style={styles.badgeInfoLabel}>
                    {isLocked ? "브론즈까지" : "다음 단계까지"}
                  </Text>
                  <Text
                    style={[
                      styles.badgeRemainingValue,
                      { color: isLocked ? COLORS.textMuted : selectedBadge.color },
                    ]}
                  >
                    {remainingCount}점
                  </Text>
                </View>
                <ProgressBar
                  value={selectedBadge.count}
                  total={selectedBadge.nextAt}
                  color={isLocked ? COLORS.textMuted : selectedBadge.color}
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
                    router.push("/my/received-likes");
                    break;
                  case "획득 뱃지":
                    scrollViewRef.current?.scrollTo({ y: 700, animated: true });
                    break;
                }
              }}
              style={({ pressed }) => [
                styles.statCard,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Pressable>
          ))}
        </View>

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

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>뱃지 보관함</Text>
          {allBadges.length > 0 ? (
            <View style={styles.badgeGrid}>
              {allBadges.map((badge) => (
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
                뱃지를 불러오는 중이에요.
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={openFriendModal}
          style={({ pressed }) => [
            styles.sectionCard,
            pressed && styles.pressed,
            { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
          ]}
        >
          <View>
            <Text style={styles.sectionTitle}>친구</Text>
            <Text style={styles.interestNotice}>
              {friendList.length > 0 ? `친구 ${friendList.length}명` : "친구를 찾아보세요"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </Pressable>

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

        <View style={styles.bottomSpace} />
      </ScrollView>

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
              <View style={styles.modalHeaderRow}>
                <Text style={styles.profileModalTitle}>프로필 수정</Text>
                <Pressable
                  onPress={() => setProfileModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={COLORS.textMain} />
                </Pressable>
              </View>
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

      {/* 친구 모달 */}
      <Modal
        visible={friendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeFriendModal}
      >
        <KeyboardAvoidingView
          style={styles.centerModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.profileModalBackdrop} onPress={closeFriendModal} />
          <View style={styles.friendFloatingCard}>
            <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <Text style={styles.profileModalTitle}>친구</Text>
                <Pressable onPress={closeFriendModal} hitSlop={10}>
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </Pressable>
              </View>

              <View style={styles.friendTabRow}>
                {(["list", "search", "requests"] as const).map((tab) => (
                  <Pressable
                    key={tab}
                    onPress={() => setFriendTab(tab)}
                    style={[
                      styles.friendTabChip,
                      friendTab === tab && styles.titleOptionChipSelected,
                    ]}
                  >
                    <Text style={[styles.titleOptionText, friendTab === tab && styles.titleOptionTextSelected]}>
                      {tab === "list"
                        ? "친구 목록"
                        : tab === "search"
                          ? "친구 찾기"
                          : `받은 요청${incomingRequests.length > 0 ? ` ${incomingRequests.length}` : ""}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 }}
            >
              {friendLoading && friendTab !== "search" ? (
                <Text style={styles.interestNotice}>불러오는 중...</Text>
              ) : friendTab === "list" ? (
                friendList.length > 0 ? (
                  friendList.map((person) => (
                    <Pressable
                      key={person.relationId}
                      onPress={() => void handleViewFriendProfile(person.id)}
                      style={styles.friendRow}
                    >
                      {person.avatar_url ? (
                        <Image source={{ uri: person.avatar_url }} style={styles.friendAvatar} />
                      ) : (
                        <View style={[styles.friendAvatar, styles.friendAvatarPlaceholder]}>
                          <Text style={{ fontSize: 18 }}>🧑</Text>
                        </View>
                      )}
                      <Text style={styles.friendName}>{person.nickname ?? "이름 없음"}</Text>
                      <Pressable onPress={() => handleRemoveFriend(person.relationId)}>
                        <Text style={{ fontSize: 12, color: COLORS.textMuted }}>삭제</Text>
                      </Pressable>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.interestNotice}>아직 친구가 없어요. 친구 찾기에서 검색해보세요.</Text>
                )
              ) : friendTab === "search" ? (
                <>
                  <TextInput
                    value={friendSearchQuery}
                    onChangeText={handleFriendSearch}
                    placeholder="닉네임으로 검색"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.profileModalInput}
                  />
                  {friendSearchResults.map((person) => {
                    const status = friendStatusMap[person.id] ?? "none";
                    return (
                      <Pressable
                        key={person.id}
                        onPress={() => void handleViewFriendProfile(person.id)}
                        style={styles.friendRow}
                      >
                        {person.avatar_url ? (
                          <Image source={{ uri: person.avatar_url }} style={styles.friendAvatar} />
                        ) : (
                          <View style={[styles.friendAvatar, styles.friendAvatarPlaceholder]}>
                            <Text style={{ fontSize: 18 }}>🧑</Text>
                          </View>
                        )}
                        <Text style={styles.friendName}>{person.nickname ?? "이름 없음"}</Text>

                        {status === "accepted" ? (
                          <Text style={{ fontSize: 12, color: COLORS.success, fontWeight: "700" }}>친구</Text>
                        ) : status === "pending_sent" ? (
                          <Text style={{ fontSize: 12, color: COLORS.textMuted }}>요청 보냄</Text>
                        ) : status === "pending_received" ? (
                          <Text style={{ fontSize: 12, color: COLORS.textMuted }}>요청 받음</Text>
                        ) : (
                          <Pressable
                            onPress={() => handleSendFriendRequest(person.id)}
                            style={styles.friendAddButton}
                          >
                            <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.primary }}>
                              친구 요청
                            </Text>
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })}
                  {friendSearchQuery.trim().length > 0 && friendSearchResults.length === 0 && (
                    <Text style={styles.interestNotice}>검색 결과가 없어요.</Text>
                  )}
                </>
              ) : (
                incomingRequests.length > 0 ? (
                  incomingRequests.map((request: any) => {
                    const person = request.profiles;
                    return (
                      <View key={request.id} style={styles.friendRow}>
                        {person?.avatar_url ? (
                          <Image source={{ uri: person.avatar_url }} style={styles.friendAvatar} />
                        ) : (
                          <View style={[styles.friendAvatar, styles.friendAvatarPlaceholder]}>
                            <Text style={{ fontSize: 18 }}>🧑</Text>
                          </View>
                        )}
                        <Text style={styles.friendName}>{person?.nickname ?? "이름 없음"}</Text>
                        <View style={styles.requestActionRow}>
                          <Pressable onPress={() => handleAcceptRequest(request.id)} style={styles.friendAddButton}>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.primary }}>수락</Text>
                          </Pressable>
                          <Pressable onPress={() => handleRejectRequest(request.id)} style={styles.rejectButton}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textMuted }}>거절</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.interestNotice}>받은 친구 요청이 없어요.</Text>
                )
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 친구 프로필 보기 모달 */}
      <Modal
        visible={viewingFriend !== null || friendProfileLoading}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingFriend(null)}
      >
        <View style={styles.centerModalOverlay}>
          <Pressable style={styles.profileModalBackdrop} onPress={() => setViewingFriend(null)} />
          <View style={[styles.friendFloatingCard, { maxHeight: undefined }]}>
            <View style={styles.profileModalContent}>
              {friendProfileLoading ? (
                <Text style={styles.interestNotice}>불러오는 중...</Text>
              ) : viewingFriend ? (
                <>
                  <View style={styles.profileImage}>
                    {viewingFriend.avatar_url ? (
                      <Image source={{ uri: viewingFriend.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.profileEmoji}>🧑</Text>
                    )}
                  </View>

                  <Text style={[styles.profileName, { marginTop: 12 }]}>
                    {viewingFriend.nickname ?? "이름 없음"}
                  </Text>

                  {viewingFriend.selected_title ? (
                    <LevelTag text={viewingFriend.selected_title} />
                  ) : (
                    <LevelTag text="대표 칭호 없음" color={COLORS.textMuted} backgroundColor={COLORS.background} />
                  )}

                  <View style={[styles.statsGrid, { width: "100%", marginTop: 20 }]}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{viewingFriend.badgeCount}</Text>
                      <Text style={styles.statLabel}>획득 뱃지</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{viewingFriend.completedMissionCount}</Text>
                      <Text style={styles.statLabel}>완료 미션</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{viewingFriend.essayCount}</Text>
                      <Text style={styles.statLabel}>완성 에세이</Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => setViewingFriend(null)}
                    style={[styles.profileSaveButton, { marginTop: 20 }]}
                  >
                    <Text style={styles.profileSaveButtonText}>닫기</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setViewingFriend(null);
                      openFriendModal();
                    }}
                    style={{ alignItems: "center", marginTop: 12 }}
                  >
                    <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>친구 목록으로</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
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
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  pressed: {
    opacity: 0.76,
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
  badgeCardLocked: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    opacity: 0.55,
  },
  lockIconWrap: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  badgeEmoji: {
    marginBottom: 6,
    fontSize: 24,
  },
  badgeEmojiLocked: {
    opacity: 0.4,
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
  bottomSpace: {
    height: 120,
  },
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
  modalHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  profileModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  modalCloseBtn: {
    padding: 4,
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

  centerModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  friendFloatingCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "75%",
    backgroundColor: "#F9F7F1",
    borderRadius: 24,
    overflow: "hidden",
  },
  friendTabRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  friendTabChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
    gap: 10,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendAvatarPlaceholder: {
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  friendName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMain,
  },
  friendAddButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  requestActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rejectButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
});