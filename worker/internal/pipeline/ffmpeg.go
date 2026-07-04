package pipeline

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
)

// allocateUDPListener grabs an OS-assigned free UDP port on loopback so each
// camera's ffmpeg->pion relay hop gets its own private port, with no fixed
// port to collide across concurrently running cameras.
func allocateUDPListener() (*net.UDPConn, int, error) {
	conn, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0})
	if err != nil {
		return nil, 0, err
	}
	port := conn.LocalAddr().(*net.UDPAddr).Port
	return conn, port, nil
}

// buildWebRTCFfmpegCmd pulls the RTSP stream and re-encodes it to H264/RTP on
// a local UDP port that relayRTP reads from.
func buildWebRTCFfmpegCmd(ctx context.Context, rtspURL string, localPort int) *exec.Cmd {
	dest := fmt.Sprintf("rtp://127.0.0.1:%d?pkt_size=1200", localPort)
	args := []string{
		"-nostdin", "-loglevel", "warning",
		"-rtsp_transport", "tcp",
		"-i", rtspURL,
		"-an",
		"-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
		"-profile:v", "baseline", "-pix_fmt", "yuv420p", "-g", "50",
		"-f", "rtp", dest,
	}
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Stderr = os.Stderr
	return cmd
}

// buildDetectionFfmpegCmd samples the RTSP stream at fps and writes back-to-back
// JPEG frames to stdout for the detection loop to split apart.
func buildDetectionFfmpegCmd(ctx context.Context, rtspURL string, fps int) (*exec.Cmd, io.ReadCloser, error) {
	args := []string{
		"-nostdin", "-loglevel", "warning",
		"-rtsp_transport", "tcp",
		"-i", rtspURL,
		"-vf", fmt.Sprintf("fps=%d", fps),
		"-f", "image2pipe", "-vcodec", "mjpeg",
		"-",
	}
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Stderr = os.Stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, err
	}
	return cmd, stdout, nil
}

// jpegSplitFunc is a bufio.SplitFunc that splits a stream of back-to-back JPEG
// images (as produced by ffmpeg's mjpeg muxer) into individual frames. JPEG's
// entropy-coded scan data byte-stuffs any literal 0xFF byte with a trailing
// 0x00, so a raw 0xFFD9 (EOI) can only ever appear as a genuine end-of-image
// marker, making this a safe frame boundary to split on.
func jpegSplitFunc(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}
	if idx := bytes.Index(data, []byte{0xFF, 0xD9}); idx >= 0 {
		return idx + 2, data[:idx+2], nil
	}
	if atEOF {
		return len(data), data, nil
	}
	return 0, nil, nil
}
