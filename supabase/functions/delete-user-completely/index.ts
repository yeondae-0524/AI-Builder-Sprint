export { };

// Supabase Edge Runtime에서 사용되는 JSR import입니다.
// @ts-ignore
    import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
import { createClient } from "jsr:@supabase/supabase-js@2";

type DeleteRequest = {
  userId?: string;
  confirm?: string;
};

type StorageObjectRef = {
  bucketId: string;
  name: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function timingSafeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function deduplicateObjects(objects: StorageObjectRef[]) {
  const seen = new Set<string>();

  return objects.filter((object) => {
    const key = `${object.bucketId}:${object.name}`;
    if (!object.bucketId || !object.name || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function listFolderRecursively(
  supabaseAdmin: any,
  bucketId: string,
  folder: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucketId)
      .list(folder, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      // 해당 버킷에 사용자 폴더가 없거나 목록 권한이 없는 경우입니다.
      return paths;
    }

    const entries = Array.isArray(data) ? data : [];
    for (const entry of entries) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;

      // Storage list 결과에서 폴더는 id가 null입니다.
      if (entry.id == null) {
        paths.push(
          ...(await listFolderRecursively(
            supabaseAdmin,
            bucketId,
            path,
          )),
        );
      } else {
        paths.push(path);
      }
    }

    if (entries.length < limit) {
      break;
    }

    offset += limit;
  }

  return paths;
}

async function findUserStorageObjects(
  supabaseAdmin: any,
  userId: string,
): Promise<StorageObjectRef[]> {
  const objects: StorageObjectRef[] = [];

  // 1. 소유자 기준으로 찾습니다. 사용자가 UID 폴더 밖에 업로드한 파일도 잡습니다.
  const ownerResult = await supabaseAdmin
    .schema("storage")
    .from("objects")
    .select("bucket_id, name")
    .eq("owner_id", userId);

  if (!ownerResult.error) {
    for (const row of ownerResult.data ?? []) {
      objects.push({
        bucketId: String(row.bucket_id ?? ""),
        name: String(row.name ?? ""),
      });
    }
  }

  // 2. 앱의 업로드 경로가 `${userId}/...` 구조이므로 경로 기준으로도 찾습니다.
  const prefixResult = await supabaseAdmin
    .schema("storage")
    .from("objects")
    .select("bucket_id, name")
    .like("name", `${userId}/%`);

  if (!prefixResult.error) {
    for (const row of prefixResult.data ?? []) {
      objects.push({
        bucketId: String(row.bucket_id ?? ""),
        name: String(row.name ?? ""),
      });
    }
  }

  // storage.objects 조회가 프로젝트 설정상 노출되지 않는 경우를 위한 폴백입니다.
  if (ownerResult.error && prefixResult.error) {
    const { data: buckets, error: bucketsError } =
      await supabaseAdmin.storage.listBuckets();

    if (bucketsError) {
      throw new Error(
        `Storage 버킷 목록 조회 실패: ${bucketsError.message}`,
      );
    }

    for (const bucket of buckets ?? []) {
      const bucketId = String(bucket.id ?? bucket.name ?? "");
      if (!bucketId) continue;

      const paths = await listFolderRecursively(
        supabaseAdmin,
        bucketId,
        userId,
      );

      for (const name of paths) {
        objects.push({ bucketId, name });
      }
    }
  }

  return deduplicateObjects(objects);
}

async function deleteStorageObjects(
  supabaseAdmin: any,
  objects: StorageObjectRef[],
) {
  const pathsByBucket = new Map<string, string[]>();

  for (const object of objects) {
    const paths = pathsByBucket.get(object.bucketId) ?? [];
    paths.push(object.name);
    pathsByBucket.set(object.bucketId, paths);
  }

  let deletedCount = 0;
  const deletedByBucket: Record<string, number> = {};

  for (const [bucketId, paths] of pathsByBucket.entries()) {
    for (const pathChunk of chunk(paths, 100)) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucketId)
        .remove(pathChunk);

      if (error) {
        throw new Error(
          `Storage 삭제 실패 (${bucketId}): ${error.message}`,
        );
      }

      const count = Array.isArray(data)
        ? data.length
        : pathChunk.length;
      deletedCount += count;
      deletedByBucket[bucketId] =
        (deletedByBucket[bucketId] ?? 0) + count;
    }
  }

  return { deletedCount, deletedByBucket };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  const configuredAdminSecret = Deno.env.get(
    "DELETE_USER_ADMIN_SECRET",
  );

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Supabase 서버 환경 변수가 없습니다." },
      500,
    );
  }

  if (!configuredAdminSecret) {
    return jsonResponse(
      { error: "DELETE_USER_ADMIN_SECRET이 설정되지 않았습니다." },
      500,
    );
  }

  const requestAdminSecret =
    request.headers.get("x-admin-secret") ?? "";

  if (
    !requestAdminSecret ||
    !timingSafeEqual(
      requestAdminSecret,
      configuredAdminSecret,
    )
  ) {
    return jsonResponse({ error: "관리자 인증에 실패했습니다." }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as DeleteRequest;
  const userId = String(body.userId ?? "").trim();
  const confirmation = String(body.confirm ?? "").trim();

  if (!isUuid(userId)) {
    return jsonResponse({ error: "올바른 사용자 UID가 필요합니다." }, 400);
  }

  // UID를 한 번 더 그대로 입력해야 실제 삭제됩니다.
  if (confirmation !== userId) {
    return jsonResponse(
      {
        error:
          "confirm 값에 삭제할 사용자 UID를 동일하게 입력해주세요.",
      },
      400,
    );
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  try {
    const { data: existingUser, error: getUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (getUserError || !existingUser?.user) {
      return jsonResponse(
        {
          error:
            getUserError?.message ?? "사용자를 찾지 못했습니다.",
        },
        404,
      );
    }

    // 1. 실제 Storage 객체를 API로 먼저 삭제합니다.
    const storageObjects = await findUserStorageObjects(
      supabaseAdmin,
      userId,
    );
    const storageResult = await deleteStorageObjects(
      supabaseAdmin,
      storageObjects,
    );

    // 2. 공개 스키마의 사용자 관련 데이터를 정리합니다.
    const { data: databaseResult, error: databaseError } =
      await supabaseAdmin.rpc("admin_delete_user_data", {
        p_user_id: userId,
      });

    if (databaseError) {
      throw new Error(
        `DB 사용자 데이터 삭제 실패: ${databaseError.message}`,
      );
    }

    // 3. 마지막으로 Auth 계정을 하드 삭제합니다.
    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(userId, false);

    if (deleteUserError) {
      throw new Error(
        `Auth 사용자 삭제 실패: ${deleteUserError.message}`,
      );
    }

    return jsonResponse({
      status: "success",
      message: "사용자 계정과 관련 데이터가 완전히 삭제되었습니다.",
      deletedUser: {
        id: userId,
        email: existingUser.user.email ?? null,
      },
      storage: storageResult,
      database: databaseResult,
    });
  } catch (error) {
    console.error("사용자 완전 삭제 실패:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "사용자 완전 삭제 중 알 수 없는 오류가 발생했습니다.",
      },
      500,
    );
  }
});
