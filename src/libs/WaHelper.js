export const handlePairingCode = async (client, nomor) => {
  try {
    // Coba pertama dengan pairing code
    const pairingCode = await client.requestPairingCode(nomor);
    if (!pairingCode) throw new Error("Failed to generate pairing code");

    const message = `code: ${
      pairingCode.slice(0, 4) + "-" + pairingCode.slice(4)
    }`;
    return {
      success: true,
      message: message,
    };
  } catch (err) {
    return {
      success: false,
      message: err.message,
    };
  }
};
