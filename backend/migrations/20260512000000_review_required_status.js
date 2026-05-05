exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TYPE document_status_enum ADD VALUE IF NOT EXISTS 'review_required';
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    UPDATE documents
    SET status = 'extracted'
    WHERE status = 'review_required';

    ALTER TYPE document_status_enum RENAME TO document_status_enum_old;
    CREATE TYPE document_status_enum AS ENUM ('uploaded', 'processing', 'extracted', 'reviewed', 'exported');

    ALTER TABLE documents
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE document_status_enum
        USING status::text::document_status_enum,
      ALTER COLUMN status SET DEFAULT 'uploaded';

    DROP TYPE document_status_enum_old;
  `);
};
