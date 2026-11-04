import { InvalidLink } from "@/components/portal/portal-view";

// /portal without a token: tell the visitor to use the link from their project manager
export default function PortalIndex() {
  return <InvalidLink />;
}
