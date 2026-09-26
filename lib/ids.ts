import { customAlphabet } from "nanoid";

const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tokenAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const createRoomCode = customAlphabet(roomAlphabet, 6);
export const createId = customAlphabet(tokenAlphabet, 21);
export const createToken = customAlphabet(tokenAlphabet, 24);
