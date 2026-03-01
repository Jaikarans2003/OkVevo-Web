const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");

const zip = new AdmZip();

console.log("Adding index.js...");
zip.addLocalFile("index.js");

console.log("Adding package.json...");
zip.addLocalFile("package.json");

console.log("Adding package-lock.json...");
zip.addLocalFile("package-lock.json");

console.log("Adding node_modules...");
zip.addLocalFolder("node_modules", "node_modules");

console.log("Writing lambda-trend-generation.zip...");
zip.writeZip("lambda-trend-generation.zip");

console.log("✅ Zip created successfully.");
