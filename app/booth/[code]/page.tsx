import { BoothApp } from "@/components/booth/BoothApp";

export default async function BoothPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ local?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;
  return <BoothApp code={code.toUpperCase()} localCamera={query.local === "1"} />;
}
