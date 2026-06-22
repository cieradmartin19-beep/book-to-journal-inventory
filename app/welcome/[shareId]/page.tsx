import { PublicWelcome } from "@/components/PublicWelcome";

export default function SharedWelcomePage({ params }: { params: { shareId: string } }) {
  return <PublicWelcome shareId={params.shareId} />;
}
