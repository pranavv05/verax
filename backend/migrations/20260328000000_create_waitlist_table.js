exports.up = async function up(knex) {
  await knex.schema.createTable("waitlist", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("email", 255).notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique("email");
    table.index(["email"], "idx_waitlist_email");
  });

  // Re-using the existing app.set_updated_at function if it exists
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')) THEN
        CREATE TRIGGER waitlist_set_updated_at
        BEFORE UPDATE ON waitlist
        FOR EACH ROW
        EXECUTE FUNCTION app.set_updated_at();
      END IF;
    END;
    $$;
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP TRIGGER IF EXISTS waitlist_set_updated_at ON waitlist;");
  await knex.schema.dropTableIfExists("waitlist");
};
