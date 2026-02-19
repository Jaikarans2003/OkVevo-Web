const fs = require('fs');
const path = require('path');

// Path to your service account file
// Adjust this if your file is named differently or in a different location
const filePath = process.argv[2] || 'c:\\Users\\hrudh\\Downloads\\service-account.json';

console.log(`Reading file: ${filePath}`);

try {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const rawContent = fs.readFileSync(filePath, 'utf8');

    // Parse it to ensure it's valid JSON and remove formatting
    const jsonParams = JSON.parse(rawContent);

    // Re-stringify to compact (remove newlines stuff)
    const compactedJson = JSON.stringify(jsonParams);

    // Encode to Base64
    const base64Key = Buffer.from(compactedJson).toString('base64');

    console.log('\n✅ Success! valid JSON parsed and encoded.\n');
    console.log('COPY THE STRING BELOW (without extra spaces) AND PASTE INTO AWS ENV VAR:');
    console.log('================================================================');
    console.log(base64Key);
    console.log('================================================================');

} catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes('JSON')) {
        console.error('The service-account.json file contains invalid JSON.');
    }
}
