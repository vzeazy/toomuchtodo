UPDATE schema_meta
SET latest_schema = 2,
    min_supported_client_schema = 2,
    updated_at = unixepoch() * 1000
WHERE id = 1;
