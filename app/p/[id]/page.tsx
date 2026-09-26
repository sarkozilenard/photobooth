import { getPhoto } from "@/lib/store";
import { GuestPhoto } from "@/components/share/GuestPhoto";

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
      <div className="flex min-h-[100dvh] items-center justify-center bg-black text-white">
        A fotó nem elérhető.
      </div>
    );
  }
  const src = `/api/photos/${photo.id}/file?t=${photo.token}`;
  return <GuestPhoto src={src} filename={`photobooth-${photo.id}.jpg`} />;
}
