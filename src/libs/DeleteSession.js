import fs from "fs";
import path from "path";

export const DeleteSession = async () => {
  try {
    const pathsToDelete = [
      path.join(__dirname, "../../.wwebjs_auth"),
      path.join(__dirname, "../../.wwebjs_cache"),
    ];

    for (const folderPath of pathsToDelete) {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
        // console.log(`Deleted folder: ${folderPath}`);
      }
    }
    return true;
  } catch (error) {
    // console.error("Error deleting session:", error);
    return false;
  }
};
