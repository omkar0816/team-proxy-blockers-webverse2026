const { createServerClient } = require("@supabase/ssr");
const { parse, serialize } = require("cookie");

function createClient(req, res) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase environment variables are missing.");
    }

    return createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return Object.entries(parse(req.headers.cookie || "")).map(([name, value]) => ({ name, value }));
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    res.append("Set-Cookie", serialize(name, value, { ...options, path: options?.path || "/" }));
                });
            }
        }
    });
}

module.exports = { createClient };