// scripts/test-post.ts
import "dotenv/config";

const MOLTBOOK_API = "https://www.moltbook.com/api/v1";
const API_KEY = process.env.MOLTBOOK_API_KEY;
const SUBMOLT = process.env.SUBMOLT || "tokenarena";

if (!API_KEY) {
    console.error("❌ MOLTBOOK_API_KEY not set");
    process.exit(1);
}

async function testPost() {
    console.log("🧪 Testing post to Moltbook...\n");

    const res = await fetch(`${MOLTBOOK_API}/posts`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            title: "🧪 TEST POST - Arena Coming Soon",
            content: "This is a test from OpenClaw Arena.\n\nToken battles starting soon!\n\n_This post will be deleted._",
            submolt: SUBMOLT
        })
    });

    if (!res.ok) {
        const error = await res.text();
        console.error(`❌ Post failed: ${res.status}`);
        console.error(error);
        process.exit(1);
    }

    const data = await res.json();
    console.log("✅ Test post successful!\n");
    console.log(`📝 Post ID: ${data.id}`);
    console.log(`🔗 URL: https://moltbook.com/post/${data.id}`);
    console.log("\n✅ Everything works! Run 'npm start' to begin battles.");
}

testPost().catch(console.error);
