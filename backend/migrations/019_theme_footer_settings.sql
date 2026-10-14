INSERT INTO settings (key, value) VALUES ('theme_footer_description', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('theme_contact_email', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('theme_instagram_url', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('theme_extra_links', '') ON CONFLICT (key) DO NOTHING;
