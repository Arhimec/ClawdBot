import "dotenv/config";
import { ethers } from "ethers";

// --- Configuration & Types ---

const CONFIG = {
    MOLTBOOK_API: "https://www.moltbook.com/api/v1",
    API_KEY: process.env.MOLTBOOK_API_KEY!,
    WALLET_KEY: process.env.WALLET_PRIVATE_KEY!,
    TOKEN_ADDRESS: process.env.TOKEN_ADDRESS!,
    SUBMOLT: process.env.SUBMOLT || "tokenarena",
    // Base Mainnet RPC (Fallbacks recommended in production)
    RPC_URL: "https://mainnet.base.org", 
    // Prize amount in Tokens
    PRIZE_AMOUNT: "100" 
};

// Validate Config
const missingKeys = Object.entries(CONFIG).filter(([k, v]) => !v && k !== "SUBMOLT");
if (missingKeys.length > 0) {
    console.error(`❌ CRITICAL: Missing environment variables: ${missingKeys.map(k => k[0]).join(", ")}`);
    process.exit(1);
}

// Interfaces for Type Safety
interface MoltbookPost {
    id: string;
    title: string;
    content: string;
    submolt: string;
}

interface MoltbookComment {
    id: string;
    content: string;
    score: number;
    agent: {
        name: string;
        id: string;
    };
}

// --- Challenges ---
const CHALLENGES = [
    "🔥 FUD BATTLE: Write the most devastating FUD about any token. Most upvoted wins.",
    "⚔️ SHILL WAR: One-liner shill. Make us ape. Most upvoted wins.",
    "💀 ROAST: Roast the agent above you. Most upvoted wins.",
    "🎭 VC LARP: Respond as a VC to 'AI agents that earn tokens.' Most upvoted wins.",
    "📉 COPE POST: Best 'this is actually good for crypto' take. Most upvoted wins.",
    "🦞 CRUSTAFARIAN SERMON: Preach the way of the claw. Most upvoted wins.",
    "🧠 AGI DOOMSDAY: Describe how the world ends, but make it bullish. Most upvoted wins.",
    "🎨 ASCII ART: Draw a crypto meme in ASCII. Most upvoted wins."
];

// --- Helpers ---

/**
 * Wrapper for Moltbook API calls with error handling
 */
async function moltbook<T>(endpoint: string, method = "GET", body?: any): Promise<T> {
    const url = `${CONFIG.MOLTBOOK_API}${endpoint}`;
    const options: RequestInit = {
        method,
        headers: {
            "Authorization": `Bearer ${CONFIG.API_KEY}`,
            "Content-Type": "application/json"
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url, options);
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Moltbook API Error ${res.status}: ${errorText}`);
        }
        return (await res.json()) as T;
    } catch (error) {
        console.error(`❌ API Call Failed [${method} ${endpoint}]:`, error);
        throw error;
    }
}

/**
 * Sends ERC-20 tokens on Base
 */
async function sendPrize(winnerAddress: string, amount: string): Promise<string> {
    try {
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const signer = new ethers.Wallet(CONFIG.WALLET_KEY, provider);
        const tokenContract = new ethers.Contract(CONFIG.TOKEN_ADDRESS, [
            "function transfer(address recipient, uint256 amount) returns (bool)",
            "function balanceOf(address account) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ], signer);

        console.log(`💸 Preparing to send ${amount} tokens to ${winnerAddress}...`);

        // Check Balance
        const decimals = await tokenContract.decimals();
        const amountWei = ethers.parseUnits(amount, decimals);
        const balance = await tokenContract.balanceOf(signer.address);

        if (balance < amountWei) {
            throw new Error(`Insufficient token balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${amount}`);
        }

        // Send Transaction
        const tx = await tokenContract.transfer(winnerAddress, amountWei);
        console.log(`➡️ Tx Sent: ${tx.hash}. Waiting for confirmation...`);
        
        await tx.wait(1); // Wait for 1 block confirmation
        console.log(`✅ Tx Confirmed: ${tx.hash}`);
        
        return tx.hash;
    } catch (error) {
        console.error("❌ Blockchain Transaction Failed:", error);
        throw error;
    }
}

// --- Main Game Loop ---

async function runRound() {
    const roundId = new Date().toISOString().split('T')[1].split('.')[0]; // timestamp HH:MM:SS
    console.log(`\n🔔 [${roundId}] Starting New Arena Round`);

    let postId: string | null = null;

    try {
        // 1. Post Challenge
        const challengeText = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
        console.log(`📝 Selected Challenge: "${challengeText}"`);
        
        const post = await moltbook<MoltbookPost>("/posts", "POST", {
            title: challengeText,
            content: `🏆 ${CONFIG.PRIZE_AMOUNT} tokens to the winner\n\n⏱️ 30 minutes to respond\n🗳 Most upvoted comment wins\n\nInclude your Base wallet in your entry.\n\nLet the agents decide.`,
            submolt: CONFIG.SUBMOLT
        });
        
        postId = post.id;
        console.log(`✅ Post created: ${postId} (m/${post.submolt})`);

        // 2. Wait Period (30 Minutes)
        console.log("⏳ Waiting 30 minutes for entries...");
        // Split wait into chunks so we can log progress or handle shutdown signals
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 60 * 1000)); // 1 minute sleep
        }

        // 3. Fetch & Judge
        console.log("⚖️ Time's up! Fetching results...");
        const comments = await moltbook<MoltbookComment[]>(`/posts/${postId}/comments?sort=top`);
        
        if (!comments || comments.length === 0) {
            console.log("⚠️ No comments found. Skipping payout.");
            await moltbook(`/posts/${postId}/comments`, "POST", {
                content: "No entries received. The arena remains quiet... for now."
            });
            return;
        }

        // Filter for comments with valid EVM addresses
        // Regex: 0x followed by 40 hex chars
        const evmRegex = /0x[a-fA-F0-9]{40}/;
        const validEntries = comments.filter(c => evmRegex.test(c.content));

        if (validEntries.length === 0) {
            console.log("⚠️ No entries with valid wallets found.");
            await moltbook(`/posts/${postId}/comments`, "POST", {
                content: "No valid wallets found in any entries. Prize pool rolls over."
            });
            return;
        }

        const winner = validEntries[0]; // Top sorted result
        const walletAddress = winner.content.match(evmRegex)![0];

        console.log(`🏅 Winner Identified: @${winner.agent.name} (${winner.score} upvotes)`);
        console.log(`💼 Wallet: ${walletAddress}`);

        // 4. Payout
        let txHash = "manual-check-needed";
        try {
            txHash = await sendPrize(walletAddress, CONFIG.PRIZE_AMOUNT);
        } catch (txError) {
            console.error("Failed to send tokens, but announcing winner anyway.");
            await moltbook(`/posts/${postId}/comments`, "POST", {
                content: `🏆 WINNER: @${winner.agent.name}\n\n👑 ${winner.score} upvotes\n⚠️ Token transfer failed (network error). Admin will retry manually.`
            });
            return;
        }

        // 5. Announce Victory
        await moltbook(`/posts/${postId}/comments`, "POST", {
            content: `🏆 WINNER: @${winner.agent.name}\n\n👑 ${winner.score} upvotes\n💰 ${CONFIG.PRIZE_AMOUNT} tokens sent\n🔗 [View on BaseScan](https://basescan.org/tx/${txHash})\n\nThe agents have spoken.`
        });
        
        console.log(`🎉 Round [${roundId}] Complete!`);

    } catch (error) {
        console.error(`❌ Round [${roundId}] Crashed:`, error);
        // If we posted but crashed before finishing, try to leave a "technical difficulties" comment
        if (postId) {
            try {
                await moltbook(`/posts/${postId}/comments`, "POST", {
                    content: "⚠️ Arena Maintenance: Judge bot encountered an error. Round under review."
                });
            } catch (e) { /* ignore secondary error */ }
        }
    }
}

// --- Execution ---

// Run immediately on startup
runRound();

// Then run every 60 minutes
// Note: Railway restarts often, so this interval keeps it alive if the container stays up
setInterval(runRound, 60 * 60 * 1000);

// Handle graceful shutdown from Railway/Docker
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});
