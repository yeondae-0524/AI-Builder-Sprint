import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from "react-native";

import { MissionProvider } from "../../contexts/mission-context";
import { supabase } from "../../lib/supabase";

const ACTIVE_COLOR = "#171719";
const INACTIVE_COLOR = "#A0A0A6";
const PRIMARY_COLOR = "#3D5AFE";
const BACKGROUND_COLOR = "#F7F8FA";

type JourneyState = "checking" | "active" | "missing";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function TabLayout() {
  const router = useRouter();

  const [journeyState, setJourneyState] =
    useState<JourneyState>("checking");

  const alertVisibleRef = useRef(false);
  const initialRedirectHandledRef = useRef(false);
  const homeCheckInProgressRef = useRef(false);

  const checkActiveJourney = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return false;
    }

    const todayKey = toDateKey(new Date());

    const { data, error } = await supabase
      .from("journeys")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .lte("start_date", todayKey)
      .gte("end_date", todayKey)
      .order("start_date", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data !== null;
  }, []);

  const showJourneyRequiredAlert =
    useCallback(() => {
      if (alertVisibleRef.current) {
        return;
      }

      alertVisibleRef.current = true;

      Alert.alert(
        "여정 기간을 먼저 선택해주세요",
        "홈에서 미션을 시작하려면 캘린더에서 1주, 2주, 한 달 중 여정 기간을 먼저 선택해야 해요.",
        [
          {
            text: "캘린더에서 선택하기",
            onPress: () => {
              alertVisibleRef.current = false;
              router.replace("/calendar");
            },
          },
        ],
        {
          cancelable: false,
        },
      );
    }, [router]);

  useEffect(() => {
    let isMounted = true;

    const loadJourneyState = async () => {
      try {
        const hasActiveJourney =
          await checkActiveJourney();

        if (!isMounted) {
          return;
        }

        setJourneyState(
          hasActiveJourney ? "active" : "missing",
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error(
          "진행 중인 여정 확인 실패:",
          error instanceof Error
            ? error.message
            : error,
        );

        // 여정 확인에 실패한 경우에도 홈을 바로 열지 않고
        // 캘린더에서 다시 확인할 수 있도록 처리합니다.
        setJourneyState("missing");
      }
    };

    void loadJourneyState();

    return () => {
      isMounted = false;
    };
  }, [checkActiveJourney]);

  useEffect(() => {
    if (
      journeyState !== "missing" ||
      initialRedirectHandledRef.current
    ) {
      return;
    }

    initialRedirectHandledRef.current = true;

    const timer = setTimeout(() => {
      router.replace("/calendar");
      showJourneyRequiredAlert();
    }, 100);

    return () => clearTimeout(timer);
  }, [
    journeyState,
    router,
    showJourneyRequiredAlert,
  ]);

  const handleHomeTabPress = useCallback(async () => {
    if (homeCheckInProgressRef.current) {
      return;
    }

    homeCheckInProgressRef.current = true;

    try {
      const hasActiveJourney =
        await checkActiveJourney();

      if (hasActiveJourney) {
        setJourneyState("active");
        router.navigate("/");
        return;
      }

      setJourneyState("missing");
      router.replace("/calendar");
      showJourneyRequiredAlert();
    } catch (error) {
      console.error(
        "홈 이동 전 여정 확인 실패:",
        error instanceof Error
          ? error.message
          : error,
      );

      Alert.alert(
        "여정 확인 실패",
        "진행 중인 여정을 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      homeCheckInProgressRef.current = false;
    }
  }, [
    checkActiveJourney,
    router,
    showJourneyRequiredAlert,
  ]);

  if (journeyState === "checking") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={PRIMARY_COLOR}
        />
      </View>
    );
  }

  return (
    <MissionProvider>
      <Tabs
        initialRouteName={
          journeyState === "active"
            ? "index"
            : "calendar"
        }
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
            marginTop: 1,
          },
          tabBarItemStyle: {
            borderRadius: 24,
          },
          tabBarStyle: {
            position: "absolute",
            left: 24,
            right: 24,
            bottom: 14,
            height: 62,
            paddingTop: 6,
            paddingBottom: 6,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: "rgba(0, 0, 0, 0.04)",
            borderRadius: 31,
            shadowColor: "#000000",
            shadowOffset: {
              width: 0,
              height: 3,
            },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 7,
          },
        }}
      >
        <Tabs.Screen
          name="calendar"
          options={{
            title: "캘린더",
            tabBarIcon: ({
              color,
              size,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? "calendar"
                    : "calendar-outline"
                }
                color={color}
                size={size}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="discover"
          options={{
            title: "발견",
            tabBarIcon: ({
              color,
              size,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? "compass"
                    : "compass-outline"
                }
                color={color}
                size={size}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="index"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              void handleHomeTabPress();
            },
          }}
          options={{
            title: "홈",
            tabBarIcon: ({
              color,
              size,
              focused,
            }) => (
              <Ionicons
                name={
                  focused ? "home" : "home-outline"
                }
                color={color}
                size={size}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="essay"
          options={{
            title: "에세이",
            tabBarIcon: ({
              color,
              size,
              focused,
            }) => (
              <Ionicons
                name={
                  focused ? "book" : "book-outline"
                }
                color={color}
                size={size}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="my"
          options={{
            title: "MY",
            tabBarIcon: ({
              color,
              size,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? "person"
                    : "person-outline"
                }
                color={color}
                size={size}
              />
            ),
          }}
        />
      </Tabs>
    </MissionProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND_COLOR,
  },
});