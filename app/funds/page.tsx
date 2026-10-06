import { redirect } from "next/navigation";
import { routeQuery } from "@/lib/routes";
export default async function Legacy({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { redirect("/catalogue-india" + routeQuery(await searchParams)); }
