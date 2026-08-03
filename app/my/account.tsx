import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  deleteAccount,
  exportMyRecords,
  requestPasswordReset,
  signOut,
  updatePassword,
} from "../../services/auth.service";

const COLORS = {
  primary: "#315C4A",
  textMain: "#26372E",
  textSub: "#65766D",
  textMuted: "#9AA49F",
  border: "#E2E3DC",
  background: "#F5F2E9",
  white: "#FFFFFF",
  danger: "#D9534F",
};

export default function AccountScreen() {
  const [loading, setLoading] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 1. 기록 내보내기
  const handleExport = async () => {
    try {
      setLoading(true);
      await exportMyRecords();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "내보내기 실패";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  };

  // 2-1. 비밀번호 직접 변경
  const handleSavePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert("알림", "새 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("알림", "비밀번호는 최소 6자리 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("알림", "비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    try {
      setLoading(true);
      await updatePassword(newPassword);
      setPwModalVisible(false);
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("완료", "비밀번호가 변경되었습니다.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "비밀번호 변경 실패";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  };

  // 2-2. 비밀번호 재설정 이메일 받기
  const handleSendResetEmail = async () => {
    try {
      setLoading(true);
      await requestPasswordReset();
      Alert.alert("이메일 전송 완료", "비밀번호 재설정 링크가 이메일로 발송되었습니다.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "이메일 전송 실패";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. 로그아웃
  const executeLogout = async () => {
  try {
    setLoading(true);

    await signOut();

    router.replace("/(auth)/login" as any);
  } catch (error) {
    console.error("로그아웃 실패:", error);

    if (Platform.OS === "web") {
      window.alert("로그아웃에 실패했습니다. 다시 시도해 주세요.");
    } else {
      Alert.alert(
        "로그아웃 실패",
        "다시 시도해 주세요.",
      );
    }
  } finally {
    setLoading(false);
  }
};

const handleLogout = () => {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(
      "정말 로그아웃하시겠어요?",
    );

    if (confirmed) {
      void executeLogout();
    }

    return;
  }

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
        onPress: () => {
          void executeLogout();
        },
      },
    ],
  );
};

  // 4. 회원 탈퇴
  const handleDeleteAccount = () => {
    Alert.alert(
      "회원 탈퇴",
      "정말 탈퇴하시겠어요?\n모든 여정과 작성된 기록, 뱃지 데이터가 삭제되며 복구할 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "탈퇴하기",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await deleteAccount();
              Alert.alert("탈퇴 완료", "이용해 주셔서 감사합니다.");
              router.replace("/(auth)/login" as any);
            } catch (error) {
              const msg = error instanceof Error ? error.message : "회원 탈퇴 실패";
              Alert.alert("오류", msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* 상단 헤더 & 뒤로가기 버튼 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>계정 및 개인정보</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 데이터 관리 섹션 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>데이터 관리</Text>
          <Pressable style={styles.row} onPress={handleExport}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowLabel}>기록 데이터 내보내기</Text>
              <Text style={styles.rowSub}>내 소중한 기록들을 백업파일로 추출합니다.</Text>
            </View>
            <Ionicons name="download-outline" size={20} color={COLORS.primary} />
          </Pressable>
        </View>

        {/* 계정 보안 섹션 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>계정 보안</Text>
          <Pressable style={styles.row} onPress={() => setPwModalVisible(true)}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowLabel}>비밀번호 변경</Text>
              <Text style={styles.rowSub}>새로운 비밀번호를 직접 입력해 설정합니다.</Text>
            </View>
            <Ionicons name="key-outline" size={20} color={COLORS.textSub} />
          </Pressable>

          <Pressable style={styles.row} onPress={handleSendResetEmail}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowLabel}>비밀번호 재설정 이메일 받기</Text>
              <Text style={styles.rowSub}>가입한 이메일로 재설정 링크를 발송합니다.</Text>
            </View>
            <Ionicons name="mail-outline" size={20} color={COLORS.textSub} />
          </Pressable>
        </View>

        {/* 계정 관리 섹션 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>계정 관리</Text>
          <Pressable style={styles.row} onPress={handleLogout}>
            <Text style={[styles.rowLabel, { color: COLORS.textMain }]}>로그아웃</Text>
            <Ionicons name="log-out-outline" size={20} color={COLORS.textSub} />
          </Pressable>

          <Pressable style={styles.row} onPress={handleDeleteAccount}>
            <Text style={[styles.rowLabel, { color: COLORS.danger }]}>회원 탈퇴</Text>
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </Pressable>
        </View>
      </ScrollView>

      {/* 비밀번호 변경 모달 */}
      <Modal visible={pwModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>비밀번호 변경</Text>

            <TextInput
              secureTextEntry
              placeholder="새 비밀번호 (6자리 이상)"
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
              placeholderTextColor={COLORS.textMuted}
            />
            <TextInput
              secureTextEntry
              placeholder="새 비밀번호 확인"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setPwModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleSavePassword}>
                <Text style={styles.saveBtnText}>변경하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textMain },
  content: { padding: 20 },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textMuted,
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
  },
  rowTextWrap: { flex: 1, marginRight: 10 },
  rowLabel: { fontSize: 15, fontWeight: "700", color: COLORS.textMain },
  rowSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textMain, marginBottom: 16 },
  input: {
    height: 48,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 14,
    color: COLORS.textMain,
  },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn: { flex: 1, height: 46, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cancelBtn: { backgroundColor: COLORS.background },
  saveBtn: { backgroundColor: COLORS.primary },
  cancelBtnText: { color: COLORS.textSub, fontWeight: "700" },
  saveBtnText: { color: COLORS.white, fontWeight: "800" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
});