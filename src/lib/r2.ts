import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.R2_ENDPOINT) {
    console.warn("R2_ENDPOINT is not defined in environment variables.");
}

export const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});
