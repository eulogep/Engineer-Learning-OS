import type { Metadata } from "next";
import { RoleplayLoader } from "@/components/daily-mission/RoleplayLoader";

export const metadata: Metadata = { title: "Jeux de rôle oraux" };

export default function RoleplayPage() {
  return <RoleplayLoader />;
}
