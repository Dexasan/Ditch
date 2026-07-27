import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "./LandingPage";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/home");
  }

  return <LandingPage />;
}