import express from "express";

import {
  CekLogin,
  getWhatsAppInfo,
  logoutWhatsApp,
  SendMessageWaBot,
} from "../libs/wa";
import { ReadGoogleSheet } from "../libs/GetGoogleSheet";
import {
  ensureStatusHeader,
  updateSheetStatus,
} from "../libs/UpdateGoogleSheet";

const send_message_controllers = express.Router();

// Objek untuk menyimpan interval ID berdasarkan nomor telepon
const activeIntervals = {};

// cek login
send_message_controllers.post(`/init-wa`, async (req, res) => {
  try {
    const data = await req.body;
    const { code = false } = await req.query;

    if (!data.nomor) throw new Error("nomor harus diisi");

    const nomorInternasional = data.nomor.replace(/^0/, "62");

    const token = await CekLogin(JSON.parse(code), nomorInternasional);
    token.code = JSON.parse(code) ? true : false;

    res.status(201).json({
      success: true,
      message: "berhasil",
      message: token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// create
send_message_controllers.post(`/send-message`, async (req, res) => {
  try {
    const data = await req.body;

    const otp = await SendMessageWaBot(data.phone_number, data.message);

    if (!otp.success) {
      return res.status(500).json({
        success: false,
        message: otp.message,
      });
    }

    res.status(200).json({
      success: true,
      message: otp.message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

send_message_controllers.post(`/disbursement`, async (req, res) => {
  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    function kapitalSetiapKata(str) {
      return str.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    // Fungsi untuk menangani pengiriman pesan di background
    async function sendMessagesInBackground(participants) {
      const eligibleParticipants = participants
        .map((participant, originalIndex) => ({
          ...participant,
          originalIndex,
        }))
        .filter(
          (participant) => participant.no_hp && participant.status === null
        );

      const totalMessages = eligibleParticipants.length;
      const totalBatch = Math.ceil(totalMessages / 20);

      console.log(`Total pesan yang akan dikirim: ${totalMessages}`);
      console.log(`Total batch: ${totalBatch}`);

      for (const [index, participant] of eligibleParticipants.entries()) {
        try {
          const currentBatch = Math.floor(index / 20) + 1; // Batch saat ini

          const phoneNumber = participant.no_hp.replace(/^0/, "62");
          participant.nama = kapitalSetiapKata(participant.nama);

          const message = `
Hi ${participant.nama},

Terima kasih banyak telah membeli tiket Precious Women Conference 2025 – PURE JOY 💛

Kamu akan mengikuti master class ${participant.kelas}

Berikut e-ticket kamu: 

${participant.link_qr}

Silakan tunjukkan e-ticket ini untuk ditukarkan dengan tiket fisik.

📍 Penukaran tiket dapat dilakukan pada:
23 Agustus 2025 di Feast Jakarta Barat atau Feast Jakarta Utara
ATAU langsung pada hari-H, 30 Agustus 2025

Precious Women Conference diadakan pada:
📅 Tanggal: Sabtu, 30 Agustus 2025
⏰ Waktu: 09:00–19:30 WIB
🏛️ Tempat: House of Blessings, Jl. Lingkar Luar Barat No.108, Jakarta Barat 11610

Kami percaya ini akan menjadi awal dari perjalanan pemulihan dan menemukan sukacita sejati di dalam Tuhan Yesus. ✨😍

Sampai jumpa di tanggal 30 Agustus 2025 ya!
#JOYISNOW

📲 Untuk pertanyaan atau info lebih lanjut, hubungi:
Ratna – 0857-1812-0654 / 0815-8006-504
Ferdinand – 0815-2362-2000
Adrian - 082119040648

🔗 Info lengkap acara: https://lojf.id/pwc2025/
📸 Follow kami di Instagram: @preciouswomen_
      `.trim();

          const send = await SendMessageWaBot(phoneNumber, message);

          if (send.success) {
            console.log(
              `[${
                index + 1
              }/${totalMessages}] (Batch ${currentBatch}/${totalBatch}) ✅ Pesan terkirim ke ${
                participant.nama
              }`
            );

            // Update status di Google Sheets jika berhasil
            await updateSheetStatus(participant.originalIndex + 2, "Terkirim");
          } else {
            console.log(
              `[${
                index + 1
              }/${totalMessages}] (Batch ${currentBatch}/${totalBatch}) ❌ Pesan TIDAK terkirim ke ${
                participant.nama
              }`
            );
            //  update status "Gagal" :
            await updateSheetStatus(participant.originalIndex + 2, "Gagal");
          }

          // Penundaan antar pesan
          if (index < totalMessages - 1) {
            if ((index + 1) % 20 === 0) {
              // Delay antar batch (setiap 20 pesan)
              const batchDelayMinutes = Math.floor(Math.random() * 6) + 10; // 10–15 menit
              const batchDelayMs = batchDelayMinutes * 60000;
              console.log(
                `✅ Batch ${currentBatch} selesai. Menunggu ${batchDelayMinutes} menit sebelum lanjut ke batch berikutnya...`
              );
              await delay(batchDelayMs);
            } else {
              // Delay antar pesan: 1–3 menit
              const minuteDelay = Math.floor(Math.random() * 3) + 1;
              const delayTime = minuteDelay * 60000;
              console.log(`Menunggu ${minuteDelay} menit...`);
              await delay(delayTime);
            }
          }
        } catch (error) {
          console.error(`Gagal mengirim ke ${participant.nama}:`, error);
          await delay(30000); // delay jika error
        }
      }
    }

    // Handler utama
    const test = await ReadGoogleSheet();

    // Mulai proses pengiriman di background tanpa menunggu
    if (test?.length > 0) {
      sendMessagesInBackground(test)
        .then(() => {
          console.log("Semua pesan telah selesai dikirim");
        })
        .catch((err) => {
          console.error("Error dalam background process:", err);
        });
    }

    // Langsung kembalikan response
    res.status(200).json({
      success: true,
      message: "Proses pengiriman pesan sedang berjalan",
      total_recipients: test?.length || 0,
      immediate_response: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// logout
send_message_controllers.get(`/logout`, async (req, res) => {
  try {
    const result = await logoutWhatsApp();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

send_message_controllers.get(`/info`, async (req, res) => {
  try {
    const result = await getWhatsAppInfo();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message,
      });
    }

    const sheetData = await ReadGoogleSheet();

    res.status(200).json({
      success: true,
      message: result.message,
      data: sheetData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

send_message_controllers.get(`/get-sheet`, async (req, res) => {
  try {
    const sheetData = await ReadGoogleSheet();

    res.status(200).json({
      success: true,
      message: sheetData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint untuk menghentikan pengiriman pesan berulang
send_message_controllers.post(`/stop-auto-message`, async (req, res) => {
  try {
    const phoneNumber = req.body.phone_number;

    if (activeIntervals[phoneNumber]) {
      clearInterval(activeIntervals[phoneNumber]);
      delete activeIntervals[phoneNumber];
      const otp = await SendMessageWaBot(
        phoneNumber,
        `Pengiriman pesan berulang dihentikan`
      );

      res.status(200).json({
        success: true,
        message: `Pengiriman pesan berulang untuk ${phoneNumber} dihentikan`,
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Tidak ada pengiriman aktif untuk ${phoneNumber}`,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default send_message_controllers;
