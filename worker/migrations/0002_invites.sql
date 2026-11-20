CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  max_uses INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 1000),
  used INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL
);

ALTER TABLE accounts ADD COLUMN invite_code TEXT REFERENCES invites(code);

CREATE TRIGGER consume_registration_invite
AFTER INSERT ON accounts
WHEN NEW.invite_code IS NOT NULL
BEGIN
  UPDATE invites SET used = used + 1 WHERE code = NEW.invite_code;
END;
