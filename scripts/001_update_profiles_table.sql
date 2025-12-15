-- Update profiles table to support Discord profile caching
-- Add unique constraint on discord_id if not exists
ALTER TABLE profiles 
ADD CONSTRAINT profiles_discord_id_unique UNIQUE (discord_id);

-- Update RLS policies to allow public read for cached profiles
DROP POLICY IF EXISTS "Public can read cached profiles" ON profiles;
CREATE POLICY "Public can read cached profiles" 
ON profiles FOR SELECT 
USING (discord_id IS NOT NULL);

-- Update RLS policies to allow upsert for caching
DROP POLICY IF EXISTS "Service can upsert profiles" ON profiles;
CREATE POLICY "Service can upsert profiles" 
ON profiles FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update profiles" ON profiles;
CREATE POLICY "Service can update profiles" 
ON profiles FOR UPDATE 
USING (true);
