// components/share-page-skeleton.tsx
import { Card, CardContent } from '@/components/ui/card';

const SharePageSkeleton = () => {
  return (
    <div
      className="min-h-screen bg-background py-12 px-4"
      data-testid="skeleton-container"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header Placeholder */}
        <header className="text-center mb-8 space-y-2">
          <div className="h-4 bg-muted animate-pulse rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-muted animate-pulse rounded w-1/2 mx-auto"></div>
        </header>

        {/* Grid Placeholder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="flex flex-col">
              <CardContent className="p-4">
                <div className="aspect-square bg-muted animate-pulse"></div>
                <div className="mt-2 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SharePageSkeleton;
