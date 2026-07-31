import { supabase } from "../lib/supabase";

export type Place = {
  id: string;
  kakao_place_id: string;
  name: string;
  category_name: string | null;
  address: string | null;
  road_address: string | null;
  region_name: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
};

export type NearbyPlace = Place & {
  distance_km: number;
};

export type KakaoPlaceDocument = {
  id: string;
  place_name: string;
  category_name?: string | null;
  address_name?: string | null;
  road_address_name?: string | null;
  x: string | number;
  y: string | number;
};

export type SavePlaceInput = {
  kakaoPlaceId: string;
  name: string;
  categoryName?: string | null;
  address?: string | null;
  roadAddress?: string | null;
  regionName?: string | null;
  latitude: number;
  longitude: number;
};

const PLACE_SELECT = `
  id,
  kakao_place_id,
  name,
  category_name,
  address,
  road_address,
  region_name,
  latitude,
  longitude,
  created_at
`;

function requireText(
  value: string,
  label: string,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label}가 필요합니다.`);
  }

  return trimmed;
}

function normalizeNullableText(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function requireLatitude(value: number): number {
  if (
    !Number.isFinite(value) ||
    value < -90 ||
    value > 90
  ) {
    throw new Error(
      "위도는 -90부터 90 사이의 숫자여야 합니다.",
    );
  }

  return value;
}

function requireLongitude(value: number): number {
  if (
    !Number.isFinite(value) ||
    value < -180 ||
    value > 180
  ) {
    throw new Error(
      "경도는 -180부터 180 사이의 숫자여야 합니다.",
    );
  }

  return value;
}

function normalizePlace(
  place: Omit<Place, "latitude" | "longitude"> & {
    latitude: number | string;
    longitude: number | string;
  },
): Place {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);

  requireLatitude(latitude);
  requireLongitude(longitude);

  return {
    ...place,
    latitude,
    longitude,
  };
}

function normalizePlaces(
  places: Array<
    Omit<Place, "latitude" | "longitude"> & {
      latitude: number | string;
      longitude: number | string;
    }
  >,
): Place[] {
  return places.map(normalizePlace);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusKm = 6371;

  const latitudeDelta = toRadians(
    latitudeB - latitudeA,
  );
  const longitudeDelta = toRadians(
    longitudeB - longitudeA,
  );

  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  const centralAngle =
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine),
    );

  return earthRadiusKm * centralAngle;
}

function sanitizeSearchTerm(value: string): string {
  return value
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * DB 장소 ID로 장소를 조회한다.
 */
export async function getPlaceById(
  placeId: string,
): Promise<Place> {
  const id = requireText(placeId, "placeId");

  const { data, error } = await supabase
    .from("places")
    .select(PLACE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getPlaceById Error:", error);
    throw error;
  }

  if (!data) {
    throw new Error("장소를 찾을 수 없습니다.");
  }

  return normalizePlace(
    data as Omit<
      Place,
      "latitude" | "longitude"
    > & {
      latitude: number | string;
      longitude: number | string;
    },
  );
}

/**
 * 카카오 장소 ID로 저장된 장소를 조회한다.
 */
export async function getPlaceByKakaoPlaceId(
  kakaoPlaceId: string,
): Promise<Place | null> {
  const id = requireText(
    kakaoPlaceId,
    "kakaoPlaceId",
  );

  const { data, error } = await supabase
    .from("places")
    .select(PLACE_SELECT)
    .eq("kakao_place_id", id)
    .maybeSingle();

  if (error) {
    console.error(
      "getPlaceByKakaoPlaceId Error:",
      error,
    );
    throw error;
  }

  if (!data) {
    return null;
  }

  return normalizePlace(
    data as Omit<
      Place,
      "latitude" | "longitude"
    > & {
      latitude: number | string;
      longitude: number | string;
    },
  );
}

/**
 * 여러 DB 장소 ID를 한 번에 조회한다.
 */
export async function getPlacesByIds(
  placeIds: string[],
): Promise<Place[]> {
  const ids = Array.from(
    new Set(
      placeIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("places")
    .select(PLACE_SELECT)
    .in("id", ids);

  if (error) {
    console.error("getPlacesByIds Error:", error);
    throw error;
  }

  return normalizePlaces(
    (data ?? []) as Array<
      Omit<
        Place,
        "latitude" | "longitude"
      > & {
        latitude: number | string;
        longitude: number | string;
      }
    >,
  );
}

/**
 * 카카오 장소 정보를 DB에 저장한다.
 *
 * kakao_place_id UNIQUE 제약조건을 사용하므로
 * 이미 저장된 장소라면 같은 행을 갱신하고 반환한다.
 */
export async function savePlace({
  kakaoPlaceId,
  name,
  categoryName = null,
  address = null,
  roadAddress = null,
  regionName = null,
  latitude,
  longitude,
}: SavePlaceInput): Promise<Place> {
  const normalizedKakaoPlaceId = requireText(
    kakaoPlaceId,
    "kakaoPlaceId",
  );
  const normalizedName = requireText(
    name,
    "장소 이름",
  );
  const normalizedLatitude =
    requireLatitude(latitude);
  const normalizedLongitude =
    requireLongitude(longitude);

  const existingPlace =
    await getPlaceByKakaoPlaceId(
      normalizedKakaoPlaceId,
    );

  if (existingPlace) {
    return existingPlace;
  }

  const { data, error } = await supabase
    .from("places")
    .insert({
      kakao_place_id:
        normalizedKakaoPlaceId,
      name: normalizedName,
      category_name:
        normalizeNullableText(categoryName),
      address:
        normalizeNullableText(address),
      road_address:
        normalizeNullableText(roadAddress),
      region_name:
        normalizeNullableText(regionName),
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
    })
    .select(PLACE_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      const duplicatedPlace =
        await getPlaceByKakaoPlaceId(
          normalizedKakaoPlaceId,
        );

      if (duplicatedPlace) {
        return duplicatedPlace;
      }
    }

    console.error("savePlace Error:", error);
    throw error;
  }

  return normalizePlace(
    data as Omit<
      Place,
      "latitude" | "longitude"
    > & {
      latitude: number | string;
      longitude: number | string;
    },
  );
}

/**
 * 카카오 장소 검색 응답 한 건을 DB 장소로 저장한다.
 *
 * 카카오 응답의 x는 경도, y는 위도이다.
 */
export async function saveKakaoPlace(
  document: KakaoPlaceDocument,
  regionName?: string | null,
): Promise<Place> {
  const longitude = Number(document.x);
  const latitude = Number(document.y);

  return savePlace({
    kakaoPlaceId: document.id,
    name: document.place_name,
    categoryName:
      document.category_name ?? null,
    address: document.address_name ?? null,
    roadAddress:
      document.road_address_name ?? null,
    regionName: regionName ?? null,
    latitude,
    longitude,
  });
}

/**
 * 여러 카카오 장소 검색 결과를 순서대로 저장한다.
 *
 * 일부 장소 저장에 실패하면 전체 처리를 중단하고 오류를 반환한다.
 */
export async function saveKakaoPlaces(
  documents: KakaoPlaceDocument[],
  regionName?: string | null,
): Promise<Place[]> {
  const savedPlaces: Place[] = [];

  for (const document of documents) {
    const place = await saveKakaoPlace(
      document,
      regionName,
    );

    savedPlaces.push(place);
  }

  return savedPlaces;
}

/**
 * 장소 이름, 카테고리, 주소, 지역명으로 DB 장소를 검색한다.
 */
export async function searchPlaces(
  query: string,
  limit = 20,
): Promise<Place[]> {
  const keyword = sanitizeSearchTerm(query);

  if (!keyword) {
    return [];
  }

  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    50,
  );

  const pattern = `%${keyword}%`;

  const { data, error } = await supabase
    .from("places")
    .select(PLACE_SELECT)
    .or(
      [
        `name.ilike.${pattern}`,
        `category_name.ilike.${pattern}`,
        `address.ilike.${pattern}`,
        `road_address.ilike.${pattern}`,
        `region_name.ilike.${pattern}`,
      ].join(","),
    )
    .order("name", {
      ascending: true,
    })
    .limit(safeLimit);

  if (error) {
    console.error("searchPlaces Error:", error);
    throw error;
  }

  return normalizePlaces(
    (data ?? []) as Array<
      Omit<
        Place,
        "latitude" | "longitude"
      > & {
        latitude: number | string;
        longitude: number | string;
      }
    >,
  );
}

/**
 * 지정한 위치 반경 안의 저장된 장소를 조회한다.
 *
 * PostGIS나 별도 거리 RPC를 가정하지 않고,
 * 먼저 위도·경도 범위로 후보를 조회한 뒤 앱에서 실제 거리를 계산한다.
 */
export async function getNearbyPlaces({
  latitude,
  longitude,
  radiusKm = 5,
  limit = 50,
}: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}): Promise<NearbyPlace[]> {
  const centerLatitude =
    requireLatitude(latitude);
  const centerLongitude =
    requireLongitude(longitude);

  if (
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0 ||
    radiusKm > 100
  ) {
    throw new Error(
      "검색 반경은 0보다 크고 100km 이하여야 합니다.",
    );
  }

  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    100,
  );

  const latitudeDelta = radiusKm / 111.32;

  const longitudeScale = Math.max(
    Math.cos(toRadians(centerLatitude)),
    0.01,
  );
  const longitudeDelta =
    radiusKm / (111.32 * longitudeScale);

  const { data, error } = await supabase
    .from("places")
    .select(PLACE_SELECT)
    .gte(
      "latitude",
      centerLatitude - latitudeDelta,
    )
    .lte(
      "latitude",
      centerLatitude + latitudeDelta,
    )
    .gte(
      "longitude",
      centerLongitude - longitudeDelta,
    )
    .lte(
      "longitude",
      centerLongitude + longitudeDelta,
    )
    .limit(500);

  if (error) {
    console.error(
      "getNearbyPlaces Error:",
      error,
    );
    throw error;
  }

  return normalizePlaces(
    (data ?? []) as Array<
      Omit<
        Place,
        "latitude" | "longitude"
      > & {
        latitude: number | string;
        longitude: number | string;
      }
    >,
  )
    .map((place) => ({
      ...place,
      distance_km: calculateDistanceKm(
        centerLatitude,
        centerLongitude,
        place.latitude,
        place.longitude,
      ),
    }))
    .filter(
      (place) =>
        place.distance_km <= radiusKm,
    )
    .sort(
      (first, second) =>
        first.distance_km -
        second.distance_km,
    )
    .slice(0, safeLimit);
}