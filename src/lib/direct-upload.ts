import { api } from "@/lib/api";

export type UploadedProof = {
  assetId: string;
  url: string;
  status: "S3_READY" | "IMAGEKIT_FALLBACK";
};

const dataOf = <T>(response: { data?: T } | T): T =>
  ((response as { data?: T }).data || response) as T;

async function putFile(uploadUrl: string, headers: Record<string, string>, file: File) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers,
      body: file,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Proof upload failed with status ${response.status}`);
  } finally {
    window.clearTimeout(timer);
  }
}

export async function uploadMarkdownProof(file: File): Promise<UploadedProof> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP proof image.");
  }
  if (file.size < 1 || file.size > 10 * 1024 * 1024) {
    throw new Error("Proof image must be smaller than 10 MB.");
  }
  const initiated = dataOf<{
    assetId: string;
    uploadUrl: string | null;
    requiredHeaders: Record<string, string>;
    fallbackRequired?: boolean;
  }>(
    await api.post("/uploads/initiate", {
      category: "MARKDOWN_DAMAGE_PROOF",
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  );
  const fallback = async () => {
    const form = new FormData();
    form.append("file", file);
    return dataOf<UploadedProof>(
      await api.post(`/uploads/${initiated.assetId}/fallback`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  };
  if (initiated.fallbackRequired || !initiated.uploadUrl) return fallback();
  try {
    await putFile(initiated.uploadUrl, initiated.requiredHeaders, file);
    return dataOf<UploadedProof>(await api.post(`/uploads/${initiated.assetId}/complete`));
  } catch (uploadError) {
    try {
      return dataOf<UploadedProof>(await api.post(`/uploads/${initiated.assetId}/complete`));
    } catch (verificationError) {
      const code = (verificationError as { code?: string })?.code;
      if (code !== "S3_UPLOAD_NOT_FOUND") throw verificationError;
    }
    return fallback();
  }
}
