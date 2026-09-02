import AuthExperience from "./AuthExperience";

export default function AuthPage({
  searchParams,
}: {
  searchParams: { mode?: string | string[] };
}) {
  const mode = searchParams.mode === "signup" ? "signup" : "signin";

  return <AuthExperience key={mode} initialMode={mode} />;
}
