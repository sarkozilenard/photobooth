import { getPhoto } from "@/lib/store";

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
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-black p-6 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="PHOTO BOOTH fotó" className="max-h-[80dvh] w-full max-w-3xl object-contain" />
      <a
        href={src}
        download={`photobooth-${photo.id}.jpg`}
        className="rounded-full bg-white px-8 py-4 font-semibold tracking-[0.2em] text-black uppercase"
      >
        Letöltés
      </a>
    </div>
  );
}
