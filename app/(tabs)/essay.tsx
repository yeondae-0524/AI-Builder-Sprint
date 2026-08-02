import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
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
  primary: "#315C4A",        // 메인 다크 그린
  primaryLight: "#E5EEE8",   // 연한 그린
  accent: "#F2C96D",         // 골드/노란 포인트
  pink: "#E07A5F",          // 딥 코랄
  pinkLight: "#F4EAE1",
  textMain: "#26372E",
  textSub: "#65766D",
  textMuted: "#9AA49F",
  border: "#E2E3DC",
  white: "#FFFFFF",
  background: "#F5F2E9",     // 따뜻한 베이지 배경

  // 🪵 원목 책장 테마
  woodDark: "#5C3A21",
  woodMain: "#825432",
  woodLight: "#A06C42",
  woodBorder: "#422815",

  // 📚 책등(Spine) 커버 테마
  bookThemes: [
    { bg: "#315C4A", text: "#F2C96D", line: "#234739" },
    { bg: "#8C3B30", text: "#F9F6F0", line: "#6D2D25" },
    { bg: "#2D4A60", text: "#E5EEE8", line: "#1E3444" },
    { bg: "#B8860B", text: "#FFFFFF", line: "#8B6508" },
    { bg: "#5A4B6E", text: "#F2C96D", line: "#423752" },
  ],
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PersonaType = "emotional" | "fact_teacher" | "detective" | "comic_pd";

type JourneyStatus = "active" | "completed_pending_essay" | "finished";

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
  title: string;
  category: string;
  recordedAt: string;
  emotion: string;
  content: string;
  imageUrl?: string;
};

type DraftEssay = {
  id: string;
  journeyTitle: string;
  goal?: string;
  dateRangeText: string;
  coverImage: string;
  title: string;
  content: string;
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
  coverImage?: string;
  records?: JourneyRecordItem[];
};

export default function EssayScreen() {
  const router = useRouter();

  const [journey, setJourney] = useState<ActiveJourney | null>(null);
  const [completedDayCount, setCompletedDayCount] = useState(0);
  const [draftEssay, setDraftEssay] = useState<DraftEssay | null>(null);
  const [essays, setEssays] = useState<CompletedEssay[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달 제어 상태
  const [writerModalVisible, setPersonaWriterModalVisible] = useState(false);
  const [personaPickerVisible, setPersonaPickerVisible] = useState(false);
  const [selectedEssay, setSelectedEssay] = useState<CompletedEssay | null>(null);

  // 에세이에 담긴 기록 아코디언 접기 상태
  const [recordsFolded, setRecordsFolded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadData = async () => {
        setLoading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // 1. 현재 여정 정보
          const { data: journeyData } = await supabase
            .from("journeys")
            .select("id, title, status, duration_days, target_record_count, start_date, end_date, goal")
            .eq("user_id", user.id)
            .order("start_date", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (journeyData && isMounted) {
            const j = journeyData as ActiveJourney;
            setJourney(j);

            const { data: journeyRecords } = await supabase
              .from("records")
              .select("id, title, category, recorded_at, emotion, content, image_url")
              .eq("user_id", user.id)
              .eq("journey_id", j.id);

            const uniqueDays = new Set((journeyRecords ?? []).map((r) => r.recorded_at?.slice(0, 10))).size;
            setCompletedDayCount(uniqueDays);

            const sampleRecords: JourneyRecordItem[] = (journeyRecords ?? []).map((r, idx) => ({
              id: r.id ?? `rec-${idx}`,
              indexNum: idx + 1,
              title: r.title ?? "골목 카페 탐험",
              category: r.category ?? "walking",
              recordedAt: r.recorded_at?.slice(0, 10) ?? "2026년 7월 31일",
              emotion: r.emotion ?? "joyful",
              content: r.content ?? "노스커피 6호점에서 아늑한 분위기에 앉아 커피 향을 맡았다.",
              imageUrl: r.image_url ?? undefined,
            }));

            if (sampleRecords.length === 0) {
              sampleRecords.push(
                { id: "1", indexNum: 1, title: "스페로스페라 근처 골목에서 발견하는 작은 아름다움", category: "walking", recordedAt: "2026년 7월 31일", emotion: "joyful", content: "골목길 벽화와 작은 가게들을 구경하며 느낀 여유." },
                { id: "2", indexNum: 2, title: "노스커피 6호점에서 커피 향과 함께 하는 명상 시간", category: "walking", recordedAt: "2026년 7월 31일", emotion: "joyful", content: "백엔드 통합 테스트로 생성한 1번째 기록입니다." },
                { id: "3", indexNum: 3, title: "대학가 골목 카페 산책", category: "walking", recordedAt: "2026년 7월 31일", emotion: "joyful", content: "따뜻한 음료 한 잔과 깊은 호흡." },
                { id: "4", indexNum: 4, title: "Spend ten quiet minutes without your phone", category: "rest", recordedAt: "2026년 7월 31일", emotion: "comfortable", content: "스마트폰을 끄고 오롯이 내 감각에 몰입하기." },
                { id: "5", indexNum: 5, title: "자연 백색소음 명상", category: "휴식", recordedAt: "2026년 7월 31일", emotion: "new", content: "빗소리에 집중했던 시간." }
              );
            }

            setDraftEssay({
              id: `draft-${j.id}`,
              journeyTitle: `${Math.max(1, Math.round(j.duration_days / 7))}주의 여정`,
              goal: j.goal ?? "소소한 일상 속 행복 기록하기",
              dateRangeText: "2026년 7월 31일 - 2026년 8월 13일",
              coverImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop",
              title: "7월 31일의 일상 기록",
              content: "오늘은 스페로스페라 근처 골목을 걸으며 아기자기한 벽화와 작은 가게들을 사진으로 담았다. 발걸음이 닿는 곳마다 예상치 못한 아름다움이 숨어 있어 산책이 마치 숨은 이야기를 찾는 듯한 기분이었다. 같은 날 오후에는 노스커피 6호점에서 아늑한 분위기에 앉아 따뜻한 커피 향을 맡았다. 10분간 눈을 감고 마음의 소리를 들어보며 여유로운 시간을 가졌고, 이어 킹스네일커피까지 걸어가는 길에서는 또 다른 카페의 정취를 비교해보았다.",
              persona: "emotional",
              aiSummary: "스페로스페라 주변 골목과 카페에서 찾은 작은 아름다움과 명상의 시간을 통해 일상의 여유를 깨달은 여정",
              records: sampleRecords,
            });
          }

          // 2. 완결된 에세이 목록
          const { data: essayRows } = await supabase
            .from("essays")
            .select("id, title, content, created_at, journey_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (essayRows && isMounted) {
            const parsed: CompletedEssay[] = essayRows.map((row, idx) => ({
              id: row.id,
              title: row.title ?? "나의 일상 에세이",
              content: row.content ?? "작성된 에세이 내용이 없습니다.",
              journeyGoal: "일상의 소소한 행복 찾기",
              dateRangeText: "2026.07.26 ~ 08.02",
              durationDays: idx % 3 === 0 ? 30 : idx % 2 === 0 ? 14 : 7,
              created_at: row.created_at,
              themeIndex: idx % COLORS.bookThemes.length,
              persona: "emotional",
            }));

            if (parsed.length === 0) {
              setEssays([
                {
                  id: "sample-1",
                  title: "동네 골목 카페 탐험과 소소한 행복들",
                  content: "바쁜 일상 속에서 잠시 벗어나 가보고 싶었던 작은 카페에 들렀다. 따뜻한 아메리카노 향과 함께 읽은 책 몇 장이 마음에 깊은 평온을 선사해주었다.",
                  journeyGoal: "나만의 고요한 시간 30분 가지기",
                  dateRangeText: "2026.07.27 ~ 08.02",
                  durationDays: 7,
                  created_at: "2026-08-02",
                  themeIndex: 0,
                  persona: "emotional",
                },
                {
                  id: "sample-2",
                  title: "나 오롯이에게 집중했던 한 달간의 기록",
                  content: "한 달이라는 시간 동안 나를 찾아 떠난 작은 여정. 바람 소리를 듣고 마음의 잡생각을 비워내며 모은 소중한 이야기.",
                  journeyGoal: "스스로를 칭찬하고 기운 얻기",
                  dateRangeText: "2026.07.01 ~ 07.31",
                  durationDays: 30,
                  created_at: "2026-07-31",
                  themeIndex: 1,
                  persona: "emotional",
                },
              ]);
            } else {
              setEssays(parsed);
            }
          }
        } catch (error) {
          console.error("에세이 로딩 실패:", error);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      void loadData();

      return () => { isMounted = false; };
    }, [])
  );

  // 📖 여정 기간별 책 두께
  const getBookSpineWidth = (durationDays: number) => {
    if (durationDays >= 30) return 68;
    if (durationDays >= 14) return 54;
    return 44;
  };

  // 🧱 책장 층 나누기
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

  // 🚀 핵심: '이번에는 누가 읽어볼까요?' 모달에서 AI 페르소나 선택 시 에세이 즉시 재작성!
  const handleSelectPersona = (persona: PersonaType) => {
    if (!draftEssay) return;
    setPersonaPickerVisible(false); // 팝업 모달 닫기

    let newTitle = draftEssay.title;
    let newContent = draftEssay.content;
    let newSummary = draftEssay.aiSummary;

    if (persona === "emotional") {
      newTitle = "7월 31일의 따뜻한 감성 기록";
      newContent = "골목길을 천천히 거닐며 모아둔 순간들이 마음에 따스한 온기를 전해줍니다. 카페에서 흘러나오는 재즈 음악과 커피 향 속에서 잠시 멈추어 오롯이 나와 마주했던 시간들. 그 작은 여유가 오늘 하루를 온전히 채워주었습니다.";
      newSummary = "골목길 카페와 고요한 명상의 시간을 통해 다정한 언어로 풀어낸 감성 여정";
    } else if (persona === "fact_teacher") {
      newTitle = "휴식 행동 패턴 및 실행력 평가 분석";
      newContent = "이번 여정 동안 기록된 미션 수행 수치 분석 결과: 카페 방문 및 명상 미션 비중이 80% 이상을 차지함. 초반 설정했던 '디지털 디톡스' 목표에 충실했으며, 10분간의 짧은 멈춤 습관이 스트레스 지수를 크게 완화시켰음이 확인됨.";
      newSummary = "목표 대비 행동 결과와 시간 활용 습관을 객관적인 시각에서 분석한 데이터 보고";
    } else if (persona === "detective") {
      newTitle = "사건명: 골목길과 커피 향 속 감정 단서 추적기";
      newContent = "기록에 남겨진 주요 단서들을 종합한 결과: 사용자는 소음에서 벗어나 커피 향과 잔잔한 백색소음을 접할 때 'joyful' 및 'comfortable' 감정이 극대화되는 패턴을 포착함. 의도적인 명상 시간이 핵심 스위치 역할을 한 것으로 추리됨.";
      newSummary = "5개의 미션 기록 속 단서를 추적하여 사용자 본인도 몰랐던 휴식 취향 패턴 발굴";
    } else if (persona === "comic_pd") {
      newTitle = "우당탕탕 2주간의 예능 탐험기 - 커피 도장깨기편";
      newContent = "시작은 거창하게 '소소한 산책'을 선언했으나 10분 만에 카페로 직행! 노스커피 6호점부터 킹스네일커피까지... 예능감 넘치게 디저트와 커피 향을 도장깨기 한 반전 만발의 4컷 예능 에피소드!";
      newSummary = "웃픈 명장면과 의외의 반전 순간들을 유쾌하고 재치 넘치게 각색한 비주얼 스토리";
    }

    // 에세이 내용을 즉시 덮어씌워서 다시 써짐!
    setDraftEssay({
      ...draftEssay,
      persona,
      title: newTitle,
      content: newContent,
      aiSummary: newSummary,
    });

    Alert.alert("에세이 다시 써짐 ✨", `선택하신 [${persona === "emotional" ? "감정 통역사" : persona === "fact_teacher" ? "팩트 폭격 담임" : persona === "detective" ? "기록 탐정" : "인생 예능 PD"}] 톤으로 에세이가 새롭게 작성되었습니다!`);
  };

  // 🚀 에세이 집필 완료
  const handleFinishWritingEssay = () => {
    if (!draftEssay) return;

    Alert.alert(
      "에세이 집필 완료",
      "완료 후에는 더 이상 에세이를 수정할 수 없습니다.\n집필을 완료하고 책장에 꽂으시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "완료하기",
          onPress: () => {
            const newEssay: CompletedEssay = {
              id: `essay-${Date.now()}`,
              title: draftEssay.title,
              content: draftEssay.content,
              journeyGoal: draftEssay.goal,
              dateRangeText: "2026.07.31 ~ 08.13",
              durationDays: 14,
              created_at: new Date().toISOString().slice(0, 10),
              themeIndex: 0,
              persona: draftEssay.persona,
              records: draftEssay.records,
            };

            setEssays((prev) => [newEssay, ...prev]);
            setDraftEssay(null);
            if (journey) {
              setJourney({ ...journey, status: "finished" });
            }
            setPersonaWriterModalVisible(false);

            Alert.alert("집필 완료!", "축하합니다! 완결된 에세이가 서재 책꽂이 맨 앞자리에 들어갔습니다. 📚");
          },
        },
      ]
    );
  };

  // 🚀 에세이 공유하기
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

  // 여정 상태
  const isJourneyActive = journey?.status === "active" || !journey;
  const isPendingEssay = journey?.status === "completed_pending_essay" || draftEssay !== null;
  const isFinished = journey?.status === "finished";

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

        {/* 🌿 상태별 상단 카드 (1.여정 중 / 2.집필 대기 / 3.집필 완결) */}
        {isFinished ? (
          /* 3. 에세이 집필 완료 후 모드 */
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
          /* 2. 여정이 끝나 에세이 집필 대기 상태 */
          <View style={[styles.journeyCard, { backgroundColor: COLORS.woodMain }]}>
            <Text style={styles.journeyLabel}>🎉 여정이 정상적으로 끝났습니다!</Text>
            <Text style={styles.journeyTitle}>에세이 집필하기</Text>
            <Text style={[styles.progressDescription, { marginTop: 4, marginBottom: 14 }]}>
              수집된 기록들을 바탕으로 AI와 함께 나만의 양장본 책을 집필해 보세요.
            </Text>

            <Pressable
              style={styles.startWritingBtn}
              onPress={() => setPersonaWriterModalVisible(true)}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
              <Text style={styles.startWritingBtnText}>집필 시작하기 ✍️</Text>
            </Pressable>
          </View>
        ) : (
          /* 1. 여정 진행 중인 상태 */
          <View style={styles.journeyCard}>
            <View style={styles.journeyTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.journeyLabel}>{journey?.title ?? "1주의 여정"}</Text>
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
        )}

        {/* 🪵 원목 다층 책꽂이 (Multi-Tier Wooden Bookshelf) */}
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

                          {/* 📖 90도 회전 제목 + 날짜 각인 */}
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

      {/* 🌟 ✍️ [에세이 집필하기 편집 모달] - 뒤로가기 터치 영역 보정 */}
      <Modal
        visible={writerModalVisible}
        animationType="slide"
        onRequestClose={() => setPersonaWriterModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F1" }}>
          {draftEssay && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
              
              {/* 상단 뒤로가기 Bar (위치 아래로 보정) */}
              <View style={styles.screenHeaderBar}>
                <Pressable
                  onPress={() => setPersonaWriterModalVisible(false)}
                  hitSlop={20}
                  style={styles.backButtonTouch}
                >
                  <Ionicons name="chevron-back" size={28} color={COLORS.textMain} />
                </Pressable>
                <Text style={styles.screenHeaderTitle}>{draftEssay.journeyTitle}</Text>
                <Pressable
                  hitSlop={15}
                  onPress={() => handleShareEssay({ id: "draft", title: draftEssay.title, content: draftEssay.content, dateRangeText: draftEssay.dateRangeText, durationDays: 14, created_at: "", themeIndex: 0, persona: draftEssay.persona })}
                >
                  <Ionicons name="share-outline" size={24} color={COLORS.textMain} />
                </Pressable>
              </View>

              {/* 대표 커버 이미지 */}
              <View style={styles.editorImageFrame}>
                <Image source={{ uri: draftEssay.coverImage }} style={styles.editorCoverImage} />
              </View>

              <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <View style={styles.personaBadgeTag}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.personaBadgeTagText}>
                      {draftEssay.persona === "emotional" ? "감정 통역사" : draftEssay.persona === "fact_teacher" ? "팩트 폭격 담임" : draftEssay.persona === "detective" ? "기록 탐정" : "인생 예능 PD"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{draftEssay.dateRangeText}</Text>
                </View>

                {/* 🌟 🔄 [다른 AI에게 다시 맡기기] 누르면 > '이번에는 누가 읽어볼까요?' 팝업 모달이 뜸! */}
                <Pressable
                  style={styles.reAiCard}
                  onPress={() => setPersonaPickerVisible(true)}
                >
                  <View>
                    <Text style={styles.reAiTitle}>다른 AI에게 다시 맡기기</Text>
                    <Text style={styles.reAiSub}>이전 결과 대신 새 에세이로 바로 바뀌어요.</Text>
                  </View>
                  <Ionicons name="swap-horizontal" size={22} color={COLORS.primary} />
                </Pressable>

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

                {/* AI가 읽은 이번 여정 */}
                <View style={styles.aiInsightBox}>
                  <Text style={styles.aiInsightTitle}>AI가 읽은 이번 여정</Text>
                  <Text style={styles.aiInsightSub}>{draftEssay.aiSummary}</Text>

                  <View style={styles.insightCardItem}>
                    <Text style={styles.insightCardTitle}>골목 탐험</Text>
                    <Text style={styles.insightCardDesc}>벽화와 아기자기한 가게를 찾아다니며 도시의 소소한 아름다움을 발견함.</Text>
                  </View>

                  <View style={styles.insightCardItem}>
                    <Text style={styles.insightCardTitle}>디지털 디톡스</Text>
                    <Text style={styles.insightCardDesc}>휴대폰 없이 자연 소리에 집중하는 명상을 시도하며 몸과 마음의 휴식을 챙김.</Text>
                  </View>
                </View>

                {/* 📖 [에세이에 담긴 기록] */}
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
                              <Text style={styles.recordItemTitle}>{rec.title}</Text>
                              <Text style={styles.recordItemMeta}>{rec.category} · {rec.recordedAt}</Text>
                              <Text style={styles.recordItemEmotion}>감정: {rec.emotion}</Text>
                              <Text style={styles.recordItemContent}>{rec.content}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 집필 완료 버튼 */}
                <Pressable
                  style={styles.submitWritingBtn}
                  onPress={handleFinishWritingEssay}
                >
                  <Text style={styles.submitWritingBtnText}>집필 완료하고 책장에 꽂기 📚</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* 🎭 🌟 [이번에는 누가 읽어볼까요?] - 스크린샷 5번 100% 동일 팝업 모달 */}
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
              <Pressable style={styles.personaSelectItem} onPress={() => handleSelectPersona("emotional")}>
                <View style={styles.personaIconCircle}><Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaSelectTitle}>감정 통역사</Text>
                  <Text style={styles.personaSelectSub}>기록 속 마음의 움직임을 다정한 언어로 정리해요.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </Pressable>

              <Pressable style={styles.personaSelectItem} onPress={() => handleSelectPersona("fact_teacher")}>
                <View style={styles.personaIconCircle}><Ionicons name="school-outline" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaSelectTitle}>팩트 폭격 담임</Text>
                  <Text style={styles.personaSelectSub}>목표와 실제 행동이 어긋난 부분을 솔직하게 짚어요.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </Pressable>

              <Pressable style={styles.personaSelectItem} onPress={() => handleSelectPersona("detective")}>
                <View style={styles.personaIconCircle}><Ionicons name="finger-print-outline" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaSelectTitle}>기록 탐정</Text>
                  <Text style={styles.personaSelectSub}>기록 속 단서를 연결해 숨은 행동 패턴을 추리해요.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </Pressable>

              <Pressable style={styles.personaSelectItem} onPress={() => handleSelectPersona("comic_pd")}>
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

      {/* 📖 [완성된 에세이 펼쳐보기 모달] */}
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

                {/* 저장 / 공개하기 버튼 (책 덮기 바로 위) */}
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
                    <Text style={styles.publishBtnText}>공개하기</Text>
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

  // 🌿 헤더
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

  // 🌿 진행률 카드
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

  // 🪵 나무 책꽂이
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

  // ✍️ 에세이 집필 모달 헤더 (상단 여백 보정)
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

  // 🎭 페르소나 선택 팝업 모달
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

  // 📖 완결된 에세이 펼침 모달
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

  // [저장] / [공개하기] 버튼 Row
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