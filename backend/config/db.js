const { MongoClient } = require("mongodb");

async function connectDB() {
    try {
        const connectionString = process.env.MONGODB_URI;

        if (!connectionString) {
            const missingUriError = new Error(
                "MONGODB_URI is missing. Add it to the project root .env file."
            );
            missingUriError.code = "MISSING_MONGODB_URI";
            throw missingUriError;
        }

        const client = new MongoClient(connectionString);
        await client.connect();

        console.log("MongoDB connected successfully");

        return client.db("dementia_helper");
    } catch (error) {
        const networkErrors = [
            "ENOTFOUND",
            "ETIMEDOUT",
            "ECONNREFUSED",
            "EHOSTUNREACH"
        ];
        const cause = error.code === "MISSING_MONGODB_URI"
            ? "missing MONGODB_URI in the project root .env file"
            : error.code === 18 || error.codeName === "AuthenticationFailed"
            ? "invalid MongoDB credentials"
            : error.name === "MongoServerSelectionError" || networkErrors.includes(error.code)
                ? "MongoDB Atlas Network Access or DNS/network settings"
                : "MONGODB_URI or another MongoDB configuration setting";

        console.error(`MongoDB connection failed: ${cause}.`);
        throw error;
    }
}

module.exports = connectDB;