import { CollectionsSubnav } from "@/components/collections/collections-subnav";

export default function CollectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-background px-4 py-3 lg:px-6">
        <CollectionsSubnav />
      </div>
      {children}
    </div>
  );
}
