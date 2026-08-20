BINARY  = dino-tui
LDFLAGS = -ldflags="-s -w"

.PHONY: build release test clean

# Build cho máy hiện tại
build:
	go build $(LDFLAGS) -o $(BINARY) .

# Build đủ 4 target macOS/Linux, binary static không cần runtime
release:
	GOOS=darwin  GOARCH=arm64 go build $(LDFLAGS) -o $(BINARY)-macos-arm64 .
	GOOS=darwin  GOARCH=amd64 go build $(LDFLAGS) -o $(BINARY)-macos-intel .
	GOOS=linux   GOARCH=amd64 go build $(LDFLAGS) -o $(BINARY)-linux-amd64 .
	GOOS=linux   GOARCH=arm64 go build $(LDFLAGS) -o $(BINARY)-linux-arm64 .

test:
	go vet ./...
	go test ./...

clean:
	rm -f $(BINARY) $(BINARY)-macos-* $(BINARY)-linux-*
