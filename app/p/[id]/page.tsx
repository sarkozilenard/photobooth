import { getPhoto } from "@/lib/store";
import { GuestPhoto } from "@/components/share/GuestPhoto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PhotoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const photo = await getPhoto(id);
  if (!photo || t !== photo.token) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black p-6 text-center text-white">
        A fotó nem elérhető. Olvasd be újra a QR-kódot, vagy kérj újat a booth-on.
      </div>
    );
  }
  const src =
    photo.blobUrl && photo.blobUrl.startsWith("http")
      ? photo.blobUrl
      : `/api/photos/${photo.id}/file?t=${photo.token}`;
  return <GuestPhoto src={src} filename={`photobooth-${photo.id}.jpg`} />;
}
