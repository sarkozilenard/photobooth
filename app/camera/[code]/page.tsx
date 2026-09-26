import { CameraApp } from "@/components/camera/CameraApp";

export default async function CameraPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CameraApp code={code.toUpperCase()} />;
}
