import env from "dotenv";

const LoadEnv = () => {
  env.config({
    path: [".env"],
    override: true,
  });
};

export default LoadEnv;
