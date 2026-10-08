"use client";
import { useParams } from "next/navigation";
import IjroNazorat from "@/components/ijro/IjroNazorat";
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <IjroNazorat view="detail" docId={Number(id)} />;
}
