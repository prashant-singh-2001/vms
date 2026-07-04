package config

import (
	"os"
	"strconv"
)

type Config struct {
	RedisURL           string
	DetectorURL        string
	HTTPAddr           string
	DedupCooldownSec   int
	MaxEventsPerMin    int
	DetectionSampleFPS int
	WebRTCUDPPortMin   int
	WebRTCUDPPortMax   int
	WebRTCPublicIP     string
}

func Load() Config {
	return Config{
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379"),
		DetectorURL:        getEnv("DETECTOR_URL", "http://localhost:8000"),
		HTTPAddr:           getEnv("HTTP_ADDR", ":8080"),
		DedupCooldownSec:   getEnvInt("DEDUP_COOLDOWN_SEC", 10),
		MaxEventsPerMin:    getEnvInt("MAX_EVENTS_PER_MIN", 6),
		DetectionSampleFPS: getEnvInt("DETECTION_SAMPLE_FPS", 5),
		WebRTCUDPPortMin:   getEnvInt("WEBRTC_UDP_PORT_MIN", 40000),
		WebRTCUDPPortMax:   getEnvInt("WEBRTC_UDP_PORT_MAX", 40100),
		WebRTCPublicIP:     getEnv("WEBRTC_PUBLIC_IP", "127.0.0.1"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
