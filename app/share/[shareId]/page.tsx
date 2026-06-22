import { PublicWelcome } from "@/components/PublicWelcome";

export default function PublicShareWelcomePage({ params }: { params: { shareId: string } }) {
  return <PublicWelcome shareId={params.shareId} />;
}
