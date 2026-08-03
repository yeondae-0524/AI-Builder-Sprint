import type { StyleProp, ViewStyle } from "react-native";

export type KakaoMapMarker = {
  id: string | number;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  photo?: string;
  imageUrl?: string;
  count?: number;
};

export type KakaoMapViewProps = {
  latitude?: number;
  longitude?: number;
  markers?: KakaoMapMarker[];
  onMarkerPress?: (id: string | number) => void;
  style?: StyleProp<ViewStyle>;

  [key: string]: unknown;
};

export function KakaoMapView(
  props: KakaoMapViewProps,
): React.JSX.Element;