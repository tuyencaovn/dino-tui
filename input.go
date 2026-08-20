package main

import "os"

type Key int

const (
	KeyJump Key = iota
	KeyDuck
	KeyRestart
	KeyPause
	KeyQuit
)

// Đọc stdin ở raw mode trong goroutine riêng và dịch byte thành key event.
// Ở raw mode Ctrl-C không sinh SIGINT mà đến dưới dạng byte 0x03.
func startInput(keys chan<- Key) {
	go func() {
		buf := make([]byte, 64)
		var carry []byte
		for {
			n, err := os.Stdin.Read(buf)
			if err != nil {
				keys <- KeyQuit
				return
			}
			data := append(carry, buf[:n]...)
			carry = decode(data, keys)
		}
	}()
}

// Trả về phần đuôi là escape sequence chưa trọn vẹn (bị cắt giữa 2 lần read)
// để ghép vào chunk kế tiếp thay vì đánh rơi phím mũi tên.
func decode(bytes []byte, keys chan<- Key) []byte {
	for i := 0; i < len(bytes); i++ {
		b := bytes[i]
		if b >= 'A' && b <= 'Z' {
			b |= 0x20 // chấp nhận cả chữ hoa (Caps Lock)
		}
		switch {
		case b == 0x03 || b == 'q':
			keys <- KeyQuit
		case b == ' ' || b == 'w':
			keys <- KeyJump
		case b == 's':
			keys <- KeyDuck
		case b == 'r':
			keys <- KeyRestart
		case b == 'p':
			keys <- KeyPause
		case bytes[i] == 0x1b:
			if i+2 >= len(bytes) {
				return append([]byte(nil), bytes[i:]...)
			}
			if bytes[i+1] == '[' {
				switch bytes[i+2] {
				case 'A':
					keys <- KeyJump // mũi tên lên
				case 'B':
					keys <- KeyDuck // mũi tên xuống
				}
				i += 2
			}
		}
	}
	return nil
}
