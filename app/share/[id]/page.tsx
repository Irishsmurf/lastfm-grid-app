import type { Metadata, ResolvingMetadata } from 'next';
import type { SharedGridData, MinimizedAlbum } from '@/lib/types'; // Keep types for generateMetadata
import ShareGridClient from '@/app/components/ShareGridClient'; // Corrected import path

// Define Props type for generateMetadata
type GenerateMetadataProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Define Props type for the Page component
type PageProps = {
  params: Promise<{ id: string }>;
};

// Function to generate metadata
export async function generateMetadata(
  { params, searchParams }: GenerateMetadataProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const apiUrl = `${baseUrl}/api/share/${id}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(
        `Error fetching shared data for ID ${id}: ${response.status}`
      );
      return {
        title: 'Shared Grid',
        description: 'Could not load shared grid details.',
        openGraph: {
          title: 'Shared Grid',
          description: 'Could not load shared grid details.',
          images: [
            {
              url: `${baseUrl}/public/icons/icon-512x512.png`,
              width: 512,
              height: 512,
            },
          ],
        },
      };
    }

    const data: SharedGridData = await response.json();

    if (!data || !data.username || !data.albums) {
      console.error(`Incomplete data received for ID ${id}`);
      return {
        title: 'Shared Grid',
        description: 'Shared grid data is incomplete.',
        openGraph: {
          title: 'Shared Grid',
          description: 'Shared grid data is incomplete.',
          images: [
            {
              url: `${baseUrl}/public/icons/icon-512x512.png`,
              width: 512,
              height: 512,
            },
          ],
        },
      };
    }

    const { username, period, createdAt, albums } = data;

    const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const title = `${username}'s Shared Grid`;
    const description = `Check out ${username}'s album grid from ${period}. Generated on ${formattedDate}.`;

    let imageUrl = `${baseUrl}/public/icons/icon-512x512.png`;
    let imageWidth = 512;
    let imageHeight = 512;

    if (albums.length > 0 && albums[0].imageUrl) {
      imageUrl = albums[0].imageUrl;
      imageWidth = 0;
      imageHeight = 0;
    }

    const siteUrl = baseUrl;

    const openGraph = {
      title: title,
      description: description,
      url: `${siteUrl}/share/${id}`,
      images: [
        {
          url: imageUrl,
          ...(imageWidth && imageHeight
            ? { width: imageWidth, height: imageHeight }
            : {}),
        },
      ],
    };

    return {
      title,
      description,
      openGraph,
    };
  } catch (error) {
    console.error(`Failed to generate metadata for ID ${id}:`, error);
    return {
      title: 'Shared Grid',
      description: 'An error occurred while loading shared grid details.',
      openGraph: {
        title: 'Shared Grid',
        description: 'An error occurred while loading shared grid details.',
        images: [
          {
            url: `${baseUrl}/public/icons/icon-512x512.png`,
            width: 512,
            height: 512,
          },
        ],
      },
    };
  }
}

// New Server Component for the page - async to align with PageProps
export default async function SharePage({ params }: PageProps) {
  // const { id } = await params; // id is not explicitly passed to ShareGridClient anymore
  // ShareGridClient will use useParams()
  return <ShareGridClient />;
}
