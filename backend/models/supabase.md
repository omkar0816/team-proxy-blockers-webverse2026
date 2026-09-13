# Supabase Migration Guide

This project has been migrated from MongoDB to Supabase (PostgreSQL).

## Setup Instructions

### 1. Create a Supabase Project
- Visit [https://supabase.com](https://supabase.com)
- Sign up or log in
- Create a new project
- Note your **Project URL** and **Anon Key** from the API settings

### 2. Create Database Tables

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL DEFAULT 'Elderly Resident',
  age INTEGER DEFAULT 74,
  region VARCHAR(255) DEFAULT 'Assam / North East India',
  caregiver_name VARCHAR(255) DEFAULT 'Family Caregiver',
  caregiver_phone VARCHAR(20) DEFAULT '+91 9876543210',
  preferred_language VARCHAR(50) DEFAULT 'English',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create game_scores table
CREATE TABLE game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  game_type VARCHAR(255) DEFAULT 'Memory Recall - Cultural Pairs',
  score INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  difficulty_level INTEGER DEFAULT 1,
  ai_spoken_message TEXT DEFAULT '',
  ai_clinical_observation TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX game_scores_patient_id_idx ON game_scores(patient_id);
CREATE INDEX game_scores_created_at_idx ON game_scores(created_at DESC);
```

### 3. Set Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
GEMINI_API_KEY=your-gemini-api-key-here
PORT=5000
```

Replace:
- `your-project-id` with your actual Supabase project ID
- `your-anon-key-here` with your Supabase Anon Key
- `your-gemini-api-key-here` with your Google Gemini API key

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Server

```bash
npm start
```

The server will be running at `http://localhost:5000`

## Key Changes from MongoDB

1. **Database**: PostgreSQL (via Supabase) instead of MongoDB
2. **Client Library**: `@supabase/supabase-js` instead of Mongoose
3. **Schema**: Tables instead of Mongoose models
   - `patients` table instead of Patient model
   - `game_scores` table instead of GameScore model
4. **IDs**: UUID instead of MongoDB ObjectId (automatically generated)
5. **API Response Format**: Transformed to maintain frontend compatibility

## Database Schema

### patients table
- `id` (UUID): Primary key
- `name` (VARCHAR): Patient's name
- `age` (INTEGER): Patient's age
- `region` (VARCHAR): Geographic region
- `caregiver_name` (VARCHAR): Caregiver's name
- `caregiver_phone` (VARCHAR): Caregiver's phone number
- `preferred_language` (VARCHAR): Language preference
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

### game_scores table
- `id` (UUID): Primary key
- `patient_id` (UUID): Foreign key to patients table
- `game_type` (VARCHAR): Type of game/activity
- `score` (INTEGER): Score achieved
- `attempts` (INTEGER): Number of attempts
- `difficulty_level` (INTEGER): Difficulty level
- `ai_spoken_message` (TEXT): AI message for the patient
- `ai_clinical_observation` (TEXT): Observation for caregiver
- `created_at` (TIMESTAMP): Creation timestamp

## API Endpoints (Unchanged)

All API endpoints remain the same:
- `GET /api/patient` - Fetch or create patient
- `POST /api/scores` - Submit a score
- `GET /api/scores/:patientId` - Get score history

## Notes

- The frontend code (`public/app.js`) requires no changes
- The server maintains backward compatibility by transforming snake_case database fields to camelCase in responses
- All validation logic remains the same
- Google Gemini AI integration is preserved
