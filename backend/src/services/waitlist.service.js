const pool = require("../db/pool");

const addToWaitlist = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  
  // Basic Gmail check as requested by user
  if (!normalizedEmail.endsWith("@gmail.com")) {
    const error = new Error("Only Gmail addresses are accepted.");
    error.status = 400;
    throw error;
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO waitlist (email)
      VALUES ($1)
      ON CONFLICT (email)
      DO UPDATE SET updated_at = NOW()
      RETURNING *
      `,
      [normalizedEmail]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error adding to waitlist:", error);
    throw error;
  }
};

module.exports = {
  addToWaitlist
};
