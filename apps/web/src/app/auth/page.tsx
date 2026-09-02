import AuthExperience from "./AuthExperience";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = (await searchParams).mode === "signup" ? "signup" : "signin";

  return <AuthExperience key={mode} initialMode={mode} />;
}
