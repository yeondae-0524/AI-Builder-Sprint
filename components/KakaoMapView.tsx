import { useCallback, useEffect, useMemo, useRef } from "react";
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

type UserLocation = { lat: number; lng: number } | null;
type PickedLocation = { lat: number; lng: number } | null;

type Props = {
  latitude: number;
  longitude: number;
  markers?: MapMarker[];
  userLocation?: UserLocation;
  pickedLocation?: PickedLocation;
  selectedMarkerId?: string | number | null;
  /** 양수면 선택 위치가 화면 위쪽으로, 음수면 아래쪽으로 이동합니다. */
  focusOffsetY?: number;
  onMarkerPress?: (id: string | number) => void;
  onMarkerClose?: () => void;
  onMarkerAction?: (id: string | number) => void;
  onMapPress?: (lat: number, lng: number) => void;
  style?: any;
};

export function KakaoMapView({
  latitude,
  longitude,
  markers = [],
  userLocation,
  pickedLocation,
  selectedMarkerId = null,
  focusOffsetY = 0,
  onMarkerPress,
  onMarkerClose,
  onMarkerAction,
  onMapPress,
  style,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const mapReadyRef = useRef(false);
  const selectedMarkerKey =
    selectedMarkerId == null ? null : String(selectedMarkerId);

  const markersJson = JSON.stringify(markers);
  const userLocationJson = JSON.stringify(userLocation);
  const pickedLocationJson = JSON.stringify(pickedLocation);

  const focusMap = useCallback(() => {
    const script = `
      if (window.focusMapMarker) {
        window.focusMapMarker(
          ${JSON.stringify(selectedMarkerKey)},
          ${latitude},
          ${longitude},
          ${Number.isFinite(focusOffsetY) ? focusOffsetY : 0}
        );
      }
      true;
    `;

    webViewRef.current?.injectJavaScript(script);
  }, [selectedMarkerKey, latitude, longitude, focusOffsetY]);

  useEffect(() => {
    if (mapReadyRef.current) {
      focusMap();
    }
  }, [focusMap]);

  const html = useMemo(
    () => `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <style>
          * { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
          #map {
            width: 100%;
            height: 100%;
            filter: grayscale(40%) saturate(0.7) brightness(1.08) contrast(0.95);
          }
          #error {
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 100;
            padding: 10px;
            background: white;
            color: red;
            font-size: 12px;
          }

          .mission-marker {
            position: relative;
            width: 34px;
            min-height: 34px;
            padding: 0;
            overflow: visible;
            border-radius: 17px;
            background: transparent;
            color: #0f0f0f;
            cursor: pointer;
            transform-origin: 50% 100%;
            transition:
              width 300ms cubic-bezier(0.2, 0.86, 0.25, 1),
              min-height 300ms cubic-bezier(0.2, 0.86, 0.25, 1),
              padding 260ms ease,
              border-radius 260ms ease,
              background-color 220ms ease,
              box-shadow 220ms ease,
              transform 260ms ease;
            will-change: width, min-height, transform;
          }
          .mission-marker.photo-marker {
            width: 48px;
            min-height: 48px;
          }
          .mission-marker.photo-marker.selected-marker {
            width: min(320px, calc(100vw - 28px));
            min-height: 0;
          }

          .marker-icon {
            position: relative;
            z-index: 3;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            border: 2px solid #ffffff;
            border-radius: 16px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            transition:
              width 260ms cubic-bezier(0.2, 0.86, 0.25, 1),
              height 260ms cubic-bezier(0.2, 0.86, 0.25, 1),
              border-radius 260ms ease,
              transform 300ms cubic-bezier(0.2, 0.9, 0.25, 1);
          }

          .marker-icon svg { width: 16px; height: 16px; transition: width 220ms ease, height 220ms ease; }
          .photo-icon { background-size: cover; background-position: center; }
          .flexible-marker .marker-icon {
            background: linear-gradient(135deg, #3d5afe, #8b5cf6);
          }
          .flexible-marker .marker-icon::after {
            content: "✦";
            color: #ffffff;
            font-size: 17px;
            line-height: 1;
            font-weight: 900;
          }
          .flexible-marker .marker-icon svg { display: none; }

          .marker-count {
            position: absolute;
            right: -5px;
            bottom: -5px;
            z-index: 4;
            padding: 1px 5px;
            border: 2px solid #ffffff;
            border-radius: 9px;
            background: #3d5afe;
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
          }

          .marker-card-content {
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            pointer-events: none;
            transform: translateY(8px);
            transform-origin: 50% 100%;
            transition:
              max-height 260ms ease-out,
              opacity 160ms ease-out,
              transform 180ms ease-out;
          }

          .selected-marker {
            width: min(320px, calc(100vw - 28px));
            min-height: 0;
            padding: 14px;
            border: 1px solid rgba(61,90,254,0.20);
            border-radius: 20px;
            background: #ffffff;
            box-shadow: 0 14px 34px rgba(15,23,42,0.24);
            cursor: default;
            transform: translateY(50%);
            transform-origin: 50% 50%;
          }

          .selected-marker .marker-icon {
            width: 42px;
            height: 42px;
            border-radius: 14px;
            transform: translateY(0);
            box-shadow: 0 5px 12px rgba(15,23,42,0.20);
          }
          .selected-marker .marker-icon svg { width: 20px; height: 20px; }
          .selected-marker .marker-count { display: none; }
          .selected-marker .marker-card-content {
            max-height: calc(100vh - 96px);
            margin-top: -42px;
            overflow-y: auto;
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
            transition-delay: 0ms;
            scrollbar-width: none;
          }
          .selected-marker .marker-card-content::-webkit-scrollbar {
            display: none;
          }


          .card-header {
            min-height: 42px;
            display: flex;
            align-items: flex-start;
            padding-left: 52px;
            padding-right: 28px;
          }
          .card-category {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 4px 9px;
            border-radius: 8px;
            background: #eef1ff;
            color: #3d5afe;
            font-size: 11px;
            font-weight: 800;
          }
          .card-close {
            position: absolute;
            top: 0;
            right: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 0;
            border-radius: 15px;
            background: #f3f4f6;
            color: #737782;
            font-size: 16px;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }
          .card-title {
            margin-top: 8px;
            color: #0f0f0f;
            font-size: 18px;
            line-height: 24px;
            font-weight: 850;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .card-description {
            margin-top: 8px;
            color: #5c5f6a;
            font-size: 12px;
            line-height: 18px;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .card-instruction {
            margin-top: 10px;
            padding: 10px 11px;
            border-radius: 11px;
            background: #f7f8fa;
            color: #5c5f6a;
            font-size: 12px;
            line-height: 18px;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .card-place {
            margin-top: 9px;
            color: #5c5f6a;
            font-size: 11px;
            line-height: 16px;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .card-metrics {
            display: grid;
            grid-template-columns: 0.8fr 1.25fr 0.7fr;
            gap: 7px;
            margin-top: 10px;
          }
          .card-metric {
            min-width: 0;
            padding: 8px;
            border-radius: 10px;
            background: #fafafa;
          }
          .metric-label {
            color: #9ea3ae;
            font-size: 9px;
            line-height: 13px;
          }
          .metric-value {
            display: -webkit-box;
            margin-top: 3px;
            overflow: hidden;
            color: #0f0f0f;
            font-size: 11px;
            line-height: 15px;
            font-weight: 750;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
          }
          .card-reason {
            display: flex;
            align-items: flex-start;
            gap: 7px;
            margin-top: 10px;
            padding: 9px 10px;
            border-radius: 10px;
            background: #f4f6f8;
          }
          .reason-label {
            flex: 0 0 auto;
            color: #3d5afe;
            font-size: 10px;
            line-height: 16px;
            font-weight: 800;
          }
          .reason-value {
            min-width: 0;
            color: #5c5f6a;
            font-size: 10px;
            line-height: 16px;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .card-action {
            width: 100%;
            min-height: 42px;
            margin-top: 11px;
            border: 0;
            border-radius: 12px;
            color: #ffffff;
            font-size: 13px;
            font-weight: 850;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }
          .card-action.primary { background: #3d5afe; }
          .card-action.pink { background: #ec4899; }
          .card-action.green { background: #10b981; }
          .card-action:disabled { opacity: 0.55; cursor: default; }
        </style>
      </head>
      <body>
        <div id="error">카카오 지도 불러오는 중...</div>
        <div id="map"></div>
        <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"></script>
        <script>
          const errorElement = document.getElementById('error');

          const CATEGORY_STYLES = {
            "음식": { color: "#F97316", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M9 12v9"/><path d="M17 3c-1.7 0-3 2-3 5s1.3 5 3 5 3-2 3-5-1.3-5-3-5z"/><path d="M17 13v8"/></svg>' },
            "카페 및 디저트": { color: "#8B5E3C", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2"/><path d="M6 3c-.5 1-.5 1.5 0 2.5"/><path d="M10 3c-.5 1-.5 1.5 0 2.5"/></svg>' },
            "산책": { color: "#22C55E", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1.6" fill="white" stroke="none"/><path d="M11 8l-2 3 2 2-1 6"/><path d="M11 8l3 1 2 4"/><path d="M9 13l-3 2"/><path d="M13 11l2 5"/></svg>' },
            "배움": { color: "#7C3AED", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5"/></svg>' },
            "감상": { color: "#EC4899", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 8 0 0 0-9 8 8 7 0 0 0 8 7c0-1 1-2 2-2h5a2 2 0 0 0 2-2c0-6-4-11-8-11z"/><circle cx="8" cy="10" r=".8" fill="white" stroke="none"/><circle cx="12" cy="7.5" r=".8" fill="white" stroke="none"/><circle cx="16" cy="10" r=".8" fill="white" stroke="none"/></svg>' },
            "활동": { color: "#EF4444", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="15" cy="4" r="1.6" fill="white" stroke="none"/><path d="M4 17l3-3 2 2 4-5"/><path d="M10 11l2-3 3 1 2 3"/><path d="M17 12l3 2"/></svg>' },
            "휴식": { color: "#4338CA", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 1 0 9 9 7 7 0 0 1-9-9z"/><path d="M17 3l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/></svg>' },
            "기타": { color: "#0D9488", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 4l2 2-2.5 2.5"/><path d="M17.5 8.5l-6 6"/><circle cx="9" cy="17.5" r="4.5"/><circle cx="9" cy="17.5" r="1.8" fill="white" stroke="none"/></svg>' }
          };

          const post = function (payload) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          };

          const appendText = function (parent, className, value) {
            const element = document.createElement('div');
            element.className = className;
            element.textContent = value || '';
            parent.appendChild(element);
            return element;
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

              const markerEntries = {};
              let selectedMarkerKey = null;

              const refreshOverlayAnchor = function (entry) {
                if (!entry) return;
                entry.overlay.setContent(entry.content);
                entry.overlay.setPosition(entry.position);
              };

              window.focusMapMarker = function (id, lat, lng, offsetY) {
                selectedMarkerKey = id == null ? null : String(id);

                Object.keys(markerEntries).forEach(function (key) {
                  const entry = markerEntries[key];
                  const isSelected = key === selectedMarkerKey;
                  entry.content.classList.toggle('selected-marker', isSelected);
                  entry.overlay.setZIndex(isSelected ? 60 : 5);
                  refreshOverlayAnchor(entry);
                });

                // 카드를 닫을 때는 선택 표시만 해제하고 지도 중심은 그대로 둔다.
                if (!selectedMarkerKey) {
                  return;
                }

                const numericLat = Number(lat);
                const numericLng = Number(lng);
                if (!Number.isFinite(numericLat) || !Number.isFinite(numericLng)) {
                  return;
                }

                const target = new kakao.maps.LatLng(numericLat, numericLng);

                if (selectedMarkerKey && map.getLevel() > 4) {
                  map.setLevel(4, { animate: { duration: 260 } });
                }

                map.panTo(target);

                // 줌 애니메이션이 끝난 뒤에도 선택 장소 좌표가
                // 화면의 정확한 중심에 남도록 한 번 더 고정한다.
                window.setTimeout(function () {
                  map.setCenter(target);
                }, 300);

                const selectedEntry = selectedMarkerKey
                  ? markerEntries[selectedMarkerKey]
                  : null;
                if (selectedEntry) {
                  selectedEntry.content.classList.remove('selected-marker');
                  void selectedEntry.content.offsetWidth;
                  selectedEntry.content.classList.add('selected-marker');
                  selectedEntry.overlay.setZIndex(60);
                  window.setTimeout(function () {
                    refreshOverlayAnchor(selectedEntry);
                  }, 320);
                }
              };

              const userLoc = ${userLocationJson};
              if (userLoc && userLoc.lat && userLoc.lng) {
                const dot = document.createElement('div');
                dot.style.width = '14px';
                dot.style.height = '14px';
                dot.style.borderRadius = '50%';
                dot.style.backgroundColor = '#3D5AFE';
                dot.style.border = '2.5px solid #ffffff';
                dot.style.boxShadow = '0 1px 4px rgba(0,0,0,0.35)';

                new kakao.maps.CustomOverlay({
                  map: map,
                  position: new kakao.maps.LatLng(userLoc.lat, userLoc.lng),
                  content: dot,
                  xAnchor: 0.5,
                  yAnchor: 0.5,
                  zIndex: 10,
                });
              }

              const pickedLoc = ${pickedLocationJson};
              if (pickedLoc && pickedLoc.lat && pickedLoc.lng) {
                const pin = document.createElement('div');
                pin.style.width = '28px';
                pin.style.height = '28px';
                pin.style.borderRadius = '14px 14px 14px 0';
                pin.style.transform = 'rotate(45deg)';
                pin.style.backgroundColor = '#EC4899';
                pin.style.border = '2.5px solid #ffffff';
                pin.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

                new kakao.maps.CustomOverlay({
                  map: map,
                  position: new kakao.maps.LatLng(pickedLoc.lat, pickedLoc.lng),
                  content: pin,
                  xAnchor: 0.5,
                  yAnchor: 1,
                  zIndex: 15,
                });
              }

              const markers = ${markersJson};
              markers.forEach(function (m) {
                const markerKey = String(m.id);
                const style = CATEGORY_STYLES[m.category] || CATEGORY_STYLES['기타'];
                const content = document.createElement('div');
                content.className = 'mission-marker';
                if (m.locationFlexible) {
                  content.classList.add('flexible-marker');
                }

                const icon = document.createElement('div');
                icon.className = 'marker-icon';

                if (m.photo) {
                  content.classList.add('photo-marker');
                  icon.classList.add('photo-icon');
                  icon.style.width = '48px';
                  icon.style.height = '48px';
                  icon.style.borderRadius = '24px';
                  icon.style.backgroundColor = '#E4E6EA';
                  icon.style.backgroundImage = "url('" + m.photo + "')";

                  if (m.count) {
                    const badge = document.createElement('div');
                    badge.className = 'marker-count';
                    badge.textContent = '+' + m.count;
                    icon.appendChild(badge);
                  }
                } else {
                  icon.style.backgroundColor = m.locationFlexible
                    ? '#3D5AFE'
                    : style.color;
                  icon.innerHTML = m.locationFlexible ? '' : style.svg;
                }

                content.appendChild(icon);

                const card = document.createElement('div');
                card.className = 'marker-card-content';

                const header = document.createElement('div');
                header.className = 'card-header';
                appendText(header, 'card-category', m.category || '기타');

                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.className = 'card-close';
                closeButton.textContent = '×';
                closeButton.addEventListener('click', function (event) {
                  event.stopPropagation();
                  post({ type: 'markerClose', id: m.id });
                });
                header.appendChild(closeButton);
                card.appendChild(header);

                appendText(card, 'card-title', m.title || m.label || '미션');

                if (m.description) {
                  appendText(card, 'card-description', m.description);
                }

                if (m.placeName) {
                  appendText(
                    card,
                    'card-place',
                    (m.locationFlexible ? '✨ ' : '📍 ') + m.placeName
                  );
                }

                const metrics = document.createElement('div');
                metrics.className = 'card-metrics';

                const metricValues = [
                  ['예상 시간', m.time || '시간 자유'],
                  ['준비물', m.preparation || '별도 준비물 없음'],
                  ['비용', m.cost || '정보 없음']
                ];
                metricValues.forEach(function (pair) {
                  const metric = document.createElement('div');
                  metric.className = 'card-metric';
                  appendText(metric, 'metric-label', pair[0]);
                  appendText(metric, 'metric-value', pair[1]);
                  metrics.appendChild(metric);
                });
                card.appendChild(metrics);

                const reason = document.createElement('div');
                reason.className = 'card-reason';
                appendText(reason, 'reason-label', '추천 이유');
                appendText(reason, 'reason-value', m.recommendationReason || '지금의 취향과 상황에 잘 맞는 경험이에요.');
                card.appendChild(reason);

                if (m.actionLabel) {
                  const action = document.createElement('button');
                  action.type = 'button';
                  action.className = 'card-action ' + (m.actionVariant || 'primary');
                  action.textContent = m.actionLabel;
                  action.disabled = Boolean(m.actionDisabled);
                  action.addEventListener('click', function (event) {
                    event.stopPropagation();
                    if (!action.disabled) {
                      post({ type: 'markerAction', id: m.id });
                    }
                  });
                  card.appendChild(action);
                }

                content.appendChild(card);

                content.addEventListener('click', function (event) {
                  event.stopPropagation();
                  if (selectedMarkerKey !== markerKey) {
                    post({ type: 'markerPress', id: m.id });
                  }
                });

                const markerPosition = new kakao.maps.LatLng(m.lat, m.lng);
                const overlay = new kakao.maps.CustomOverlay({
                  map: map,
                  position: markerPosition,
                  content: content,
                  xAnchor: 0.5,
                  yAnchor: 1,
                  zIndex: 5,
                });

                markerEntries[markerKey] = {
                  content: content,
                  overlay: overlay,
                  position: markerPosition,
                };
              });

              kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
                const latlng = mouseEvent.latLng;
                post({
                  type: 'mapClick',
                  lat: latlng.getLat(),
                  lng: latlng.getLng(),
                });
              });

              errorElement.style.display = 'none';
              post({ type: 'mapReady' });
            });
          }
        </script>
      </body>
    </html>
  `,
    [markersJson, userLocationJson, pickedLocationJson],
  );

  const webViewSource = useMemo(() => ({ html }), [html]);

  return (
    <WebView
      ref={webViewRef}
      style={[StyleSheet.absoluteFill, style]}
      originWhitelist={["*"]}
      source={webViewSource}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      onLoadStart={() => {
        mapReadyRef.current = false;
      }}
      onLoadEnd={() => {
        setTimeout(() => {
          focusMap();
        }, 80);
      }}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);

          if (data.type === "mapReady") {
            mapReadyRef.current = true;
            focusMap();
          }
          if (data.type === "markerPress" && onMarkerPress) {
            onMarkerPress(data.id);
          }
          if (data.type === "markerClose" && onMarkerClose) {
            onMarkerClose();
          }
          if (data.type === "markerAction" && onMarkerAction) {
            onMarkerAction(data.id);
          }
          if (data.type === "mapClick" && onMapPress) {
            onMapPress(data.lat, data.lng);
          }
        } catch {
          // 지도 내부의 알 수 없는 메시지는 무시합니다.
        }
      }}
    />
  );
}