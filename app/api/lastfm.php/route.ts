import { getTopAlbums, LastFmAlbum } from "@/lib/lastfmService"; // Assuming @ refers to the root of the project
import sharp from 'sharp';
import fetch from 'node-fetch'; // For fetching album images
import { NextResponse } from 'next/server'; // Using NextResponse for convenience with JSON responses

const TILE_SIZE = 150;
const TEXT_HEIGHT = 45; // Approximate height for text overlay area
const PADDING = 5; // Padding for text within the overlay

async function generateImageGrid(
  albums: LastFmAlbum[],
  cols: number,
  rows: number,
  showInfo: boolean,
  showPlaycount: boolean
): Promise<Buffer | null> {
  if (!albums || albums.length === 0) {
    console.log("No albums provided for image generation.");
    return null;
  }

  const imageWidth = cols * TILE_SIZE;
  const imageHeight = rows * TILE_SIZE;

  let canvas = sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  });

  const compositeOperations = [];

  for (let i = 0; i < Math.min(albums.length, cols * rows); i++) {
    const album = albums[i];
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;

    let imageUrl = album.image.find(img => img.size === 'extralarge')?.['#text'] ||
                   album.image.find(img => img.size === 'large')?.['#text'] ||
                   album.image.find(img => img.size === 'medium')?.['#text'] ||
                   album.image.find(img => img.size !== '')?.['#text'];

    if (!imageUrl) {
      console.warn(`No image URL found for album: ${album.name}. Skipping.`);
      const placeholderSvg = `
        <svg width="${TILE_SIZE}" height="${TILE_SIZE}">
          <rect x="0" y="0" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="#cccccc" />
          <text x="10" y="20" font-family="sans-serif" font-size="12px" fill="black">No Image</text>
        </svg>`;
      compositeOperations.push({ input: Buffer.from(placeholderSvg), top: y, left: x });
      continue;
    }

    try {
      console.log(`Fetching image for ${album.name} from ${imageUrl}`);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.statusText} for ${album.name}`);
      const imageBuffer = await imageResponse.buffer();

      let tileImage = sharp(imageBuffer).resize(TILE_SIZE, TILE_SIZE, { fit: 'cover' });

      if (showInfo) {
        const textElements = [];
        const textYBase = TILE_SIZE - TEXT_HEIGHT + PADDING;
        textElements.push(`<text x="${PADDING}" y="${textYBase + 12}" font-family="sans-serif" font-size="12px" fill="white" font-weight="bold">${escapeXml(album.name)}</text>`);
        textElements.push(`<text x="${PADDING}" y="${textYBase + 24}" font-family="sans-serif" font-size="10px" fill="white">${escapeXml(album.artist.name)}</text>`);
        if (showPlaycount && album.playcount) {
          textElements.push(`<text x="${PADDING}" y="${textYBase + 36}" font-family="sans-serif" font-size="10px" fill="white">${album.playcount} plays</text>`);
        }
        const svgTextOverlay = `
          <svg width="${TILE_SIZE}" height="${TILE_SIZE}">
            <rect x="0" y="${TILE_SIZE - TEXT_HEIGHT}" width="${TILE_SIZE}" height="${TEXT_HEIGHT}" fill="black" fill-opacity="0.6"/>
            ${textElements.join('')}
          </svg>`;
        tileImage = tileImage.composite([{ input: Buffer.from(svgTextOverlay), gravity: 'southwest' }]);
      }

      const processedTileBuffer = await tileImage.png().toBuffer();
      compositeOperations.push({ input: processedTileBuffer, top: y, left: x });

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error processing image";
      console.error(`Error processing image for album ${album.name}: ${message}`);
      const errorSvg = `
        <svg width="${TILE_SIZE}" height="${TILE_SIZE}">
          <rect x="0" y="0" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="#ffdddd" />
          <text x="10" y="20" font-family="sans-serif" font-size="12px" fill="black">Error</text>
          <text x="10" y="35" font-family="sans-serif" font-size="10px" fill="black">${escapeXml(message.substring(0,20))}</text>
        </svg>`;
      compositeOperations.push({ input: Buffer.from(errorSvg), top: y, left: x });
    }
  }

  if (compositeOperations.length > 0) {
    canvas = canvas.composite(compositeOperations);
  }
  return canvas.jpeg().toBuffer();
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user = searchParams.get("user");
  const period = searchParams.get("period") || "7day";
  const cols = parseInt(searchParams.get("cols") || "3", 10);
  const rows = parseInt(searchParams.get("rows") || "3", 10);
  const info = (searchParams.get("info") || "1") === "1";
  const playcount = (searchParams.get("playcount") || "1") === "1";

  // console.log("Parsed parameters:", { user, period, cols, rows, info, playcount }); // Optional: keep for debugging if needed

  if (!user) {
    return NextResponse.json({ error: "Missing 'user' query parameter" }, { status: 400 });
  }

  try {
    const limit = cols * rows;
    // console.log(`Fetching top albums for user: ${user}, period: ${period}, limit: ${limit}`); // Optional: keep for debugging
    const topAlbumsData = await getTopAlbums(user, period, limit);

    if (!topAlbumsData.topalbums || topAlbumsData.topalbums.album.length === 0) {
      return NextResponse.json({ error: "No albums found for this user or parameters." }, { status: 404 });
    }

    // console.log(`Fetched ${topAlbumsData.topalbums.album.length} albums. Generating image...`); // Optional: keep for debugging

    const imageBuffer = await generateImageGrid(topAlbumsData.topalbums.album, cols, rows, info, playcount);

    if (imageBuffer) {
      return new Response(imageBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate", // Cache for 1 day
        },
      });
    } else {
      return NextResponse.json({ error: "Image generation failed or no albums to process." }, { status: 500 });
    }

  } catch (error) {
    console.error("Error in GET handler:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    if (errorMessage.toLowerCase().includes("cannot find module 'sharp'") || errorMessage.toLowerCase().includes("sharp")) {
        console.error("Sharp library might be missing or not installed correctly.");
    }
    return NextResponse.json({ error: `Server error: ${errorMessage}` }, { status: 500 });
  }
}
