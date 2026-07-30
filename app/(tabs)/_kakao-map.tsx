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
};

type Props = {
  latitude: number;
  longitude: number;
  markers?: MapMarker[];
  onMarkerPress?: (id: string | number) => void;
  style?: any;
};

export function KakaoMapView({ latitude, longitude, markers = [], onMarkerPress, style }: Props) {
  const html = useMemo(
    () => `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          html, body, #map { width: 100%; height: 100%; margin: 0; }
          #error { position: fixed; top: 10px; left: 10px; z-index: 10; padding: 10px; background: white; color: red; font-size: 12px; }
        </style>
      </head>
      <body>
        <div id="error">카카오 지도 불러오는 중...</div>
        <div id="map"></div>
        <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"></script>
        <script>
          const errorElement = document.getElementById('error');
          if (typeof kakao === 'undefined') {
            errorElement.textContent = '카카오 SDK 로드 실패';
          } else {
            kakao.maps.load(function () {
              const position = new kakao.maps.LatLng(${latitude}, ${longitude});
              const map = new kakao.maps.Map(document.getElementById('map'), {
                center: position,
                level: 5,
              });

              const markers = ${JSON.stringify(markers)};

              markers.forEach(function (m) {
                const content = document.createElement('div');
                content.style.width = '48px';
                content.style.height = '48px';
                content.style.borderRadius = '24px';
                content.style.border = '3px solid #ffffff';
                content.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
                content.style.backgroundColor = '#E4E6EA';
                content.style.backgroundSize = 'cover';
                content.style.backgroundPosition = 'center';
                content.style.cursor = 'pointer';
                content.style.position = 'relative';

                if (m.photo) {
                  content.style.backgroundImage = "url('" + m.photo + "')";
                }

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

                content.addEventListener('click', function () {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', id: m.id }));
                });

                new kakao.maps.CustomOverlay({
                  map: map,
                  position: new kakao.maps.LatLng(m.lat, m.lng),
                  content: content,
                  xAnchor: 0.5,
                  yAnchor: 0.5,
                });
              });

              errorElement.style.display = 'none';
            });
          }
        </script>
      </body>
    </html>
  `,
    [latitude, longitude, JSON.stringify(markers)]
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