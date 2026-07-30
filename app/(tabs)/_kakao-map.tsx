import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

const KAKAO_JS_KEY = "f937d15a94db64ab114b3495f8b6ad3c";

type MapMarker = {
  id: string | number;
  lat: number;
  lng: number;
  photo?: string;
  count?: number;
  label?: string;
  category?: string;
};

type UserLocation = { lat: number; lng: number } | null;

type Props = {
  latitude: number;
  longitude: number;
  markers?: MapMarker[];
  userLocation?: UserLocation;
  onMarkerPress?: (id: string | number) => void;
  style?: any;
};

export function KakaoMapView({
  latitude,
  longitude,
  markers = [],
  userLocation,
  onMarkerPress,
  style,
}: Props) {
  const html = useMemo(
    () => `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          html, body { width: 100%; height: 100%; margin: 0; }
          #map {
            width: 100%;
            height: 100%;
            filter: grayscale(40%) saturate(0.7) brightness(1.08) contrast(0.95);
          }
          #error { position: fixed; top: 10px; left: 10px; z-index: 10; padding: 10px; background: white; color: red; font-size: 12px; }
        </style>
      </head>
      <body>
        <div id="error">카카오 지도 불러오는 중...</div>
        <div id="map"></div>
        <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"></script>
        <script>
          const errorElement = document.getElementById('error');

          const CATEGORY_STYLES = {
            "음식": {
              color: "#F97316",
              svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M9 12v9"/><path d="M17 3c-1.7 0-3 2-3 5s1.3 5 3 5 3-2 3-5-1.3-5-3-5z"/><path d="M17 13v8"/></svg>'
            },
            "카페 및 디저트": {
              color: "#8B5E3C",
              svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2"/><path d="M6 3c-.5 1 -.5 1.5 0 2.5"/><path d="M10 3c-.5 1 -.5 1.5 0 2.5"/></svg>'
            },
            "산책": {
              color: "#22C55E",
              svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1.6" fill="white" stroke="none"/><path d="M11 8l-2 3 2 2 -1 6"/><path d="M11 8l3 1 2 4"/><path d="M9 13l-3 2"/><path d="M13 11l2 5"/></svg>'
            },
            "배움": {
              color: "#7C3AED",
              svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5"/></svg>'
            },
            "감상": {
              color: "#EC4899",
              svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 8 0 0 0 -9 8 8 7 0 0 0 8 7c0-1 1-2 2-2h5a2 2 0 0 0 2-2c0-6-4-11-8-11z"/><circle cx="8" cy="10" r="0.8" fill="white" stroke="none"/><circle cx="12" cy="7.5" r="0.8" fill="white" stroke="none"/><circle cx="16" cy="10" r="0.8" fill="white" stroke="none"/></svg>'
            },
            "활동": {
              color: "#EF4444",
              svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="15" cy="4" r="1.6" fill="white" stroke="none"/><path d="M4 17l3-3 2 2 4-5"/><path d="M10 11l2-3 3 1 2 3"/><path d="M17 12l3 2"/></svg>'
            },
            "휴식": {
              color: "#4338CA",
              svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 1 0 9 9 7 7 0 0 1 -9 -9z"/><path d="M17 3l0.7 1.6 1.6 0.7 -1.6 0.7 -0.7 1.6 -0.7 -1.6 -1.6 -0.7 1.6 -0.7z"/></svg>'
            },
            "기타": {
              color: "#0D9488",
              svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 4l2 2-2.5 2.5"/><path d="M17.5 8.5l-6 6"/><circle cx="9" cy="17.5" r="4.5"/><circle cx="9" cy="17.5" r="1.8" fill="white" stroke="none"/></svg>'
            }
          };

          if (typeof kakao === 'undefined') {
            errorElement.textContent = '카카오 SDK 로드 실패';
          } else {
            kakao.maps.load(function () {
              const position = new kakao.maps.LatLng(${latitude}, ${longitude});
              const map = new kakao.maps.Map(document.getElementById('map'), {
                center: position,
                level: 5,
              });

              const userLoc = ${JSON.stringify(userLocation)};
              if (userLoc && userLoc.lat && userLoc.lng) {
                const dot = document.createElement('div');
                dot.style.width = '14px';
                dot.style.height = '14px';
                dot.style.borderRadius = '50%';
                dot.style.backgroundColor = '#3D5AFE';
                dot.style.border = '2.5px solid #ffffff';
                dot.style.boxShadow = '0 1px 4px rgba(0,0,0,0.35)';
                dot.style.boxSizing = 'border-box';

                new kakao.maps.CustomOverlay({
                  map: map,
                  position: new kakao.maps.LatLng(userLoc.lat, userLoc.lng),
                  content: dot,
                  xAnchor: 0.5,
                  yAnchor: 0.5,
                  zIndex: 10,
                });
              }

              const markers = ${JSON.stringify(markers)};
              markers.forEach(function (m) {
                const content = document.createElement('div');
                content.style.cursor = 'pointer';

                if (m.photo) {
                  content.style.width = '48px';
                  content.style.height = '48px';
                  content.style.borderRadius = '24px';
                  content.style.border = '3px solid #ffffff';
                  content.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
                  content.style.backgroundColor = '#E4E6EA';
                  content.style.backgroundSize = 'cover';
                  content.style.backgroundPosition = 'center';
                  content.style.position = 'relative';
                  content.style.backgroundImage = "url('" + m.photo + "')";

                  if (m.count) {
                    const badge = document.createElement('div');
                    badge.textContent = '+' + m.count;
                    badge.style.position = 'absolute';
                    badge.style.bottom = '-4px';
                    badge.style.right = '-4px';
                    badge.style.backgroundColor = '#3D5AFE';
                    badge.style.color = '#ffffff';
                    badge.style.fontSize = '10px';
                    badge.style.fontWeight = '700';
                    badge.style.borderRadius = '9px';
                    badge.style.padding = '1px 5px';
                    badge.style.border = '2px solid #ffffff';
                    content.appendChild(badge);
                  }
                } else {
                  const style = CATEGORY_STYLES[m.category] || CATEGORY_STYLES["기타"];
                  content.style.width = '32px';
                  content.style.height = '32px';
                  content.style.borderRadius = '16px';
                  content.style.backgroundColor = style.color;
                  content.style.display = 'flex';
                  content.style.alignItems = 'center';
                  content.style.justifyContent = 'center';
                  content.style.border = '2px solid #ffffff';
                  content.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
                  content.innerHTML = style.svg;
                }

                content.addEventListener('click', function () {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', id: m.id }));
                });

                new kakao.maps.CustomOverlay({
                  map: map,
                  position: new kakao.maps.LatLng(m.lat, m.lng),
                  content: content,
                  xAnchor: 0.5,
                  yAnchor: m.photo ? 0.5 : 1,
                });
              });

              errorElement.style.display = 'none';
            });
          }
        </script>
      </body>
    </html>
  `,
    [latitude, longitude, JSON.stringify(markers), JSON.stringify(userLocation)]
  );

  return (
    <WebView
      style={[StyleSheet.absoluteFill, style]}
      originWhitelist={["*"]}
      source={{ html }}
      javaScriptEnabled
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === "markerPress" && onMarkerPress) {
            onMarkerPress(data.id);
          }
        } catch {}
      }}
    />
  );
}