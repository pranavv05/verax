const pool = require("./pool");

const setLocalConfig = async (client, key, value) => {
  await client.query("SELECT set_config($1, $2, true)", [key, value ?? ""]);
};

const withTenantTransaction = async (context, handler) => {
  const resolvedContext = typeof context === "function" ? {} : context;
  const resolvedHandler = typeof context === "function" ? context : handler;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setLocalConfig(client, "app.current_firm_id", resolvedContext.firmId ?? "");
    await setLocalConfig(client, "app.current_client_id", resolvedContext.clientId ?? "");
    await setLocalConfig(client, "app.auth_context", resolvedContext.authContext ?? "");
    await setLocalConfig(client, "app.auth_email", resolvedContext.authEmail ?? "");
    await setLocalConfig(client, "app.upload_token", resolvedContext.uploadToken ?? "");
    await setLocalConfig(client, "app.portal_email", resolvedContext.portalEmail ?? "");
    await setLocalConfig(
      client,
      "app.password_reset_token_hash",
      resolvedContext.passwordResetTokenHash ?? ""
    );

    const result = await resolvedHandler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  withTenantTransaction,
  setLocalConfig
};
