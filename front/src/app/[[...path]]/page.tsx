import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const [section = "home", id] = path;
  if (
    !["home", "feed", "map", "report", "my", "post"].includes(section) ||
    path.length > 2 ||
    (section === "post" && !id) ||
    (["home", "report", "my"].includes(section) && id)
  )
    notFound();
  return null;
}
