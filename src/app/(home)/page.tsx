import { JoinScreen } from "@/components/home-screen";
import { AccountProvider } from "@/lib/account-store";

export default function Page() {
  return (
    <AccountProvider>
      <JoinScreen />
    </AccountProvider>
  );
}
