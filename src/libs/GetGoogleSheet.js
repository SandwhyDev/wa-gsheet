import { google } from "googleapis";
import fs from "fs";
import path from "path";

const credentials = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../analog-hull-284010-ccea5608e83c.json")
  )
);

// Fungsi untuk mengkonversi data sheet ke JSON dengan format key menggunakan underscore
function convertSheetDataToJson(sheetData) {
  if (!sheetData || sheetData.length === 0) return [];

  // Ambil header dan replace spasi dengan underscore
  const headers = sheetData[0].map((header) =>
    header.toString().replace(/\s+/g, "_")
  );

  // Proses setiap baris data
  return sheetData.slice(1).map((row) => {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index] || null;
      return obj;
    }, {});
  });
}

export const ReadGoogleSheet = async () => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = "1Mmovkn5EuV5pr8WvraA7k4PDqoGwoaUeVGElpHeLPok";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "test", // Nama sheet di spreadsheet Anda
    });

    const values = response.data.values;

    if (!values || values.length === 0) {
      console.log("Tidak ada data ditemukan.");
      return [];
    }

    // Gunakan fungsi convertSheetDataToJson untuk konversi
    const jsonData = convertSheetDataToJson(values);

    return jsonData;
  } catch (err) {
    console.error("Error membaca Google Sheet:", err);
    throw err;
  }
};
