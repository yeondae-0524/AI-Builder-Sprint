import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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
  background: "#F7F8FA",
  white: "#FFFFFF",
  border: "#E4E6EA",
  textMain: "#171719",
  textSub: "#6B7280",
  danger: "#EF4444",
};

export default function AccountScreen() {
  const [email, setEmail] = useState("");
  const [joinedDate, setJoinedDate] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setEmail(user.email ?? "");

    const date = new Date(user.created_at);
    setJoinedDate(
      `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} />
        </Pressable>

        <Text style={styles.title}>계정 및 개인정보</Text>

        <View style={{ width: 24 }} />
      </View>

      <ScrollView>

        <View style={styles.card}>
          <Text style={styles.section}>계정</Text>

          <Item label="이메일" value={email} />

          <Item label="가입일" value={joinedDate} />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>데이터</Text>

          <Pressable
            style={styles.menu}
            onPress={() =>
              Alert.alert("준비 중", "기록 내보내기 기능을 다음 단계에서 만들 예정입니다.")
            }
          >
            <Text style={styles.menuText}>기록 내보내기</Text>
            <Ionicons name="chevron-forward" size={20} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>보안</Text>

          <Pressable
            style={styles.menu}
            onPress={() =>
              Alert.alert("준비 중", "비밀번호 변경 기능을 추가할 예정입니다.")
            }
          >
            <Text style={styles.menuText}>비밀번호 변경</Text>
            <Ionicons name="chevron-forward" size={20} />
          </Pressable>

          <Pressable
            style={styles.menu}
            onPress={async () => {
              await supabase.auth.signOut();
            }}
          >
            <Text style={styles.menuText}>로그아웃</Text>
            <Ionicons name="log-out-outline" size={20} />
          </Pressable>

          <Pressable
            style={styles.menu}
            onPress={() =>
              Alert.alert("회원 탈퇴", "다음 단계에서 구현할 예정입니다.")
            }
          >
            <Text style={[styles.menuText, { color: COLORS.danger }]}>
              회원 탈퇴
            </Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },

  title: {
    fontSize: 17,
    fontWeight: "700",
  },

  card: {
    backgroundColor: COLORS.white,
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  section: {
    fontWeight: "700",
    marginBottom: 16,
    fontSize: 15,
  },

  row: {
    marginBottom: 14,
  },

  label: {
    color: COLORS.textSub,
    fontSize: 12,
  },

  value: {
    marginTop: 4,
    fontSize: 16,
    color: COLORS.textMain,
  },

  menu: {
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  menuText: {
    fontSize: 15,
    color: COLORS.textMain,
  },
});