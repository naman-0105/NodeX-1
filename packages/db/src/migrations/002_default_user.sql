-- Seed default developer user for local development and workflow ownership
INSERT INTO users (id, email, password_hash, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'dev@nodex.local', 'dev_default_hash', 'admin')
ON CONFLICT (id) DO NOTHING;
