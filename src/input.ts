export type Key = "jump" | "duck" | "restart" | "pause" | "quit";

// Đọc stdin ở raw mode và dịch byte thành key event.
// Ở raw mode Ctrl-C không sinh SIGINT mà đến dưới dạng byte 0x03.
export function startInput(onKey: (key: Key) => void): void {
  Deno.stdin.setRaw(true);
  const buf = new Uint8Array(64);
  let carry = new Uint8Array(0);

  (async () => {
    while (true) {
      const n = await Deno.stdin.read(buf);
      if (n === null) break;
      const bytes = new Uint8Array(carry.length + n);
      bytes.set(carry);
      bytes.set(buf.subarray(0, n), carry.length);
      carry = decode(bytes, onKey);
    }
    onKey("quit");
  })().catch(() => onKey("quit"));
}

// Trả về phần đuôi là escape sequence chưa trọn vẹn (bị cắt giữa 2 lần read)
// để ghép vào chunk kế tiếp thay vì đánh rơi phím mũi tên.
function decode(
  bytes: Uint8Array<ArrayBuffer>,
  onKey: (key: Key) => void,
): Uint8Array<ArrayBuffer> {
  for (let i = 0; i < bytes.length; i++) {
    let b = bytes[i];
    if (b >= 0x41 && b <= 0x5a) b |= 0x20; // chấp nhận cả chữ hoa (Caps Lock)
    if (b === 0x03 || b === 0x71) onKey("quit"); // Ctrl-C, q
    else if (b === 0x20 || b === 0x77) onKey("jump"); // space, w
    else if (b === 0x73) onKey("duck"); // s
    else if (b === 0x72) onKey("restart"); // r
    else if (b === 0x70) onKey("pause"); // p
    else if (bytes[i] === 0x1b) {
      if (i + 2 >= bytes.length) return bytes.subarray(i);
      if (bytes[i + 1] === 0x5b) {
        const code = bytes[i + 2];
        if (code === 0x41) onKey("jump"); // mũi tên lên
        else if (code === 0x42) onKey("duck"); // mũi tên xuống
        i += 2;
      }
    }
  }
  return new Uint8Array(0);
}
