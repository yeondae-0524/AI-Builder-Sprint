import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
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

const COLORS = {
  primary: "#3D5AFE",
  primaryPressed: "#3048D9",
  textMain: "#171719",
  textSub: "#76767F",
  border: "#E4E4E7",
  background: "#F7F8FA",
  white: "#FFFFFF",
  error: "#EF4444",
};

export default function SignupScreen() {
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const handleSignUp = async () => {
    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedNickname) {
      Alert.alert(
        "닉네임 확인",
        "닉네임을 입력해 주세요.",
      );
      return;
    }

    if (!trimmedEmail) {
      Alert.alert(
        "이메일 확인",
        "이메일을 입력해 주세요.",
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "비밀번호 확인",
        "비밀번호는 6자 이상 입력해 주세요.",
      );
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert(
        "비밀번호 확인",
        "입력한 비밀번호가 서로 다릅니다.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              nickname: trimmedNickname,
            },
          },
        });

      if (error) {
        throw error;
      }

      // 이 기기에서 회원가입을 완료했다는 정보 저장
      localStorage.setItem("hasAccount", "true");

      /*
       * Supabase 설정에 따라 회원가입과 동시에
       * 로그인 세션이 만들어질 수 있으므로,
       * 로그인 화면을 반드시 거치게 하려면 로그아웃 처리
       */
      if (data.session) {
        await supabase.auth.signOut();
      }

      Alert.alert(
        "회원가입 완료",
        "가입이 완료되었습니다. 이제 로그인해 주세요.",
        [
          {
            text: "확인",
            onPress: () => {
              router.replace("/login");
            },
          },
        ],
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "회원가입 중 오류가 발생했습니다.";

      Alert.alert("회원가입 실패", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Ionicons
                name="sparkles"
                size={28}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.appName}>
              시작이 반
            </Text>
          </View>

          <View style={styles.titleArea}>
            <Text style={styles.title}>
              새로운 여정을 시작해요
            </Text>

            <Text style={styles.subtitle}>
              작은 경험을 기록하고 나만의 이야기를
              만들어보세요.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>
              닉네임
            </Text>

            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="사용할 닉네임을 입력해 주세요"
              placeholderTextColor="#A0A0A6"
              maxLength={20}
              style={styles.input}
            />

            <Text style={styles.label}>
              이메일
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor="#A0A0A6"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              style={styles.input}
            />

            <Text style={styles.label}>
              비밀번호
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="6자 이상 입력해 주세요"
                placeholderTextColor="#A0A0A6"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                style={styles.passwordInput}
              />

              <Pressable
                onPress={() =>
                  setShowPassword(
                    (previous) => !previous,
                  )
                }
                style={styles.eyeButton}
              >
                <Ionicons
                  name={
                    showPassword
                      ? "eye-outline"
                      : "eye-off-outline"
                  }
                  size={20}
                  color={COLORS.textSub}
                />
              </Pressable>
            </View>

            <Text style={styles.label}>
              비밀번호 확인
            </Text>

            <TextInput
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholder="비밀번호를 한 번 더 입력해 주세요"
              placeholderTextColor="#A0A0A6"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="newPassword"
              style={styles.input}
            />

            <Pressable
              disabled={isLoading}
              onPress={handleSignUp}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isLoading && styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading
                  ? "가입 중..."
                  : "회원가입"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginGuide}>
              이미 계정이 있나요?
            </Text>

            <Pressable
              onPress={() => router.push("/login")}
            >
              <Text style={styles.loginLink}>
                로그인
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 36,
  },

  logoArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 42,
  },

  logoCircle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF1FF",
    borderRadius: 16,
  },

  appName: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  titleArea: {
    marginBottom: 32,
  },

  title: {
    marginBottom: 10,
    fontSize: 27,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSub,
  },

  form: {
    gap: 10,
  },

  label: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMain,
  },

  input: {
    height: 54,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    fontSize: 15,
    color: COLORS.textMain,
  },

  passwordContainer: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
  },

  passwordInput: {
    flex: 1,
    height: "100%",
    paddingLeft: 16,
    fontSize: 15,
    color: COLORS.textMain,
  },

  eyeButton: {
    width: 50,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButton: {
    height: 54,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
  },

  primaryButtonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },

  disabledButton: {
    opacity: 0.55,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },

  loginGuide: {
    fontSize: 14,
    color: COLORS.textSub,
  },

  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
});