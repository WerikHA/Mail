import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Dashboard will run in demo mode.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * ZimaMail DB Schema Recommendation (Run this in Supabase SQL Editor):
 * 
 * -- Accounts table for routing/auth
 * CREATE TABLE mail_accounts (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   email TEXT UNIQUE NOT NULL,
 *   full_name TEXT,
 *   domain TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   is_active BOOLEAN DEFAULT true
 * );
 * 
 * -- Logs for email activity
 * CREATE TABLE mail_logs (
 *   id BIGSERIAL PRIMARY KEY,
 *   account_id UUID REFERENCES mail_accounts(id),
 *   direction TEXT CHECK (direction IN ('incoming', 'outgoing')),
 *   sender TEXT NOT NULL,
 *   recipient TEXT NOT NULL,
 *   subject TEXT,
 *   status TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 */
