import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const lambdaUrl = process.env.NEXT_PUBLIC_LAMBDA_STITCH_URL;

        if (!lambdaUrl) {
            return NextResponse.json(
                { success: false, error: 'Lambda URL not configured' },
                { status: 500 }
            );
        }

        console.log('Proxying to Lambda:', lambdaUrl);

        const response = await fetch(lambdaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const responseText = await response.text();
        console.log(`Lambda response status: ${response.status}`);
        console.log(`Lambda response body:`, responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse Lambda response as JSON');
            return NextResponse.json({
                success: false,
                error: `Lambda error: ${responseText.substring(0, 300)}`
            }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
