import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

const COLORS = {
  primary: "#315C4A",
  primaryPressed: "#3048D9",
  textMain: "#26372E",
  textSub: "#76767F",
  border: "#E2E3DC",
  background: "#F5F2E9",
  white: "#FFFFFF",
};

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      Alert.alert(
        "입력 확인",
        "이메일과 비밀번호를 모두 입력해 주세요.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

      if (error) {
        throw error;
      }

      localStorage.setItem("hasAccount", "true");

      /*
       * 로그인 성공 시 app/_layout.tsx의
       * onAuthStateChange가 세션을 감지하여
       * 자동으로 메인 탭 화면을 표시함
       */
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "로그인 중 오류가 발생했습니다.";

      Alert.alert("로그인 실패", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={COLORS.textMain}
          />
        </Pressable>

        <View style={styles.content}>
          <View style={styles.logoArea}>
             <Text style={styles.appName}>
                BEGIN AGAIN 
             </Text>
            </View>

          <Text style={styles.title}>
            다시 만나서 반가워요
          </Text>

          <Text style={styles.subtitle}>
            로그인하고 나의 여정을 이어가세요.
          </Text>

          <View style={styles.form}>
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
                placeholder="비밀번호를 입력해 주세요"
                placeholderTextColor="#A0A0A6"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="password"
                onSubmitEditing={handleLogin}
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

            <Pressable
              disabled={isLoading}
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isLoading && styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading
                  ? "로그인 중..."
                  : "로그인"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupGuide}>
              아직 계정이 없나요?
            </Text>

            <Pressable
              onPress={() =>
                router.push("/signup")
              }
            >
              <Text style={styles.signupLink}>
                회원가입
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
  },

  backButton: {
    width: 44,
    height: 44,
    marginTop: 8,
    marginLeft: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 42,
  },

  logoArea: {
  marginBottom: 28,
},

appName: {
  fontSize: 30,
  fontWeight: "700",
  letterSpacing: 2,
  textTransform: "uppercase",
  color: COLORS.primary,
},

  title: {
    marginBottom: 10,
    fontSize: 27,
    fontWeight: "800",
    color: COLORS.textMain,
  },

  subtitle: {
    marginBottom: 38,
    fontSize: 14,
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
    marginTop: 20,
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

  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },

  signupGuide: {
    fontSize: 14,
    color: COLORS.textSub,
  },

  signupLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
});