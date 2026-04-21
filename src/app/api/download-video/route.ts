import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const videoUrl = searchParams.get('url');

        if (!videoUrl) {
            return NextResponse.json(
                { error: 'Video URL is required' },
                { status: 400 }
            );
        }

        // Validate URL is from Firebase Storage
        if (!videoUrl.includes('firebasestorage.googleapis.com') && 
            !videoUrl.includes('storage.googleapis.com')) {
            return NextResponse.json(
                { error: 'Invalid video URL' },
                { status: 400 }
            );
        }

        // Fetch the video from Firebase Storage (server-side, no CORS)
        const videoResponse = await fetch(videoUrl);

        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
        }

        // Get the file blob
        const contentType = videoResponse.headers.get('content-type') || 'application/octet-stream';
        const fileBlob = await videoResponse.blob();
        const buffer = await fileBlob.arrayBuffer();

        // Determine file extension from content type
        const timestamp = Date.now();
        let ext = 'mp4';
        let prefix = 'okvevo-video';
        if (contentType.includes('image/png')) { ext = 'png'; prefix = 'okvevo-thumbnail'; }
        else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) { ext = 'jpg'; prefix = 'okvevo-thumbnail'; }
        else if (contentType.includes('image/webp')) { ext = 'webp'; prefix = 'okvevo-thumbnail'; }
        else if (contentType.includes('image/')) { ext = 'png'; prefix = 'okvevo-thumbnail'; }
        const filename = `${prefix}-${timestamp}.${ext}`;

        // Return the file with download headers
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': buffer.byteLength.toString(),
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Download video error:', error);
        return NextResponse.json(
            { error: 'Failed to download video' },
            { status: 500 }
        );
    }
}
