package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/term"
)

const (
	minCols  = 60
	minRows  = 16
	frameDur = 16 * time.Millisecond
)

func main() {
	inFd := int(os.Stdin.Fd())
	outFd := int(os.Stdout.Fd())
	if !term.IsTerminal(inFd) || !term.IsTerminal(outFd) {
		fmt.Fprintln(os.Stderr, "This game must run in a real terminal (TTY).")
		os.Exit(1)
	}
	oldState, err := term.MakeRaw(inFd)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	restore := func() {
		_ = term.Restore(inFd, oldState)
		os.Stdout.WriteString(leaveScreen)
	}
	defer restore()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGTERM, syscall.SIGHUP)
	go func() {
		<-sig
		restore()
		os.Exit(0)
	}()

	keys := make(chan Key, 32)
	startInput(keys)
	os.Stdout.WriteString(enterScreen)

	cols, _, _ := term.GetSize(outFd)
	game := NewGame(cols)
	renderer := NewRenderer()
	last := time.Now()

loop:
	for {
		now := time.Now()
		// Chặn dt lớn (máy lag, laptop sleep) để dino không xuyên vật cản
		dt := now.Sub(last).Seconds()
		if dt > 0.1 {
			dt = 0.1
		}
		last = now

	drain:
		for {
			select {
			case k := <-keys:
				switch k {
				case KeyJump:
					game.JumpKey()
				case KeyDuck:
					game.Duck()
				case KeyRestart:
					if game.State == StateDead {
						game.Reset()
					}
				case KeyPause:
					game.TogglePause()
				case KeyQuit:
					break loop
				}
			default:
				break drain
			}
		}

		cols, rows, _ := term.GetSize(outFd)
		if cols < minCols || rows < minRows {
			renderer.TooSmall(cols, rows)
		} else {
			game.Width = cols
			game.Tick(dt)
			renderer.Frame(game, cols, rows)
		}

		if sleep := frameDur - time.Since(now); sleep > 0 {
			time.Sleep(sleep)
		}
	}
}
