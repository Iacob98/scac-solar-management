-- Add storage_path column to file_storage table for Supabase Storage integration
ALTER TABLE file_storage ADD COLUMN IF NOT EXISTS storage_path VARCHAR;

-- Create the 'files' storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT DO NOTHING;
