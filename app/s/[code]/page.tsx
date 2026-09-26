import { PullShare } from "@/components/share/PullShare";

export default async function SharePullPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PullShare code={code.toUpperCase()} />;
}
