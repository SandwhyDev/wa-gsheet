import { Client, LocalAuth } from "whatsapp-web.js";
import LoadEnv from "./LoadENv";
import fs from "fs";
import path from "path";
import qrcode from "qrcode";
import { DeleteSession } from "./DeleteSession";
import { handlePairingCode } from "./WaHelper";
import { GenerateDate } from "./Generate";

LoadEnv();
const SESSION_DIR = path.join(__dirname, "../../.wwebjs_auth");

let client = null;
let isInitializing = false;

// Initialize WhatsApp client
const createClient = () => {
  if (client) {
    client.removeAllListeners();
  }

  return new Client({
    authStrategy: new LocalAuth({
      clientId: "default-client", // Add clientId for multi-device support
      dataPath: SESSION_DIR,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-gpu",
        "--disable-infobars",
        "--window-size=800,600",
      ],
      handleSIGINT: false, // Prevent automatic browser close
    },
    takeoverOnConflict: false,
    restartOnAuthFail: true,
  });
};

// Main initialization function
export const initializeWaBot = async (PairCode = null, nomor) => {
  if (isInitializing) {
    return { success: false, msg: "Initialization already in progress" };
  }

  isInitializing = true;

  try {
    // Clean up previous client if exists
    if (client) {
      client.removeAllListeners();
      try {
        await client.destroy();
      } catch (e) {
        // await HandleTelegrambot(`Error destroying previous client: ${e}`);
      }
    }

    client = createClient();
    client.setMaxListeners(20);

    return new Promise((resolve, reject) => {
      // Setup event listeners
      const cleanupListeners = () => {
        client.removeAllListeners("qr");
        client.removeAllListeners("authenticated");
        client.removeAllListeners("ready");
        client.removeAllListeners("auth_failure");
        client.removeAllListeners("disconnected");
      };

      const Pairing = async (qr) => {
        try {
          if (!nomor) {
            resolve({
              success: false,
              msg: "Belum login, Nomor tidak boleh kosong",
            });
          }

          var result;
          const code = await handlePairingCode(client, nomor);
          if (!code.success) {
            resolve({
              success: false,
              msg: "Belum login, Nomor tidak boleh kosong",
            });
          } else {
            result = code;
          }

          resolve({ success: true, data: result });
        } catch (error) {
          throw error;
        } finally {
          cleanupListeners();
        }
      };

      const onAuthenticated = async () => {
        // await HandleTelegrambot("WA bot authenticated");
        cleanupListeners();
        resolve({ success: true, status: "AUTHENTICATED" });
      };

      const onReady = async () => {
        // await HandleTelegrambot("WA bot ready");
        cleanupListeners();
        resolve({ success: true, status: "READY" });
      };

      const onAuthFailure = async (msg) => {
        // await HandleTelegrambot(`WA bot auth failed: ${msg}`);
        cleanupListeners();
        reject(new Error(`Authentication failed: ${msg}`));
      };

      const onDisconnected = async (reason) => {
        // await HandleTelegrambot(`WA bot disconnected: ${reason}`);
        await DeleteSession();
        cleanupListeners();
        reject(new Error(`Disconnected: ${reason}`));
      };

      // Attach listeners once to prevent multiple triggers
      client.once("qr", Pairing);
      client.once("authenticated", onAuthenticated);
      client.once("ready", onReady);
      client.once("auth_failure", onAuthFailure);
      client.once("disconnected", onDisconnected);

      // Initialize client
      client.initialize().catch((err) => {
        cleanupListeners();
        reject(err);
      });
    });
  } catch (error) {
    return { success: false, msg: error.message };
  } finally {
    isInitializing = false;
  }
};

export const CekLogin = async (PairCode = false, nomor) => {
  try {
    const sessionExists = fs.existsSync(path.join(SESSION_DIR, "session"));

    if (!sessionExists) {
      const init = await initializeWaBot(PairCode, nomor);

      return init;
    }

    return { success: true, status: "SESSION_EXISTS" };
  } catch (error) {
    console.error("Error checking login status:", error);
    return { success: false, msg: error.message };
  }
};

export const logoutWhatsApp = async () => {
  try {
    if (!client) {
      return { success: false, message: "Client not initialized" };
    }

    // Logout from WhatsApp
    await client.logout();

    // Destroy the client
    await client.destroy();
    client = null;

    // Delete session data
    await DeleteSession();

    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    // Force cleanup if normal logout fails
    try {
      if (client) {
        await client.destroy();
        client = null;
      }
      await DeleteSession();
    } catch (cleanupError) {
      // console.error("Cleanup error:", cleanupError);
    }

    return {
      success: false,
      message: "Client not initialized or not connected",
    };
  }
};

export const SendMessageWaBot = async (number, message) => {
  try {
    let result;
    let phone_number;

    // Cek jika number sudah mengandung '@c.us'
    if (number.includes("@c.us")) {
      phone_number = number;
    } else {
      // Bersihkan nomor dari karakter non-digit
      const cleanedNumber = number.replace(/\D/g, "");

      // Tambahkan kode negara jika belum ada
      let formattedNumber;
      if (cleanedNumber.startsWith("0")) {
        // Jika mulai dengan 0, ganti dengan 62
        formattedNumber = "62" + cleanedNumber.substring(1);
      } else if (
        !cleanedNumber.startsWith("62") &&
        !cleanedNumber.startsWith("+")
      ) {
        // Jika tidak ada kode negara sama sekali, tambahkan 62
        formattedNumber = "62" + cleanedNumber;
      } else {
        // Jika sudah ada kode negara, gunakan langsung
        formattedNumber = cleanedNumber;
      }

      phone_number = formattedNumber + "@c.us";
    }

    if (!client?.info?.wid) {
      return {
        success: false,
        message: "Client is not ready yet",
      };
    }

    const isRegistered = await client.isRegisteredUser(phone_number);
    // console.log("number ", isRegistered);

    if (!isRegistered) {
      return {
        success: false,
        message: "Nomor tidak terdaftar di WhatsApp",
      };
    }

    const chat = await client.getChatById(phone_number);

    // Set status "typing"
    await chat.sendStateTyping();

    // Tunggu 5 detik
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Kirim pesan dan timeout jika lebih dari 30 detik
    const sendPromise = client.sendMessage(phone_number, message);
    await chat.clearState();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Send message timeout")), 30000)
    );

    result = await Promise.race([sendPromise, timeoutPromise]);

    // Tambahkan pengecekan ACK untuk memastikan pesan terkirim
    const ackPromise = new Promise((resolve, reject) => {
      // Timeout untuk ACK
      const ackTimeout = setTimeout(() => {
        // reject(new Error("ACK timeout - message not delivered"));
      }, 30000);

      // Listener untuk ACK
      client.once("message_ack", (msg, ack) => {
        if (msg.id.id === result.id.id) {
          clearTimeout(ackTimeout);
          if (ack >= 1) {
            // ACK.SENT (1) atau lebih tinggi
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
    });

    // Tunggu konfirmasi ACK
    const ack = await ackPromise;

    return {
      success: true,
      message: "berhasil terkirim",
      result: ack,
    };
  } catch (error) {
    // console.error("SendMessageWaBot Error:", error);

    // Check if the error is specifically about serialization
    if (
      error.message.includes("serialize") ||
      error.stack.includes("serialize")
    ) {
      // The message might have actually been sent despite the error
      return {
        success: true,
        message: "Message likely sent despite serialization error",
        error: error.message,
      };
    }

    return {
      success: false,
      message: error.message,
    };
  }
};

export const getWhatsAppInfo = async () => {
  if (!client || !client.info) {
    return {
      success: false,
      message: "Client not initialized or not connected",
      status: "DISCONNECTED",
    };
  }

  try {
    // Get basic client info
    const info = {
      success: true,
      status: "CONNECTED",
      message: {
        phone: {
          number: client.info.wid.user,
          platform: client.info.platform,
          isBusiness: client.info.isBusiness,
          isEnterprise: client.info.isEnterprise,
        },
        pushname: client.info.pushname,
        wid: client.info.wid._serialized,
        connected: client.info.connected,
        lastSeen: client.info.lastSeen,
      },
    };

    // Try to get profile picture
    try {
      info.profile = await client.getProfilePictureUrl(client.info.wid);
    } catch (e) {
      info.profile = "Not available";
    }

    // Add business info if it's a business account
    if (client.info.isBusiness) {
      try {
        info.businessProfile = await client.getBusinessProfile(client.info.wid);
      } catch (e) {
        info.businessProfile = "Not available";
      }
    }

    return info;
  } catch (error) {
    // console.error("Error getting WhatsApp info:", error);
    return {
      success: false,
      message: error.message,
      status: "ERROR",
    };
  }
};
