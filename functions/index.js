const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();

// Enable CORS for all requests
app.use(cors({ origin: true }));

// Middleware to parse JSON body
app.use(express.json());

// Replicate API Proxy
app.all("*", async (req, res) => {
    // Get token from Firebase Config or Environment
    // Priority: Environment variable > Firebase config > Default
    const apiToken = process.env.REPLICATE_API_TOKEN || 
                     (functions.config().replicate && functions.config().replicate.token) ||
                     "r8_GfTTd9urXq1PAMzGsc2MkMzmQoWF2qz4OIRno"; // Fallback to the token from .env

    if (!apiToken) {
        console.error("Missing REPLICATE_API_TOKEN configuration");
        res.status(500).send({ 
            error: "Server configuration error", 
            details: "Missing API Token. Please configure REPLICATE_API_TOKEN in Firebase Functions config or environment variables." 
        });
        return;
    }

    // Strip '/api/replicate' from the path to get the target path on Replicate API
    // Incoming request: /api/replicate/predictions -> /predictions
    const targetPath = req.path.replace(/^\/api\/replicate/, "") || req.path;
    const targetUrl = `https://api.replicate.com/v1${targetPath}`;

    console.log(`Proxying request to: ${targetUrl} [${req.method}]`);
    console.log(`Using API token: ${apiToken.substring(0, 8)}...`);

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Token ${apiToken}`,
                // Forward other relevant headers if needed, but exclude Host
            },
            body: req.method === "POST" || req.method === "PUT" ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();
        
        console.log(`Response status: ${response.status}`);
        console.log(`Response data:`, data);

        // Forward status code
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).json({ 
            error: "Failed to proxy request", 
            details: error.message,
            url: targetUrl,
            method: req.method
        });
    }
});

exports.replicateProxy = functions.https.onRequest(app);
