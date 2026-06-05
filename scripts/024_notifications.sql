-- Migration 024: In-app notifications table
-- Run in Supabase SQL editor

CREATE TABLE notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            text        NOT NULL,
  title           text        NOT NULL,
  body            text,
  link            text,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON notifications(recipient_id, read_at);
CREATE INDEX ON notifications(organization_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid());

CREATE POLICY "Service role insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);
