import { redirect } from "next/navigation";
import { firstAllowedPath } from "@/lib/auth/paginas-acesso";
import { getCurrentUser } from "@/lib/data/usuario-atual";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(firstAllowedPath(user.paginasAcesso));
}
