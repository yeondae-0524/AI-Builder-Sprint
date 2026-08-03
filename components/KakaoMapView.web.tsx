import { useEffect, useMemo, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type MapMarker = {
  id: string | number;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;

  photo?: string;
  imageUrl?: string;
  count?: number;

  category?: string;
  title?: string;
  description?: string;
  instructions?: string;
  recommendationReason?: string;
  placeName?: string;
  locationFlexible?: boolean;
  time?: string;
  cost?: string;
  preparation?: string;

  actionLabel?: string;
  actionVariant?: "primary" | "pink" | "green";
  actionDisabled?: boolean;
};

type KakaoMapViewProps = {
  latitude?: number;
  longitude?: number;
  markers?: MapMarker[];

  selectedMarkerId?: string | number | null;

  onMarkerPress?: (id: string | number) => void;
  onMarkerClose?: () => void;
  onMarkerAction?: (id: string | number) => void;

  style?: any;

  // 네이티브와 타입을 맞추기 위한 선택 속성
  userLocation?: {
    lat: number;
    lng: number;
  } | null;
  focusOffsetY?: number;
};

type KakaoMapMessage = {
  source?: string;
  payload?: {
    type?: string;
    id?: string | number;
  };
};

const KAKAO_JS_KEY =
  process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY ?? "";

export function KakaoMapView({
  latitude = 35.1796,
  longitude = 129.0756,
  markers = [],
  selectedMarkerId = null,
  onMarkerPress,
  onMarkerClose,
  onMarkerAction,
  style,
}: KakaoMapViewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  type NormalizedMarker = {
  id: string | number;
  lat: number;
  lng: number;
  photo: string | undefined;
  count: number | undefined;
};


const normalizedMarkers = useMemo<NormalizedMarker[]>(
  () =>
    markers.flatMap((marker) => {
      const lat =
        marker.lat ?? marker.latitude;

      const lng =
        marker.lng ?? marker.longitude;

      if (
        typeof lat !== "number" ||
        typeof lng !== "number"
      ) {
        return [];
      }

      return [
        {
          id: marker.id,
          lat,
          lng,
          photo:
            marker.photo ?? marker.imageUrl,
          count: marker.count,
        },
      ];
    }),
  [markers],
);

const selectedMarker = useMemo(() => {
  if (selectedMarkerId === null) {
    return null;
  }

  return (
    markers.find(
      (marker) =>
        String(marker.id) ===
        String(selectedMarkerId),
    ) ?? null
  );
}, [markers, selectedMarkerId]);

  const html = useMemo(
    () => `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1"
  />
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    body {
      background: #dfe8f0;
    }

    #status {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 100;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.95);
      font-family: sans-serif;
      font-size: 12px;
      color: #444;
    }
  </style>
</head>
<body>
  <div id="status">지도를 불러오는 중입니다.</div>
  <div id="map"></div>

  <script
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"
  ></script>

  <script>
    const statusElement = document.getElementById("status");

    function sendMessage(payload) {
      window.parent.postMessage(
        {
          source: "begin-again-kakao-map",
          payload
        },
        "*"
      );
    }

    if (!window.kakao) {
      statusElement.textContent =
        "카카오 지도 SDK를 불러오지 못했습니다.";
    } else {
      kakao.maps.load(function () {
        const center = new kakao.maps.LatLng(
          ${latitude},
          ${longitude}
        );

        const map = new kakao.maps.Map(
          document.getElementById("map"),
          {
            center,
            level: 5
          }
        );

        const markers = ${JSON.stringify(normalizedMarkers)};

        markers.forEach(function (marker) {
          const position = new kakao.maps.LatLng(
            marker.lat,
            marker.lng
          );

          const element = document.createElement("button");

          element.type = "button";
          element.style.width = "44px";
          element.style.height = "44px";
          element.style.padding = "0";
          element.style.border = "3px solid white";
          element.style.borderRadius = "50%";
          element.style.backgroundColor = "#7686ff";
          element.style.backgroundSize = "cover";
          element.style.backgroundPosition = "center";
          element.style.boxShadow =
            "0 2px 8px rgba(0, 0, 0, 0.25)";
          element.style.cursor = "pointer";

          if (marker.photo) {
            element.style.backgroundImage =
              "url('" + marker.photo + "')";
          }

          element.addEventListener("click", function () {
            sendMessage({
              type: "markerPress",
              id: marker.id
            });
          });

          new kakao.maps.CustomOverlay({
            map,
            position,
            content: element,
            xAnchor: 0.5,
            yAnchor: 0.5
          });
        });

        statusElement.style.display = "none";
      });
    }
  </script>
</body>
</html>
`,
    [latitude, longitude, normalizedMarkers],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent<KakaoMapMessage>) => {
      if (event.data?.source !== "begin-again-kakao-map") {
        return;
      }

      if (
        event.data.payload?.type === "markerPress" &&
        event.data.payload.id !== undefined
      ) {
        onMarkerPress?.(event.data.payload.id);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onMarkerPress]);

  if (!KAKAO_JS_KEY) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>
          카카오 JavaScript 키가 설정되지 않았습니다.
        </Text>
      </View>
    );
  }

  return (
  <View style={[styles.container, style]}>
    <iframe
      ref={iframeRef}
      title="Begin Again Kakao Map"
      srcDoc={html}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        minHeight: 320,
        border: 0,
        display: "block",
        zIndex: 0,
      }}
      allow="geolocation"
    />

    {selectedMarker ? (
      <View
        pointerEvents="box-none"
        style={styles.popupLayer}
      >
        <View style={styles.missionPopup}>
          <View style={styles.popupHeader}>
            <View style={styles.popupCategoryBadge}>
              <Text style={styles.popupCategoryText}>
                {selectedMarker.category ?? "추천 미션"}
              </Text>
            </View>

            <Pressable
              onPress={() => onMarkerClose?.()}
              hitSlop={10}
              style={({ pressed }) => [
                styles.popupCloseButton,
                pressed && styles.popupPressed,
              ]}
            >
              <Text style={styles.popupCloseText}>
                ×
              </Text>
            </Pressable>
          </View>

          <Text style={styles.popupTitle}>
            {selectedMarker.title ?? "미션"}
          </Text>

          {selectedMarker.description ? (
            <Text style={styles.popupDescription}>
              {selectedMarker.description}
            </Text>
          ) : null}

          {selectedMarker.placeName ? (
            <Text style={styles.popupPlace}>
              📍 {selectedMarker.placeName}
            </Text>
          ) : selectedMarker.locationFlexible ? (
            <Text style={styles.popupPlace}>
              📍 원하는 장소에서 수행 가능
            </Text>
          ) : null}

          <View style={styles.popupMetrics}>
            <View style={styles.popupMetric}>
              <Text style={styles.popupMetricLabel}>
                예상 시간
              </Text>
              <Text style={styles.popupMetricValue}>
                {selectedMarker.time ?? "자유"}
              </Text>
            </View>

            <View style={styles.popupMetric}>
              <Text style={styles.popupMetricLabel}>
                준비물
              </Text>
              <Text
                numberOfLines={2}
                style={styles.popupMetricValue}
              >
                {selectedMarker.preparation ?? "없음"}
              </Text>
            </View>

            <View style={styles.popupMetric}>
              <Text style={styles.popupMetricLabel}>
                비용
              </Text>
              <Text style={styles.popupMetricValue}>
                {selectedMarker.cost ?? "무료"}
              </Text>
            </View>
          </View>

          {selectedMarker.recommendationReason ? (
            <View style={styles.popupReason}>
              <Text style={styles.popupReasonLabel}>
                추천 이유
              </Text>

              <Text style={styles.popupReasonText}>
                {selectedMarker.recommendationReason}
              </Text>
            </View>
          ) : null}

          <Pressable
            disabled={selectedMarker.actionDisabled}
            onPress={() =>
              onMarkerAction?.(selectedMarker.id)
            }
            style={({ pressed }) => [
              styles.popupActionButton,

              selectedMarker.actionVariant === "pink" &&
                styles.popupActionPink,

              selectedMarker.actionVariant === "green" &&
                styles.popupActionGreen,

              selectedMarker.actionDisabled &&
                styles.popupActionDisabled,

              pressed &&
                !selectedMarker.actionDisabled &&
                styles.popupPressed,
            ]}
          >
            <Text style={styles.popupActionText}>
              {selectedMarker.actionLabel ??
                "미션 시작하기"}
            </Text>
          </Pressable>
        </View>
      </View>
    ) : null}
  </View>
);
}

const styles = StyleSheet.create({
  popupLayer: {
  ...StyleSheet.absoluteFillObject,
  zIndex: 50,
  alignItems: "center",
},

missionPopup: {
  position: "absolute",
  top: 68,
  width: "92%",
  maxWidth: 360,
  padding: 16,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "rgba(49, 92, 74, 0.18)",
  borderRadius: 20,

  shadowColor: "#000000",
  shadowOffset: {
    width: 0,
    height: 10,
  },
  shadowOpacity: 0.22,
  shadowRadius: 18,
  elevation: 20,
},

popupHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

popupCategoryBadge: {
  paddingHorizontal: 9,
  paddingVertical: 5,
  backgroundColor: "#E5EEE8",
  borderRadius: 8,
},

popupCategoryText: {
  color: "#315C4A",
  fontSize: 11,
  fontWeight: "800",
},

popupCloseButton: {
  width: 30,
  height: 30,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#F1F2EE",
  borderRadius: 15,
},

popupCloseText: {
  color: "#65766D",
  fontSize: 20,
  lineHeight: 22,
  fontWeight: "600",
},

popupTitle: {
  marginTop: 10,
  color: "#26372E",
  fontSize: 18,
  lineHeight: 24,
  fontWeight: "900",
},

popupDescription: {
  marginTop: 7,
  color: "#65766D",
  fontSize: 12,
  lineHeight: 18,
},

popupPlace: {
  marginTop: 8,
  color: "#65766D",
  fontSize: 11,
  lineHeight: 16,
},

popupMetrics: {
  marginTop: 11,
  flexDirection: "row",
  gap: 7,
},

popupMetric: {
  flex: 1,
  minWidth: 0,
  padding: 9,
  backgroundColor: "#F7F7F3",
  borderRadius: 10,
},

popupMetricLabel: {
  color: "#9AA49F",
  fontSize: 9,
},

popupMetricValue: {
  marginTop: 3,
  color: "#26372E",
  fontSize: 10,
  lineHeight: 14,
  fontWeight: "800",
},

popupReason: {
  marginTop: 10,
  padding: 10,
  backgroundColor: "#F4F6F4",
  borderRadius: 10,
},

popupReasonLabel: {
  color: "#315C4A",
  fontSize: 10,
  fontWeight: "900",
},

popupReasonText: {
  marginTop: 3,
  color: "#65766D",
  fontSize: 10,
  lineHeight: 16,
},

popupActionButton: {
  minHeight: 44,
  marginTop: 12,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#315C4A",
  borderRadius: 12,
},

popupActionPink: {
  backgroundColor: "#E07A5F",
},

popupActionGreen: {
  backgroundColor: "#10B981",
},

popupActionDisabled: {
  opacity: 0.55,
},

popupActionText: {
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: "900",
},

popupPressed: {
  opacity: 0.78,
},

  container: {
    position: "relative",
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#dfe8f0",
  },
  fallback: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dfe8f0",
  },
  fallbackText: {
    color: "#555",
    fontSize: 14,
  },
});