const { createClient } = require("@supabase/supabase-js");

async function connectDB() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required in the project root .env file.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("patients").select("id").limit(1);

    if (error) {
        throw error;
    }

    console.log("Supabase connected successfully");
    return supabase;
}

module.exports = connectDB;