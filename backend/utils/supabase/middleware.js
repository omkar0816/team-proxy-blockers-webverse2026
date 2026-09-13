const { createClient } = require("./server");

async function refreshSession(req, res, next) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        return next();
    }

    try {
        const supabase = createClient(req, res);
        await supabase.auth.getUser();
    } catch (error) {
        console.error(`Supabase session refresh failed: ${error.message}`);
    }

    next();
}

module.exports = { refreshSession };