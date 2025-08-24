import axios from "axios";

export const http = axios.create({
  timeout: 8000,
  maxBodyLength: 5 * 1024 * 1024
});
