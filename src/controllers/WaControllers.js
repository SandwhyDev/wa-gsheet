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
import { DataPesan } from "../../public/constant/data";

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

    // Destructure dari req.body dengan fallback ke DataPesan
    const {
      message: customMessage = DataPesan.message,
      limit: maxRecipients = DataPesan.limit || null,
      batch_size: batchSize = DataPesan.batch_size || 20,
      delay_between_messages:
        messagedelayMinutes = DataPesan.delay_between_messages || {
          min: 1,
          max: 3,
        },
      delay_between_batches:
        batchDelayMinutes = DataPesan.delay_between_batches || {
          min: 10,
          max: 15,
        },
    } = req.body;

    // Validasi input
    if (batchSize <= 0) {
      return res.status(400).json({
        success: false,
        error: "Batch size harus lebih besar dari 0",
      });
    }

    if (maxRecipients !== null && maxRecipients <= 0) {
      return res.status(400).json({
        success: false,
        error: "Limit recipients harus lebih besar dari 0",
      });
    }

    // Fungsi untuk menangani pengiriman pesan di background
    async function sendMessagesInBackground(participants) {
      let eligibleParticipants = participants
        .map((participant, originalIndex) => ({
          ...participant,
          originalIndex,
        }))
        .filter(
          (participant) => participant.no_hp && participant.status === null
        );

      // Batasi jumlah penerima jika maxRecipients ditentukan
      if (maxRecipients && maxRecipients > 0) {
        eligibleParticipants = eligibleParticipants.slice(0, maxRecipients);
        console.log(
          `Dibatasi hanya ${maxRecipients} penerima dari ${
            participants.filter((p) => p.no_hp && p.status === null).length
          } data yang memenuhi syarat`
        );
      }

      const totalMessages = eligibleParticipants.length;
      const totalBatch = Math.ceil(totalMessages / batchSize);

      console.log(`Total pesan yang akan dikirim: ${totalMessages}`);
      console.log(`Total batch: ${totalBatch}`);
      console.log(`Ukuran batch: ${batchSize}`);

      for (const [index, participant] of eligibleParticipants.entries()) {
        try {
          const currentBatch = Math.floor(index / batchSize) + 1; // Batch saat ini

          const phoneNumber = participant.no_hp.replace(/^0/, "62");
          participant.nama = kapitalSetiapKata(participant.nama);

          // Gunakan pesan custom atau pesan default
          let finalMessage;
          if (customMessage) {
            // Replace placeholder dengan data participant
            finalMessage = customMessage
              .replace(/\{nama\}/g, participant.nama)
              .replace(/\{no_hp\}/g, participant.no_hp)
              .replace(/\{index\}/g, index + 1)
              .replace(/\{kelas\}/g, participant.kelas || "N/A")
              .replace(/\{link_qr\}/g, participant.link_qr || "N/A");
          } else {
            // Pesan default
            finalMessage = `
${index + 1}. Hi ${participant.nama},


            `.trim();
          }

          const send = await SendMessageWaBot(phoneNumber, finalMessage);

          console.log("cek send : ", send);

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
            if ((index + 1) % batchSize === 0) {
              // Delay antar batch
              const delayMin = batchDelayMinutes.min || 10;
              const delayMax = batchDelayMinutes.max || 15;
              const randomBatchDelay =
                Math.floor(Math.random() * (delayMax - delayMin + 1)) +
                delayMin;
              const batchDelayMs = randomBatchDelay * 60000;
              console.log(
                `✅ Batch ${currentBatch} selesai. Menunggu ${randomBatchDelay} menit sebelum lanjut ke batch berikutnya...`
              );
              await delay(batchDelayMs);
            } else {
              // Delay antar pesan
              const delayMin = messagedelayMinutes.min || 1;
              const delayMax = messagedelayMinutes.max || 3;
              const randomMessageDelay =
                Math.floor(Math.random() * (delayMax - delayMin + 1)) +
                delayMin;
              const delayTime = randomMessageDelay * 60000;
              console.log(`Menunggu ${randomMessageDelay} menit...`);
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

    // Langsung kembalikan response dengan info konfigurasi
    res.status(200).json({
      success: true,
      message: "Proses pengiriman pesan sedang berjalan",
      configuration: {
        total_data: test?.length || 0,
        limit_recipients: maxRecipients,
        batch_size: batchSize,
        estimated_batches: maxRecipients
          ? Math.ceil(
              Math.min(
                maxRecipients,
                test?.filter((p) => p.no_hp && p.status === null).length || 0
              ) / batchSize
            )
          : Math.ceil(
              (test?.filter((p) => p.no_hp && p.status === null).length || 0) /
                batchSize
            ),
        delay_between_messages: `${messagedelayMinutes.min}-${messagedelayMinutes.max} menit`,
        delay_between_batches: `${batchDelayMinutes.min}-${batchDelayMinutes.max} menit`,
        custom_message: customMessage ? "Ya" : "Default",
      },
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
