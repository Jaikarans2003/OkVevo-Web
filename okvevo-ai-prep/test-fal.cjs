const { fal } = require('@fal-ai/client');
fal.config({ credentials: '87a072b0-fc7d-40fe-b96c-dd9979ea8d3a:9ab79d052e639e31eaecc553a6ed2c15' });
async function check() {
    try {
        const res = await fal.queue.status('resemble-ai/chatterboxhd/text-to-speech', {
            requestId: '019d1ea1-0d0b-7480-add8-d3f8506a14ec',
            logs: true
        });
        console.log("STATUS:", res.status);
        if (res.error) console.log("ERROR:", res.error);
        if (res.payload) console.log("PAYLOAD:", res.payload);
        const logs = res.logs || [];
        for (const l of logs) if(l.message && l.message.includes('rror')||l.message.includes('xception')||l.message.includes('ampling')) console.log("LOG:", l.message);
    } catch(err) {
        console.error("EXCEPTION:", err.message);
    }
}
check();
