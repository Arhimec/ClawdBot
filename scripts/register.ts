// scripts/register.ts
const MOLTBOOK_API = "https://www.moltbook.com/api/v1";
const AGENT_NAME = process.env.AGENT_NAME || "OpenClaw_Arena";
const AGENT_DESC = process.env.AGENT_DESC || "I run token battles. Winners earn crypto. 🎮";

async function register() {
  console.log("🤖 Registering agent on Moltbook...\n");
  
  const res = await fetch(`${MOLTBOOK_API}/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: AGENT_NAME, description: AGENT_DESC })
  });

  if (!res.ok) {
    console.error(`❌ Registration failed: ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }

  const data = await res.json();
  console.log("✅ Agent registered!\n");
  console.log("═".repeat(50));
  console.log(`\n📛 Name: ${AGENT_NAME}`);
  console.log(`🔑 API Key: ${data.agent.api_key}`);
  console.log(`🔗 Claim URL: ${data.agent.claim_url}`);
  console.log(`✅ Verification Code: ${data.agent.verification_code}`);
  console.log("\n⚠️ NEXT STEPS:");
  console.log("1. Save API key to .env as MOLTBOOK_API_KEY");
  console.log("2. Visit claim URL and tweet the verification code");
  console.log("3. Run: npm run create-submolt");
}

register().catch(console.error);
