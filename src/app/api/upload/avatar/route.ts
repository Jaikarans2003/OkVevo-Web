import { NextResponse } from "next/server";
import { r2Client } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const uid = formData.get("uid") as string;

        if (!file || !uid) {
            return NextResponse.json({ error: "Missing file or user ID" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileExtension = file.name.split(".").pop();
        const fileName = `${uid}-${Date.now()}.${fileExtension}`;

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `avatars/${fileName}`,
            Body: buffer,
            ContentType: file.type,
        });

        await r2Client.send(command);

        const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/avatars/${fileName}`;

        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        console.error("Error uploading to R2:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
