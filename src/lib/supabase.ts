import { createClient } from '@supabase/supabase-js';

// Acesso seguro ao ZimaOS Runtime Env ou variáveis de Build
const zimaEnv = (window as any).ZIMA_ENV || {};

const url = zimaEnv.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const key = zimaEnv.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (url && key) ? createClient(url, key) : null;

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
