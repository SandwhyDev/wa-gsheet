export const GenerateOtp = async () => {
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += Math.floor(Math.random() * 10); // Menambah angka acak antara 0-9
  }
  return otp;
};

export const GenerateDate = async () => {
  const date = Math.floor(Date.now() / 1000);
  return date;
};
