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

        // Get the video blob
        const videoBlob = await videoResponse.blob();
        const buffer = await videoBlob.arrayBuffer();

        // Generate filename with timestamp
        const timestamp = Date.now();
        const filename = `okvevo-video-${timestamp}.mp4`;

        // Return the video with download headers
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
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
