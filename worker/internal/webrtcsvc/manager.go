// Package webrtcsvc implements the worker side of WHEP (WebRTC-HTTP Egress
// Protocol): browsers POST an SDP offer, we return an SDP answer, and video
// flows over the negotiated peer connection. One pion TrackLocal per camera
// fans out to every connected viewer.
package webrtcsvc

import (
	"context"
	"fmt"
	"sync"

	"github.com/pion/webrtc/v4"
)

type Manager struct {
	mu     sync.RWMutex
	tracks map[string]*webrtc.TrackLocalStaticRTP
	api    *webrtc.API
}

func NewManager(publicIP string, udpMin, udpMax uint16) (*Manager, error) {
	se := webrtc.SettingEngine{}
	if publicIP != "" {
		se.SetNAT1To1IPs([]string{publicIP}, webrtc.ICECandidateTypeHost)
	}
	if udpMin > 0 && udpMax > 0 {
		if err := se.SetEphemeralUDPPortRange(udpMin, udpMax); err != nil {
			return nil, fmt.Errorf("set udp port range: %w", err)
		}
	}

	me := &webrtc.MediaEngine{}
	if err := me.RegisterDefaultCodecs(); err != nil {
		return nil, fmt.Errorf("register codecs: %w", err)
	}

	api := webrtc.NewAPI(webrtc.WithMediaEngine(me), webrtc.WithSettingEngine(se))
	return &Manager{tracks: make(map[string]*webrtc.TrackLocalStaticRTP), api: api}, nil
}

// RegisterTrack creates a fresh local track for a camera's current streaming
// run. Callers must Unregister it (with the same pointer) when that run ends.
func (m *Manager) RegisterTrack(cameraID string) (*webrtc.TrackLocalStaticRTP, error) {
	track, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000},
		"video", "camera-"+cameraID,
	)
	if err != nil {
		return nil, err
	}
	m.mu.Lock()
	m.tracks[cameraID] = track
	m.mu.Unlock()
	return track, nil
}

// UnregisterTrack removes the track only if it's still the current one for
// this camera, so a stale shutdown can never clobber a newer run's track.
func (m *Manager) UnregisterTrack(cameraID string, track *webrtc.TrackLocalStaticRTP) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if current, ok := m.tracks[cameraID]; ok && current == track {
		delete(m.tracks, cameraID)
	}
}

// HandleWHEP negotiates a new viewer peer connection against whatever track is
// currently live for cameraID, and returns the SDP answer.
func (m *Manager) HandleWHEP(ctx context.Context, cameraID, offerSDP string) (string, error) {
	m.mu.RLock()
	track, ok := m.tracks[cameraID]
	m.mu.RUnlock()
	if !ok {
		return "", fmt.Errorf("camera %s is not currently streaming", cameraID)
	}

	pc, err := m.api.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}},
	})
	if err != nil {
		return "", fmt.Errorf("new peer connection: %w", err)
	}

	if _, err := pc.AddTrack(track); err != nil {
		_ = pc.Close()
		return "", fmt.Errorf("add track: %w", err)
	}

	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		switch s {
		case webrtc.PeerConnectionStateFailed, webrtc.PeerConnectionStateClosed, webrtc.PeerConnectionStateDisconnected:
			_ = pc.Close()
		}
	})

	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: offerSDP}); err != nil {
		_ = pc.Close()
		return "", fmt.Errorf("set remote description: %w", err)
	}

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		_ = pc.Close()
		return "", fmt.Errorf("create answer: %w", err)
	}

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		_ = pc.Close()
		return "", fmt.Errorf("set local description: %w", err)
	}

	select {
	case <-gatherComplete:
	case <-ctx.Done():
		_ = pc.Close()
		return "", ctx.Err()
	}

	return pc.LocalDescription().SDP, nil
}
