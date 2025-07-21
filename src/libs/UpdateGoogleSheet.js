import { google } from "googleapis";
import fs from "fs";
import path from "path";
import LoadEnv from "./LoadENv";

LoadEnv();

const file = process.env.file_key || "your_file_key_here";
const sheet_id = process.env.sheet_id || "your_file_key_here";

const credentials = JSON.parse(
  fs.readFileSync(path.join(__dirname, `../../${file}`))
);

const spreadsheetId = sheet_id;
const sheetName = "test";

export async function updateSheetStatus(rowNumber, status) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Update column E (5th column) with status
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!E${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[status]],
      },
    });

    console.log(`Updated status for row ${rowNumber} to ${status}`);
    return true;
  } catch (error) {
    console.error("Error updating sheet status:", error);
    throw error;
  }
}

export async function ensureStatusHeader() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Check if status header exists in E1
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!E1`,
    });

    if (!response.data.values || !response.data.values[0]) {
      // Add status header if it doesn't exist
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!E1`,
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [["Status"]],
        },
      });
      console.log("Added Status header to column E");
    }
  } catch (error) {
    console.error("Error ensuring status header:", error);
    throw error;
  }
}
