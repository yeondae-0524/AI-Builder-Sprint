import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import {
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

  parkWalk:
    "https://images.unsplash.com/photo-1780342745241-c4bb07a0a198?w=400&h=400&fit=crop&auto=format",

  autumnWalk:
    "https://images.unsplash.com/photo-1774356148397-d5dfe91253c2?w=400&h=400&fit=crop&auto=format",

  music:
    "https://images.unsplash.com/photo-1583236753515-7e06aae56395?w=400&h=400&fit=crop&auto=format",

  bookMug:
    "https://images.unsplash.com/photo-1414124488080-0188dcbb8834?w=400&h=400&fit=crop&auto=format",
};

type EssayThickness = "thin" | "medium" | "thick";

type Essay = {
  id: number;
  title: string;
  period: string;
  year: string;
  thickness: EssayThickness;
  color: string;
  photo: string;
  coverPhoto: string;
};

type EssayEntry = {
  id: number;
  photo: string;
  mission: string;
  userText: string;
  aiText: string;
};

const ESSAYS: Essay[] = [
  {
    id: 1,
    title: "연남동에서 보낸 7일",
    period: "6. 15 – 6. 22",
    year: "2026",
    thickness: "thin",
    color: "#1E3A5F",
    photo: PHOTOS.latte,
    coverPhoto: PHOTOS.cafeWindow,
  },
  {
    id: 2,
    title: "소리를 따라 걸은 2주",
    period: "5. 1 – 5. 14",
    year: "2026",
    thickness: "medium",
    color: "#2D5A4A",
    photo: PHOTOS.parkWalk,
    coverPhoto: PHOTOS.bench,
  },
  {
    id: 3,
    title: "혼자였지만 혼자가 아닌",
    period: "3. 1 – 3. 31",
    year: "2026",
    thickness: "thick",
    color: "#5C3D2E",
    photo: PHOTOS.autumnWalk,
    coverPhoto: PHOTOS.street,
  },
  {
    id: 4,
    title: "빛의 기록",
    period: "1. 10 – 1. 17",
    year: "2026",
    thickness: "thin",
    color: "#3B4A6B",
    photo: PHOTOS.nightLamp,
    coverPhoto: PHOTOS.nightLamp,
  },
];

const SPINE_WIDTH: Record<EssayThickness, number> = {
  thin: 24,
  medium: 40,
  thick: 60,
};

const SPINE_HEIGHT = 172;

function getEssayEntries(essay: Essay): EssayEntry[] {
  return [
    {
      id: 1,
      photo: PHOTOS.bookMug,
      mission: "조용한 카페에서 30분 독서",
      userText:
        "카페 창가 자리가 비어 있었다. 30분 동안 읽기만 했는데 이상하게 마음이 가벼워졌다.",
      aiText: "그 가벼움이 어디에서 왔는지 궁금해집니다.",
    },
    {
      id: 2,
      photo: essay.photo,
      mission: "공원 산책하며 계절 사진 찍기",
      userText:
        "낙엽이 예쁘다고 느낀 건 아마 처음인 것 같다. 바스락거리는 소리가 좋았다.",
      aiText:
        "계절을 그냥 지나치지 않고 멈춰 들여다본 하루였군요.",
    },
    {
      id: 3,
      photo: PHOTOS.music,
      mission: "버스킹 공연 감상하기",
      userText:
        "모르는 노래였는데도 계속 발이 떨어지지 않았다. 그 사람의 목소리가 마음에 걸렸다.",
      aiText:
        "낯선 음악이 왜 그렇게 익숙하게 느껴졌을까요.",
    },
  ];
}

export default function EssayScreen() {
  const [selectedEssay, setSelectedEssay] =
    useState<Essay | null>(null);

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

  if (selectedEssay) {
    const entries = getEssayEntries(selectedEssay);

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

              {entries.map((entry) => (
                <View
                  key={entry.id}
                  style={styles.entryContainer}
                >
                  <Image
                    source={{ uri: entry.photo }}
                    style={styles.entryImage}
                  />

                  <Text style={styles.entryMission}>
                    {entry.mission}
                  </Text>

                  <Text style={styles.entryUserText}>
                    {entry.userText}
                  </Text>

                  <View style={styles.aiTextBox}>
                    <Text style={styles.aiText}>
                      {entry.aiText}
                    </Text>
                  </View>
                </View>
              ))}

              <View style={styles.detailBottomSpace} />
            </View>
          </ScrollView>

          <View style={styles.actionBar}>
            <Pressable
              onPress={() => setSelectedEssay(null)}
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

        {/* 책장 */}
        <View style={styles.bookshelfContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bookRow}
          >
            {/* 진행 중인 책 */}
            <View style={styles.progressBook}>
              <View style={styles.rotatedLabelWrapper}>
                <Text style={styles.progressBookText}>
                  진행 중
                </Text>
              </View>
            </View>

            {/* 완성된 책 */}
            {ESSAYS.map((essay, index) => {
              const bookHeight =
                SPINE_HEIGHT -
                (index === 0 ? 0 : index * 4);

              return (
                <Pressable
                  key={essay.id}
                  onPress={() =>
                    setSelectedEssay(essay)
                  }
                  style={({ pressed }) => [
                    styles.bookSpine,
                    {
                      width:
                        SPINE_WIDTH[
                          essay.thickness
                        ],
                      height: bookHeight,
                      backgroundColor: essay.color,
                    },
                    pressed && styles.bookPressed,
                  ]}
                >
                  <View
                    style={styles.rotatedLabelWrapper}
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

                    {essay.thickness !== "thin" && (
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

            {/* 비어 있는 책 자리 */}
            {[20, 26, 22].map((width, index) => (
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
            ))}

            <View style={styles.bookRowEndSpace} />
          </ScrollView>

          <View style={styles.shelf} />
          <View style={styles.wall} />
        </View>

        {/* 진행 중인 에세이 */}
        <View style={styles.body}>
          <View style={styles.progressCard}>
            <View style={styles.progressCardTop}>
              <View style={styles.progressTag}>
                <Text style={styles.progressTagText}>
                  진행 중
                </Text>
              </View>

              <Text style={styles.journeyText}>
                14일의 여정
              </Text>
            </View>

            <Text style={styles.progressEssayTitle}>
              나의 7월 기록들
            </Text>

            <Text style={styles.progressEssayPeriod}>
              2026. 7. 16 – 7. 29
            </Text>

            <View style={styles.progressInfoRow}>
              <Text style={styles.progressInfoText}>
                4개의 경험이 담겼어요
              </Text>

              <Text style={styles.progressCount}>
                4/7
              </Text>
            </View>

            <View style={styles.progressBarBackground}>
              <View style={styles.progressBarFill} />
            </View>

            <View style={styles.remainingNotice}>
              <Text style={styles.remainingText}>
                완성까지{" "}
                <Text style={styles.remainingStrong}>
                  3개의 경험
                </Text>
                이 더 필요해요
              </Text>
            </View>

            <Pressable
              disabled
              style={styles.disabledCreateButton}
            >
              <Text
                style={styles.disabledCreateButtonText}
              >
                에세이 만들기 (3개 남음)
              </Text>
            </Pressable>
          </View>

          {/* 완성된 에세이 목록 */}
          <Text style={styles.completedSectionTitle}>
            완성된 에세이 ({ESSAYS.length})
          </Text>

          {ESSAYS.map((essay) => (
            <Pressable
              key={essay.id}
              onPress={() => setSelectedEssay(essay)}
              style={({ pressed }) => [
                styles.essayListCard,
                pressed && styles.cardPressed,
              ]}
            >
              <View
                style={[
                  styles.essayAccent,
                  {
                    backgroundColor: essay.color,
                  },
                ]}
              />

              <Image
                source={{ uri: essay.photo }}
                style={styles.essayThumbnail}
              />

              <View style={styles.essayListText}>
                <Text
                  numberOfLines={1}
                  style={styles.essayListTitle}
                >
                  {essay.title}
                </Text>

                <Text style={styles.essayListPeriod}>
                  {essay.year}년 {essay.period}
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
});