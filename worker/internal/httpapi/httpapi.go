// Package httpapi is the worker's small internal HTTP surface: a health check
// and the WHEP endpoint the api proxies browser SDP offers to.
package httpapi

import (
	"context"
	"io"
	"net/http"
	"strings"
	"time"

	"vms-worker/internal/webrtcsvc"
)

func NewMux(manager *webrtcsvc.Manager) *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	mux.HandleFunc("/whep/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		cameraID := strings.TrimPrefix(r.URL.Path, "/whep/")
		if cameraID == "" {
			http.Error(w, "missing camera id", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			http.Error(w, "failed to read offer", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		answer, err := manager.HandleWHEP(ctx, cameraID, string(body))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/sdp")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(answer))
	})

	return mux
}
