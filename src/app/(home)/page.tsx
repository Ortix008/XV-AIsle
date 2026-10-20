import { JoinScreen } from "@/components/home-screen";
import { AccountProvider } from "@/lib/account-store";

const HERO_POSTER = "/brand/hero-aisle-pedestals.webp";

export default function Page() {
  return (
    <>
      <link rel="preload" href={HERO_POSTER} as="image" fetchPriority="high" />
      <AccountProvider>
        <JoinScreen />
      </AccountProvider>
    </>
  );
}
