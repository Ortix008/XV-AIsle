import { ListingsView } from "@/components/listings-view";
import { appOrigin } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

export default function Page() {
  return <ListingsView shareOrigin={appOrigin()} />;
}
