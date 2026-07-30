import { useState } from "react";
import {
    Alert,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { updateMyProfile } from "../services/profile.service";
import { usePreferencesRecheck } from "./_layout";

const COLORS = {
  primary: "#3D5AFE",
  primaryLight: "#EEF1FF",
  textMain: "#171719",
  textSub: "#76767F",
  border: "#E4E4E7",
  background: "#F7F8FA",
  white: "#FFFFFF",
};

const CATEGORIES = ["음식", "카페 및 디저트", "산책", "배움", "감상", "활동", "휴식", "기타"];

export default function PreferencesScreen() {
  const { recheckPreferences } = usePreferencesRecheck();
  const [selected, setSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = (category: string) => {
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      Alert.alert("취향 선택", "최소 1개 이상 선택해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      await updateMyProfile({ interests: selected });
      console.log("① 저장 성공");
      await recheckPreferences();
      console.log("② recheck 완료");
    } catch (error) {
      const message = error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.";
      console.log("❌ 에러:", message);
      Alert.alert("저장 실패", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>어떤 경험을 좋아하세요?</Text>
        <Text style={styles.subtitle}>최소 1개 이상 골라주세요. 나중에 언제든 바꿀 수 있어요.</Text>

        <View style={styles.chipWrap}>
          {CATEGORIES.map((category) => {
            const isSelected = selected.includes(category);
            return (
              <Pressable
                key={category}
                onPress={() => toggle(category)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={isLoading || selected.length === 0}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            (isLoading || selected.length === 0) && styles.disabledButton,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading ? "저장 중..." : `${selected.length > 0 ? `${selected.length}개 ` : ""}선택 완료`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.textMain, marginBottom: 10 },
  subtitle: { fontSize: 14, color: COLORS.textSub, marginBottom: 32, lineHeight: 20 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipSelected: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText: { fontSize: 14, color: COLORS.textMain, fontWeight: "500" },
  chipTextSelected: { color: COLORS.primary, fontWeight: "700" },
  primaryButton: {
    height: 54,
    marginTop: "auto",
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
  },
  primaryButtonPressed: { backgroundColor: "#3048D9" },
  disabledButton: { opacity: 0.4 },
  primaryButtonText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
});