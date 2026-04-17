import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ address: string }>;
};

/** Shareable path: `/market/0x…` → home with `?market=` (factory still from env / query). */
export default async function MarketDeepLinkPage({ params }: PageProps) {
  const { address } = await params;
  redirect(`/?market=${encodeURIComponent(address)}`);
}
